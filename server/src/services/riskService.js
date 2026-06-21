/**
 * Risk Service
 * Business logic for Risk management
 * 
 * Uses shared enums from models/enums.js for status consistency
 */
import mongoose from 'mongoose';
import Risk from '../models/Risk.js';
import RiskAssessment from '../models/RiskAssessment.js';
import InternalControl from '../models/InternalControl.js';
import User from '../models/User.js';
import { logCrudOperation } from './activityLogger.js';
import { RISK_STATUS, TREATMENT } from '../models/enums.js';
import { andAccess, buildLinkedControlEntityAccessMatch } from './frameworkAccessService.js';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Calculate Vanta-style risk score and level for 1–3 scale.
 * Score = likelihood × impact (allowed scores: 1, 2, 3, 4, 6, 9)
 */
export const calculateRisk = (likelihood, impact) => {
  if (likelihood == null || impact == null) return null;

  const l = Math.max(1, Math.min(3, Number(likelihood)));
  const i = Math.max(1, Math.min(3, Number(impact)));
  const score = l * i;

  let level = 'Low';
  if (score === 9) level = 'High';
  else if (score === 3 || score === 4 || score === 6) level = 'Medium';

  return { likelihood: l, impact: i, score, level };
};

const APPROVER_ROLES = ['ADMIN', 'MANAGER'];

function makeError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateRiskApprovalReadiness(risk, action = 'approval') {
  if (!risk.ownerId) {
    throw makeError(`Owner must be assigned before ${action}`, 400);
  }

  const missing = ['likelihood', 'impact', 'residualLikelihood', 'residualImpact'].filter(
    (field) => risk[field] == null
  );
  if (missing.length > 0) {
    throw makeError(`Cannot ${action}: missing fields: ${missing.join(', ')}`, 422);
  }

  if (!risk.treatment) {
    throw makeError(`Treatment must be set before ${action}`, 422);
  }
}

async function populateRiskForResponse(riskOrId) {
  const query = typeof riskOrId?.populate === 'function'
    ? riskOrId
    : Risk.findById(riskOrId);

  return query
    .populate('ownerId', 'firstName lastName email')
    .populate('assignedApproverIds', 'firstName lastName email role')
    .populate('approvals.approverId', 'firstName lastName email')
    .populate('mitigatingControlIds', 'identifier title overallStatus');
}

// =============================================================================
// RISK CRUD
// =============================================================================

/**
 * Create a new risk
 * Ensures identifier is never empty: uses provided value (trimmed) or generates R-{seq}.
 */
export const createRisk = async (data, user) => {
  const { organizationId, userId } = user;

  const { residualLikelihood, residualImpact, ...rest } = data;

  const providedId = rest.identifier != null && String(rest.identifier).trim() !== ''
    ? String(rest.identifier).trim()
    : null;

  if (!providedId) {
    const count = await Risk.countDocuments({
      organizationId,
      isDeleted: { $ne: true },
    });
    rest.identifier = `R-${String(count + 1).padStart(1, '0')}`;
  } else {
    rest.identifier = providedId;
  }

  const risk = await Risk.create({
    organizationId,
    ...rest,
    residualLikelihood: residualLikelihood ?? undefined,
    residualImpact: residualImpact ?? undefined,
    status: RISK_STATUS[0], // 'OPEN'
    identifiedBy: userId,
    identifiedAt: new Date(),
    ownerId: rest.ownerId || userId,
  });

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'CREATE',
    entityType: 'Risk',
    entityId: risk._id,
    entitySnapshot: { title: risk.title, inherentScore: risk.inherentScore },
  });

  await risk.populate('ownerId', 'firstName lastName email');
  await risk.populate('mitigatingControlIds', 'identifier title overallStatus');

  return risk;
};

/**
 * Get paginated risk list
 */
export const getRisks = async (orgId, filters) => {
  const {
    page = 1,
    limit = 20,
    status,
    riskLevel,
    treatment,
    treatmentPlan,
    category,
    ownerId,
    owner,
    userId,
    inherent,
    residual,
    approverId,
    reviewDue,
    stale,
    search,
    sortBy = 'residualScore',
    sortOrder = 'desc',
  } = filters;

  const query = { organizationId: orgId, isDeleted: false };

  // Status: support Vanta-style (DRAFT, NEEDS_REVIEW, PENDING_APPROVAL, APPROVED) map to OPEN/CLOSED
  if (status) {
    const raw = status.split(',').map((s) => s.trim().toUpperCase());
    const vantaToInternal = [];
    for (const s of raw) {
      if (s === 'APPROVED') vantaToInternal.push('CLOSED');
      else if (s === 'PENDING_APPROVAL') vantaToInternal.push('PENDING_APPROVAL');
      else if (['DRAFT', 'NEEDS_REVIEW'].includes(s)) vantaToInternal.push('OPEN');
      else if (RISK_STATUS.includes(s)) vantaToInternal.push(s);
    }
    if (vantaToInternal.length > 0) query.status = { $in: [...new Set(vantaToInternal)] };
  }

  if (riskLevel) {
    const levels = riskLevel.split(',').map((l) => l.trim().toUpperCase());
    query.riskLevel = { $in: levels };
  }

  if (treatment) {
    const treatments = treatment.split(',').map((t) => t.trim().toUpperCase());
    const valid = treatments.filter((t) => TREATMENT.includes(t));
    if (valid.length > 0) query.treatment = { $in: valid };
  }
  if (treatmentPlan) {
    const t = treatmentPlan.trim().toUpperCase();
    if (TREATMENT.includes(t)) query.treatment = t;
  }

  if (category) query.category = { $regex: category, $options: 'i' };

  // Owner: support special values __me__, __unassigned__, __needs_reassignment__
  const ownerFilter = owner || ownerId;
  if (ownerFilter) {
    if (ownerFilter === '__me__' && userId) {
      query.ownerId = userId;
    } else if (ownerFilter === '__unassigned__' || ownerFilter === '__needs_reassignment__') {
      query.ownerId = null;
    } else {
      query.ownerId = ownerFilter;
    }
  }

  if (inherent) {
    const level = inherent.trim().toUpperCase();
    if (level === 'HIGH' || level === 'MED' || level === 'LOW') {
      const mappedLevel = level === 'MED' ? 'Medium' : level.charAt(0) + level.slice(1).toLowerCase();
      query['inherentRisk.level'] = mappedLevel;
    }
  }

  if (residual) {
    const level = residual.trim().toUpperCase();
    if (level === 'HIGH' || level === 'MED' || level === 'LOW') {
      const mappedLevel = level === 'MED' ? 'Medium' : level.charAt(0) + level.slice(1).toLowerCase();
      query['residualRisk.level'] = mappedLevel;
    }
  }

  // Approver: Risk model has no approverId; support when model is extended
  if (approverId) {
    if (approverId === '__me__' && userId) {
      query.assignedApproverIds = userId;
    } else if (approverId === '__needs_reassignment__') {
      query.$or = [
        ...(query.$or || []),
        { assignedApproverIds: { $exists: false } },
        { assignedApproverIds: { $size: 0 } },
      ];
    } else if (mongoose.Types.ObjectId.isValid(approverId)) {
      query.assignedApproverIds = approverId;
    }
  }

  if (reviewDue === 'true') query.nextReviewDue = { $lt: new Date() };

  if (stale === 'true') {
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 30);
    query.$or = [
      { updatedAt: { $lt: staleDate } },
      { updatedAt: { $exists: false } },
    ];
  }

  if (search) {
    // Override $or if stale is also set - combine conditions
    const searchConditions = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { identifier: { $regex: search, $options: 'i' } },
    ];

    if (query.$or) {
      // Stale filter already set $or, need to use $and
      query.$and = [{ $or: query.$or }, { $or: searchConditions }];
      delete query.$or;
    } else {
      query.$or = searchConditions;
    }
  }

  const accessQuery = andAccess(query, await buildLinkedControlEntityAccessMatch(orgId, 'mitigatingControlIds'));

  const total = await Risk.countDocuments(accessQuery);
  const risks = await Risk.find(accessQuery)
    .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('ownerId', 'firstName lastName email')
    .populate('assignedApproverIds', 'firstName lastName email role')
    .lean();

  return {
    risks,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    },
  };
};

/**
 * Get single risk with full details
 */
export const getRiskById = async (riskId, orgId) => {
  const accessMatch = await buildLinkedControlEntityAccessMatch(orgId, 'mitigatingControlIds');
  const risk = await Risk.findOne({
    $and: [
      { _id: riskId, organizationId: orgId, isDeleted: false },
      accessMatch,
    ],
  })
    .populate('ownerId', 'firstName lastName email')
    .populate('identifiedBy', 'firstName lastName email')
    .populate('lastReviewedBy', 'firstName lastName email')
    .populate('closedBy', 'firstName lastName email')
    .populate('mitigatingControlIds', 'identifier title description overallStatus')
    .populate('assignedApproverIds', 'firstName lastName email role')
    .populate('approvals.approverId', 'firstName lastName email');

  if (!risk) {
    const error = new Error('Risk not found');
    error.statusCode = 404;
    throw error;
  }

  const result = risk.toObject();
  if (!result.identifier || String(result.identifier).trim() === '') {
    result.identifier = `R-${result._id.toString().slice(-6)}`;
  }

  return result;
};

/**
 * Update risk
 */
export const updateRisk = async (riskId, data, user) => {
  const { organizationId, userId } = user;

  const { residualLikelihood, residualImpact, ...rest } = data;

  const risk = await Risk.findOne({
    _id: riskId,
    organizationId,
    isDeleted: false,
  });

  if (!risk) {
    const error = new Error('Risk not found');
    error.statusCode = 404;
    throw error;
  }

  const before = risk.toObject();

  if (residualLikelihood !== undefined) risk.residualLikelihood = residualLikelihood;
  if (residualImpact !== undefined) risk.residualImpact = residualImpact;
  Object.assign(risk, rest);


  // Recalculate inherent risk if likelihood or impact changed
  if (rest.likelihood !== undefined || rest.impact !== undefined) {
    const inherentCalc = calculateRisk(
      risk.likelihood ?? rest.likelihood,
      risk.impact ?? rest.impact
    );
    if (inherentCalc) {
      risk.inherentRisk = inherentCalc;
    }
  }

  // Recalculate residual risk if residualLikelihood or residualImpact changed
  if (rest.residualLikelihood !== undefined || rest.residualImpact !== undefined) {
    const residualCalc = calculateRisk(
      risk.residualLikelihood ?? rest.residualLikelihood,
      risk.residualImpact ?? rest.residualImpact
    );
    if (residualCalc) {
      risk.residualRisk = residualCalc;
      risk.residualScore = residualCalc.score;
    }
  }
  await risk.save();

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'UPDATE',
    entityType: 'Risk',
    entityId: risk._id,
    entitySnapshot: { title: risk.title },
    before,
    after: risk.toObject(),
  });

  await risk.populate('ownerId', 'firstName lastName email');
  await risk.populate('assignedApproverIds', 'firstName lastName email role');
  await risk.populate('mitigatingControlIds', 'identifier title overallStatus');

  return risk;
};

/**
 * Delete risk (soft delete)
 */
export const deleteRisk = async (riskId, user) => {
  const { organizationId, userId } = user;

  const risk = await Risk.findOne({
    _id: riskId,
    organizationId,
    isDeleted: false,
  });

  if (!risk) {
    const error = new Error('Risk not found');
    error.statusCode = 404;
    throw error;
  }

  risk.isDeleted = true;
  risk.deletedAt = new Date();
  risk.deletedBy = userId;
  await risk.save();

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'DELETE',
    entityType: 'Risk',
    entityId: risk._id,
    entitySnapshot: { title: risk.title },
  });

  return { deleted: true, id: riskId };
};

// =============================================================================
// RISK LIFECYCLE
// =============================================================================

/**
 * Close a risk
 */
export const closeRisk = async (riskId, data, user) => {
  const { organizationId, userId } = user;

  const risk = await Risk.findOne({
    _id: riskId,
    organizationId,
    isDeleted: false,
  });

  if (!risk) {
    const error = new Error('Risk not found');
    error.statusCode = 404;
    throw error;
  }

  if (risk.status === 'CLOSED') {
    // 'CLOSED'
    const error = new Error('Risk is already closed');
    error.statusCode = 400;
    throw error;
  }

  const beforeStatus = risk.status;
  risk.status = 'CLOSED';
  risk.closedAt = new Date();
  risk.closedBy = userId;
  risk.closureReason = data.closureReason;
  await risk.save();

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'STATUS_CHANGE',
    entityType: 'Risk',
    entityId: risk._id,
    entitySnapshot: { title: risk.title },
    before: { status: beforeStatus },
    after: { status: 'CLOSED' },
  });

  return populateRiskForResponse(risk);
};

/**
 * Reopen a closed risk
 */
export const reopenRisk = async (riskId, data, user) => {
  const { organizationId, userId } = user;

  const risk = await Risk.findOne({
    _id: riskId,
    organizationId,
    isDeleted: false,
  });

  if (!risk) {
    const error = new Error('Risk not found');
    error.statusCode = 404;
    throw error;
  }

  if (risk.status === 'OPEN') {
    // 'OPEN'
    const error = new Error('Risk is already open');
    error.statusCode = 400;
    throw error;
  }

  const beforeStatus = risk.status;
  risk.status = 'OPEN';
  risk.closedAt = null;
  risk.closedBy = null;
  risk.closureReason = null;
  risk.assignedApproverIds = [];
  risk.submittedForApprovalAt = null;
  risk.submittedForApprovalBy = null;
  await risk.save();

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'STATUS_CHANGE',
    entityType: 'Risk',
    entityId: risk._id,
    entitySnapshot: { title: risk.title, reopenReason: data.reason },
    before: { status: beforeStatus },
    after: { status: 'OPEN' },
  });

  return populateRiskForResponse(risk);
};

/**
 * Archive a risk (keep visible in register, mark status as ARCHIVED)
 */
export const archiveRisk = async (riskId, user) => {
  const { organizationId, userId } = user;

  const risk = await Risk.findOne({
    _id: riskId,
    organizationId,
    isDeleted: false,
  });

  if (!risk) {
    const error = new Error('Risk not found');
    error.statusCode = 404;
    throw error;
  }

  if (risk.status === 'ARCHIVED') {
    // 'ARCHIVED'
    const error = new Error('Risk is already archived');
    error.statusCode = 400;
    throw error;
  }

  const beforeStatus = risk.status;
  risk.status = 'ARCHIVED';
  risk.archivedAt = new Date();
  await risk.save();

  if (risk.mitigatingControlIds?.length) {
    await Promise.all(
      risk.mitigatingControlIds.map((controlId) =>
        InternalControl.updateControlReadiness(controlId, organizationId)
      )
    );
  }

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'STATUS_CHANGE',
    entityType: 'Risk',
    entityId: risk._id,
    entitySnapshot: { title: risk.title },
    before: { status: beforeStatus },
    after: { status: 'ARCHIVED' },
  });

  return populateRiskForResponse(risk);
};

/**
 * Assign approvers and submit a risk for approval.
 */
export const submitRiskApproval = async (riskId, data, user) => {
  const { organizationId, userId } = user;
  const approverIds = [...new Set((data.approverIds || []).map((id) => String(id)))];

  if (approverIds.length === 0) {
    throw makeError('At least one approver must be assigned before submission', 400);
  }

  const risk = await Risk.findOne({ _id: riskId, organizationId, isDeleted: false });
  if (!risk) {
    throw makeError('Risk not found', 404);
  }

  if (risk.status === 'CLOSED') {
    throw makeError('Closed risks cannot be submitted for approval', 400);
  }
  if (risk.status === 'ARCHIVED') {
    throw makeError('Archived risks cannot be submitted for approval', 400);
  }

  validateRiskApprovalReadiness(risk, 'submit for approval');

  const approvers = await User.find({
    _id: { $in: approverIds },
    organizationId,
    role: { $in: APPROVER_ROLES },
    isDeleted: { $ne: true },
  }).select('_id');

  if (approvers.length !== approverIds.length) {
    throw makeError('Approvers must be active ADMIN or MANAGER users in this organization', 400);
  }

  const beforeStatus = risk.status;
  risk.assignedApproverIds = approverIds;
  risk.status = 'PENDING_APPROVAL';
  risk.submittedForApprovalAt = new Date();
  risk.submittedForApprovalBy = userId;
  if (data.notes != null) risk.assessmentNotes = data.notes;

  await risk.save();

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'STATUS_CHANGE',
    entityType: 'Risk',
    entityId: risk._id,
    entitySnapshot: { title: risk.title },
    before: { status: beforeStatus },
    after: {
      status: 'PENDING_APPROVAL',
      assignedApproverIds: approverIds,
    },
  });

  return populateRiskForResponse(risk);
};

/**
 * Approve a risk and create an immutable RiskAssessment snapshot
 */
export const approveRisk = async (riskId, data, user) => {
  const { organizationId, userId, role } = user;

  const risk = await Risk.findOne({ _id: riskId, organizationId, isDeleted: false });
  if (!risk) {
    throw makeError('Risk not found', 404);
  }

  if (risk.status === 'CLOSED') {
    throw makeError('Risk is already approved', 400);
  }
  if (risk.status === 'ARCHIVED') {
    throw makeError('Archived risks cannot be approved', 400);
  }
  if (risk.status !== 'PENDING_APPROVAL') {
    throw makeError('Risk must be submitted for approval before it can be approved', 409);
  }

  validateRiskApprovalReadiness(risk, 'approve');

  const assignedApproverIds = (risk.assignedApproverIds || []).map((id) => String(id));
  const isAssignedApprover = assignedApproverIds.includes(String(userId));
  const isAdmin = role === 'ADMIN';

  if (!isAssignedApprover && !isAdmin) {
    throw makeError('Only assigned approvers or admins can approve this risk', 403);
  }

  const inherentCalc = calculateRisk(risk.likelihood, risk.impact);
  const residualCalc = calculateRisk(risk.residualLikelihood, risk.residualImpact);

  const assessment = await RiskAssessment.create({
    riskId: risk._id,
    assessedById: userId,
    notes: data.notes ?? risk.assessmentNotes ?? null,
    snapshot: {
      inherentLikelihood: risk.likelihood,
      inherentImpact: risk.impact,
      inherentScore: inherentCalc.score,
      inherentBand: inherentCalc.level,
      residualLikelihood: risk.residualLikelihood,
      residualImpact: risk.residualImpact,
      residualScore: residualCalc.score,
      residualBand: residualCalc.level,
      treatmentType: risk.treatment,
      mappedControlIds: risk.mitigatingControlIds ?? [],
    },
  });

  const beforeStatus = risk.status;
  risk.status = 'CLOSED';
  risk.closedAt = new Date();
  risk.closedBy = userId;
  risk.closureReason = risk.closureReason || 'Approved';
  risk.lastAssessmentId = assessment._id;
  risk.approvals.push({ approverId: userId, approvedAt: new Date() });
  await risk.save();

  if (risk.mitigatingControlIds?.length) {
    await Promise.all(
      risk.mitigatingControlIds.map((controlId) =>
        InternalControl.updateControlReadiness(controlId, organizationId)
      )
    );
  }

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'STATUS_CHANGE',
    entityType: 'Risk',
    entityId: risk._id,
    entitySnapshot: { title: risk.title },
    before: { status: beforeStatus },
    after: { status: 'CLOSED' },
  });

  return populateRiskForResponse(risk);
};

/**
 * Review risk (periodic assessment)
 */
export const reviewRisk = async (riskId, data, user) => {
  const { organizationId, userId } = user;

  const risk = await Risk.findOne({
    _id: riskId,
    organizationId,
    isDeleted: false,
  });

  if (!risk) {
    const error = new Error('Risk not found');
    error.statusCode = 404;
    throw error;
  }

  const before = risk.toObject();

  // Update scoring if provided
  if (data.likelihood) risk.likelihood = data.likelihood;
  if (data.impact) risk.impact = data.impact;
  if (data.nextReviewDue) risk.nextReviewDue = data.nextReviewDue;

  if (data.likelihood || data.impact) {
    const calc = calculateRisk(risk.likelihood, risk.impact);
    if (calc) {
      risk.inherentRisk = calc;
    }
  }

  risk.lastReviewedAt = new Date();
  risk.lastReviewedBy = userId;

  await risk.save();

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'UPDATE',
    entityType: 'Risk',
    entityId: risk._id,
    entitySnapshot: { title: risk.title, reviewNotes: data.notes },
    before,
    after: risk.toObject(),
  });

  await risk.populate('ownerId', 'firstName lastName email');

  return risk;
};

// =============================================================================
// MITIGATING CONTROLS
// =============================================================================

/**
 * Link mitigating controls to risk
 */
export const linkControls = async (riskId, controlIds, user) => {
  const { organizationId, userId } = user;

  const risk = await Risk.findOne({
    _id: riskId,
    organizationId,
    isDeleted: false,
  });

  if (!risk) {
    const error = new Error('Risk not found');
    error.statusCode = 404;
    throw error;
  }

  // Add new controls (avoid duplicates)
  const existingIds = risk.mitigatingControlIds.map((id) => id.toString());
  const newIds = controlIds.filter((id) => !existingIds.includes(id));

  if (newIds.length === 0) {
    const error = new Error('All controls are already linked');
    error.statusCode = 400;
    throw error;
  }

  risk.mitigatingControlIds.push(...newIds);
  await risk.save();

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'UPDATE',
    entityType: 'Risk',
    entityId: risk._id,
    entitySnapshot: {
      title: risk.title,
      action: 'link_controls',
      controlsAdded: newIds.length,
    },
  });

  await risk.populate('mitigatingControlIds', 'identifier title overallStatus');

  return risk;
};

/**
 * Unlink mitigating controls from risk
 */
export const unlinkControls = async (riskId, controlIds, user) => {
  const { organizationId, userId } = user;

  const risk = await Risk.findOne({
    _id: riskId,
    organizationId,
    isDeleted: false,
  });

  if (!risk) {
    const error = new Error('Risk not found');
    error.statusCode = 404;
    throw error;
  }

  const removeSet = new Set(controlIds);
  const originalCount = risk.mitigatingControlIds.length;
  risk.mitigatingControlIds = risk.mitigatingControlIds.filter(
    (id) => !removeSet.has(id.toString())
  );

  const removedCount = originalCount - risk.mitigatingControlIds.length;
  if (removedCount === 0) {
    const error = new Error('None of the specified controls were linked');
    error.statusCode = 400;
    throw error;
  }

  await risk.save();

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'UPDATE',
    entityType: 'Risk',
    entityId: risk._id,
    entitySnapshot: {
      title: risk.title,
      action: 'unlink_controls',
      controlsRemoved: removedCount,
    },
  });

  await risk.populate('mitigatingControlIds', 'identifier title overallStatus');

  return risk;
};

/**
 * Recalculate residual score for a risk (no-op: manual 3x3 only)
 */
export const recalculateResidual = async (riskId, user) => {
  const risk = await Risk.findOne({
    _id: riskId,
    organizationId: user.organizationId,
    isDeleted: false,
  })
    .populate('ownerId', 'firstName lastName email')
    .populate('mitigatingControlIds', 'identifier title overallStatus');
  if (!risk) {
    const e = new Error('Risk not found');
    e.statusCode = 404;
    throw e;
  }
  return risk;
};

// =============================================================================
// ANALYTICS & DASHBOARD
// =============================================================================

/**
 * Get risk statistics
 */
export const getRiskStats = async (orgId) => {
  const accessMatch = await buildLinkedControlEntityAccessMatch(orgId, 'mitigatingControlIds');
  const baseMatch = {
    organizationId: new mongoose.Types.ObjectId(orgId),
    isDeleted: { $ne: true },
  };
  const openMatch = andAccess({ ...baseMatch, status: 'OPEN' }, accessMatch);
  const [levelCounts, statusCounts, treatmentCounts, overdueCount] =
    await Promise.all([
      Risk.aggregate([
        { $match: openMatch },
        { $group: { _id: '$riskLevel', count: { $sum: 1 } } },
      ]),
      Risk.aggregate([
        { $match: andAccess(baseMatch, accessMatch) },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Risk.aggregate([
        { $match: openMatch },
        { $group: { _id: '$treatment', count: { $sum: 1 } } },
      ]),
      Risk.countDocuments(andAccess({
        organizationId: orgId,
        isDeleted: { $ne: true },
        status: 'OPEN',
        nextReviewDue: { $lt: new Date() },
      }, accessMatch)),
    ]);

  const stats = {
    byLevel: levelCounts,
    byStatus: {
      OPEN: 0,
      PENDING_APPROVAL: 0,
      CLOSED: 0,
      ARCHIVED: 0,
    },
    byTreatment: {
      [TREATMENT[0]]: 0, // MITIGATE
      [TREATMENT[1]]: 0, // ACCEPT
      [TREATMENT[2]]: 0, // TRANSFER
      [TREATMENT[3]]: 0, // AVOID
    },
    overdueReview: overdueCount,
  };

  statusCounts.forEach(({ _id, count }) => {
    if (_id && stats.byStatus.hasOwnProperty(_id)) stats.byStatus[_id] = count;
  });

  treatmentCounts.forEach(({ _id, count }) => {
    if (_id && stats.byTreatment.hasOwnProperty(_id))
      stats.byTreatment[_id] = count;
  });

  return stats;
};

/**
 * Get top risks by residual score
 */
export const getTopRisks = async (orgId, limit = 10) => {
  return Risk.getTopRisks(orgId, limit);
};

/**
 * Get risk matrix data for heat map
 */
export const getRiskMatrix = async (orgId) => {
  return Risk.getRiskMatrix(orgId);
};

/**
 * Get stale risks (need recalculation)
 */
export const getStaleRisks = async (orgId, days = 30) => {
  return Risk.getStaleRisks(orgId, days);
};

/**
 * Get assessment history for a risk
 */
export const getRiskAssessments = async (riskId, orgId) => {
  const risk = await Risk.findOne({
    _id: riskId,
    organizationId: orgId,
    isDeleted: false,
  }).lean();
  if (!risk) {
    const e = new Error('Risk not found');
    e.statusCode = 404;
    throw e;
  }

  return RiskAssessment.find({ riskId })
    .populate('assessedById', 'firstName lastName email')
    .sort({ assessedAt: -1 })
    .lean();
};

/**
 * Batch recalculate all residual scores (no-op: manual 3x3 only)
 */
export const batchRecalculate = async (_orgId, _user) => {
  return {
    message:
      'Automated residual recalculation is disabled. Residual risk must be assessed manually.',
  };
};

export default {
  createRisk,
  getRisks,
  getRiskById,
  updateRisk,
  deleteRisk,
  closeRisk,
  reopenRisk,
  archiveRisk,
  submitRiskApproval,
  approveRisk,
  reviewRisk,
  linkControls,
  unlinkControls,
  recalculateResidual,
  getRiskAssessments,
  getRiskStats,
  getTopRisks,
  getRiskMatrix,
  getStaleRisks,
  batchRecalculate,
};
