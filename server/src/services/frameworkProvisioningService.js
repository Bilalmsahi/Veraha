import Framework from '../models/Framework.js';
import GlobalControlTemplate from '../models/GlobalControlTemplate.js';
import GlobalTestTemplate from '../models/GlobalTestTemplate.js';
import InternalControl from '../models/InternalControl.js';
import Evidence from '../models/Evidence.js';
import Test from '../models/Test.js';
import Policy from '../models/Policy.js';
import PolicyTemplate from '../models/PolicyTemplate.js';
import PolicyVersion from '../models/PolicyVersion.js';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import { POLICY_STATUS } from '../models/enums.js';
import { seedTrainingModulesForOrganization } from '../seeds/seedTrainingModules.js';
import { hashPolicyHtml, sanitizePolicyHtml } from '../utils/policyHtmlSanitizer.js';

const normalize = (value = '') => String(value).trim().toLowerCase();
const COMPLETE_DATASET_SEED_VERSION = 'complete-global-dataset-v1';
const COMPLETE_DATASET_SEED_IN_PROGRESS = `${COMPLETE_DATASET_SEED_VERSION}:in-progress`;

function uniqueRequirementLinks(links = []) {
  const seen = new Set();
  const result = [];

  for (const link of links) {
    if (!link?.requirementId || !link?.frameworkId) continue;
    const key = `${link.frameworkId.toString()}:${link.requirementId.toString()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      requirementId: link.requirementId,
      frameworkId: link.frameworkId,
      coverage: link.coverage || 'FULL',
      justification: link.justification || '',
    });
  }

  return result;
}

async function resolveProvisioningUserId(organizationId, actorUserId = null) {
  if (actorUserId) return actorUserId;

  const user = await User.findOne({
    organizationId,
    isDeleted: { $ne: true },
    role: { $in: ['ADMIN', 'MANAGER'] },
  })
    .sort({ role: 1, createdAt: 1 })
    .select('_id')
    .lean();

  if (user?._id) return user._id;

  const error = new Error('Cannot provision framework data without an organization admin user');
  error.statusCode = 400;
  throw error;
}

async function getFrameworks(frameworkCodes) {
  const codes = [...new Set(frameworkCodes.map((code) => code.toUpperCase()))];
  const frameworks = await Framework.find({
    code: { $in: codes },
    isActive: true,
  });

  const foundCodes = new Set(frameworks.map((framework) => framework.code));
  const missingCodes = codes.filter((code) => !foundCodes.has(code));
  if (missingCodes.length > 0) {
    const error = new Error(`Invalid framework codes: ${missingCodes.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }

  return frameworks;
}

async function provisionControls({ organizationId, frameworkIds, includeUnlinked = false }) {
  const templateQuery = {
    isActive: true,
    'suggestedRequirements.frameworkId': { $in: frameworkIds },
  };
  if (includeUnlinked) {
    templateQuery.$or = [
      { 'suggestedRequirements.frameworkId': { $in: frameworkIds } },
      { suggestedRequirements: { $size: 0 } },
      { suggestedRequirements: { $exists: false } },
    ];
    delete templateQuery['suggestedRequirements.frameworkId'];
  }

  const templates = await GlobalControlTemplate.find(templateQuery);

  if (templates.length === 0) {
    const error = new Error('No control templates found for selected frameworks');
    error.statusCode = 400;
    throw error;
  }

  const existingControls = await InternalControl.find({
    organizationId,
    identifier: { $in: templates.map((template) => template.identifier) },
    isDeleted: false,
  });
  const existingByIdentifier = new Map(existingControls.map((control) => [control.identifier, control]));

  const createdControls = [];
  const updatedControls = [];

  for (const template of templates) {
    const linkedRequirements = uniqueRequirementLinks(template.suggestedRequirements || []);
    const existing = existingByIdentifier.get(template.identifier);

    if (!existing) {
      const control = await InternalControl.create({
        organizationId,
        sourceTemplateId: template._id,
        identifier: template.identifier,
        title: template.title,
        description: template.description,
        controlGroup: template.controlGroup,
        frequency: template.frequency,
        suggestedPolicySlugs: template.suggestedPolicySlugs || [],
        implementationNotes: template.implementationGuidance || '',
        linkedRequirements,
        manualStatus: 'NOT_APPLICABLE',
        automationStatus: 'NOT_CONFIGURED',
        overallStatus: 'NOT_APPLICABLE',
      });
      existingByIdentifier.set(control.identifier, control);
      createdControls.push(control);
      continue;
    }

    const mergedLinks = uniqueRequirementLinks([
      ...(existing.linkedRequirements || []),
      ...linkedRequirements,
    ]);
    const mergedPolicySlugs = [
      ...new Set([
        ...(existing.suggestedPolicySlugs || []),
        ...(template.suggestedPolicySlugs || []),
      ].filter(Boolean)),
    ];

    const linkCountChanged = mergedLinks.length !== (existing.linkedRequirements || []).length;
    const policySlugsChanged = mergedPolicySlugs.length !== (existing.suggestedPolicySlugs || []).length;

    if (linkCountChanged || policySlugsChanged || !existing.sourceTemplateId) {
      existing.linkedRequirements = mergedLinks;
      existing.suggestedPolicySlugs = mergedPolicySlugs;
      if (!existing.sourceTemplateId) existing.sourceTemplateId = template._id;
      await existing.save();
      updatedControls.push(existing);
    }
  }

  return {
    templates,
    controls: [...existingByIdentifier.values()],
    createdControls,
    updatedControls,
  };
}

async function provisionTestsAndEvidence({ organizationId, controls, actorUserId }) {
  const controlByIdentifier = new Map(controls.map((control) => [control.identifier, control._id]));
  const testTemplates = await GlobalTestTemplate.find({
    isActive: true,
    suggestedControlIdentifiers: { $in: [...controlByIdentifier.keys()] },
  }).lean();

  const [existingTests, existingEvidence] = await Promise.all([
    Test.find({
      organizationId,
      name: { $in: testTemplates.filter((template) => template.type === 'automated').map((template) => template.name) },
      isDeleted: false,
    }).select('name linkedControlIds'),
    Evidence.find({
      organizationId,
      title: { $in: testTemplates.filter((template) => template.type === 'document').map((template) => template.name) },
      isDeleted: false,
    }).select('title linkedControlIds'),
  ]);

  const existingTestByName = new Map(existingTests.map((test) => [normalize(test.name), test]));
  const existingEvidenceByTitle = new Map(existingEvidence.map((item) => [normalize(item.title), item]));
  const testsToCreate = [];
  const evidenceToCreate = [];

  for (const template of testTemplates) {
    const linkedControlIds = (template.suggestedControlIdentifiers || [])
      .filter((identifier) => controlByIdentifier.has(identifier))
      .map((identifier) => controlByIdentifier.get(identifier));

    if (linkedControlIds.length === 0) continue;

    if (template.type === 'automated') {
      const existing = existingTestByName.get(normalize(template.name));
      if (existing) {
        const existingIds = new Set((existing.linkedControlIds || []).map((id) => id.toString()));
        const newIds = linkedControlIds.filter((id) => !existingIds.has(id.toString()));
        if (newIds.length > 0) {
          existing.linkedControlIds.push(...newIds);
          await existing.save();
        }
        continue;
      }
      testsToCreate.push({
        organizationId,
        notionId: `global-template:${normalize(template.name)}`,
        name: template.name,
        description: template.description || '',
        evidenceGuidance: template.evidenceGuidance || '',
        type: 'automated',
        category: template.category || 'Engineering',
        renewalPeriod: template.renewalPeriod,
        rollout: 'enabled',
        status: 'needs_remediation',
        skipStatusRecompute: true,
        linkedControlIds,
        isActive: true,
      });
    } else if (template.type === 'document') {
      const existing = existingEvidenceByTitle.get(normalize(template.name));
      if (existing) {
        const existingIds = new Set((existing.linkedControlIds || []).map((id) => id.toString()));
        const newIds = linkedControlIds.filter((id) => !existingIds.has(id.toString()));
        if (newIds.length > 0) {
          existing.linkedControlIds.push(...newIds);
          await existing.save();
        }
        continue;
      }
      evidenceToCreate.push({
        organizationId,
        title: template.name,
        description: template.evidenceGuidance || template.description || '',
        category: template.category || 'Engineering',
        linkedControlIds,
        uploadedBy: actorUserId,
        status: 'PENDING',
      });
    }
  }

  const [createdTests, createdEvidence] = await Promise.all([
    testsToCreate.length > 0 ? Test.insertMany(testsToCreate) : [],
    evidenceToCreate.length > 0 ? Evidence.insertMany(evidenceToCreate) : [],
  ]);

  return { createdTests, createdEvidence };
}

async function provisionPolicies({ organizationId, frameworkCodes, controls, actorUserId, includeUnlinked = false }) {
  const suggestedPolicySlugs = [
    ...new Set(controls.flatMap((control) => control.suggestedPolicySlugs || []).filter(Boolean)),
  ];

  const policyTemplateOr = [
      { frameworkCodes: { $in: frameworkCodes } },
      { slug: { $in: suggestedPolicySlugs } },
  ];
  if (includeUnlinked) {
    policyTemplateOr.push({ frameworkCodes: { $size: 0 } }, { frameworkCodes: { $exists: false } });
  }

  const templates = await PolicyTemplate.find({
    $or: policyTemplateOr,
  });

  if (templates.length === 0) return { createdPolicies: [] };

  const [frameworks, existingPolicies] = await Promise.all([
    Framework.find({ code: { $in: [...new Set(templates.flatMap((template) => template.frameworkCodes || []))] } }),
    Policy.find({
      organizationId,
      templateId: { $in: templates.map((template) => template._id) },
      isDeleted: false,
    }).select('templateId linkedControlIds frameworkIds'),
  ]);

  const frameworkByCode = new Map(frameworks.map((framework) => [framework.code, framework._id]));
  const existingPolicyByTemplateId = new Map(
    existingPolicies
      .filter((policy) => policy.templateId)
      .map((policy) => [policy.templateId.toString(), policy])
  );
  const controlsByPolicySlug = new Map();

  for (const control of controls) {
    for (const slug of control.suggestedPolicySlugs || []) {
      const list = controlsByPolicySlug.get(slug) || [];
      list.push(control._id);
      controlsByPolicySlug.set(slug, list);
    }
  }

  const createdPolicies = [];

  for (const template of templates) {
    const linkedControlIds = controlsByPolicySlug.get(template.slug) || [];
    const frameworkIds = (template.frameworkCodes || []).map((code) => frameworkByCode.get(code)).filter(Boolean);
    const existing = existingPolicyByTemplateId.get(template._id.toString());

    if (existing) {
      const existingControlIds = new Set((existing.linkedControlIds || []).map((id) => id.toString()));
      const missingControlIds = linkedControlIds.filter((id) => !existingControlIds.has(id.toString()));
      const existingFrameworkIds = new Set((existing.frameworkIds || []).map((id) => id.toString()));
      const missingFrameworkIds = frameworkIds.filter((id) => !existingFrameworkIds.has(id.toString()));

      if (missingControlIds.length > 0 || missingFrameworkIds.length > 0) {
        existing.linkedControlIds.push(...missingControlIds);
        existing.frameworkIds.push(...missingFrameworkIds);
        await existing.save();
      }

      if (linkedControlIds.length > 0) {
        await InternalControl.updateMany(
          { _id: { $in: linkedControlIds }, organizationId },
          { $addToSet: { linkedPolicyIds: existing._id } }
        );
      }
      continue;
    }

    const policy = await Policy.create({
      organizationId,
      templateId: template._id,
      source: 'VANTA',
      title: template.title,
      description: template.description || '',
      category: template.category || 'General',
      status: POLICY_STATUS[0],
      workflowStatus: 'DRAFT',
      ownerId: actorUserId,
      reviewFrequency: 'ANNUALLY',
      requiresAttestation: true,
      frameworkIds,
      linkedControlIds,
    });

    const initialContentHtml = sanitizePolicyHtml(
      `<h1>${template.title}</h1><p>${template.description || ''}</p><p><em>Based on template: ${template.filename}</em></p>`
    );

    await PolicyVersion.create({
      organizationId,
      policyId: policy._id,
      versionNumber: 1,
      status: POLICY_STATUS[0],
      contentHtml: initialContentHtml,
      contentType: 'EDITOR_HTML',
      contentHash: hashPolicyHtml(initialContentHtml),
      editorLastSavedAt: new Date(),
      editorLastSavedBy: actorUserId,
      changelog: 'Initial version from framework provisioning',
      createdBy: actorUserId,
    });

    if (linkedControlIds.length > 0) {
      await InternalControl.updateMany(
        { _id: { $in: linkedControlIds }, organizationId },
        { $addToSet: { linkedPolicyIds: policy._id } }
      );
    }

    createdPolicies.push(policy);
  }

  return { createdPolicies };
}

export async function provisionFrameworkForOrganization({
  organizationId,
  frameworkCodes,
  actorUserId = null,
  seedTraining = true,
  includeUnlinked = false,
}) {
  const frameworks = await getFrameworks(frameworkCodes);
  const resolvedActorUserId = await resolveProvisioningUserId(organizationId, actorUserId);
  const frameworkIds = frameworks.map((framework) => framework._id);
  const normalizedFrameworkCodes = frameworks.map((framework) => framework.code);

  const controlResult = await provisionControls({
    organizationId,
    frameworkIds,
    includeUnlinked,
  });

  const [testEvidenceResult, policyResult, trainingResult] = await Promise.all([
    provisionTestsAndEvidence({
      organizationId,
      controls: controlResult.controls,
      actorUserId: resolvedActorUserId,
    }),
    provisionPolicies({
      organizationId,
      frameworkCodes: normalizedFrameworkCodes,
      controls: controlResult.controls,
      actorUserId: resolvedActorUserId,
      includeUnlinked,
    }),
    seedTraining ? seedTrainingModulesForOrganization(organizationId) : Promise.resolve(null),
  ]);

  return {
    frameworks,
    frameworkIds,
    controlsCreated: controlResult.createdControls.length,
    controlsUpdated: controlResult.updatedControls.length,
    testsCreated: testEvidenceResult.createdTests.length,
    evidenceCreated: testEvidenceResult.createdEvidence.length,
    policiesCreated: policyResult.createdPolicies.length,
    training: trainingResult,
  };
}

export async function provisionCompleteDatasetForOrganization({
  organizationId,
  actorUserId = null,
  force = false,
} = {}) {
  const organization = await Organization
    .findById(organizationId)
    .select('complianceDataSeededAt')
    .lean();

  if (!organization) {
    const error = new Error('Organization not found');
    error.statusCode = 404;
    throw error;
  }

  if (!force && organization.complianceDataSeededAt) {
    return {
      skipped: true,
      reason: 'Organization compliance dataset is already seeded',
    };
  }

  let lockAcquired = Boolean(force);
  if (!force) {
    const locked = await Organization.findOneAndUpdate(
      {
        _id: organizationId,
        complianceDataSeededAt: null,
        complianceDataSeedVersion: { $ne: COMPLETE_DATASET_SEED_IN_PROGRESS },
      },
      { $set: { complianceDataSeedVersion: COMPLETE_DATASET_SEED_IN_PROGRESS } },
      { new: true }
    ).select('_id');

    lockAcquired = Boolean(locked);
    if (!lockAcquired) {
      return {
        skipped: true,
        reason: 'Organization compliance dataset seed is already running',
      };
    }
  }

  try {
    const existingControlCount = await InternalControl.countDocuments({
      organizationId,
      isDeleted: false,
    });

    if (!force && existingControlCount > 0) {
      await Organization.updateOne(
        { _id: organizationId },
        {
          $set: {
            complianceDataSeededAt: new Date(),
            complianceDataSeedVersion: COMPLETE_DATASET_SEED_VERSION,
          },
        }
      );
      return {
        skipped: true,
        reason: 'Organization already has compliance controls',
        existingControlCount,
      };
    }

    const frameworks = await Framework.find({ isActive: true }).select('code').lean();
    const frameworkCodes = frameworks.map((framework) => framework.code);

    const result = await provisionFrameworkForOrganization({
      organizationId,
      frameworkCodes,
      actorUserId,
      seedTraining: true,
      includeUnlinked: true,
    });

    await Organization.updateOne(
      { _id: organizationId },
      {
        $set: {
          complianceDataSeededAt: new Date(),
          complianceDataSeedVersion: COMPLETE_DATASET_SEED_VERSION,
        },
      }
    );

    return {
      ...result,
      skipped: false,
      completeDataset: true,
    };
  } catch (error) {
    if (lockAcquired && !force) {
      await Organization.updateOne(
        { _id: organizationId, complianceDataSeedVersion: COMPLETE_DATASET_SEED_IN_PROGRESS },
        { $set: { complianceDataSeedVersion: null } }
      );
    }
    throw error;
  }
}

export default {
  provisionFrameworkForOrganization,
  provisionCompleteDatasetForOrganization,
};
