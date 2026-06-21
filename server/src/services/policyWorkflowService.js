/**
 * Policy Workflow Service (Phase 3)
 *
 * Implements state transitions using Policy.status + PolicyVersion.status
 * (single status per-entity).
 */
import mongoose from 'mongoose';
import Policy from '../models/Policy.js';
import PolicyVersion from '../models/PolicyVersion.js';
import PolicyAttestation from '../models/PolicyAttestation.js';
import Group from '../models/Group.js';
import User from '../models/User.js';
import InternalControl from '../models/InternalControl.js';
import Organization from '../models/Organization.js';
import { logCrudOperation } from './activityLogger.js';
import { sendNotificationEmail } from './emailService.js';
import { withTransaction } from '../utils/transactions.js';
import {
  syncPolicyApprovalTests,
  syncPolicyAttestationTests,
} from './policyTestAutomationService.js';

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function notFound(message) {
  const err = new Error(message);
  err.statusCode = 404;
  return err;
}

function forbidden(message) {
  const err = new Error(message);
  err.statusCode = 403;
  return err;
}

export async function findPolicyOrThrow({ policyId, organizationId, session = null }) {
  const q = Policy.findOne({ _id: policyId, organizationId, isDeleted: { $ne: true } });
  if (session) q.session(session);
  const policy = await q;
  if (!policy) throw notFound('Policy not found');
  return policy;
}

async function findVersionOrThrow({ policyVersionId, organizationId, session = null }) {
  const q = PolicyVersion.findOne({ _id: policyVersionId, organizationId });
  if (session) q.session(session);
  const version = await q;
  if (!version) throw notFound('Policy version not found');
  return version;
}

/**
 * Resolve users to target for acknowledgements.
 * Handles: ALL_PERSONNEL | SPECIFIC_GROUPS | SPECIFIC_USERS | SPECIFIC_ROLES
 */
export async function getTargetUsers(policy) {
  const orgId = policy.organizationId;

  if (Array.isArray(policy.targetUserIds) && policy.targetUserIds.length > 0) {
    return User.find({
      organizationId: orgId,
      isDeleted: { $ne: true },
      _id: { $in: policy.targetUserIds },
      role: { $in: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
    })
      .select('_id email firstName lastName role')
      .lean();
  }

  if (policy.assignmentScope === 'SPECIFIC_USERS') {
    const ids = (policy.assignmentUserIds || []).filter(Boolean);
    if (!ids.length) return [];
    return User.find({
      organizationId: orgId,
      isDeleted: { $ne: true },
      status: 'ACTIVE',
      _id: { $in: ids },
      role: { $in: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
    })
      .select('_id email firstName lastName role')
      .lean();
  }

  if (policy.assignmentScope === 'SPECIFIC_GROUPS') {
    const groupIds = (policy.assignmentGroupIds || []).filter(Boolean);
    if (!groupIds.length) return [];
    const groups = await Group.find({
      organizationId: orgId,
      isDeleted: { $ne: true },
      _id: { $in: groupIds },
    })
      .select('memberUserIds')
      .lean();
    const memberIds = [...new Set(groups.flatMap((g) => g.memberUserIds || []).map(String))].map(
      (id) => new mongoose.Types.ObjectId(id)
    );
    if (!memberIds.length) return [];
    return User.find({
      organizationId: orgId,
      isDeleted: { $ne: true },
      status: 'ACTIVE',
      _id: { $in: memberIds },
      role: { $in: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
    })
      .select('_id email firstName lastName role')
      .lean();
  }

  if (policy.assignmentScope === 'SPECIFIC_ROLES') {
    const roles = (policy.targetRoles || []).filter(Boolean);
    if (!roles.length) return [];
    return User.find({
      organizationId: orgId,
      isDeleted: { $ne: true },
      status: 'ACTIVE',
      role: { $in: roles },
    })
      .select('_id email firstName lastName role')
      .lean();
  }

  // Default: ALL_PERSONNEL (exclude auditors)
  return User.find({
    organizationId: orgId,
    isDeleted: { $ne: true },
    status: 'ACTIVE',
    role: { $in: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  })
    .select('_id email firstName lastName role')
    .lean();
}

export async function _recalculateAcknowledgementRate(policyId) {
  const policy = await Policy.findById(policyId).populate('currentVersionId');
  if (!policy) throw notFound('Policy not found');

  if (!policy.requiresAttestation || !policy.currentVersionId) {
    return { required: 0, attested: 0, pending: 0, percent: 0 };
  }

  const targets = await getTargetUsers(policy);
  const required = targets.length;
  if (!required) return { required: 0, attested: 0, pending: 0, percent: 0 };

  const attested = await PolicyAttestation.countDocuments({
    policyVersionId: policy.currentVersionId._id,
    userId: { $in: targets.map((u) => u._id) },
  });

  return {
    required,
    attested,
    pending: Math.max(0, required - attested),
    percent: Math.round((attested / required) * 100),
  };
}

async function resolvePublishTargetUserIds({ organizationId, recipientType, userIds = [], groupIds = [], session }) {
  if (recipientType === 'SPECIFIC_USERS') {
    const requestedIds = [...new Set((userIds || []).map(String).filter(Boolean))];
    if (!requestedIds.length) throw badRequest('Select at least one user to publish to');

    const users = await User.find({
      organizationId,
      isDeleted: { $ne: true },
      status: 'ACTIVE',
      role: { $in: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
      _id: { $in: requestedIds },
    })
      .select('_id')
      .lean()
      .session(session);
    const validSet = new Set(users.map((u) => String(u._id)));
    if (validSet.size !== requestedIds.length) {
      throw badRequest('One or more selected users are not active personnel');
    }
    return requestedIds;
  }

  if (recipientType === 'SPECIFIC_GROUPS') {
    const requestedGroupIds = [...new Set((groupIds || []).map(String).filter(Boolean))];
    if (!requestedGroupIds.length) throw badRequest('Select at least one group to publish to');

    const groups = await Group.find({
      organizationId,
      isDeleted: { $ne: true },
      _id: { $in: requestedGroupIds },
    })
      .select('memberUserIds')
      .lean()
      .session(session);
    if (groups.length !== requestedGroupIds.length) {
      throw badRequest('One or more selected groups were not found');
    }

    const memberIds = [...new Set(groups.flatMap((g) => g.memberUserIds || []).map(String).filter(Boolean))];
    if (!memberIds.length) throw badRequest('Selected groups do not contain active personnel');

    const users = await User.find({
      organizationId,
      isDeleted: { $ne: true },
      status: 'ACTIVE',
      role: { $in: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
      _id: { $in: memberIds },
    })
      .select('_id')
      .lean()
      .session(session);
    return users.map((u) => String(u._id));
  }

  const users = await User.find({
    organizationId,
    isDeleted: { $ne: true },
    status: 'ACTIVE',
    role: { $in: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  })
    .select('_id')
    .lean()
    .session(session);
  return users.map((u) => String(u._id));
}

async function persistAcknowledgementRate(policy, { session = null } = {}) {
  const { percent } = await _recalculateAcknowledgementRate(policy._id);
  policy.acknowledgementRate = Math.round(percent);
  await policy.save({ session });
  return policy.acknowledgementRate;
}

async function getWorkflowConfig(organizationId, { session = null } = {}) {
  const q = Organization.findById(organizationId).select('settings').lean();
  if (session) q.session(session);
  const organization = await q;
  return {
    archiveAutoPassesAttestation: organization?.settings?.archiveAutoPassesAttestation ?? true,
    archiveEvidenceCountsAsSatisfied: organization?.settings?.archiveEvidenceCountsAsSatisfied ?? true,
    naCountsAsSatisfied: organization?.settings?.naCountsAsSatisfied ?? false,
    snoozeBlocksReadiness: organization?.settings?.snoozeBlocksReadiness ?? false,
  };
}

/**
 * When a policy is archived, auto-complete missing attestations for audit completeness.
 * Creates attestations for every target user who hasn't yet attested to the current version.
 */
export async function _autoCompleteAttestations(policyId, { session = null } = {}) {
  const policy = await Policy.findById(policyId).populate('currentVersionId').session(session);
  if (!policy) throw notFound('Policy not found');
  if (!policy.requiresAttestation || !policy.currentVersionId) return { created: 0 };

  const targets = await getTargetUsers(policy);
  if (!targets.length) return { created: 0 };

  const existing = await PolicyAttestation.find({
    policyVersionId: policy.currentVersionId._id,
    userId: { $in: targets.map((u) => u._id) },
  })
    .select('userId')
    .lean()
    .session(session);

  const existingSet = new Set(existing.map((a) => String(a.userId)));
  const missing = targets.filter((u) => !existingSet.has(String(u._id)));

  if (!missing.length) return { created: 0 };

  const docs = missing.map((u) => ({
    policyVersionId: policy.currentVersionId._id,
    userId: u._id,
    signatureText: 'Auto-completed on policy archive',
    source: 'SYSTEM_ARCHIVE',
    ipAddress: 'system',
    userAgent: 'system',
  }));

  await PolicyAttestation.insertMany(docs, { session, ordered: false });
  return { created: docs.length };
}

/**
 * Submit a policy version for approval (version-level workflow).
 */
export async function submitForApproval({ policyId, policyVersionId, approverId, actor }) {
  return withTransaction(async (session) => {
    const policy = await findPolicyOrThrow({ policyId, organizationId: actor.organizationId, session });
    const version = await findVersionOrThrow({ policyVersionId, organizationId: actor.organizationId, session });

    if (!version.policyId.equals(policy._id)) throw badRequest('Policy version does not belong to policy');
    if (version.status !== 'DRAFT') throw badRequest('Only DRAFT versions can be submitted');
    // Validate approver role (ADMIN/MANAGER) and assign to version (per-version approver)
    const approver = await User.findOne({
      _id: approverId,
      organizationId: actor.organizationId,
      isDeleted: { $ne: true },
      status: 'ACTIVE',
      role: { $in: ['ADMIN', 'MANAGER'] },
    })
      .select('_id email firstName lastName role')
      .lean()
      .session(session);
    if (!approver) throw badRequest('Approver must be an ADMIN or MANAGER in this organization');
    const policyApproverIds = (policy.approverIds || []).map(String);
    if (!policyApproverIds.includes(String(approver._id))) {
      policy.approverIds = [...(policy.approverIds || []), approver._id];
    }

    version.status = 'PENDING_APPROVAL';
    version.approverId = approver._id;
    version.submittedForApprovalAt = new Date();
    version.submittedBy = actor.userId;
    policy.workflowStatus = 'PENDING_APPROVAL';
    await policy.save({ session });
    await version.save({ session });

    // Notify approver if present
    if (approver?.email) {
      await sendNotificationEmail(
        approver.email,
        `${approver.firstName || ''} ${approver.lastName || ''}`.trim(),
        `Policy approval requested: ${policy.title}`,
        `A policy version was submitted for approval.\n\nPolicy: ${policy.title}\nVersion: ${version.versionNumber}\n\nReview: /policies/${policy._id}?versionId=${version._id}`
      );
    }

    await logCrudOperation({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      action: 'STATUS_CHANGE',
      entityType: 'PolicyVersion',
      entityId: version._id,
      entitySnapshot: { policyId: policy._id, policyTitle: policy.title, versionNumber: version.versionNumber },
      before: { status: 'DRAFT' },
      after: { status: 'PENDING_APPROVAL', approverId: String(approver._id) },
      changedFields: ['status', 'approverId', 'submittedForApprovalAt', 'submittedBy'],
    });

    return { policyId: policy._id, policyVersionId: version._id, status: version.status, approverId: version.approverId };
  });
}

export async function approveVersion({ policyId, policyVersionId, actor }) {
  return withTransaction(async (session) => {
    const policy = await findPolicyOrThrow({ policyId, organizationId: actor.organizationId, session });
    const version = await findVersionOrThrow({ policyVersionId, organizationId: actor.organizationId, session });
    if (!version.policyId.equals(policy._id)) throw badRequest('Policy version does not belong to policy');
    if (version.status !== 'PENDING_APPROVAL') throw badRequest('Only PENDING_APPROVAL versions can be approved');
    const policyApproverIds = policy.approverIds || [];
    const isPolicyApprover = policyApproverIds.some((id) => String(id) === String(actor.userId));
    if (!isPolicyApprover) throw forbidden('User is not authorized to approve this policy');

    version.status = 'APPROVED';
    version.approvedAt = new Date();
    version.approvedBy = actor.userId;
    policy.workflowStatus = 'APPROVED';
    await policy.save({ session });
    await version.save({ session });
    await syncPolicyApprovalTests(policy, { approved: true, session });

    await logCrudOperation({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      action: 'STATUS_CHANGE',
      entityType: 'PolicyVersion',
      entityId: version._id,
      entitySnapshot: { policyId: policy._id, policyTitle: policy.title, versionNumber: version.versionNumber },
      before: { status: 'PENDING_APPROVAL' },
      after: { status: 'APPROVED' },
      changedFields: ['status', 'approvedAt', 'approvedBy'],
    });

    return { policyId: policy._id, policyVersionId: version._id, status: version.status };
  });
}

export async function rejectVersion({ policyId, policyVersionId, actor, reason = '' }) {
  return withTransaction(async (session) => {
    const policy = await findPolicyOrThrow({ policyId, organizationId: actor.organizationId, session });
    const version = await findVersionOrThrow({ policyVersionId, organizationId: actor.organizationId, session });
    if (!version.policyId.equals(policy._id)) throw badRequest('Policy version does not belong to policy');
    if (version.status !== 'PENDING_APPROVAL') throw badRequest('Only PENDING_APPROVAL versions can be rejected');
    const policyApproverIds = policy.approverIds || [];
    const isPolicyApprover = policyApproverIds.some((id) => String(id) === String(actor.userId));
    if (!isPolicyApprover) throw forbidden('User is not authorized to reject this policy');

    version.status = 'DRAFT';
    version.rejectedAt = new Date();
    version.rejectedBy = actor.userId;
    version.rejectionReason = reason || '';
    policy.workflowStatus = 'DRAFT';
    await policy.save({ session });
    await version.save({ session });

    await logCrudOperation({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      action: 'STATUS_CHANGE',
      entityType: 'PolicyVersion',
      entityId: version._id,
      entitySnapshot: { policyId: policy._id, policyTitle: policy.title, versionNumber: version.versionNumber },
      before: { status: 'PENDING_APPROVAL' },
      after: { status: 'DRAFT', rejectionReason: version.rejectionReason },
      changedFields: ['status', 'rejectedAt', 'rejectedBy', 'rejectionReason'],
    });

    return { policyId: policy._id, policyVersionId: version._id, status: version.status };
  });
}

export async function cancelApproval({ policyId, policyVersionId, actor }) {
  return withTransaction(async (session) => {
    const policy = await findPolicyOrThrow({ policyId, organizationId: actor.organizationId, session });
    const version = await findVersionOrThrow({ policyVersionId, organizationId: actor.organizationId, session });
    if (!version.policyId.equals(policy._id)) throw badRequest('Policy version does not belong to policy');
    if (version.status !== 'PENDING_APPROVAL') {
      throw badRequest('Only PENDING_APPROVAL versions can have approval cancelled');
    }

    const isOwner = policy.ownerId && String(policy.ownerId) === String(actor.userId);
    const isSubmitter = version.submittedBy && String(version.submittedBy) === String(actor.userId);
    if (!isOwner && !isSubmitter) {
      throw forbidden('Only the policy owner or original submitter can cancel approval');
    }

    const before = {
      status: version.status,
      approverId: version.approverId,
      submittedForApprovalAt: version.submittedForApprovalAt,
      submittedBy: version.submittedBy,
      policyWorkflowStatus: policy.workflowStatus,
    };

    version.status = 'DRAFT';
    version.approverId = null;
    version.submittedForApprovalAt = null;
    version.submittedBy = null;
    policy.workflowStatus = 'DRAFT';

    await policy.save({ session });
    await version.save({ session });
    await syncPolicyApprovalTests(policy, { approved: false, session });

    await logCrudOperation({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      action: 'APPROVAL_CANCELLED',
      entityType: 'PolicyVersion',
      entityId: version._id,
      entitySnapshot: { policyId: policy._id, policyTitle: policy.title, versionNumber: version.versionNumber },
      before,
      after: {
        status: 'DRAFT',
        approverId: null,
        submittedForApprovalAt: null,
        submittedBy: null,
        policyWorkflowStatus: 'DRAFT',
      },
      changedFields: ['status', 'approverId', 'submittedForApprovalAt', 'submittedBy', 'workflowStatus'],
    });

    return { policyId: policy._id, policyVersionId: version._id, status: version.status };
  });
}

export async function cancelApprovalByVersion({ policyVersionId, actor }) {
  const version = await findVersionOrThrow({
    policyVersionId,
    organizationId: actor.organizationId,
  });
  return cancelApproval({ policyId: version.policyId, policyVersionId, actor });
}

/**
 * Publish: marks Policy.status ACTIVE and PolicyVersion.status ACTIVE.
 */
export async function publishVersionWorkflow({
  policyId,
  policyVersionId,
  recipientType = 'ALL_PERSONNEL',
  userIds = [],
  groupIds = [],
  actor,
}) {
  return withTransaction(async (session) => {
    const policy = await findPolicyOrThrow({ policyId, organizationId: actor.organizationId, session });
    const version = await findVersionOrThrow({ policyVersionId, organizationId: actor.organizationId, session });
    if (!version.policyId.equals(policy._id)) throw badRequest('Policy version does not belong to policy');
    if (version.status !== 'APPROVED') {
      throw badRequest('Only APPROVED versions can be published');
    }

    if (policy.currentVersionId) {
      await PolicyVersion.findOneAndUpdate(
        { _id: policy.currentVersionId, organizationId: actor.organizationId },
        {
          status: 'ARCHIVED',
          supersededAt: new Date(),
          supersededBy: version._id,
        },
        { session }
      );
    }

    const beforePolicy = { status: policy.status, workflowStatus: policy.workflowStatus, currentVersionId: policy.currentVersionId };
    const targetUserIds = await resolvePublishTargetUserIds({
      organizationId: actor.organizationId,
      recipientType,
      userIds,
      groupIds,
      session,
    });

    version.status = 'ACTIVE';
    version.effectiveDate = version.effectiveDate || new Date();
    await version.save({ session });

    policy.status = 'ACTIVE';
    policy.currentVersionId = version._id;
    policy.workflowStatus = 'APPROVED';
    policy.requiresAttestation = true;
    policy.assignmentScope = recipientType;
    policy.assignmentUserIds = recipientType === 'SPECIFIC_USERS' ? targetUserIds : [];
    policy.assignmentGroupIds = recipientType === 'SPECIFIC_GROUPS' ? groupIds : [];
    policy.targetUserIds = targetUserIds;
    policy.acknowledgementRate = 0;
    policy.snoozedUntil = null;
    policy.deactivatedAt = null;
    policy.deactivatedBy = null;
    policy.deactivationReason = '';
    await policy.save({ session });
    await syncPolicyAttestationTests(policy, { acknowledgementRate: 0, session });

    // Email target users to acknowledge
    if (policy.requiresAttestation) {
      const targets = await getTargetUsers(policy);
      for (const u of targets) {
        if (!u?.email) continue;
        await sendNotificationEmail(
          u.email,
          `${u.firstName || ''} ${u.lastName || ''}`.trim(),
          `Policy acknowledgement requested: ${policy.title}`,
          `A policy requires your acknowledgement.\n\nPolicy: ${policy.title}`
        );
      }
    }

    // Trigger readiness recalculation for linked controls
    if (policy.linkedControlIds?.length) {
      await Promise.all(
        policy.linkedControlIds.map((id) => InternalControl.updateControlReadiness(id, actor.organizationId))
      );
    }

    await logCrudOperation({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      action: 'STATUS_CHANGE',
      entityType: 'Policy',
      entityId: policy._id,
      entitySnapshot: { title: policy.title },
      before: beforePolicy,
      after: { status: 'ACTIVE', workflowStatus: 'APPROVED', currentVersionId: String(version._id) },
      changedFields: ['status', 'workflowStatus', 'currentVersionId'],
    });

    return { policyId: policy._id, status: policy.status, policyVersionId: version._id };
  });
}

/**
 * User acknowledges policy (creates PolicyAttestation on currentVersionId).
 */
export async function acknowledgePolicy({ policyId, userId, ipAddress, userAgent }) {
  const policy = await Policy.findOne({
    _id: policyId,
    isDeleted: { $ne: true },
  }).populate('currentVersionId');

  if (!policy) throw notFound('Policy not found');
  if (!policy.currentVersionId) throw badRequest('Policy has no published version');
  if (policy.status !== 'ACTIVE') throw badRequest('Policy must be ACTIVE to acknowledge');

  // Ensure user is a target
  const targets = await getTargetUsers(policy);
  if (!targets.some((u) => String(u._id) === String(userId))) {
    throw forbidden('You are not a target for this policy acknowledgement');
  }

  await PolicyAttestation.create({
    policyVersionId: policy.currentVersionId._id,
    userId,
    ipAddress: ipAddress || '',
    userAgent: userAgent || '',
    signatureText: 'Acknowledged',
  });

  const rate = await _recalculateAcknowledgementRate(policy._id);
  policy.acknowledgementRate = Math.round(rate.percent);
  await policy.save();
  await syncPolicyAttestationTests(policy, { acknowledgementRate: rate.percent });
  return { policyId: policy._id, policyVersionId: policy.currentVersionId._id, acknowledgement: rate };
}

export async function snoozePolicy({ policyId, actor, snoozedUntil, reason = '' }) {
  return withTransaction(async (session) => {
    const policy = await findPolicyOrThrow({ policyId, organizationId: actor.organizationId, session });
    policy.snoozedUntil = snoozedUntil ? new Date(snoozedUntil) : null;
    policy.snoozedBy = actor.userId;
    policy.snoozeReason = reason || '';
    await policy.save({ session });

    if (policy.linkedControlIds?.length) {
      await Promise.all(
        policy.linkedControlIds.map((id) => InternalControl.updateControlReadiness(id, actor.organizationId))
      );
    }

    return policy.toObject();
  });
}

export async function unsnoozePolicy({ policyId, actor }) {
  return withTransaction(async (session) => {
    const policy = await findPolicyOrThrow({ policyId, organizationId: actor.organizationId, session });
    policy.snoozedUntil = null;
    policy.snoozedBy = null;
    policy.snoozeReason = '';
    await policy.save({ session });

    if (policy.linkedControlIds?.length) {
      await Promise.all(
        policy.linkedControlIds.map((id) => InternalControl.updateControlReadiness(id, actor.organizationId))
      );
    }

    return policy.toObject();
  });
}

export async function deactivatePolicy({ policyId, actor, reason = '' }) {
  return withTransaction(async (session) => {
    const policy = await findPolicyOrThrow({ policyId, organizationId: actor.organizationId, session });
    policy.deactivatedAt = new Date();
    policy.deactivatedBy = actor.userId;
    policy.deactivationReason = reason || '';
    await policy.save({ session });

    if (policy.linkedControlIds?.length) {
      await Promise.all(
        policy.linkedControlIds.map((id) => InternalControl.updateControlReadiness(id, actor.organizationId))
      );
    }

    return policy.toObject();
  });
}

export async function reactivatePolicy({ policyId, actor }) {
  return withTransaction(async (session) => {
    const policy = await findPolicyOrThrow({ policyId, organizationId: actor.organizationId, session });
    policy.deactivatedAt = null;
    policy.deactivatedBy = null;
    policy.deactivationReason = '';
    await policy.save({ session });

    if (policy.linkedControlIds?.length) {
      await Promise.all(
        policy.linkedControlIds.map((id) => InternalControl.updateControlReadiness(id, actor.organizationId))
      );
    }

    return policy.toObject();
  });
}

export async function archivePolicyWorkflow({ policyId, actor, reason = '' }) {
  return withTransaction(async (session) => {
    const policy = await findPolicyOrThrow({ policyId, organizationId: actor.organizationId, session });
    const config = await getWorkflowConfig(actor.organizationId, { session });

    policy.status = 'ARCHIVED';
    policy.archivedAt = new Date();
    policy.archivedBy = actor.userId;
    policy.archiveReason = reason || '';
    await policy.save({ session });

    if (config.archiveAutoPassesAttestation) {
      await _autoCompleteAttestations(policy._id, { session });
      policy.acknowledgementRate = 100;
      await policy.save({ session });
      await syncPolicyAttestationTests(policy, { acknowledgementRate: 100, session });
    }

    if (policy.linkedControlIds?.length) {
      await Promise.all(
        policy.linkedControlIds.map((id) => InternalControl.updateControlReadiness(id, actor.organizationId))
      );
    }

    return policy.toObject();
  });
}

export async function unarchivePolicyWorkflow({ policyId, actor }) {
  return withTransaction(async (session) => {
    const policy = await findPolicyOrThrow({ policyId, organizationId: actor.organizationId, session });
    policy.status = 'DRAFT';
    policy.workflowStatus = 'DRAFT';
    policy.currentVersionId = null;
    policy.archivedAt = null;
    policy.archivedBy = null;
    policy.archiveReason = '';
    await policy.save({ session });

    if (policy.linkedControlIds?.length) {
      await Promise.all(
        policy.linkedControlIds.map((id) => InternalControl.updateControlReadiness(id, actor.organizationId))
      );
    }

    return policy.toObject();
  });
}

export async function autoUnsnoozeExpiredPolicies({ organizationId }) {
  const now = new Date();
  const policies = await Policy.find({
    organizationId,
    isDeleted: { $ne: true },
    snoozedUntil: { $ne: null, $lte: now },
  }).select('_id linkedControlIds');

  let updated = 0;
  for (const p of policies) {
    p.snoozedUntil = null;
    p.snoozedBy = null;
    p.snoozeReason = '';
    await p.save();
    updated++;
    if (p.linkedControlIds?.length) {
      await Promise.all(p.linkedControlIds.map((id) => InternalControl.updateControlReadiness(id, organizationId)));
    }
  }

  return { updated };
}

export default {
  findPolicyOrThrow,
  getTargetUsers,
  submitForApproval,
  approveVersion,
  rejectVersion,
  cancelApproval,
  cancelApprovalByVersion,
  publishVersionWorkflow,
  acknowledgePolicy,
  snoozePolicy,
  unsnoozePolicy,
  deactivatePolicy,
  reactivatePolicy,
  archivePolicyWorkflow,
  unarchivePolicyWorkflow,
  autoUnsnoozeExpiredPolicies,
  _autoCompleteAttestations,
  _recalculateAcknowledgementRate,
};

