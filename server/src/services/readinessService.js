/**
 * Readiness Service
 *
 * Source of truth for framework readiness:
 * Framework -> Requirement Categories -> Requirements -> Controls -> workflow items.
 *
 * Linked items contribute SATISFIED, FAILING, or EXCLUDED through centralized
 * readiness predicates before controls roll up to requirements/categories.
 */
import Framework from '../models/Framework.js';
import InternalControl from '../models/InternalControl.js';
import Requirement from '../models/Requirement.js';
import RequirementCategory from '../models/RequirementCategory.js';
import Policy from '../models/Policy.js';
import Test from '../models/Test.js';
import Evidence from '../models/Evidence.js';
import Risk from '../models/Risk.js';
import Organization from '../models/Organization.js';
import OrganizationFrameworkReadiness from '../models/OrganizationFrameworkReadiness.js';
import { evaluateControlSatisfaction } from '../utils/readinessPredicates.js';

export function evaluateControl({ control, policies, tests, evidence, risks, config }) {
  return evaluateControlSatisfaction(control, { policies, tests, evidence, risks }, config);
}

function byControlId(items, field) {
  const map = new Map();
  for (const item of items) {
    for (const id of item[field] || []) {
      const key = String(id);
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    }
  }
  return map;
}

/**
 * Control workflow overlays -> requirement rollup -> category rollup -> framework readiness.
 *
 * A requirement passes only when it has at least one mapped control and every mapped
 * control passes. A category passes only when every active requirement in it passes.
 * A framework is ready only when every active category passes.
 */
export async function getFrameworkReadinessWithWorkflowOverlay(organizationId, frameworkCode) {
  const framework = await Framework.findOne({
    code: frameworkCode.toUpperCase(),
    isActive: true,
  }).lean();

  if (!framework) {
    const err = new Error(`Framework '${frameworkCode}' not found`);
    err.statusCode = 404;
    throw err;
  }

  const [requirements, categories, controls] = await Promise.all([
    Requirement.find({ frameworkId: framework._id, isActive: true })
      .select('_id categoryId identifier title')
      .lean(),
    RequirementCategory.find({ frameworkId: framework._id, isActive: true })
      .select('_id code title order')
      .sort({ order: 1, code: 1 })
      .lean(),
    InternalControl.find({
      organizationId,
      isDeleted: { $ne: true },
      isActive: { $ne: false },
      'linkedRequirements.frameworkId': framework._id,
    })
      .select('_id identifier title linkedRequirements manualStatus automationStatus overallStatus')
      .lean(),
  ]);

  const controlIds = controls.map((c) => c._id);
  const organization = await Organization.findById(organizationId).select('settings').lean();
  const config = organization?.settings || {};

  const [policies, tests, evidence, risks] = await Promise.all([
    Policy.find({
      organizationId,
      isDeleted: { $ne: true },
      linkedControlIds: { $in: controlIds },
    })
      .select('_id title status workflowStatus requiresAttestation acknowledgementRate archivedAt linkedControlIds')
      .lean(),
    Test.find({
      organizationId,
      isDeleted: { $ne: true },
      linkedControlIds: { $in: controlIds },
    })
      .select('_id name status isActive snoozedUntil snoozeReason deactivationReason notApplicableAt notApplicableReason archivedAt archiveReason linkedControlIds')
      .lean(),
    Evidence.find({
      organizationId,
      isDeleted: { $ne: true },
      linkedControlIds: { $in: controlIds },
    })
      .select('_id title status archivedAt validUntil linkedControlIds')
      .lean(),
    Risk.find({
      organizationId,
      isDeleted: { $ne: true },
      mitigatingControlIds: { $in: controlIds },
    })
      .select('_id title status archivedAt mitigatingControlIds')
      .lean(),
  ]);

  const policiesByControl = byControlId(policies, 'linkedControlIds');
  const testsByControl = byControlId(tests, 'linkedControlIds');
  const evidenceByControl = byControlId(evidence, 'linkedControlIds');
  const risksByControl = byControlId(risks, 'mitigatingControlIds');

  const overlays = controls.map((control) => {
    const result = evaluateControl({
      control,
      policies: policiesByControl.get(String(control._id)) || [],
      tests: testsByControl.get(String(control._id)) || [],
      evidence: evidenceByControl.get(String(control._id)) || [],
      risks: risksByControl.get(String(control._id)) || [],
      config,
    });

    return {
      ...result,
      identifier: control.identifier,
      title: control.title,
    };
  });

  const overlayByControlId = new Map(overlays.map((o) => [String(o.controlId), o]));
  const controlsByRequirementId = new Map();

  for (const control of controls) {
    for (const link of control.linkedRequirements || []) {
      if (String(link.frameworkId) !== String(framework._id)) continue;
      const reqKey = String(link.requirementId);
      const list = controlsByRequirementId.get(reqKey) || [];
      const overlay = overlayByControlId.get(String(control._id));
      if (overlay) list.push(overlay);
      controlsByRequirementId.set(reqKey, list);
    }
  }

  const requirementRollup = requirements.map((req) => {
    const linkedControlOverlays = controlsByRequirementId.get(String(req._id)) || [];
    const totalControls = linkedControlOverlays.length;
    const pass = linkedControlOverlays.filter((o) => o.status === 'PASS').length;
    const fail = linkedControlOverlays.filter((o) => o.status === 'FAIL').length;
    const readinessScore = totalControls ? Math.round((pass / totalControls) * 100) : 0;
    const status = totalControls > 0 && pass === totalControls ? 'PASS' : 'FAIL';

    return {
      requirementId: req._id,
      categoryId: req.categoryId,
      identifier: req.identifier,
      title: req.title,
      status,
      readinessScore,
      controls: {
        total: totalControls,
        pass,
        fail,
      },
    };
  });

  const requirementsByCategoryId = new Map();
  for (const rollup of requirementRollup) {
    const key = String(rollup.categoryId);
    const list = requirementsByCategoryId.get(key) || [];
    list.push(rollup);
    requirementsByCategoryId.set(key, list);
  }

  const categoryRollup = categories.map((cat) => {
    const categoryRequirements = requirementsByCategoryId.get(String(cat._id)) || [];
    const totalRequirements = categoryRequirements.length;
    const pass = categoryRequirements.filter((r) => r.status === 'PASS').length;
    const fail = categoryRequirements.filter((r) => r.status === 'FAIL').length;
    const readinessScore = totalRequirements ? Math.round((pass / totalRequirements) * 100) : 0;
    const status = totalRequirements > 0 && pass === totalRequirements ? 'PASS' : 'FAIL';

    return {
      categoryId: cat._id,
      code: cat.code,
      title: cat.title,
      status,
      readinessScore,
      requirements: {
        total: totalRequirements,
        pass,
        fail,
      },
    };
  });

  const totalRequirements = requirementRollup.length;
  const passRequirements = requirementRollup.filter((r) => r.status === 'PASS').length;
  const failRequirements = requirementRollup.filter((r) => r.status === 'FAIL').length;
  const gapRequirements = requirementRollup.filter((r) => r.controls.total === 0).length;
  const passCategories = categoryRollup.filter((c) => c.status === 'PASS').length;
  const failCategories = categoryRollup.filter((c) => c.status === 'FAIL').length;
  const readinessScore = totalRequirements ? Math.round((passRequirements / totalRequirements) * 100) : 0;
  const coveragePercentage = totalRequirements
    ? Math.round(((totalRequirements - gapRequirements) / totalRequirements) * 100)
    : 0;

  const workflowOverlay = {
    pass: overlays.filter((o) => o.status === 'PASS').length,
    fail: overlays.filter((o) => o.status === 'FAIL').length,
    controls: overlays,
  };

  return {
    frameworkId: framework._id,
    framework: { _id: framework._id, code: framework.code, name: framework.name },
    readinessScore,
    complianceScore: readinessScore,
    gapPercentage: totalRequirements ? Math.round((gapRequirements / totalRequirements) * 100) : 0,
    coveragePercentage,
    totalRequirements,
    totalControls: controls.length,
    statusBreakdown: {
      PASS: workflowOverlay.pass,
      FAIL: workflowOverlay.fail,
    },
    gaps: gapRequirements,
    partial: Math.max(0, failRequirements - gapRequirements),
    covered: passRequirements,
    controls,
    rollup: {
      requirement: {
        total: totalRequirements,
        pass: passRequirements,
        fail: failRequirements,
        items: requirementRollup,
      },
      category: {
        total: categoryRollup.length,
        pass: passCategories,
        fail: failCategories,
        items: categoryRollup,
      },
      framework: {
        readinessScore,
        ready: categoryRollup.length > 0 && passCategories === categoryRollup.length,
      },
    },
    workflowOverlay,
  };
}

export async function recalculateReadinessForOrg(organizationId) {
  const frameworks = await Framework.find({ isActive: true }).select('_id code').lean();
  const results = [];

  for (const framework of frameworks) {
    try {
      const readiness = await getFrameworkReadinessWithWorkflowOverlay(organizationId, framework.code);
      const readinessPercent = Number(readiness.readinessScore || 0);
      const row = await OrganizationFrameworkReadiness.findOneAndUpdate(
        { organizationId, frameworkId: framework._id },
        {
          $set: {
            readinessPercent,
            calculatedAt: new Date(),
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );
      results.push(row);
    } catch (error) {
      if (error.statusCode !== 404) {
        console.error(`[readiness] failed to recalculate ${framework.code} for org ${organizationId}:`, error.message);
      }
    }
  }

  return results;
}

export default {
  evaluateControl,
  getFrameworkReadinessWithWorkflowOverlay,
  recalculateReadinessForOrg,
};
