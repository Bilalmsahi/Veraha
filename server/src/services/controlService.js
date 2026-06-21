/**
 * Control Service
 * Business logic for internal control operations.
 * Uses existing InternalControl model statics where available.
 */

import InternalControl from '../models/InternalControl.js';
import mongoose from 'mongoose';
import Framework from '../models/Framework.js';
import Requirement from '../models/Requirement.js';
import User from '../models/User.js';
import Risk from '../models/Risk.js';
import Test from '../models/Test.js';
import { CONTROL_SOURCE } from '../models/enums.js';
import { logActivity } from './activityLogger.js';
import readinessService from './readinessService.js';
import {
  assertControlAccessibleForOrg,
  buildAccessibleControlMatch,
  getGrantedFrameworkIdSet,
  isControlAccessibleForOrg,
} from './frameworkAccessService.js';

/**
 * Recalculate residual scores for all open risks that reference a given control.
 * Ensures risk posture stays in sync when control effectiveness changes.
 */
const recalculateRisksForControl = async (orgId, controlId) => {
  const risks = await Risk.find({
    organizationId: orgId,
    isDeleted: { $ne: true },
    status: 'OPEN',
    mitigatingControlIds: controlId,
  });

  for (const risk of risks) {
    await risk.calculateResidualScore();
  }
};

async function assertControlAccessibleForWrite(control, orgId) {
  return assertControlAccessibleForOrg(control, orgId);
}

async function attachControlReadinessSummaries(controls, orgId) {
  if (!controls.length) return controls;

  const controlIds = controls.map((control) => control._id);
  const tests = await Test.find({
    organizationId: orgId,
    isDeleted: { $ne: true },
    isActive: { $ne: false },
    linkedControlIds: { $in: controlIds },
  })
    .select('_id status linkedControlIds')
    .lean();

  const testsByControlId = new Map();
  for (const test of tests) {
    for (const controlId of test.linkedControlIds || []) {
      const key = String(controlId);
      if (!controlIds.some((id) => String(id) === key)) continue;
      const list = testsByControlId.get(key) || [];
      list.push(test);
      testsByControlId.set(key, list);
    }
  }

  return Promise.all(
    controls.map(async (control) => {
      const linkedTests = testsByControlId.get(String(control._id)) || [];
      const passing = linkedTests.filter((test) => test.status === 'ok' || test.status === 'na').length;
      const readiness = await InternalControl.updateControlReadiness(control._id, orgId);
      return {
        ...control,
        testSummary: {
          total: linkedTests.length,
          passing,
          failing: Math.max(0, linkedTests.length - passing),
        },
        readiness,
      };
    })
  );
}

/**
 * Get paginated controls with filters
 * @param {String} orgId - Organization ObjectId
 * @param {Object} options - Query options
 * @returns {Promise<Object>} { controls, pagination }
 */
export const getControls = async (orgId, options) => {
  const {
    page = 1,
    limit = 20,
    status,
    controlGroup,
    source,
    frameworkCode,
    requirementId,
    categoryId,
    ownerId,
    search,
    sortBy = 'identifier',
    sortOrder = 'asc',
    includeRequirements = false,
  } = options;

  // Build base query (exclude soft-deactivated controls)
  const query = {
    organizationId: orgId,
    isDeleted: false,
    isActive: { $ne: false },
  };
  const accessMatch = await buildAccessibleControlMatch(orgId);

  // Filter by specific IDs (comma-separated)
  if (options.ids) {
    const ids = options.ids.split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.length > 0) {
      try {
        const { default: mongoose } = await import('mongoose');
        query._id = { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) };
      } catch {
        // Invalid IDs - no match
        query._id = { $in: [] };
      }
    }
  }

  // Filter by status (can be comma-separated)
  if (status) {
    const statuses = status.split(',').map(s => s.trim().toUpperCase());
    query.overallStatus = { $in: statuses };
  }

  // Filter by control group (functional label)
  if (controlGroup) {
    query.controlGroup = controlGroup;
  }

  if (source) {
    const normalizedSource = String(source).toUpperCase();
    if (normalizedSource === CONTROL_SOURCE.CUSTOM) {
      query.sourceTemplateId = null;
    } else if (normalizedSource === CONTROL_SOURCE.TEMPLATE) {
      query.sourceTemplateId = { $ne: null };
    }
  }

  // Filter by framework (invalid code must return no rows, not all controls)
  if (frameworkCode) {
    const framework = await Framework.findOne({
      code: frameworkCode.toUpperCase(),
      isActive: true,
    });
    if (!framework) {
      query._id = { $in: [] };
    } else {
      query['linkedRequirements.frameworkId'] = framework._id;
    }
  }

  // Filter by single requirement ObjectId (must run before categoryId)
  if (requirementId) {
    const { default: mongoose } = await import('mongoose');
    const reqObjId = new mongoose.Types.ObjectId(requirementId);
    const resolvedFwId = query['linkedRequirements.frameworkId'];
    if (resolvedFwId) {
      delete query['linkedRequirements.frameworkId'];
      query.linkedRequirements = {
        $elemMatch: { frameworkId: resolvedFwId, requirementId: reqObjId },
      };
    } else if (query.linkedRequirements?.$elemMatch) {
      query.linkedRequirements.$elemMatch.requirementId = reqObjId;
    } else {
      query['linkedRequirements.requirementId'] = reqObjId;
    }
  }

  /** Requirement ObjectIds allowed when filtering by categoryId (for intersect with requirementIdentifier) */
  let categoryRequirementIds = null;

  // Filter by requirement category (RequirementCategory _id)
  if (categoryId) {
    const emptyResult = query._id?.['$in'] && query._id['$in'].length === 0;
    if (!emptyResult) {
      const reqFilter = { categoryId };
      const resolvedFwId = query['linkedRequirements.frameworkId'];
      if (resolvedFwId) {
        reqFilter.frameworkId = resolvedFwId;
      }

      const catReqs = await Requirement.find(reqFilter).select('_id').lean();
      categoryRequirementIds = catReqs.map((r) => r._id);

      if (catReqs.length === 0) {
        query._id = { $in: [] };
      } else if (resolvedFwId) {
        delete query['linkedRequirements.frameworkId'];
        query.linkedRequirements = {
          $elemMatch: {
            frameworkId: resolvedFwId,
            requirementId: { $in: categoryRequirementIds },
          },
        };
      } else {
        query['linkedRequirements.requirementId'] = { $in: categoryRequirementIds };
      }
    }
  }

  // Filter by requirement identifier (e.g. CC 6.5, A.5.11); intersect with category filter if set
  if (options.requirementIdentifier) {
    const identifier = options.requirementIdentifier.trim();
    if (identifier) {
      let requirements = await Requirement.find({
        identifier: { $regex: identifier, $options: 'i' },
      }).select('_id').lean();
      let reqIds = requirements.map((r) => r._id);

      if (categoryRequirementIds && categoryRequirementIds.length > 0) {
        const allow = new Set(categoryRequirementIds.map((id) => String(id)));
        reqIds = reqIds.filter((id) => allow.has(String(id)));
      }

      if (reqIds.length > 0) {
        const resolvedFwId = query['linkedRequirements.frameworkId'];
        const elem = query.linkedRequirements?.$elemMatch;
        if (elem && elem.frameworkId && elem.requirementId?.$in) {
          const allowId = new Set(reqIds.map((id) => String(id)));
          const narrowed = elem.requirementId.$in.filter((id) => allowId.has(String(id)));
          if (narrowed.length === 0) {
            query._id = { $in: [] };
            delete query.linkedRequirements;
          } else {
            query.linkedRequirements = {
              $elemMatch: {
                frameworkId: elem.frameworkId,
                requirementId: { $in: narrowed },
              },
            };
          }
        } else if (resolvedFwId) {
          // Same subdocument must match framework + requirement (avoid cross-subdoc AND bug)
          delete query['linkedRequirements.frameworkId'];
          query.linkedRequirements = {
            $elemMatch: {
              frameworkId: resolvedFwId,
              requirementId: { $in: reqIds },
            },
          };
        } else {
          query['linkedRequirements.requirementId'] = { $in: reqIds };
        }
      } else {
        query._id = { $in: [] };
        delete query['linkedRequirements.frameworkId'];
        delete query['linkedRequirements.requirementId'];
        delete query.linkedRequirements;
      }
    }
  }

  // Filter by owner
  if (ownerId) {
    query.ownerId = ownerId;
  }

  // Search by identifier or title
  if (search) {
    query.$or = [
      { identifier: { $regex: search, $options: 'i' } },
      { title: { $regex: search, $options: 'i' } },
    ];
  }

  // Get total count
  const accessQuery = { $and: [query, accessMatch] };
  const total = await InternalControl.countDocuments(accessQuery);

  // Build query
  let controlsQuery = InternalControl.find(accessQuery)
    .select('identifier title description controlGroup manualStatus automationStatus overallStatus ownerId lastAssessedAt nextAssessmentDue frequency isPurchased isActive linkedRequirements createdAt')
    .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('ownerId', 'firstName lastName email');

  if (includeRequirements) {
    controlsQuery = controlsQuery
      .populate({ path: 'linkedRequirements.requirementId', select: 'identifier' })
      .populate({ path: 'linkedRequirements.frameworkId', select: 'code' });
  }

  const controls = await controlsQuery.lean();

  const [organization, grants, allFrameworks] = await Promise.all([
    Promise.resolve(null),
    Promise.resolve([]),
    Framework.find({ isActive: true }).select('code name').lean(),
  ]);
  void organization;
  void grants;
  const purchasedFrameworkIds = await getGrantedFrameworkIdSet(orgId);
  const frameworkById = new Map(allFrameworks.map((framework) => [framework._id.toString(), framework]));

  // Add requirement count; strip linkedRequirements unless includeRequirements
  const controlsWithCounts = controls.map(c => {
    const rawReqs = c.linkedRequirements || [];
    const reqCount = rawReqs.length;
    const reqs = includeRequirements ? rawReqs
      .map((lr) => {
        const req = lr.requirementId;
        const fw = lr.frameworkId;
        if (!req || !fw) return null;
        const identifier = typeof req === 'object' ? req.identifier : null;
        const code = typeof fw === 'object' ? fw.code : null;
        const requirementId =
          typeof req === 'object' && req._id != null ? String(req._id) : String(lr.requirementId ?? '');
        const frameworkIdStr =
          typeof fw === 'object' && fw._id != null ? String(fw._id) : String(lr.frameworkId ?? '');
        if (!requirementId || !frameworkIdStr) return null;
        if (!code && !identifier) return null;
        return {
          requirementId,
          frameworkId: frameworkIdStr,
          code: code ? `${code} ${identifier ?? ''}`.trim() : identifier ?? '',
          justification: lr.justification,
        };
      })
      .filter(Boolean) : undefined;
    const linkedFrameworkIds = rawReqs
      .map((lr) => {
        const fw = lr.frameworkId;
        return typeof fw === 'object' && fw?._id ? fw._id.toString() : String(fw || '');
      })
      .filter(Boolean);
    const accessibleFrameworkId = linkedFrameworkIds.find((id) => purchasedFrameworkIds.has(id));
    const primaryFramework = frameworkById.get(accessibleFrameworkId || linkedFrameworkIds[0] || '');
    return {
      ...c,
      requirementCount: reqCount,
      linkedRequirements: reqs,
      isAccessible: linkedFrameworkIds.length === 0 || Boolean(accessibleFrameworkId),
      frameworkName: primaryFramework?.name || null,
      frameworkSlug: primaryFramework?.code || null,
    };
  });

  const pages = Math.ceil(total / limit);

  const controlsWithReadiness = await attachControlReadinessSummaries(controlsWithCounts, orgId);

  return {
    controls: controlsWithReadiness,
    pagination: {
      page,
      limit,
      total,
      pages,
      hasNextPage: page < pages,
      hasPrevPage: page > 1,
    },
  };
};

/**
 * Get single control by ID with full details
 * @param {String} controlId - Control ObjectId
 * @param {String} orgId - Organization ObjectId
 * @returns {Promise<Object>} Control document
 */
export const getControlById = async (controlId, orgId) => {
  const control = await InternalControl.findOne({
    _id: controlId,
    organizationId: orgId,
    isDeleted: false,
    isActive: { $ne: false },
  })
    .populate('ownerId', 'firstName lastName email')
    .populate('sourceTemplateId', 'identifier title')
    .populate('linkedPolicyIds', 'title status')
    .populate({
      path: 'linkedRequirements.requirementId',
      select: 'identifier title',
    })
    .populate({
      path: 'linkedRequirements.frameworkId',
      select: 'code name',
    })
    .lean();

  if (!control) {
    const error = new Error('Control not found');
    error.statusCode = 404;
    throw error;
  }

  const isAccessible = await isControlAccessibleForOrg(control, orgId);
  if (!isAccessible) {
    const error = new Error('Control not found');
    error.statusCode = 404;
    throw error;
  }

  // Derive linked risks from Risk.mitigatingControlIds for consistency
  const linkedRisks = await Risk.find({
    organizationId: orgId,
    isDeleted: { $ne: true },
    mitigatingControlIds: controlId,
  })
    .select('title status riskLevel')
    .lean();

  // Transform linkedRequirements for cleaner response; filter out stale refs
  control.linkedRequirements = (control.linkedRequirements || [])
    .map(lr => ({
      requirementId:
        typeof lr.requirementId === 'object' && lr.requirementId
          ? String(lr.requirementId._id ?? '')
          : String(lr.requirementId ?? ''),
      frameworkId:
        typeof lr.frameworkId === 'object' && lr.frameworkId
          ? String(lr.frameworkId._id ?? '')
          : String(lr.frameworkId ?? ''),
      requirement: typeof lr.requirementId === 'object' && lr.requirementId ? lr.requirementId : null,
      framework: typeof lr.frameworkId === 'object' && lr.frameworkId ? lr.frameworkId : null,
      coverage: lr.coverage,
      justification: lr.justification,
    }))
    .filter(lr => lr.requirement && lr.framework);

  control.linkedRiskIds = linkedRisks;
  const [readiness, testSummaryControls] = await Promise.all([
    InternalControl.updateControlReadiness(controlId, orgId),
    attachControlReadinessSummaries([control], orgId),
  ]);
  control.readiness = readiness;
  control.testSummary = testSummaryControls[0]?.testSummary ?? { total: 0, passing: 0, failing: 0 };
  control.isAccessible = isAccessible;

  if (!isAccessible) {
    control.linkedPolicyIds = [];
    control.linkedRiskIds = [];
    control.implementationNotes = undefined;
  }

  return control;
};

/**
 * Map control to framework requirement
 */
export const mapRequirementToControl = async (controlId, orgId, userId, data) => {
  const control = await InternalControl.findOne({
    _id: controlId,
    organizationId: orgId,
    isDeleted: false,
    isActive: { $ne: false },
  });

  if (!control) {
    const error = new Error('Control not found');
    error.statusCode = 404;
    throw error;
  }
  await assertControlAccessibleForWrite(control, orgId);

  const framework = await Framework.findOne({ _id: data.frameworkId, isActive: true });
  if (!framework) {
    const error = new Error('Framework not found');
    error.statusCode = 400;
    throw error;
  }

  const requirement = await Requirement.findOne({
    _id: data.requirementId,
    frameworkId: data.frameworkId,
    isActive: true,
  });
  if (!requirement) {
    const error = new Error('Requirement not found for selected framework');
    error.statusCode = 400;
    throw error;
  }

  const exists = (control.linkedRequirements || []).some((lr) =>
    lr.frameworkId?.toString() === data.frameworkId &&
    lr.requirementId?.toString() === data.requirementId
  );

  if (!exists) {
    control.linkedRequirements.push({
      frameworkId: data.frameworkId,
      requirementId: data.requirementId,
      coverage: data.coverage || 'FULL',
      justification: data.justification || '',
    });

    await control.save();

    await logActivity({
      organizationId: orgId,
      actorId: userId,
      action: 'UPDATE',
      entityType: 'InternalControl',
      entityId: control._id,
      entitySnapshot: { identifier: control.identifier, title: control.title },
      notes: `Mapped control to ${framework.code} ${requirement.identifier}`,
    });
  }

  return getControlById(controlId, orgId);
};

/**
 * Get status counts - delegates to model static
 * @param {String} orgId - Organization ObjectId
 * @returns {Promise<Object>} Status counts
 */
export const getStatusCounts = async (orgId) => {
  const accessMatch = await buildAccessibleControlMatch(orgId);
  const results = await InternalControl.aggregate([
    {
      $match: {
        organizationId: new mongoose.Types.ObjectId(orgId),
        isDeleted: { $ne: true },
        isActive: { $ne: false },
        ...accessMatch,
      },
    },
    { $group: { _id: '$overallStatus', count: { $sum: 1 } } },
  ]);

  const counts = {
    PASS: 0,
    FAIL: 0,
    WARNING: 0,
    NOT_APPLICABLE: 0,
    NOT_CONFIGURED: 0,
    total: 0,
  };
  results.forEach(({ _id, count }) => {
    if (_id && Object.prototype.hasOwnProperty.call(counts, _id)) counts[_id] = count;
    counts.total += count;
  });
  return counts;
};

/**
 * Get framework gap analysis - delegates to model static
 * @param {String} orgId - Organization ObjectId
 * @param {String} frameworkCode - Framework code
 * @returns {Promise<Object>} Gap analysis
 */
export const getFrameworkGapAnalysis = async (orgId, frameworkCode) => {
  const framework = await Framework.findOne({
    code: frameworkCode.toUpperCase(),
    isActive: true,
  });

  if (!framework) {
    const error = new Error(`Framework '${frameworkCode}' not found`);
    error.statusCode = 404;
    throw error;
  }

  return InternalControl.getFrameworkGapAnalysis(orgId, framework._id);
};

/**
 * Get framework readiness score - delegates to model static
 * @param {String} orgId - Organization ObjectId
 * @param {String} frameworkCode - Framework code
 * @returns {Promise<Object>} Readiness score
 */
export const getFrameworkReadiness = async (orgId, frameworkCode) => {
  return readinessService.getFrameworkReadinessWithWorkflowOverlay(orgId, frameworkCode);
};

/**
 * Update control
 * @param {String} controlId - Control ObjectId
 * @param {String} orgId - Organization ObjectId
 * @param {String} userId - User performing update
 * @param {Object} updateData - Fields to update
 * @returns {Promise<Object>} Updated control
 */
export const updateControl = async (controlId, orgId, userId, updateData) => {
  const control = await InternalControl.findOne({
    _id: controlId,
    organizationId: orgId,
    isDeleted: false,
  });

  if (!control) {
    const error = new Error('Control not found');
    error.statusCode = 404;
    throw error;
  }
  await assertControlAccessibleForWrite(control, orgId);

  // Track changes for activity log
  const before = {};
  const after = {};
  const changedFields = [];

  // Update allowed fields
  if (updateData.manualStatus !== undefined) {
    before.manualStatus = control.manualStatus;
    control.manualStatus = updateData.manualStatus;
    after.manualStatus = updateData.manualStatus;
    changedFields.push('manualStatus');
  }

  if (updateData.ownerId !== undefined) {
    before.ownerId = control.ownerId;
    
    // Validate owner exists in same org if not null
    if (updateData.ownerId !== null) {
      const owner = await User.findOne({
        _id: updateData.ownerId,
        organizationId: orgId,
        isDeleted: false,
      });
      if (!owner) {
        const error = new Error('Owner not found in your organization');
        error.statusCode = 400;
        throw error;
      }
    }
    
    control.ownerId = updateData.ownerId;
    after.ownerId = updateData.ownerId;
    changedFields.push('ownerId');
  }

  if (updateData.implementationNotes !== undefined) {
    before.implementationNotes = control.implementationNotes;
    control.implementationNotes = updateData.implementationNotes;
    after.implementationNotes = updateData.implementationNotes;
    changedFields.push('implementationNotes');
  }

  if (updateData.nextAssessmentDue !== undefined) {
    before.nextAssessmentDue = control.nextAssessmentDue;
    control.nextAssessmentDue = updateData.nextAssessmentDue;
    after.nextAssessmentDue = updateData.nextAssessmentDue;
    changedFields.push('nextAssessmentDue');
  }

  if (updateData.isActive !== undefined) {
    before.isActive = control.isActive;
    control.isActive = updateData.isActive;
    after.isActive = updateData.isActive;
    changedFields.push('isActive');
  }

  if (updateData.frequency !== undefined) {
    before.frequency = control.frequency;
    control.frequency = updateData.frequency;
    after.frequency = updateData.frequency;
    changedFields.push('frequency');
  }

  if (updateData.isPurchased !== undefined) {
    before.isPurchased = control.isPurchased;
    control.isPurchased = updateData.isPurchased;
    after.isPurchased = updateData.isPurchased;
    changedFields.push('isPurchased');
  }

  await control.save();
  if (changedFields.some((field) => ['manualStatus', 'isActive', 'isPurchased'].includes(field))) {
    await readinessService.recalculateReadinessForOrg(orgId);
  }

  // Log activity
  await logActivity({
    organizationId: orgId,
    actorId: userId,
    action: 'UPDATE',
    entityType: 'InternalControl',
    entityId: controlId,
    entitySnapshot: {
      identifier: control.identifier,
      title: control.title,
    },
    changes: { before, after, fields: changedFields },
    notes: `Control updated: ${changedFields.join(', ')}`,
  });

  return getControlById(controlId, orgId);
};

/**
 * Record manual assessment
 * @param {String} controlId - Control ObjectId
 * @param {String} orgId - Organization ObjectId
 * @param {String} userId - User performing assessment
 * @param {Object} assessmentData - { status, notes }
 * @returns {Promise<Object>} Updated control
 */
export const assessControl = async (controlId, orgId, userId, assessmentData) => {
  const control = await InternalControl.findOne({
    _id: controlId,
    organizationId: orgId,
    isDeleted: false,
  });

  if (!control) {
    const error = new Error('Control not found');
    error.statusCode = 404;
    throw error;
  }
  await assertControlAccessibleForWrite(control, orgId);

  const before = {
    manualStatus: control.manualStatus,
    lastAssessedAt: control.lastAssessedAt,
  };

  // Update assessment fields
  control.manualStatus = assessmentData.status;
  control.lastAssessedAt = new Date();
  control.lastAssessedBy = userId;

  // Add notes to implementation notes if provided
  if (assessmentData.notes) {
    const timestamp = new Date().toISOString().split('T')[0];
    const noteEntry = `[${timestamp}] Assessment: ${assessmentData.status}. ${assessmentData.notes}`;
    control.implementationNotes = control.implementationNotes
      ? `${control.implementationNotes}\n\n${noteEntry}`
      : noteEntry;
  }

  await control.save();

  // Log activity
  await logActivity({
    organizationId: orgId,
    actorId: userId,
    action: 'UPDATE',
    entityType: 'InternalControl',
    entityId: controlId,
    entitySnapshot: {
      identifier: control.identifier,
      title: control.title,
    },
    changes: {
      before,
      after: {
        manualStatus: control.manualStatus,
        lastAssessedAt: control.lastAssessedAt,
      },
      fields: ['manualStatus', 'lastAssessedAt'],
    },
    metadata: {
      assessmentType: 'manual',
      assessmentStatus: assessmentData.status,
    },
    notes: `Manual assessment recorded: ${assessmentData.status}`,
  });

  // Update residual scores for risks mitigated by this control
  await recalculateRisksForControl(orgId, controlId);
  await readinessService.recalculateReadinessForOrg(orgId);

  return getControlById(controlId, orgId);
};

/**
 * Bulk update controls
 * @param {String} orgId - Organization ObjectId
 * @param {String} userId - User performing update
 * @param {Array<String>} controlIds - Control IDs to update
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Update summary
 */
export const bulkUpdateControls = async (orgId, userId, controlIds, updates) => {
  const result = {
    updated: 0,
    failed: 0,
    errors: [],
  };

  // Validate owner if being set
  if (updates.ownerId !== undefined && updates.ownerId !== null) {
    const owner = await User.findOne({
      _id: updates.ownerId,
      organizationId: orgId,
      isDeleted: false,
    });
    if (!owner) {
      const error = new Error('Owner not found in your organization');
      error.statusCode = 400;
      throw error;
    }
  }

  for (const controlId of controlIds) {
    try {
      const control = await InternalControl.findOne({
        _id: controlId,
        organizationId: orgId,
        isDeleted: false,
      });

      if (!control) {
        result.failed++;
        result.errors.push({ controlId, error: 'Control not found' });
        continue;
      }
      await assertControlAccessibleForWrite(control, orgId);

      if (updates.manualStatus !== undefined) {
        control.manualStatus = updates.manualStatus;
      }

      if (updates.ownerId !== undefined) {
        control.ownerId = updates.ownerId;
      }

      await control.save();
      result.updated++;
    } catch (err) {
      result.failed++;
      result.errors.push({ controlId, error: err.message });
    }
  }

  if (updates.manualStatus !== undefined) {
    await readinessService.recalculateReadinessForOrg(orgId);
  }

  // Log bulk activity
  await logActivity({
    organizationId: orgId,
    actorId: userId,
    action: 'UPDATE',
    entityType: 'InternalControl',
    entityId: orgId, // Use org as entity for bulk ops
    metadata: {
      bulkOperation: true,
      controlCount: controlIds.length,
      updated: result.updated,
      failed: result.failed,
      updates,
    },
    notes: `Bulk update: ${result.updated} controls updated`,
  });

  return result;
};

/**
 * Get unique requirement identifiers from org's controls (for Framework code filter)
 * Falls back to all requirements for org's enabled frameworks when no controls have linkedRequirements.
 * @param {String} orgId - Organization ObjectId
 * @param {String} [frameworkCode] - Optional framework to filter by
 * @returns {Promise<Array<{frameworkCode:string,identifier:string,label:string}>>}
 */
export const getRequirementCodes = async (orgId, frameworkCode) => {
  const match = { organizationId: orgId, isDeleted: false, isActive: { $ne: false }, 'linkedRequirements.0': { $exists: true } };
  Object.assign(match, await buildAccessibleControlMatch(orgId));
  const controls = await InternalControl.find(match)
    .select('linkedRequirements')
    .populate({ path: 'linkedRequirements.requirementId', select: 'identifier' })
    .populate({ path: 'linkedRequirements.frameworkId', select: 'code name' })
    .lean();
  const seen = new Set();
  const result = [];
  for (const c of controls) {
    for (const lr of c.linkedRequirements || []) {
      const req = lr.requirementId;
      const fw = lr.frameworkId;
      // After populate, req/fw are objects if the reference is valid, or null/ObjectId if stale
      if (!req || !fw || typeof req !== 'object' || typeof fw !== 'object') continue;
      if (!fw.code || !req.identifier) continue;
      const code = fw.code.toUpperCase();
      if (frameworkCode && code !== frameworkCode.toUpperCase()) continue;
      const key = `${code}:${req.identifier}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const fwName = fw.name || code;
      result.push({
        frameworkCode: code,
        frameworkName: fwName,
        identifier: req.identifier,
        label: `${fwName} · ${req.identifier}`.trim(),
      });
    }
  }

  // Fallback: if no accessible controls have linkedRequirements, return requirements from granted frameworks.
  if (result.length === 0) {
    let frameworkIds = [];
    const grantedFrameworkIds = await getGrantedFrameworkIdSet(orgId);
    frameworkIds = [...grantedFrameworkIds];
    if (frameworkIds.length === 0) {
      return [];
    }
    if (frameworkIds.length > 0) {
      const requirements = await Requirement.find({
        frameworkId: { $in: frameworkIds },
        isActive: true,
      })
        .select('identifier frameworkId')
        .populate({ path: 'frameworkId', select: 'code name' })
        .lean();
      for (const req of requirements) {
        const fw = req.frameworkId;
        if (!fw) continue;
        const code = (fw.code || '').toUpperCase();
        if (frameworkCode && code !== frameworkCode.toUpperCase()) continue;
        const identifier = req.identifier || '';
        const key = `${code}:${identifier}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const fwName = fw.name || code;
        result.push({
          frameworkCode: code,
          frameworkName: fwName,
          identifier,
          label: `${fwName} · ${identifier}`.trim(),
        });
      }
    }
  }

  result.sort((a, b) => a.label.localeCompare(b.label));
  return result;
};

/**
 * Get unique categories from org's controls
 * @param {String} orgId - Organization ObjectId
 * @returns {Promise<Array>} Categories with counts
 */
export const getCategories = async (orgId) => {
  const accessMatch = await buildAccessibleControlMatch(orgId);
  const categories = await InternalControl.aggregate([
    { $match: { organizationId: orgId, isDeleted: false, isActive: { $ne: false }, controlGroup: { $ne: null, $ne: '' }, ...accessMatch } },
    { $group: { _id: '$controlGroup', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $project: { controlGroup: '$_id', count: 1, _id: 0 } },
  ]);

  return categories;
};

/**
 * Create a custom control (not from template)
 */
export const createControl = async (orgId, userId, data) => {
  const existing = await InternalControl.findOne({
    organizationId: orgId,
    identifier: data.identifier,
    isDeleted: false,
  });
  if (existing) {
    const error = new Error(`Control with identifier "${data.identifier}" already exists`);
    error.statusCode = 409;
    throw error;
  }

  if (data.ownerId) {
    const owner = await User.findOne({ _id: data.ownerId, organizationId: orgId, isDeleted: false });
    if (!owner) {
      const error = new Error('Owner not found in your organization');
      error.statusCode = 400;
      throw error;
    }
  }

  const control = await InternalControl.create({
    organizationId: orgId,
    identifier: data.identifier,
    title: String(data.title || data.description || data.identifier).slice(0, 300),
    description: data.description || '',
    controlGroup: data.controlGroup || '',
    frequency: data.frequency || 'QUARTERLY',
    isPurchased: data.isPurchased !== false,
    isActive: true,
    implementationNotes: data.implementationNotes || '',
    nextAssessmentDue: data.nextAssessmentDue || null,
    ownerId: data.ownerId || null,
    sourceTemplateId: null,
    manualStatus: 'NOT_APPLICABLE',
    automationStatus: 'NOT_CONFIGURED',
    overallStatus: 'NOT_CONFIGURED',
  });

  await logActivity({
    organizationId: orgId,
    actorId: userId,
    action: 'CREATE',
    entityType: 'InternalControl',
    entityId: control._id,
    entitySnapshot: { identifier: control.identifier, title: control.title },
    notes: 'Custom control created',
  });

  return getControlById(control._id, orgId);
};

/**
 * Create control from a GlobalControlTemplate
 */
export const createFromTemplate = async (orgId, userId, templateId) => {
  const GlobalControlTemplate = (await import('../models/GlobalControlTemplate.js')).default;

  const template = await GlobalControlTemplate.findOne({ _id: templateId, isActive: true });
  if (!template) {
    const error = new Error('Template not found');
    error.statusCode = 404;
    throw error;
  }

  const existing = await InternalControl.findOne({
    organizationId: orgId,
    identifier: template.identifier,
    isDeleted: false,
  });
  if (existing) {
    const error = new Error(`Control "${template.identifier}" already exists in your organization`);
    error.statusCode = 409;
    throw error;
  }

  const enabledFrameworkIds = await getGrantedFrameworkIdSet(orgId);

  const control = await InternalControl.create({
    organizationId: orgId,
    sourceTemplateId: template._id,
    identifier: template.identifier,
    title: template.title,
    description: template.description,
    controlGroup: template.controlGroup,
    frequency: template.frequency || 'QUARTERLY',
    isPurchased: true,
    isActive: true,
    implementationNotes: template.implementationGuidance || '',
    linkedRequirements: (template.suggestedRequirements || []).filter(sr =>
      enabledFrameworkIds.has(sr.frameworkId?.toString())
    ),
    manualStatus: 'NOT_APPLICABLE',
    automationStatus: 'NOT_CONFIGURED',
    overallStatus: 'NOT_CONFIGURED',
  });

  await logActivity({
    organizationId: orgId,
    actorId: userId,
    action: 'CREATE',
    entityType: 'InternalControl',
    entityId: control._id,
    entitySnapshot: { identifier: control.identifier, title: control.title, templateId: template._id.toString() },
    notes: `Created from template: ${template.identifier}`,
  });

  return getControlById(control._id, orgId);
};

export default {
  getControls,
  getControlById,
  getStatusCounts,
  getFrameworkGapAnalysis,
  getFrameworkReadiness,
  updateControl,
  assessControl,
  bulkUpdateControls,
  getCategories,
  getRequirementCodes,
  createControl,
  createFromTemplate,
  mapRequirementToControl,
};
