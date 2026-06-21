import mongoose from 'mongoose';
import Audit from '../models/Audit.js';
import AuditAssignment from '../models/AuditAssignment.js';
import AuditorProfile from '../models/AuditorProfile.js';
import AuditorTenantMembership from '../models/AuditorTenantMembership.js';
import AuditEvidenceItem from '../models/AuditEvidenceItem.js';
import AuditEvidenceRequest from '../models/AuditEvidenceRequest.js';
import AuditFinding from '../models/AuditFinding.js';
import AuditReport from '../models/AuditReport.js';
import AuditControlSnapshot from '../models/AuditControlSnapshot.js';
import Evidence from '../models/Evidence.js';
import InternalControl from '../models/InternalControl.js';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import { createAuditSnapshot } from '../utils/transactions.js';
import { logCrudOperation, logActivity } from './activityLogger.js';
import { sendNotificationEmail } from './emailService.js';
import { createInvitation } from './invitationService.js';
import { storageService } from './storageService.js';
import { notifyEvidenceRequestMessage } from './notificationService.js';

function makeError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function assertInternalAudit(auditId, organizationId) {
  const audit = await Audit.findOne({
    _id: auditId,
    organizationId,
    isDeleted: { $ne: true },
  });
  if (!audit) throw makeError('Audit not found', 404);
  return audit;
}

function createCompletionGateError(openFindings) {
  const err = makeError('Cannot complete audit with open high/critical findings', 409);
  err.openFindings = openFindings.map((finding) => ({
    id: finding._id,
    title: finding.title,
    severity: finding.severity,
  }));
  return err;
}

function normalizeAuditStatus(status) {
  if (status === 'PREP') return 'DRAFT';
  if (status === 'FIELDWORK') return 'IN_PROGRESS';
  return status;
}

function generateTemporaryPassword() {
  return `Temp${Date.now()}Aa!`;
}

const REQUEST_STATUS_TRANSITIONS = {
  OPEN: ['IN_REVIEW', 'CLOSED'],
  IN_REVIEW: ['COMPLETED', 'CLOSED'],
  SUBMITTED: ['ACCEPTED', 'COMPLETED'],
  ACCEPTED: ['COMPLETED'],
};

function populateAuditRequest(query) {
  return query
    .populate('requestedBy', 'firstName lastName email')
    .populate('submittedBy', 'firstName lastName email')
    .populate('submittedEvidenceId', 'title status fileName')
    .populate('assignedTo', 'firstName lastName email role')
    .populate('submittedItems', 'title status fileName fileUrl')
    .populate('messages.author', 'firstName lastName email role');
}

function validateRequestStatusTransition(currentStatus, nextStatus) {
  if (!nextStatus || nextStatus === currentStatus) return;
  const allowed = REQUEST_STATUS_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(nextStatus)) {
    throw makeError(`Invalid status transition from ${currentStatus} to ${nextStatus}`, 400);
  }
}

async function computeAuditOutcome(auditId, organizationId) {
  const findings = await AuditFinding.find({
    audit: auditId,
    organization: organizationId,
    deletedAt: null,
  }).lean();
  const openCount = findings.filter((finding) => finding.status === 'OPEN').length;
  if (openCount > 0) return 'FAILED';
  if (findings.length > 0) return 'PASSED_WITH_EXCEPTIONS';
  return 'PASSED';
}

export async function listAudits(organizationId, query = {}) {
  const { status, page = 1, limit = 20, controlId } = query;
  const filter = { organizationId, isDeleted: { $ne: true } };
  if (status) filter.status = status;

  if (controlId) {
    const controlIds = String(controlId)
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .map((id) => new mongoose.Types.ObjectId(id));

    if (controlIds.length > 0) {
      const snapshotAuditIds = await AuditControlSnapshot.distinct('auditId', {
        originalControlId: controlIds.length === 1 ? controlIds[0] : { $in: controlIds },
      });

      if (snapshotAuditIds.length === 0) {
        return {
          audits: [],
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: 0,
            pages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        };
      }

      filter._id = { $in: snapshotAuditIds };
    }
  }

  const [audits, total] = await Promise.all([
    Audit.find(filter)
      .sort({ periodStart: -1, createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .populate('frameworkId', 'code name')
      .populate('leaderId', 'firstName lastName email')
      .lean(),
    Audit.countDocuments(filter),
  ]);

  const auditIds = audits.map((audit) => audit._id);
  let evidenceCountsByAudit = {};
  let requestCountsByAudit = {};

  if (auditIds.length > 0) {
    const orgObjectId = new mongoose.Types.ObjectId(organizationId);
    const auditObjectIds = auditIds.map((id) => new mongoose.Types.ObjectId(id));

    const [evidenceAgg, requestAgg] = await Promise.all([
      AuditEvidenceItem.aggregate([
        {
          $match: {
            auditId: { $in: auditObjectIds },
            organizationId: orgObjectId,
            isDeleted: { $ne: true },
          },
        },
        { $group: { _id: { auditId: '$auditId', status: '$status' }, count: { $sum: 1 } } },
      ]),
      AuditEvidenceRequest.aggregate([
        {
          $match: {
            auditId: { $in: auditObjectIds },
            organizationId: orgObjectId,
            isDeleted: { $ne: true },
          },
        },
        { $group: { _id: { auditId: '$auditId', status: '$status' }, count: { $sum: 1 } } },
      ]),
    ]);

    for (const row of evidenceAgg) {
      const key = String(row._id.auditId);
      if (!evidenceCountsByAudit[key]) evidenceCountsByAudit[key] = {};
      evidenceCountsByAudit[key][row._id.status] = row.count;
    }
    for (const row of requestAgg) {
      const key = String(row._id.auditId);
      if (!requestCountsByAudit[key]) requestCountsByAudit[key] = {};
      requestCountsByAudit[key][row._id.status] = row.count;
    }
  }

  const enrichedAudits = audits.map((audit) => ({
    ...audit,
    status: normalizeAuditStatus(audit.status),
    evidenceStatusCounts: evidenceCountsByAudit[String(audit._id)] || {},
    requestStatusCounts: requestCountsByAudit[String(audit._id)] || {},
  }));

  return {
    audits: enrichedAudits,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)),
      hasNextPage: Number(page) < Math.ceil(total / Number(limit)),
      hasPrevPage: Number(page) > 1,
    },
  };
}

export async function createAudit(data, actor) {
  if (data.periodEnd && data.periodStart && new Date(data.periodEnd) < new Date(data.periodStart)) {
    throw makeError('Period end must be after period start', 400);
  }

  const audit = await Audit.create({
    organizationId: actor.organizationId,
    name: data.name,
    description: data.description || '',
    frameworkId: data.frameworkId || null,
    auditType: data.auditType || 'EXTERNAL',
    auditorFirm: data.auditorFirm || '',
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
    earlyAccessDate: data.earlyAccessDate || null,
    fieldworkStartDate: data.fieldworkStartDate || data.periodStart,
    fieldworkEndDate: data.fieldworkEndDate || data.periodEnd,
    scopedControlIds: data.scopedControlIds || [],
    leaderId: actor._id,
    status: 'DRAFT',
  });

  await logCrudOperation({
    organizationId: actor.organizationId,
    actorId: actor._id,
    action: 'CREATE',
    entityType: 'Audit',
    entityId: audit._id,
    entitySnapshot: { title: audit.name },
  });

  return getAuditById(audit._id, actor.organizationId);
}

export async function getAuditById(auditId, organizationId) {
  const audit = await Audit.findOne({
    _id: auditId,
    organizationId,
    isDeleted: { $ne: true },
  })
    .populate('frameworkId', 'code name')
    .populate('leaderId', 'firstName lastName email')
    .lean();

  if (!audit) throw makeError('Audit not found', 404);

  const [assignments, evidenceCounts, requestCounts, reports] = await Promise.all([
    AuditAssignment.find({ auditId, organizationId, isDeleted: { $ne: true } })
      .populate('auditorUserId', 'firstName lastName email role status')
      .lean(),
    AuditEvidenceItem.aggregate([
      { $match: { auditId: new mongoose.Types.ObjectId(auditId), organizationId: new mongoose.Types.ObjectId(organizationId), isDeleted: { $ne: true } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    AuditEvidenceRequest.aggregate([
      { $match: { auditId: new mongoose.Types.ObjectId(auditId), organizationId: new mongoose.Types.ObjectId(organizationId), isDeleted: { $ne: true } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    AuditReport.find({ auditId, organizationId, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .populate('uploadedBy', 'firstName lastName email')
      .lean(),
  ]);

  return {
    ...audit,
    status: normalizeAuditStatus(audit.status),
    assignments,
    evidenceStatusCounts: Object.fromEntries(evidenceCounts.map((item) => [item._id, item.count])),
    requestStatusCounts: Object.fromEntries(requestCounts.map((item) => [item._id, item.count])),
    reports,
  };
}

export async function updateAudit(auditId, data, actor) {
  const audit = await assertInternalAudit(auditId, actor.organizationId);
  if (['COMPLETED', 'ARCHIVED'].includes(audit.status)) {
    throw makeError('Completed or archived audits cannot be updated', 400);
  }

  const allowed = [
    'name',
    'description',
    'frameworkId',
    'auditType',
    'auditorFirm',
    'periodStart',
    'periodEnd',
    'earlyAccessDate',
    'fieldworkStartDate',
    'fieldworkEndDate',
    'scopedControlIds',
  ];
  for (const key of allowed) {
    if (data[key] !== undefined) audit[key] = data[key];
  }
  await audit.save();

  await logCrudOperation({
    organizationId: actor.organizationId,
    actorId: actor._id,
    action: 'UPDATE',
    entityType: 'Audit',
    entityId: audit._id,
    entitySnapshot: { title: audit.name },
  });

  return getAuditById(auditId, actor.organizationId);
}

export async function lockEvidenceForAudit(auditId) {
  const now = new Date();
  const result = await AuditEvidenceItem.updateMany(
    {
      auditId,
      lockedAt: null,
      isDeleted: { $ne: true },
    },
    {
      $set: { lockedAt: now },
      $inc: { version: 1 },
    }
  );

  return result.modifiedCount;
}

const VALID_AUDIT_TRANSITIONS = {
  DRAFT: ['SCHEDULED', 'READINESS_CHECK'],
  SCHEDULED: ['READINESS_CHECK', 'IN_PROGRESS'],
  READINESS_CHECK: ['IN_PROGRESS', 'SCHEDULED'],
  IN_PROGRESS: ['COMPLETING'],
  COMPLETING: ['COMPLETED'],
  COMPLETED: ['ARCHIVED'],
  // Legacy status paths back to canonical statuses
  PREP: ['DRAFT'],
  FIELDWORK: ['IN_PROGRESS'],
};

export async function transitionAudit(auditId, status, actor) {
  const audit = await assertInternalAudit(auditId, actor.organizationId);
  const previousStatus = audit.status;
  const normalizedStatus = normalizeAuditStatus(status);
  const normalizedPrevious = normalizeAuditStatus(previousStatus);
  const allowed = VALID_AUDIT_TRANSITIONS[previousStatus] ?? VALID_AUDIT_TRANSITIONS[normalizedPrevious] ?? [];
  if (!allowed.includes(normalizedStatus)) {
    throw makeError(
      `Cannot transition audit from ${previousStatus} to ${status}. Allowed next statuses: ${allowed.join(', ') || 'none'}`,
      400
    );
  }
  if (normalizedStatus === 'COMPLETING') {
    const openFindings = await AuditFinding.find({
      audit: auditId,
      organization: actor.organizationId,
      severity: { $in: ['HIGH', 'CRITICAL'] },
      status: 'OPEN',
      deletedAt: null,
    })
      .select('_id title severity')
      .lean();

    if (openFindings.length > 0) {
      throw createCompletionGateError(openFindings);
    }
  }
  audit.status = normalizedStatus;
  if (normalizedStatus === 'COMPLETED') {
    audit.outcome = await computeAuditOutcome(auditId, actor.organizationId);
    audit.reportReceivedDate = audit.reportReceivedDate || new Date();
    await AuditAssignment.updateMany(
      { auditId, organizationId: actor.organizationId, status: 'ACTIVE' },
      { $set: { status: 'REVOKED', revokedAt: new Date(), revokedBy: actor._id } }
    );
  }
  await audit.save();

  if (normalizedStatus === 'IN_PROGRESS' && normalizeAuditStatus(previousStatus) !== 'IN_PROGRESS') {
    const lockedCount = await lockEvidenceForAudit(auditId);
    await logActivity({
      organizationId: actor.organizationId,
      actorId: actor._id,
      action: 'EVIDENCE_LOCKED',
      entityType: 'Audit',
      entityId: audit._id,
      entitySnapshot: { title: audit.name },
      metadata: {
        resourceType: 'Audit',
        resourceId: audit._id,
        lockedCount,
      },
      notes: `Locked ${lockedCount} evidence item${lockedCount === 1 ? '' : 's'} for audit review`,
    });
  }

  await logCrudOperation({
    organizationId: actor.organizationId,
    actorId: actor._id,
    action: 'STATUS_CHANGE',
    entityType: 'Audit',
    entityId: audit._id,
    entitySnapshot: { title: audit.name },
    after: { status: normalizedStatus },
    changedFields: ['status'],
  });

  return getAuditById(auditId, actor.organizationId);
}

async function assertFindingControl(audit, linkedControl) {
  if (!linkedControl) return;

  const control = await InternalControl.findOne({
    _id: linkedControl,
    organizationId: audit.organizationId,
    isDeleted: { $ne: true },
  }).lean();
  if (!control) throw makeError('Linked control not found', 404);

  if (audit.scopedControlIds?.length) {
    const isScoped = audit.scopedControlIds.some((controlId) => controlId.equals(control._id));
    if (!isScoped) throw makeError('Linked control is not scoped to this audit', 400);
  }
}

function populateAuditFinding(query) {
  return query
    .populate('linkedControl', 'identifier title')
    .populate('createdBy', 'firstName lastName email role');
}

export async function listAuditFindings(auditId, organizationId, query = {}) {
  await assertInternalAudit(auditId, organizationId);
  const filter = { audit: auditId, organization: organizationId, deletedAt: null };
  if (query.status) filter.status = query.status;
  if (query.severity) filter.severity = query.severity;

  return populateAuditFinding(AuditFinding.find(filter))
    .sort({ severity: 1, createdAt: -1 })
    .lean();
}

export async function createAuditFinding(auditId, data, actor, organizationIdOverride = null) {
  const organizationId = organizationIdOverride || actor.organizationId;
  const audit = await assertInternalAudit(auditId, organizationId);
  await assertFindingControl(audit, data.linkedControl);

  const finding = await AuditFinding.create({
    audit: auditId,
    organization: organizationId,
    title: data.title,
    description: data.description || '',
    severity: data.severity,
    linkedControl: data.linkedControl || null,
    createdBy: actor._id,
  });

  await logCrudOperation({
    organizationId,
    actorId: actor._id,
    action: 'CREATE',
    entityType: 'AuditFinding',
    entityId: finding._id,
    entitySnapshot: { title: finding.title },
  });

  return populateAuditFinding(AuditFinding.findById(finding._id)).lean();
}

export async function updateAuditFinding(auditId, findingId, data, actor) {
  await assertInternalAudit(auditId, actor.organizationId);
  const finding = await AuditFinding.findOne({
    _id: findingId,
    audit: auditId,
    organization: actor.organizationId,
    deletedAt: null,
  });
  if (!finding) throw makeError('Audit finding not found', 404);

  if (data.status !== undefined) {
    finding.status = data.status;
    finding.resolvedAt = data.status === 'REMEDIATED' ? new Date() : null;
  }
  if (data.remediationNote !== undefined) finding.remediationNote = data.remediationNote;
  await finding.save();

  await logCrudOperation({
    organizationId: actor.organizationId,
    actorId: actor._id,
    action: 'UPDATE',
    entityType: 'AuditFinding',
    entityId: finding._id,
    entitySnapshot: { title: finding.title },
    after: { status: finding.status, remediationNote: finding.remediationNote },
    changedFields: Object.keys(data),
  });

  return populateAuditFinding(AuditFinding.findById(finding._id)).lean();
}

export async function deleteAuditFinding(auditId, findingId, actor) {
  if (actor.role !== 'ADMIN') throw makeError('Only admins can delete audit findings', 403);
  await assertInternalAudit(auditId, actor.organizationId);

  const finding = await AuditFinding.findOne({
    _id: findingId,
    audit: auditId,
    organization: actor.organizationId,
    deletedAt: null,
  });
  if (!finding) throw makeError('Audit finding not found', 404);
  if (finding.status !== 'OPEN') throw makeError('Only open findings can be deleted', 400);

  finding.deletedAt = new Date();
  finding.deletedBy = actor._id;
  await finding.save();

  await logCrudOperation({
    organizationId: actor.organizationId,
    actorId: actor._id,
    action: 'DELETE',
    entityType: 'AuditFinding',
    entityId: finding._id,
    entitySnapshot: { title: finding.title },
  });

  return { deleted: true };
}

export async function snapshotAudit(auditId, actor) {
  const audit = await assertInternalAudit(auditId, actor.organizationId);
  const controlFilter = {
    organizationId: actor.organizationId,
    isDeleted: { $ne: true },
    isActive: { $ne: false },
  };

  if (audit.scopedControlIds?.length) {
    controlFilter._id = { $in: audit.scopedControlIds };
  } else if (audit.frameworkId) {
    controlFilter['linkedRequirements.frameworkId'] = audit.frameworkId;
  }

  const controls = await InternalControl.find(controlFilter).select('_id identifier title').lean();
  let createdSnapshots = 0;
  let createdItems = 0;

  for (const control of controls) {
    let snapshot = await AuditControlSnapshot.findOne({
      auditId,
      originalControlId: control._id,
    });

    if (!snapshot) {
      try {
        snapshot = await createAuditSnapshot(auditId, control._id, actor._id);
        createdSnapshots++;
      } catch (error) {
        if (!String(error.message).includes('duplicate')) throw error;
        snapshot = await AuditControlSnapshot.findOne({ auditId, originalControlId: control._id });
      }
    }

    const evidence = await Evidence.find({
      organizationId: actor.organizationId,
      linkedControlIds: control._id,
      isDeleted: { $ne: true },
      archivedAt: null,
    }).lean();

    if (evidence.length === 0) {
      const result = await AuditEvidenceItem.updateOne(
        { auditId, controlId: control._id, evidenceId: null, organizationId: actor.organizationId },
        {
          $setOnInsert: {
            organizationId: actor.organizationId,
            auditId,
            controlId: control._id,
            evidenceId: null,
            snapshotId: snapshot?._id || null,
            title: `${control.identifier}: ${control.title}`,
            description: 'No linked evidence was available when this audit snapshot was created.',
            status: 'NOT_STARTED',
          },
        },
        { upsert: true }
      );
      if (result.upsertedCount) createdItems++;
      continue;
    }

    for (const ev of evidence) {
      const result = await AuditEvidenceItem.updateOne(
        { auditId, controlId: control._id, evidenceId: ev._id, organizationId: actor.organizationId },
        {
          $setOnInsert: {
            organizationId: actor.organizationId,
            auditId,
            controlId: control._id,
            evidenceId: ev._id,
            snapshotId: snapshot?._id || null,
            title: ev.title,
            description: ev.description || '',
            fileName: ev.fileName || '',
            fileUrl: ev.fileUrl || '',
            status: ev.status === 'APPROVED' ? 'READY_FOR_AUDIT' : 'NOT_STARTED',
          },
        },
        { upsert: true }
      );
      if (result.upsertedCount) createdItems++;
    }
  }

  if (audit.status === 'DRAFT') {
    audit.status = 'SCHEDULED';
    await audit.save();
  }

  await logActivity({
    organizationId: actor.organizationId,
    actorId: actor._id,
    action: 'CREATE',
    entityType: 'AuditSnapshot',
    entityId: audit._id,
    entitySnapshot: { title: audit.name },
    notes: `Created audit snapshot: ${createdSnapshots} control snapshots, ${createdItems} evidence items`,
  });

  return { audit: await getAuditById(auditId, actor.organizationId), createdSnapshots, createdItems };
}

export async function lookupAuditorCandidate(auditId, email, actor) {
  await assertInternalAudit(auditId, actor.organizationId);
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail, isDeleted: { $ne: true } })
    .select('_id firstName lastName email role status organizationId')
    .lean();

  if (!user) {
    return {
      state: 'NOT_FOUND',
      email: normalizedEmail,
      message: 'No user exists with this email.',
    };
  }

  if (user.role === 'AUDITOR') {
    return {
      state: 'AUDITOR_EXISTS',
      email: normalizedEmail,
      user,
      message: 'Auditor exists and can be assigned.',
    };
  }

  return {
    state: 'ROLE_CONFLICT',
    email: normalizedEmail,
    user,
    message: 'A user exists with this email but is not an auditor.',
  };
}

export async function inviteAuditor(auditId, data, actor) {
  const audit = await assertInternalAudit(auditId, actor.organizationId);
  const email = data.email.toLowerCase().trim();
  const mode = data.mode || 'assign';
  let auditor = await User.findOne({ email, isDeleted: { $ne: true } });

  if (auditor && auditor.role !== 'AUDITOR') {
    if (!data.confirmRoleChange) {
      const err = makeError('User exists but is not an auditor', 409);
      err.code = 'ROLE_CONFLICT';
      err.user = {
        _id: auditor._id,
        email: auditor.email,
        firstName: auditor.firstName,
        lastName: auditor.lastName,
        role: auditor.role,
        status: auditor.status,
      };
      throw err;
    }

    const previousRole = auditor.role;
    auditor.role = 'AUDITOR';
    if (auditor.status === 'INVITED') auditor.status = 'ACTIVE';
    await auditor.save();

    await sendNotificationEmail(
      auditor.email,
      `${auditor.firstName} ${auditor.lastName}`,
      'Your Veraha role was updated to Auditor',
      `Your role was changed from ${previousRole} to Auditor so you can review the audit "${audit.name}".`
    );

    await logCrudOperation({
      organizationId: actor.organizationId,
      actorId: actor._id,
      action: 'UPDATE',
      entityType: 'User',
      entityId: auditor._id,
      entitySnapshot: { title: auditor.email, identifier: 'AUDITOR' },
      before: { role: previousRole },
      after: { role: 'AUDITOR' },
      changedFields: ['role'],
    });
  }

  if (!auditor && mode === 'provision') {
    const tempPassword = data.password || generateTemporaryPassword();
    auditor = await User.create({
      organizationId: actor.organizationId,
      email,
      password: tempPassword,
      firstName: data.firstName || 'External',
      lastName: data.lastName || 'Auditor',
      role: 'AUDITOR',
      status: 'ACTIVE',
      invitedBy: actor._id,
      invitedAt: new Date(),
    });

    await sendNotificationEmail(
      email,
      `${auditor.firstName} ${auditor.lastName}`,
      `Auditor account created for ${audit.name}`,
      `An auditor account was provisioned for you in Veraha Security. Sign in with ${email}${data.password ? '.' : ` using this temporary password: ${tempPassword}`}`
    );
  } else if (!auditor && mode === 'invite') {
    const result = await createInvitation(
      {
        email,
        role: 'AUDITOR',
        firstName: data.firstName || 'External',
        lastName: data.lastName || 'Auditor',
      },
      actor
    );
    auditor = result.user;
  } else if (!auditor) {
    const err = makeError('No user exists with this email. Choose an onboarding path.', 404);
    err.code = 'USER_NOT_FOUND';
    throw err;
  } else if (auditor.status === 'SUSPENDED') {
    throw makeError('Auditor account is suspended', 403);
  } else if (auditor.role === 'AUDITOR') {
    await sendNotificationEmail(
      email,
      `${auditor.firstName} ${auditor.lastName}`,
      `You were assigned to audit: ${audit.name}`,
      `You have been assigned to review the audit "${audit.name}" in Veraha Security. Sign in to the auditor portal to continue.`
    );
  }

  const auditorProfile = await AuditorProfile.findOrCreate(email, {
    firstName: auditor.firstName,
    lastName: auditor.lastName,
    firmName: data.firmName,
  });

  await AuditorTenantMembership.findOneAndUpdate(
    {
      auditorProfile: auditorProfile._id,
      organization: actor.organizationId,
    },
    {
      $set: {
        status: 'ACTIVE',
        invitedBy: actor._id,
      },
      $setOnInsert: {
        auditorProfile: auditorProfile._id,
        organization: actor.organizationId,
        joinedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );

  const assignment = await AuditAssignment.findOneAndUpdate(
    { auditId, auditorUserId: auditor._id, organizationId: actor.organizationId },
    {
      $set: {
        auditorEmail: email,
        auditorProfile: auditorProfile._id,
        assignedBy: actor._id,
        status: 'ACTIVE',
        accessStartsAt: data.accessStartsAt ?? null,
        accessEndsAt: data.accessEndsAt ?? null,
        revokedAt: null,
        revokedBy: null,
      },
      $setOnInsert: {
        auditId,
        auditorUserId: auditor._id,
        organizationId: actor.organizationId,
      },
    },
    { upsert: true, new: true }
  );

  audit.auditorEmail = email;
  audit.auditorName = `${auditor.firstName} ${auditor.lastName}`;
  await audit.save();

  await logCrudOperation({
    organizationId: actor.organizationId,
    actorId: actor._id,
    action: 'CREATE',
    entityType: 'AuditAssignment',
    entityId: assignment._id,
    entitySnapshot: { title: email, identifier: audit.name },
  });

  return assignment.populate('auditorUserId', 'firstName lastName email role status');
}

export async function listAuditEvidence(auditId, organizationId, query = {}) {
  const filter = { auditId, organizationId, isDeleted: { $ne: true } };
  if (query.status) filter.status = query.status;
  return AuditEvidenceItem.find(filter)
    .sort({ status: 1, createdAt: 1 })
    .populate('controlId', 'identifier title overallStatus')
    .populate('evidenceId', 'title status validUntil fileName fileUrl')
    .populate('reviewedBy', 'firstName lastName email')
    .lean();
}

export async function respondToEvidenceItem(auditId, itemId, data, actor) {
  await assertInternalAudit(auditId, actor.organizationId);
  const item = await AuditEvidenceItem.findOne({
    _id: itemId,
    auditId,
    organizationId: actor.organizationId,
    isDeleted: { $ne: true },
  });
  if (!item) throw makeError('Audit evidence item not found', 404);
  if (item.status !== 'FLAGGED') throw makeError('Only flagged evidence can be returned for review', 400);

  if (item.lockedAt) {
    const allowedLockedFields = new Set(['status', 'internalNote']);
    const disallowedFields = Object.keys(data).filter((field) => !allowedLockedFields.has(field));

    if (disallowedFields.length > 0) {
      const err = makeError('Evidence item is locked. Only status and notes can be updated.', 423);
      err.code = 'EVIDENCE_ITEM_LOCKED';
      throw err;
    }

    if (data.internalNote !== undefined) item.internalNote = data.internalNote;
    item.status = data.status || 'READY_FOR_AUDIT';
  } else {
    item.customerResponse = data.response || '';
    item.customerRespondedBy = actor._id;
    item.customerRespondedAt = new Date();
    item.status = data.status || 'READY_FOR_AUDIT';
    if (data.internalNote !== undefined) item.internalNote = data.internalNote;
  }
  await item.save();

  await logCrudOperation({
    organizationId: actor.organizationId,
    actorId: actor._id,
    action: 'STATUS_CHANGE',
    entityType: 'AuditEvidenceItem',
    entityId: item._id,
    entitySnapshot: { title: item.title },
    after: { status: item.status, customerResponse: item.customerResponse, internalNote: item.internalNote },
    changedFields: ['status', 'customerResponse', 'internalNote'],
  });

  return item;
}

export async function listAuditorEngagements(auditor) {
  const auditorProfile = await AuditorProfile.findOne({
    email: auditor.email?.toLowerCase().trim(),
  }).lean();

  const assignmentQuery = {
    status: 'ACTIVE',
    isDeleted: { $ne: true },
  };

  if (auditorProfile) {
    assignmentQuery.auditorProfile = auditorProfile._id;
  } else {
    assignmentQuery.auditorUserId = auditor._id;
  }

  const assignments = await AuditAssignment.find(assignmentQuery)
    .populate({
      path: 'auditId',
      match: { isDeleted: { $ne: true }, status: { $nin: ['ARCHIVED'] } },
      populate: { path: 'frameworkId', select: 'code name' },
    })
    .populate('organizationId', 'name')
    .lean();

  return assignments.filter((assignment) => assignment.auditId);
}

export async function getAuditorEngagement(auditId, assignment) {
  const audit = await getAuditById(auditId, assignment.organizationId);
  const organization = await Organization.findById(assignment.organizationId).select('name').lean();
  return { ...audit, organization };
}

export async function reviewAuditEvidenceItem(auditId, itemId, action, data, auditor, organizationId) {
  const item = await AuditEvidenceItem.findOne({
    _id: itemId,
    auditId,
    organizationId,
    isDeleted: { $ne: true },
  });
  if (!item) throw makeError('Audit evidence item not found', 404);

  const statusByAction = {
    approve: 'APPROVED',
    flag: 'FLAGGED',
    notApplicable: 'NOT_APPLICABLE',
  };
  const nextStatus = statusByAction[action];
  if (!nextStatus) throw makeError('Invalid review action', 400);
  if (nextStatus === 'FLAGGED' && !data.comment?.trim()) {
    throw makeError('A comment is required when flagging evidence', 400);
  }

  item.status = nextStatus;
  item.flagReason = nextStatus === 'FLAGGED' ? data.comment.trim() : '';
  item.reviewedBy = auditor._id;
  item.reviewedAt = new Date();
  await item.save();

  if (data.comment?.trim()) {
    const Comment = mongoose.model('Comment');
    await Comment.create({
      organizationId,
      entityType: 'Evidence',
      entityId: item.evidenceId || item._id,
      userId: auditor._id,
      content: data.comment.trim(),
    });
  }

  await logCrudOperation({
    organizationId,
    actorId: auditor._id,
    action: 'STATUS_CHANGE',
    entityType: 'AuditEvidenceItem',
    entityId: item._id,
    entitySnapshot: { title: item.title },
    after: { status: item.status, flagReason: item.flagReason },
    changedFields: ['status', 'flagReason', 'reviewedBy', 'reviewedAt'],
  });

  return item.populate('controlId', 'identifier title overallStatus');
}

export async function listAuditRequests(auditId, organizationId) {
  return populateAuditRequest(AuditEvidenceRequest.find({ auditId, organizationId, isDeleted: { $ne: true } }))
    .sort({ createdAt: -1 })
    .lean();
}

export async function getAuditRequestById(auditId, requestId, organizationId) {
  const request = await populateAuditRequest(
    AuditEvidenceRequest.findOne({ _id: requestId, auditId, organizationId, isDeleted: { $ne: true } })
  ).lean({ virtuals: true });

  if (!request) throw makeError('Audit evidence request not found', 404);
  return request;
}

export async function createAuditRequest(auditId, data, auditor, organizationId) {
  const request = await AuditEvidenceRequest.create({
    organizationId,
    auditId,
    auditEvidenceItemId: data.auditEvidenceItemId || null,
    requestedBy: auditor._id,
    title: data.title,
    description: data.description || '',
    dueDate: data.dueDate || null,
    assignedTo: data.assignedTo || null,
    status: 'OPEN',
  });

  await logCrudOperation({
    organizationId,
    actorId: auditor._id,
    action: 'CREATE',
    entityType: 'AuditEvidenceRequest',
    entityId: request._id,
    entitySnapshot: { title: request.title },
  });

  return getAuditRequestById(auditId, request._id, organizationId);
}

export async function addAuditRequestMessage(auditId, requestId, data, actor, role, organizationIdOverride = null) {
  const organizationId = organizationIdOverride || actor.organizationId;
  if (role === 'INTERNAL') {
    await assertInternalAudit(auditId, organizationId);
  }

  const request = await AuditEvidenceRequest.findOne({
    _id: requestId,
    auditId,
    organizationId,
    isDeleted: { $ne: true },
  });
  if (!request) throw makeError('Audit evidence request not found', 404);

  request.messages.push({
    author: actor._id,
    role,
    body: data.body,
    attachmentUrl: data.attachmentUrl || '',
    createdAt: new Date(),
  });
  await request.save();

  const recipientUserId = role === 'AUDITOR' ? request.assignedTo : request.requestedBy;
  await notifyEvidenceRequestMessage({
    requestId: request._id,
    auditId,
    fromRole: role,
    recipientUserId,
  });

  await logCrudOperation({
    organizationId,
    actorId: actor._id,
    action: 'UPDATE',
    entityType: 'AuditEvidenceRequest',
    entityId: request._id,
    entitySnapshot: { title: request.title },
    changedFields: ['messages'],
  });

  return getAuditRequestById(auditId, requestId, organizationId);
}

export async function updateAuditRequest(auditId, requestId, data, actor) {
  await assertInternalAudit(auditId, actor.organizationId);
  const request = await AuditEvidenceRequest.findOne({
    _id: requestId,
    auditId,
    organizationId: actor.organizationId,
    isDeleted: { $ne: true },
  });
  if (!request) throw makeError('Audit evidence request not found', 404);

  if (data.assignedTo) {
    const assignee = await User.findOne({
      _id: data.assignedTo,
      organizationId: actor.organizationId,
      role: { $ne: 'AUDITOR' },
      isDeleted: { $ne: true },
    }).lean();
    if (!assignee) throw makeError('Assigned user must be an internal user in this organization', 400);
  }

  if (data.status !== undefined) {
    validateRequestStatusTransition(request.status, data.status);
    request.status = data.status;
    request.closedAt = ['COMPLETED', 'CLOSED', 'ACCEPTED'].includes(data.status) ? new Date() : null;
  }
  if (data.dueDate !== undefined) request.dueDate = data.dueDate;
  if (data.assignedTo !== undefined) request.assignedTo = data.assignedTo || null;

  await request.save();

  await logCrudOperation({
    organizationId: actor.organizationId,
    actorId: actor._id,
    action: 'UPDATE',
    entityType: 'AuditEvidenceRequest',
    entityId: request._id,
    entitySnapshot: { title: request.title },
    after: {
      dueDate: request.dueDate,
      assignedTo: request.assignedTo,
      status: request.status,
    },
    changedFields: Object.keys(data),
  });

  return getAuditRequestById(auditId, requestId, actor.organizationId);
}

export async function submitAuditEvidenceItemToRequest(auditId, requestId, itemId, actor) {
  await assertInternalAudit(auditId, actor.organizationId);
  const [request, item] = await Promise.all([
    AuditEvidenceRequest.findOne({
      _id: requestId,
      auditId,
      organizationId: actor.organizationId,
      isDeleted: { $ne: true },
    }),
    AuditEvidenceItem.findOne({
      _id: itemId,
      auditId,
      organizationId: actor.organizationId,
      isDeleted: { $ne: true },
    }).lean(),
  ]);
  if (!request) throw makeError('Audit evidence request not found', 404);
  if (!item) throw makeError('Audit evidence item not found', 404);

  const alreadyLinked = request.submittedItems.some((submittedItemId) => submittedItemId.equals(item._id));
  if (!alreadyLinked) request.submittedItems.push(item._id);
  request.submittedBy = actor._id;
  request.submittedAt = new Date();
  await request.save();

  await logCrudOperation({
    organizationId: actor.organizationId,
    actorId: actor._id,
    action: 'UPDATE',
    entityType: 'AuditEvidenceRequest',
    entityId: request._id,
    entitySnapshot: { title: request.title },
    after: { submittedItems: request.submittedItems },
    changedFields: ['submittedItems', 'submittedBy', 'submittedAt'],
  });

  return getAuditRequestById(auditId, requestId, actor.organizationId);
}

export async function submitAuditRequest(auditId, requestId, evidenceId, actor) {
  await assertInternalAudit(auditId, actor.organizationId);
  const [request, evidence] = await Promise.all([
    AuditEvidenceRequest.findOne({ _id: requestId, auditId, organizationId: actor.organizationId, isDeleted: { $ne: true } }),
    Evidence.findOne({ _id: evidenceId, organizationId: actor.organizationId, isDeleted: { $ne: true } }),
  ]);
  if (!request) throw makeError('Audit evidence request not found', 404);
  if (!evidence) throw makeError('Evidence not found', 404);

  request.status = 'SUBMITTED';
  request.submittedEvidenceId = evidence._id;
  request.submittedBy = actor._id;
  request.submittedAt = new Date();
  await request.save();

  await logCrudOperation({
    organizationId: actor.organizationId,
    actorId: actor._id,
    action: 'UPDATE',
    entityType: 'AuditEvidenceRequest',
    entityId: request._id,
    entitySnapshot: { title: request.title },
    after: { status: request.status, submittedEvidenceId: evidence._id },
    changedFields: ['status', 'submittedEvidenceId'],
  });

  return request;
}

function sumCounts(counts = {}) {
  return Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
}

function computeReadinessPercent(completed, total) {
  if (!total) return 0;
  return Math.round((completed / total) * 100);
}

/**
 * Aggregate evidence, request, and finding progress for an audit engagement.
 */
export async function getAuditReadiness(auditId, organizationId) {
  const audit = await assertInternalAudit(auditId, organizationId);

  const [evidenceAgg, requestAgg, findings] = await Promise.all([
    AuditEvidenceItem.aggregate([
      {
        $match: {
          auditId: new mongoose.Types.ObjectId(auditId),
          organizationId: new mongoose.Types.ObjectId(organizationId),
          isDeleted: { $ne: true },
        },
      },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    AuditEvidenceRequest.aggregate([
      {
        $match: {
          auditId: new mongoose.Types.ObjectId(auditId),
          organizationId: new mongoose.Types.ObjectId(organizationId),
          isDeleted: { $ne: true },
        },
      },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    AuditFinding.find({
      audit: auditId,
      organization: organizationId,
      deletedAt: null,
    })
      .select('severity status')
      .lean(),
  ]);

  const evidenceByStatus = Object.fromEntries(evidenceAgg.map((row) => [row._id, row.count]));
  const requestByStatus = Object.fromEntries(requestAgg.map((row) => [row._id, row.count]));

  const totalEvidence = sumCounts(evidenceByStatus);
  const reviewedEvidence =
    (evidenceByStatus.APPROVED || 0) +
    (evidenceByStatus.NOT_APPLICABLE || 0);
  const evidenceReadiness = computeReadinessPercent(reviewedEvidence, totalEvidence);

  const totalRequests = sumCounts(requestByStatus);
  const completedRequests =
    (requestByStatus.COMPLETED || 0) +
    (requestByStatus.CLOSED || 0) +
    (requestByStatus.ACCEPTED || 0);
  const requestReadiness = computeReadinessPercent(completedRequests, totalRequests);

  const findingsBySeverity = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  const openFindingsBySeverity = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  let openFindings = 0;

  for (const finding of findings) {
    findingsBySeverity[finding.severity] = (findingsBySeverity[finding.severity] || 0) + 1;
    if (finding.status === 'OPEN') {
      openFindings += 1;
      openFindingsBySeverity[finding.severity] = (openFindingsBySeverity[finding.severity] || 0) + 1;
    }
  }

  const components = [evidenceReadiness];
  if (totalRequests > 0) components.push(requestReadiness);
  const overallReadinessScore = Math.round(
    components.reduce((sum, value) => sum + value, 0) / components.length
  );

  const blockers = [];
  if ((openFindingsBySeverity.CRITICAL || 0) > 0) {
    blockers.push(`${openFindingsBySeverity.CRITICAL} critical finding(s) still open`);
  }
  if ((openFindingsBySeverity.HIGH || 0) > 0) {
    blockers.push(`${openFindingsBySeverity.HIGH} high finding(s) still open`);
  }
  if ((evidenceByStatus.FLAGGED || 0) > 0) {
    blockers.push(`${evidenceByStatus.FLAGGED} evidence item(s) flagged`);
  }

  return {
    auditId,
    status: normalizeAuditStatus(audit.status),
    overallReadinessScore,
    evidence: {
      total: totalEvidence,
      reviewed: reviewedEvidence,
      readinessPercent: evidenceReadiness,
      byStatus: evidenceByStatus,
    },
    requests: {
      total: totalRequests,
      completed: completedRequests,
      readinessPercent: requestReadiness,
      byStatus: requestByStatus,
    },
    findings: {
      total: findings.length,
      open: openFindings,
      bySeverity: findingsBySeverity,
      openBySeverity: openFindingsBySeverity,
    },
    milestones: {
      kickoffDate: audit.kickoffDate,
      fieldworkStartDate: audit.fieldworkStartDate,
      fieldworkEndDate: audit.fieldworkEndDate,
      reportReceivedDate: audit.reportReceivedDate,
      earlyAccessDate: audit.earlyAccessDate,
    },
    blockers,
    canComplete: blockers.filter((b) => b.includes('finding')).length === 0,
  };
}

/**
 * Return paginated activity history for an audit and related entities.
 */
export async function getAuditActivity(auditId, organizationId, query = {}) {
  await assertInternalAudit(auditId, organizationId);
  const { page = 1, limit = 50 } = query;
  const skip = (Number(page) - 1) * Number(limit);

  const [findingIds, requestIds, reportIds] = await Promise.all([
    AuditFinding.find({ audit: auditId, organization: organizationId }).distinct('_id'),
    AuditEvidenceRequest.find({ auditId, organizationId, isDeleted: { $ne: true } }).distinct('_id'),
    AuditReport.find({ auditId, organizationId, isDeleted: { $ne: true } }).distinct('_id'),
  ]);

  const orConditions = [{ entityType: 'Audit', entityId: new mongoose.Types.ObjectId(auditId) }];
  if (findingIds.length) {
    orConditions.push({ entityType: 'AuditFinding', entityId: { $in: findingIds } });
  }
  if (requestIds.length) {
    orConditions.push({ entityType: 'AuditEvidenceRequest', entityId: { $in: requestIds } });
  }
  if (reportIds.length) {
    orConditions.push({ entityType: 'AuditReport', entityId: { $in: reportIds } });
  }

  const filter = {
    organizationId: new mongoose.Types.ObjectId(organizationId),
    $or: orConditions,
  };

  const ActivityLog = mongoose.model('ActivityLog');
  const [activities, total] = await Promise.all([
    ActivityLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    ActivityLog.countDocuments(filter),
  ]);

  return {
    activities,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)) || 1,
      hasNextPage: skip + activities.length < total,
      hasPrevPage: Number(page) > 1,
    },
  };
}

/**
 * Organization-wide audit metrics for dashboards and list headers.
 */
export async function getAuditStats(organizationId) {
  const audits = await Audit.find({ organizationId, isDeleted: { $ne: true } })
    .select('status outcome updatedAt periodEnd')
    .lean();

  const byStatus = {};
  const currentYear = new Date().getFullYear();
  let inProgress = 0;
  let completedThisYear = 0;

  for (const audit of audits) {
    const status = normalizeAuditStatus(audit.status);
    byStatus[status] = (byStatus[status] || 0) + 1;
    if (['IN_PROGRESS', 'READINESS_CHECK', 'COMPLETING', 'SCHEDULED'].includes(status)) {
      inProgress += 1;
    }
    if (status === 'COMPLETED' && audit.updatedAt && new Date(audit.updatedAt).getFullYear() === currentYear) {
      completedThisYear += 1;
    }
  }

  const openHighCriticalFindings = await AuditFinding.countDocuments({
    organization: organizationId,
    status: 'OPEN',
    deletedAt: null,
    severity: { $in: ['HIGH', 'CRITICAL'] },
  });

  const upcomingDeadlines = audits
    .filter((audit) => {
      const status = normalizeAuditStatus(audit.status);
      return !['COMPLETED', 'ARCHIVED'].includes(status) && audit.periodEnd;
    })
    .sort((a, b) => new Date(a.periodEnd) - new Date(b.periodEnd))
    .slice(0, 5)
    .map((audit) => ({
      auditId: audit._id,
      periodEnd: audit.periodEnd,
      status: normalizeAuditStatus(audit.status),
    }));

  return {
    total: audits.length,
    byStatus,
    inProgress,
    completedThisYear,
    openHighCriticalFindings,
    upcomingDeadlines,
  };
}

export async function uploadAuditReport(auditId, file, actor, organizationIdOverride = null) {
  const organizationId = organizationIdOverride || actor.organizationId;
  const audit = await Audit.findOne({ _id: auditId, organizationId, isDeleted: { $ne: true } });
  if (!audit) throw makeError('Audit not found', 404);
  if (!file) throw makeError('Report file is required', 400);

  const uploadResult = await storageService.uploadFile(
    file.buffer,
    organizationId.toString(),
    file.originalname,
    file.mimetype
  );

  const report = await AuditReport.create({
    organizationId,
    auditId,
    uploadedBy: actor._id,
    s3Key: uploadResult.key,
    fileUrl: uploadResult.url,
    fileName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: uploadResult.size,
    fileHash: uploadResult.hash,
  });

  audit.reportUrl = uploadResult.url;
  audit.reportFileName = file.originalname;
  audit.reportReceivedDate = new Date();
  if (audit.status === 'COMPLETING') {
    audit.status = 'COMPLETED';
    audit.outcome = await computeAuditOutcome(auditId, organizationId);
    await AuditAssignment.updateMany(
      { auditId, organizationId, status: 'ACTIVE' },
      { $set: { status: 'REVOKED', revokedAt: new Date(), revokedBy: actor._id } }
    );
  }
  await audit.save();

  await logCrudOperation({
    organizationId,
    actorId: actor._id,
    action: 'CREATE',
    entityType: 'AuditReport',
    entityId: report._id,
    entitySnapshot: { title: file.originalname },
  });

  return report;
}

export default {
  listAudits,
  createAudit,
  getAuditById,
  getAuditReadiness,
  getAuditActivity,
  getAuditStats,
  updateAudit,
  lockEvidenceForAudit,
  transitionAudit,
  snapshotAudit,
  listAuditFindings,
  createAuditFinding,
  updateAuditFinding,
  deleteAuditFinding,
  inviteAuditor,
  listAuditEvidence,
  respondToEvidenceItem,
  listAuditorEngagements,
  getAuditorEngagement,
  reviewAuditEvidenceItem,
  listAuditRequests,
  createAuditRequest,
  getAuditRequestById,
  addAuditRequestMessage,
  updateAuditRequest,
  submitAuditEvidenceItemToRequest,
  submitAuditRequest,
  uploadAuditReport,
  lookupAuditorCandidate,
};
