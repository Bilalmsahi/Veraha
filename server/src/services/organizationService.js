/**
 * Organization Service
 * Business logic for organization management.
 */

import Organization from '../models/Organization.js';
import Framework from '../models/Framework.js';
import GlobalControlTemplate from '../models/GlobalControlTemplate.js';
import InternalControl from '../models/InternalControl.js';
import Requirement from '../models/Requirement.js';
import { logActivity } from './activityLogger.js';

/**
 * Get organization by ID with populated frameworks
 * @param {String} orgId - Organization ObjectId
 * @returns {Promise<Object>} Organization document
 */
export const getOrganization = async (orgId) => {
  const org = await Organization.findOne({
    _id: orgId,
    isDeleted: false,
  }).populate('settings.enabledFrameworks', 'code name version');

  if (!org) {
    const error = new Error('Organization not found');
    error.statusCode = 404;
    throw error;
  }

  return org;
};

/**
 * Update organization settings
 * @param {String} orgId - Organization ObjectId
 * @param {String} userId - User performing the update
 * @param {Object} updateData - Fields to update
 * @returns {Promise<Object>} Updated organization
 */
export const updateOrganization = async (orgId, userId, updateData) => {
  const org = await Organization.findOne({
    _id: orgId,
    isDeleted: false,
  });

  if (!org) {
    const error = new Error('Organization not found');
    error.statusCode = 404;
    throw error;
  }

  // Track changes for activity log
  const before = {
    name: org.name,
    settings: { ...org.settings.toObject() },
  };

  // Update allowed fields
  if (updateData.name) {
    org.name = updateData.name;
  }

  if (updateData.settings) {
    if (updateData.settings.timezone) {
      org.settings.timezone = updateData.settings.timezone;
    }
    if (updateData.settings.dateFormat) {
      org.settings.dateFormat = updateData.settings.dateFormat;
    }
    if (updateData.settings.evidenceExpiryWarningDays) {
      org.settings.evidenceExpiryWarningDays = updateData.settings.evidenceExpiryWarningDays;
    }
    if (updateData.settings.sessionTimeoutMinutes) {
      org.settings.sessionTimeoutMinutes = updateData.settings.sessionTimeoutMinutes;
    }
  }

  await org.save();

  // Log activity
  await logActivity({
    organizationId: orgId,
    actorId: userId,
    action: 'UPDATE',
    entityType: 'Organization',
    entityId: orgId,
    entitySnapshot: { name: org.name },
    changes: {
      before,
      after: {
        name: org.name,
        settings: org.settings.toObject(),
      },
    },
    notes: 'Organization settings updated',
  });

  // Return with populated frameworks
  return getOrganization(orgId);
};

/**
 * Repair linkedRequirements on all controls in an org.
 * After seed:fresh, Framework/Requirement ObjectIds change but control/template identifiers stay stable.
 * Matches controls to current templates by identifier, then copies the template's resolved suggestedRequirements.
 */
export const repairControlRequirements = async (orgId) => {
  const controls = await InternalControl.find({
    organizationId: orgId,
    isDeleted: false,
  }).select('_id identifier sourceTemplateId linkedRequirements').lean();

  if (controls.length === 0) return 0;

  const frameworks = await Framework.find({ isActive: true }).lean();
  const fwIdSet = new Set(frameworks.map(f => f._id.toString()));
  const allReqs = await Requirement.find({ frameworkId: { $in: frameworks.map(f => f._id) } }).select('_id').lean();
  const reqIdSet = new Set(allReqs.map(r => r._id.toString()));

  // Build template lookup by identifier (stable across seed:fresh)
  const allTemplates = await GlobalControlTemplate.find({ isActive: true }).lean();
  const templateByIdentifier = new Map(allTemplates.map(t => [t.identifier, t]));

  let repaired = 0;
  const bulkOps = [];

  for (const ctrl of controls) {
    // Check if current linkedRequirements are already valid
    const currentReqs = ctrl.linkedRequirements || [];
    const allValid = currentReqs.length > 0 && currentReqs.every(lr =>
      fwIdSet.has(lr.frameworkId?.toString()) && reqIdSet.has(lr.requirementId?.toString())
    );
    if (allValid) continue;

    // Find matching template by identifier
    const template = templateByIdentifier.get(ctrl.identifier);
    if (!template) continue;

    // Copy the template's current suggestedRequirements (already resolved by runSeeds)
    const newLinked = (template.suggestedRequirements || [])
      .filter(sr => fwIdSet.has(sr.frameworkId?.toString()) && reqIdSet.has(sr.requirementId?.toString()))
      .map(sr => ({
        requirementId: sr.requirementId,
        frameworkId: sr.frameworkId,
        coverage: sr.coverage || 'FULL',
        justification: sr.justification || '',
      }));

    if (newLinked.length > 0) {
      const updateFields = { linkedRequirements: newLinked };
      // Also fix sourceTemplateId if it's stale
      if (!ctrl.sourceTemplateId || ctrl.sourceTemplateId.toString() !== template._id.toString()) {
        updateFields.sourceTemplateId = template._id;
      }
      bulkOps.push({
        updateOne: {
          filter: { _id: ctrl._id },
          update: { $set: updateFields },
        },
      });
      repaired++;
    }
  }

  if (bulkOps.length > 0) {
    await InternalControl.bulkWrite(bulkOps);
  }

  return repaired;
};

/**
 * Toggle frameworks for an organization
 * Adds or removes framework access. Tenant compliance data is seeded once at
 * organization creation and is never deleted by entitlement changes.
 *
 * @param {String} orgId - Organization ObjectId
 * @param {String} userId - User performing the action
 * @param {Object} options - { enable: [...], disable: [...] }
 * @returns {Promise<Object>} Result summary
 */
export const toggleFrameworks = async (orgId, userId, { enable = [], disable = [] }) => {
  const org = await Organization.findOne({
    _id: orgId,
    isDeleted: false,
  });

  if (!org) {
    const error = new Error('Organization not found');
    error.statusCode = 404;
    throw error;
  }

  const result = {
    enabled: [],
    disabled: [],
    controlsCreated: 0,
    controlsRemoved: 0,
  };

  // Get current enabled framework IDs as strings for comparison
  const currentFrameworkIds = org.settings.enabledFrameworks.map(id => id.toString());

  if (enable.length > 0) {
    const frameworksToEnable = await Framework.find({
      code: { $in: enable.map(c => c.toUpperCase()) },
      isActive: true,
    });

    for (const framework of frameworksToEnable) {
      if (currentFrameworkIds.includes(framework._id.toString())) continue;
      org.settings.enabledFrameworks.push(framework._id);
      result.enabled.push(framework.code);
    }

    enable = [];
  }

  if (disable.length > 0) {
    const frameworksToDisable = await Framework.find({
      code: { $in: disable.map(c => c.toUpperCase()) },
      isActive: true,
    });

    for (const framework of frameworksToDisable) {
      if (!currentFrameworkIds.includes(framework._id.toString())) continue;
      org.settings.enabledFrameworks = org.settings.enabledFrameworks.filter(
        id => !id.equals(framework._id)
      );
      result.disabled.push(framework.code);
    }

    disable = [];
  }

  // Save organization changes
  await org.save();

  // Log activity
  await logActivity({
    organizationId: orgId,
    actorId: userId,
    action: 'UPDATE',
    entityType: 'Organization',
    entityId: orgId,
    entitySnapshot: { name: org.name },
    metadata: result,
    notes: `Frameworks toggled: enabled=[${result.enabled.join(',')}], disabled=[${result.disabled.join(',')}]`,
  });

  return getOrganization(orgId);
};

export default {
  getOrganization,
  updateOrganization,
  toggleFrameworks,
  repairControlRequirements,
};
