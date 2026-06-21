import mongoose from 'mongoose';
import InternalControl from '../models/InternalControl.js';
import Evidence from '../models/Evidence.js';
import Framework from '../models/Framework.js';
import Organization from '../models/Organization.js';
import Policy from '../models/Policy.js';
import User from '../models/User.js';
import DeviceEvidence from '../models/DeviceEvidence.js';
import TrainingModule from '../models/TrainingModule.js';
import TrainingAttempt from '../models/TrainingAttempt.js';
import Risk from '../models/Risk.js';
import Vendor from '../models/Vendor.js';
import vendorService from './vendorService.js';
import personnelTaskService from './personnelTaskService.js';
import readinessService from './readinessService.js';

const INTERNAL_PERSONNEL_ROLES = ['ADMIN', 'MANAGER', 'EMPLOYEE'];

function timeframeToDate(timeframe) {
  const now = new Date();
  const daysByKey = { '30d': 30, '90d': 90, '180d': 180, '1y': 365 };
  const days = daysByKey[timeframe];
  if (!days) return null;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function getDateRange(filters = {}) {
  const since = filters.startDate ? new Date(filters.startDate) : timeframeToDate(filters.timeframe);
  const until = filters.endDate ? new Date(filters.endDate) : null;
  return {
    since: since && !Number.isNaN(since.getTime()) ? since : null,
    until: until && !Number.isNaN(until.getTime()) ? until : null,
  };
}

function dateRangeQuery(field, filters = {}) {
  const { since, until } = getDateRange(filters);
  const range = {};
  if (since) range.$gte = since;
  if (until) {
    const endOfDay = new Date(until);
    endOfDay.setHours(23, 59, 59, 999);
    range.$lte = endOfDay;
  }
  return Object.keys(range).length ? { [field]: range } : {};
}

function normalizeFrameworkCodes(frameworks) {
  return String(frameworks || '')
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

async function getFrameworkFilterIds(frameworks) {
  const codes = normalizeFrameworkCodes(frameworks);
  if (!codes.length) return null;
  const rows = await Framework.find({ code: { $in: codes }, isActive: true }).select('_id code name').lean();
  return rows;
}

function mapCounts(rows, fallbackKeys = []) {
  const result = Object.fromEntries(fallbackKeys.map((key) => [key, 0]));
  for (const row of rows || []) {
    result[row._id || 'UNKNOWN'] = row.count;
  }
  return result;
}

function percent(part, total) {
  return total ? Math.round((part / total) * 100) : 0;
}

function fullName(user) {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return name || user?.email || 'Unknown user';
}

function formatRequirementLinks(linkedRequirements = []) {
  const frameworkCodes = new Set();
  const requirementIds = [];

  for (const link of linkedRequirements || []) {
    const framework = link.frameworkId;
    const requirement = link.requirementId;
    const frameworkCode = typeof framework === 'object' ? framework?.code : null;
    const requirementIdentifier = typeof requirement === 'object' ? requirement?.identifier : null;
    if (frameworkCode) frameworkCodes.add(frameworkCode);
    if (frameworkCode && requirementIdentifier) {
      requirementIds.push(`${frameworkCode} ${requirementIdentifier}`);
    } else if (requirementIdentifier) {
      requirementIds.push(requirementIdentifier);
    }
  }

  return {
    frameworks: [...frameworkCodes].join(', ') || 'Unmapped',
    requirements: requirementIds.join(', ') || 'Unmapped',
    requirementCount: requirementIds.length,
  };
}

function serializeControlForExport(control, evidenceCountByControl) {
  const links = formatRequirementLinks(control.linkedRequirements);
  return {
    _id: String(control._id),
    controlId: control.identifier,
    title: control.title,
    status: control.overallStatus || 'NOT_CONFIGURED',
    manualStatus: control.manualStatus || 'NOT_APPLICABLE',
    automationStatus: control.automationStatus || 'NOT_CONFIGURED',
    controlGroup: control.controlGroup || 'Uncategorized',
    ownerName: control.ownerId ? fullName(control.ownerId) : 'Unassigned',
    frameworks: links.frameworks,
    requirements: links.requirements,
    requirementCount: links.requirementCount,
    evidenceCount: evidenceCountByControl.get(String(control._id)) || 0,
    lastAssessedAt: control.lastAssessedAt || null,
    nextAssessmentDue: control.nextAssessmentDue || null,
    updatedAt: control.updatedAt,
  };
}

function serializeEvidenceForExport(evidence) {
  const linkedControls = (evidence.linkedControlIds || [])
    .map((control) => (typeof control === 'object' ? control.identifier : null))
    .filter(Boolean);

  return {
    _id: String(evidence._id),
    title: evidence.title,
    status: evidence.status || 'PENDING',
    category: evidence.category || 'Uncategorized',
    linkedControls: linkedControls.join(', ') || 'Unlinked',
    uploadedBy: evidence.uploadedBy ? fullName(evidence.uploadedBy) : 'Unknown user',
    validUntil: evidence.validUntil || null,
    updatedAt: evidence.updatedAt,
  };
}

function serializePolicyForExport(policy) {
  return {
    _id: String(policy._id),
    title: policy.title,
    status: policy.status,
    workflowStatus: policy.workflowStatus,
    acknowledgementRate: Number(policy.acknowledgementRate || 0),
    requiresAttestation: Boolean(policy.requiresAttestation),
    ownerName: policy.ownerId ? fullName(policy.ownerId) : 'Unassigned',
    nextReviewDue: policy.nextReviewDue || null,
  };
}

export async function getComplianceReport(organizationId, filters = {}, options = {}) {
  const detailLevel = options.detailLevel || 'summary';
  const isExport = detailLevel === 'export';
  const updatedAtRange = dateRangeQuery('updatedAt', filters);
  const frameworkRows = await getFrameworkFilterIds(filters.frameworks);
  const frameworkIds = frameworkRows?.map((framework) => framework._id) || null;
  const organization = await Organization.findById(organizationId)
    .populate('settings.enabledFrameworks', 'code name')
    .select('settings.enabledFrameworks')
    .lean();
  const controlMatch = {
    organizationId: new mongoose.Types.ObjectId(organizationId),
    isDeleted: { $ne: true },
    isActive: { $ne: false },
    ...updatedAtRange,
    ...(frameworkIds ? { 'linkedRequirements.frameworkId': { $in: frameworkIds } } : {}),
  };

  const [totalControls, passingControls, controlStatusRows, policies, topFailingControls, exportControls] =
    await Promise.all([
      InternalControl.countDocuments(controlMatch),
      InternalControl.countDocuments({ ...controlMatch, overallStatus: 'PASS' }),
      InternalControl.aggregate([
        { $match: controlMatch },
        { $group: { _id: '$overallStatus', count: { $sum: 1 } } },
      ]),
      Policy.find({
        organizationId,
        isDeleted: { $ne: true },
        status: 'ACTIVE',
        requiresAttestation: true,
      })
        .select('title acknowledgementRate')
        .lean(),
      InternalControl.find({
        ...controlMatch,
        overallStatus: { $in: ['FAIL', 'WARNING', 'NOT_CONFIGURED'] },
      })
        .select('identifier title overallStatus controlGroup')
        .sort({ overallStatus: 1, updatedAt: -1 })
        .limit(10)
        .lean(),
      isExport
        ? InternalControl.find(controlMatch)
            .select(
              'identifier title overallStatus manualStatus automationStatus controlGroup ownerId linkedRequirements lastAssessedAt nextAssessmentDue updatedAt',
            )
            .sort({ identifier: 1, title: 1 })
            .populate('ownerId', 'firstName lastName email')
            .populate({ path: 'linkedRequirements.requirementId', select: 'identifier' })
            .populate({ path: 'linkedRequirements.frameworkId', select: 'code' })
            .lean()
        : Promise.resolve([]),
    ]);

  const exportControlIds = exportControls.map((control) => control._id);
  const evidenceMatch = {
    organizationId: new mongoose.Types.ObjectId(organizationId),
    isDeleted: { $ne: true },
    ...updatedAtRange,
    ...(isExport && frameworkIds ? { linkedControlIds: { $in: exportControlIds } } : {}),
  };
  const [evidenceStatusRows, exportEvidence, exportPolicyRows, evidenceCountRows] = await Promise.all([
    Evidence.aggregate([{ $match: evidenceMatch }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    isExport
      ? Evidence.find(evidenceMatch)
          .select('title status category linkedControlIds uploadedBy validUntil updatedAt')
          .sort({ status: 1, updatedAt: -1, title: 1 })
          .populate('linkedControlIds', 'identifier title')
          .populate('uploadedBy', 'firstName lastName email')
          .lean()
      : Promise.resolve([]),
    isExport
      ? Policy.find({
          organizationId,
          isDeleted: { $ne: true },
          status: 'ACTIVE',
          requiresAttestation: true,
          ...(frameworkIds
            ? {
                $or: [
                  { frameworkIds: { $in: frameworkIds } },
                  { linkedControlIds: { $in: exportControlIds } },
                ],
              }
            : {}),
        })
          .select('title status workflowStatus acknowledgementRate requiresAttestation ownerId nextReviewDue')
          .sort({ title: 1 })
          .populate('ownerId', 'firstName lastName email')
          .lean()
      : Promise.resolve([]),
    isExport
      ? Evidence.aggregate([
          {
            $match: {
              organizationId: new mongoose.Types.ObjectId(organizationId),
              isDeleted: { $ne: true },
              linkedControlIds: { $in: exportControlIds },
              ...updatedAtRange,
            },
          },
          { $unwind: '$linkedControlIds' },
          { $match: { linkedControlIds: { $in: exportControlIds } } },
          { $group: { _id: '$linkedControlIds', count: { $sum: 1 } } },
        ])
      : Promise.resolve([]),
  ]);

  const enabledFrameworks = organization?.settings?.enabledFrameworks || [];
  const selectedFrameworkIds = frameworkIds ? new Set(frameworkIds.map(String)) : null;
  const frameworksForReadiness = enabledFrameworks.filter((framework) =>
    selectedFrameworkIds ? selectedFrameworkIds.has(String(framework._id)) : true,
  );
  const frameworkBreakdown = [];
  for (const framework of frameworksForReadiness) {
    try {
      const readiness = await readinessService.getFrameworkReadinessWithWorkflowOverlay(
        organizationId,
        framework.code,
      );
      frameworkBreakdown.push({
        frameworkId: String(framework._id),
        code: framework.code,
        name: framework.name,
        totalRequirements: readiness.totalRequirements,
        passingRequirements: readiness.rollup?.requirement?.pass ?? readiness.covered ?? 0,
        totalControls: readiness.totalControls,
        passingControls: readiness.statusBreakdown?.PASS ?? 0,
        compliancePercent: readiness.readinessScore,
        readinessScore: readiness.readinessScore,
      });
    } catch (err) {
      console.error(`Failed to get report readiness for ${framework.code}:`, err.message);
    }
  }

  const totalRequirements = frameworkBreakdown.reduce((sum, row) => sum + row.totalRequirements, 0);
  const passingRequirements = frameworkBreakdown.reduce((sum, row) => sum + row.passingRequirements, 0);
  const compliancePercent = frameworkBreakdown.length
    ? Math.round(frameworkBreakdown.reduce((sum, row) => sum + row.readinessScore, 0) / frameworkBreakdown.length)
    : percent(passingControls, totalControls);

  const acknowledgementPolicies = isExport ? exportPolicyRows : policies;
  const avgAcknowledgement = acknowledgementPolicies.length
    ? Math.round(
        acknowledgementPolicies.reduce((sum, policy) => sum + Number(policy.acknowledgementRate || 0), 0) /
          acknowledgementPolicies.length,
      )
    : 100;

  const evidenceCountByControl = new Map(evidenceCountRows.map((row) => [String(row._id), row.count]));
  const result = {
    generatedAt: new Date(),
    filters: {
      timeframe: filters.timeframe || 'all',
      startDate: filters.startDate || null,
      endDate: filters.endDate || null,
      frameworks: normalizeFrameworkCodes(filters.frameworks).join(', ') || null,
    },
    overall: {
      totalControls,
      passingControls,
      totalRequirements,
      passingRequirements,
      compliancePercent,
    },
    controlsByStatus: mapCounts(controlStatusRows, ['PASS', 'FAIL', 'WARNING', 'NOT_APPLICABLE', 'NOT_CONFIGURED']),
    evidenceByStatus: mapCounts(evidenceStatusRows, ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED']),
    policyAcknowledgement: {
      totalAssignments: acknowledgementPolicies.length,
      acknowledged: Math.round((avgAcknowledgement / 100) * acknowledgementPolicies.length),
      percentAcknowledged: avgAcknowledgement,
      policyCount: acknowledgementPolicies.length,
      averageRate: avgAcknowledgement,
    },
    frameworkBreakdown,
    topFailingControls: topFailingControls.map((control) => ({
      _id: String(control._id),
      controlId: control.identifier,
      title: control.title,
      status: control.overallStatus,
      updatedAt: control.updatedAt,
    })),
  };

  if (isExport) {
    result.detailLevel = 'export';
    result.controls = exportControls.map((control) => serializeControlForExport(control, evidenceCountByControl));
    result.evidenceItems = exportEvidence.map(serializeEvidenceForExport);
    result.policies = exportPolicyRows.map(serializePolicyForExport);
  }

  return result;
}

export async function getPersonnelReport(currentUser) {
  const organizationId = currentUser.organizationId;
  const [totalPersonnel, taskRows, trainingModules, deviceReviewRows] = await Promise.all([
    User.countDocuments({
      organizationId,
      isDeleted: { $ne: true },
      role: { $in: INTERNAL_PERSONNEL_ROLES },
    }),
    personnelTaskService.getAdminPeople(currentUser),
    TrainingModule.find({ organizationId, active: true, isDeleted: { $ne: true } })
      .select('_id title moduleKey')
      .lean(),
    DeviceEvidence.aggregate([
      { $match: { organizationId: new mongoose.Types.ObjectId(organizationId) } },
      { $group: { _id: '$reviewStatus', count: { $sum: 1 } } },
    ]),
  ]);

  const attempts = trainingModules.length
    ? await TrainingAttempt.aggregate([
        {
          $match: {
            organizationId: new mongoose.Types.ObjectId(organizationId),
            moduleId: { $in: trainingModules.map((module) => module._id) },
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: '$moduleId',
            started: { $sum: 1 },
            completed: { $sum: { $cond: [{ $ne: ['$passedAt', null] }, 1, 0] } },
          },
        },
      ])
    : [];
  const attemptByModule = new Map(attempts.map((row) => [String(row._id), row]));
  const totals = taskRows.reduce(
    (acc, row) => {
      acc.total += row.summary.total || 0;
      acc.complete += row.summary.complete || 0;
      acc.overdue += row.summary.overdue || 0;
      acc.awaitingReview += row.summary.awaitingReview || 0;
      return acc;
    },
    { total: 0, complete: 0, overdue: 0, awaitingReview: 0 },
  );

  return {
    generatedAt: new Date(),
    totalPersonnel,
    taskCompletion: {
      ...totals,
      totalTasks: totals.total,
      completeTasks: totals.complete,
      completionPercent: percent(totals.complete, totals.total),
    },
    roleBreakdown: taskRows.reduce((acc, row) => {
      const role = row.user?.role || 'UNKNOWN';
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, { ADMIN: 0, MANAGER: 0, EMPLOYEE: 0 }),
    people: taskRows.map((row) => ({
      id: String(row.user?._id || row.user?.id || ''),
      name: fullName(row.user),
      email: row.user?.email || '',
      role: row.user?.role || 'UNKNOWN',
      totalTasks: row.summary.total || 0,
      completeTasks: row.summary.complete || 0,
      completionPercent: row.percentComplete,
    })),
    trainingByModule: trainingModules.map((module) => {
      const row = attemptByModule.get(String(module._id)) || { started: 0, completed: 0 };
      return {
        moduleId: String(module._id),
        title: module.title,
        moduleKey: module.moduleKey,
        attempts: row.started,
        passed: row.completed,
        passRate: percent(row.completed, row.started),
        started: row.started,
        completed: row.completed,
        completionPercent: percent(row.completed, totalPersonnel),
      };
    }),
    deviceReviewsByStatus: mapCounts(deviceReviewRows, ['SUBMITTED', 'APPROVED', 'REJECTED']),
  };
}

export async function getRiskReport(organizationId) {
  const base = { organizationId, isDeleted: { $ne: true } };
  const [totalOpen, residualRows, treatmentRows, statusRows, topRisks] = await Promise.all([
    Risk.countDocuments({ ...base, status: 'OPEN' }),
    Risk.aggregate([
      { $match: { organizationId: new mongoose.Types.ObjectId(organizationId), isDeleted: { $ne: true } } },
      { $group: { _id: { $ifNull: ['$residualRisk.level', '$riskLevel'] }, count: { $sum: 1 } } },
    ]),
    Risk.aggregate([
      { $match: { organizationId: new mongoose.Types.ObjectId(organizationId), isDeleted: { $ne: true } } },
      { $group: { _id: '$treatment', count: { $sum: 1 } } },
    ]),
    Risk.aggregate([
      { $match: { organizationId: new mongoose.Types.ObjectId(organizationId), isDeleted: { $ne: true } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Risk.find(base)
      .select('identifier title status treatment residualScore residualRisk riskLevel ownerId')
      .sort({ residualScore: -1, inherentScore: -1 })
      .limit(10)
      .populate('ownerId', 'firstName lastName email')
      .lean(),
  ]);

  return {
    generatedAt: new Date(),
    totalOpen,
    residualByBand: mapCounts(residualRows, ['Low', 'Medium', 'High', 'LOW', 'MEDIUM', 'HIGH', 'UNKNOWN']),
    byTreatment: mapCounts(treatmentRows, ['MITIGATE', 'ACCEPT', 'TRANSFER', 'AVOID']),
    byStatus: mapCounts(statusRows, ['OPEN', 'CLOSED', 'ARCHIVED']),
    topRisks: topRisks.map((risk) => ({
      _id: String(risk._id),
      title: risk.title,
      status: risk.status,
      residualScore: risk.residualScore || risk.residualRisk?.score,
      residualBand: risk.residualRisk?.level || risk.riskLevel,
      treatmentType: risk.treatment,
      ownerName: risk.ownerId ? fullName(risk.ownerId) : null,
    })),
  };
}

export async function getVendorReport(organizationId) {
  const [stats, highRiskVendors, certificationRows, certificationNameRows] = await Promise.all([
    vendorService.getVendorStats(organizationId),
    vendorService.getHighRiskVendors(organizationId),
    Vendor.aggregate([
      { $match: { organizationId: new mongoose.Types.ObjectId(organizationId), isDeleted: { $ne: true }, status: 'ACTIVE' } },
      {
        $project: {
          hasCertifications: { $gt: [{ $size: { $ifNull: ['$certifications', []] } }, 0] },
        },
      },
      { $group: { _id: '$hasCertifications', count: { $sum: 1 } } },
    ]),
    Vendor.aggregate([
      { $match: { organizationId: new mongoose.Types.ObjectId(organizationId), isDeleted: { $ne: true }, status: 'ACTIVE' } },
      { $unwind: '$certifications' },
      { $group: { _id: '$certifications.name', count: { $sum: 1 } } },
    ]),
  ]);
  const certified = certificationRows.find((row) => row._id === true)?.count || 0;
  const uncertified = certificationRows.find((row) => row._id === false)?.count || 0;
  const totalVendors = certified + uncertified;

  return {
    generatedAt: new Date(),
    ...stats,
    certificationCoverage: {
      totalVendors,
      vendorsWithCertifications: certified,
      certificationsByName: mapCounts(certificationNameRows),
      certified,
      uncertified,
      coveragePercent: percent(certified, totalVendors),
    },
    highRiskVendors: highRiskVendors.map((vendor) => ({
      _id: String(vendor._id),
      name: vendor.name,
      riskTier: vendor.riskTier,
      status: vendor.status,
      category: vendor.category,
    })),
  };
}

export default {
  getComplianceReport,
  getPersonnelReport,
  getRiskReport,
  getVendorReport,
};
