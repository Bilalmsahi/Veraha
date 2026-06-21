/**
 * Evidence Service
 * Business logic for Evidence management
 */
import mongoose from 'mongoose';
import Evidence from '../models/Evidence.js';
import EvidenceVersionFile from '../models/EvidenceVersionFile.js';
import InternalControl from '../models/InternalControl.js';
import { storageService } from './storageService.js';
import { logCrudOperation } from './activityLogger.js';
import { recalculateReadinessForOrg } from './readinessService.js';
import {
  andAccess,
  assertControlAccessibleForOrg,
  buildLinkedControlEntityAccessMatch,
} from './frameworkAccessService.js';

/**
 * When evidence is reviewed, update linked controls' manualStatus based on
 * the presence of approved, non-expired evidence for each control.
 *
 * Rule of thumb:
 * - If a control has >=1 approved, non-expired evidence -> manualStatus = PASS
 * - If it has none and was NOT_CONFIGURED -> downgrade to FAIL
 * - Otherwise keep existing manualStatus
 */
const updateLinkedControlsFromEvidence = async (evidence, reviewerId) => {
  if (!evidence.linkedControlIds || evidence.linkedControlIds.length === 0) {
    return;
  }

  const organizationId = evidence.organizationId;

  for (const controlId of evidence.linkedControlIds) {
    // Count active approved evidence for this control
    const approvedCount = await Evidence.countDocuments({
      organizationId,
      isDeleted: { $ne: true },
      linkedControlIds: controlId,
      status: 'APPROVED',
      $or: [
        { validUntil: null },
        { validUntil: { $gt: new Date() } },
      ],
    });

    const control = await InternalControl.findOne({
      _id: controlId,
      organizationId,
      isDeleted: false,
      isActive: { $ne: false },
    });

    if (!control) continue;

    const previousStatus = control.manualStatus;
    const nextStatus =
      approvedCount > 0
        ? 'PASS'
        : previousStatus === 'NOT_CONFIGURED'
        ? 'FAIL'
        : previousStatus;

    if (nextStatus !== previousStatus) {
      control.manualStatus = nextStatus;
      control.lastAssessedAt = new Date();
      control.lastAssessedBy = reviewerId;
      await control.save(); // triggers overallStatus recalculation
    }
  }
};

/**
 * Create evidence with file upload
 * @param {Object} data - Evidence metadata
 * @param {Object} file - Multer file object
 * @param {Object} user - Current user context
 */
export const createEvidence = async (data, file, user) => {
  const { organizationId, userId } = user;

  // Upload file to storage (local or S3)
  const uploadResult = await storageService.uploadFile(
    file.buffer,
    organizationId.toString(),
    file.originalname,
    file.mimetype
  );

  const { isSensitive, tags: incomingTags, ...rest } = data;
  const tags = [...(Array.isArray(incomingTags) ? incomingTags : []), isSensitive ? 'sensitive' : 'non-sensitive'];
  // Create evidence document
  const evidence = await Evidence.create({
    organizationId,
    ...rest,
    tags,
    s3Key: uploadResult.key,
    fileUrl: uploadResult.url,
    fileName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: uploadResult.size,
    fileHash: uploadResult.hash,
    uploadedBy: userId,
    status: 'PENDING',
  });

  // Log activity
  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'CREATE',
    entityType: 'Evidence',
    entityId: evidence._id,
    entitySnapshot: { title: evidence.title, fileName: evidence.fileName },
  });

  // Populate relations for response
  await evidence.populate('uploadedBy', 'firstName lastName email');
  await evidence.populate('linkedControlIds', 'identifier title');

  return evidence;
};

const calculateValidUntilFromRecurrence = (recurrence) => {
  if (recurrence === 'NEVER') return null;
  const next = new Date();
  switch (recurrence) {
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      return next;
    case 'QUARTERLY':
      next.setMonth(next.getMonth() + 3);
      return next;
    case 'SEMI_ANNUALLY':
      next.setMonth(next.getMonth() + 6);
      return next;
    case 'ANNUALLY':
    default:
      next.setFullYear(next.getFullYear() + 1);
      return next;
  }
};

export const createCustomDocument = async (data, user) => {
  const { organizationId, userId } = user;
  const validUntil = calculateValidUntilFromRecurrence(data.recurrence);

  const evidence = await Evidence.create({
    organizationId,
    title: data.title,
    description: data.description || '',
    category: 'Custom Document',
    tags: [
      'custom-document',
      data.isSensitive ? 'sensitive' : 'non-sensitive',
      `recurrence:${data.recurrence}`,
    ],
    source: 'CUSTOM_DOCUMENT',
    status: 'PENDING',
    linkedControlIds: data.linkedControlIds || [],
    uploadedBy: userId,
    validFrom: new Date(),
    validUntil,
  });

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'CREATE',
    entityType: 'Evidence',
    entityId: evidence._id,
    entitySnapshot: { title: evidence.title, fileName: evidence.fileName || 'custom-document' },
  });

  await evidence.populate('uploadedBy', 'firstName lastName email');
  await evidence.populate('linkedControlIds', 'identifier title');

  return evidence;
};

/**
 * Get paginated evidence list with filters
 */
export const getEvidenceList = async (orgId, filters) => {
  const {
    page = 1,
    limit = 20,
    status,
    category,
    controlId,
    sources,
    uploadedBy,
    userId,
    frameworkId,
    tab,
    overallStatus,
    expiring,
    expired,
    validUntilFrom,
    validUntilTo,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = filters;

  // Build query
  let query = { organizationId: orgId, isDeleted: false };

  // Tab filters (Vanta-style)
  if (tab === 'owned') {
    if (userId) query.uploadedBy = userId;
  } else if (tab === 'needs_document') {
    query.$or = [
      { status: 'PENDING' },
      {
        status: 'APPROVED',
        validUntil: {
          $gte: new Date(),
          $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
    ];
  } else if (tab === 'draft') {
    query.status = 'PENDING';
  }

  if (status) {
    const statuses = status.split(',').map((s) => s.trim().toUpperCase());
    const valid = statuses.filter((s) => ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'].includes(s));
    if (valid.length) query.status = { $in: valid };
  }

  // Overall status (Vanta-style: OK, Due soon, Overdue, Needs remediation). When status filter is also set, apply overallStatus so both combine (e.g. Document status=Complete + Overall=Due soon).
  if (overallStatus) {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const statusVal = overallStatus === 'NEEDS_REMEDIATION' ? 'OVERDUE' : overallStatus;
    let overallCond;
    if (statusVal === 'OK') {
      overallCond = {
        status: 'APPROVED',
        $or: [
          { validUntil: null },
          { validUntil: { $gt: thirtyDaysFromNow } },
        ],
      };
    } else if (statusVal === 'DUE_SOON') {
      overallCond = { status: 'APPROVED', validUntil: { $gte: now, $lte: thirtyDaysFromNow } };
    } else if (statusVal === 'OVERDUE') {
      overallCond = {
        $or: [
          { status: 'EXPIRED' },
          { validUntil: { $lt: now }, status: 'APPROVED' },
        ],
      };
    } else {
      overallCond = null;
    }
    if (overallCond) {
      query = { $and: [query, overallCond] };
    }
  }

  // Renew by date range (takes precedence over overallStatus for validUntil when both provided)
  if (validUntilFrom && validUntilTo) {
    const from = new Date(validUntilFrom);
    const to = new Date(validUntilTo);
    if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
      query.validUntil = { $gte: from, $lte: to };
    }
  }

  if (category) {
    query.category = { $regex: category, $options: 'i' };
  }

  if (controlId) {
    query.linkedControlIds = controlId;
  }

  if (sources) {
    const sourceList = sources
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (sourceList.length > 0) {
      query.source = { $in: sourceList };
    }
  }

  if (uploadedBy) {
    if (uploadedBy === '__unassigned__' || uploadedBy === '__needs_reassignment__') {
      query.uploadedBy = null;
    } else {
      query.uploadedBy = uploadedBy;
    }
  }

  // Framework filter: evidence linked to controls that map to this framework, or no framework
  if (frameworkId === '__none__') {
    query.linkedControlIds = { $size: 0 };
  } else if (frameworkId && mongoose.Types.ObjectId.isValid(frameworkId)) {
    const controlIds = await InternalControl.find({
      organizationId: orgId,
      isDeleted: { $ne: true },
      isActive: { $ne: false },
      'linkedRequirements.frameworkId': new mongoose.Types.ObjectId(frameworkId),
    })
      .select('_id')
      .lean();
    const ids = controlIds.map((c) => c._id);
    query.linkedControlIds = { $in: ids };
  }

  if (expiring === 'true') {
    const now = new Date();
    const thirtyDays = new Date();
    thirtyDays.setDate(thirtyDays.getDate() + 30);
    query.validUntil = { $gte: now, $lte: thirtyDays };
    if (!query.status) query.status = { $nin: ['EXPIRED', 'REJECTED'] };
  }

  if (expired === 'true') {
    query.validUntil = { $lt: new Date() };
  }

  if (search) {
    const searchConditions = {
      $or: [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { fileName: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ],
    };
    query = { $and: [query, searchConditions] };
  }

  const accessQuery = andAccess(query, await buildLinkedControlEntityAccessMatch(orgId, 'linkedControlIds'));

  // Count total
  const total = await Evidence.countDocuments(accessQuery);

  // Fetch with pagination (populate controls with framework for Framework column)
  const evidence = await Evidence.find(accessQuery)
    .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('uploadedBy', 'firstName lastName email')
    .populate('reviewedBy', 'firstName lastName email')
    .populate({
      path: 'linkedControlIds',
      select: 'identifier title linkedRequirements',
      populate: { path: 'linkedRequirements.frameworkId', model: 'Framework', select: 'code name' },
    })
    .lean();

  // Refresh signed URLs for each evidence item
  const evidenceIds = evidence.map((item) => item._id);
  const latestFileUploads = await EvidenceVersionFile.aggregate([
    { $match: { organizationId: new mongoose.Types.ObjectId(orgId), evidenceId: { $in: evidenceIds } } },
    { $group: { _id: '$evidenceId', evidenceUploadedAt: { $max: '$createdAt' } } },
  ]);
  const latestFileUploadByEvidenceId = new Map(
    latestFileUploads.map((item) => [String(item._id), item.evidenceUploadedAt])
  );

  for (const item of evidence) {
    if (item.s3Key) {
      item.fileUrl = await storageService.getFileUrl(item.s3Key);
    }
    item.evidenceUploadedAt = latestFileUploadByEvidenceId.get(String(item._id)) || null;
  }

  return {
    evidence,
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
 * Get single evidence by ID
 */
export const getEvidenceById = async (evidenceId, orgId) => {
  const accessMatch = await buildLinkedControlEntityAccessMatch(orgId, 'linkedControlIds');
  const evidence = await Evidence.findOne({
    $and: [
      { _id: evidenceId, organizationId: orgId, isDeleted: false },
      accessMatch,
    ],
  })
    .populate('uploadedBy', 'firstName lastName email')
    .populate('reviewedBy', 'firstName lastName email')
    .populate('linkedControlIds', 'identifier title category overallStatus');

  if (!evidence) {
    const error = new Error('Evidence not found');
    error.statusCode = 404;
    throw error;
  }

  // Refresh signed URL
  if (evidence.s3Key) {
    evidence.fileUrl = await storageService.getFileUrl(evidence.s3Key);
  }

  return evidence;
};

/**
 * Get evidence for a specific control
 */
export const getEvidenceByControl = async (controlId, orgId, pagination) => {
  const { page = 1, limit = 20 } = pagination;

  // Verify control exists and belongs to org
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
  await assertControlAccessibleForOrg(control, orgId);

  const query = {
    organizationId: orgId,
    linkedControlIds: controlId,
    isDeleted: false,
  };

  const total = await Evidence.countDocuments(query);

  const evidence = await Evidence.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('uploadedBy', 'firstName lastName email')
    .populate('reviewedBy', 'firstName lastName email')
    .lean();

  // Refresh signed URLs
  for (const item of evidence) {
    if (item.s3Key) {
      item.fileUrl = await storageService.getFileUrl(item.s3Key);
    }
  }

  return {
    control: {
      _id: control._id,
      identifier: control.identifier,
      title: control.title,
    },
    evidence,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Update evidence metadata
 */
export const updateEvidence = async (evidenceId, data, user) => {
  const { organizationId, userId } = user;

  const evidence = await Evidence.findOne({
    _id: evidenceId,
    organizationId,
    isDeleted: false,
  });

  if (!evidence) {
    const error = new Error('Evidence not found');
    error.statusCode = 404;
    throw error;
  }

  const before = evidence.toObject();

  // Handle isSensitive -> tags
  const { isSensitive, ...rest } = data;
  if (isSensitive !== undefined) {
    const tags = (evidence.tags || []).filter(
      (t) => t !== 'sensitive' && t !== 'non-sensitive'
    );
    tags.push(isSensitive ? 'sensitive' : 'non-sensitive');
    rest.tags = tags;
  }

  // Update fields
  Object.assign(evidence, rest);
  await evidence.save();

  // Log activity
  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'UPDATE',
    entityType: 'Evidence',
    entityId: evidence._id,
    entitySnapshot: { title: evidence.title },
    before,
    after: evidence.toObject(),
  });

  // Populate relations for response
  await evidence.populate('uploadedBy', 'firstName lastName email');
  await evidence.populate('reviewedBy', 'firstName lastName email');
  await evidence.populate('linkedControlIds', 'identifier title');

  return evidence;
};

/**
 * Review evidence (approve/reject)
 */
export const reviewEvidence = async (evidenceId, reviewData, user) => {
  const { organizationId, userId } = user;
  const { status, reviewNotes } = reviewData;

  const evidence = await Evidence.findOne({
    _id: evidenceId,
    organizationId,
    isDeleted: false,
  });

  if (!evidence) {
    const error = new Error('Evidence not found');
    error.statusCode = 404;
    throw error;
  }

  const beforeStatus = evidence.status;

  evidence.status = status;
  evidence.reviewedBy = userId;
  evidence.reviewedAt = new Date();
  evidence.reviewNotes = reviewNotes;

  await evidence.save();

  // Update linked controls' readiness based on approved evidence
  await updateLinkedControlsFromEvidence(evidence, userId);
  await recalculateReadinessForOrg(organizationId);

  // Log status change
  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'STATUS_CHANGE',
    entityType: 'Evidence',
    entityId: evidence._id,
    entitySnapshot: { title: evidence.title },
    before: { status: beforeStatus },
    after: { status },
    changedFields: ['status', 'reviewedBy', 'reviewedAt', 'reviewNotes'],
  });

  // Populate relations for response
  await evidence.populate('uploadedBy', 'firstName lastName email');
  await evidence.populate('reviewedBy', 'firstName lastName email');
  await evidence.populate('linkedControlIds', 'identifier title');

  return evidence;
};

export const archiveEvidence = async (evidenceId, user) => {
  const { organizationId, userId } = user;

  const evidence = await Evidence.findOne({
    _id: evidenceId,
    organizationId,
    isDeleted: false,
  });

  if (!evidence) {
    const error = new Error('Evidence not found');
    error.statusCode = 404;
    throw error;
  }

  const before = evidence.toObject();
  evidence.archivedAt = new Date();
  evidence.archivedBy = userId;
  await evidence.save();

  if (evidence.linkedControlIds?.length) {
    await Promise.all(
      evidence.linkedControlIds.map((controlId) =>
        InternalControl.updateControlReadiness(controlId, organizationId)
      )
    );
    await recalculateReadinessForOrg(organizationId);
  }

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'STATUS_CHANGE',
    entityType: 'Evidence',
    entityId: evidence._id,
    entitySnapshot: { title: evidence.title },
    before: { archivedAt: before.archivedAt, archivedBy: before.archivedBy },
    after: { archivedAt: evidence.archivedAt, archivedBy: evidence.archivedBy },
    changedFields: ['archivedAt', 'archivedBy'],
  });

  return evidence;
};

export const unarchiveEvidence = async (evidenceId, user) => {
  const { organizationId, userId } = user;

  const evidence = await Evidence.findOne({
    _id: evidenceId,
    organizationId,
    isDeleted: false,
  });

  if (!evidence) {
    const error = new Error('Evidence not found');
    error.statusCode = 404;
    throw error;
  }

  const before = evidence.toObject();
  evidence.archivedAt = null;
  evidence.archivedBy = null;
  await evidence.save();

  if (evidence.linkedControlIds?.length) {
    await Promise.all(
      evidence.linkedControlIds.map((controlId) =>
        InternalControl.updateControlReadiness(controlId, organizationId)
      )
    );
    await recalculateReadinessForOrg(organizationId);
  }

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'STATUS_CHANGE',
    entityType: 'Evidence',
    entityId: evidence._id,
    entitySnapshot: { title: evidence.title },
    before: { archivedAt: before.archivedAt, archivedBy: before.archivedBy },
    after: { archivedAt: evidence.archivedAt, archivedBy: evidence.archivedBy },
    changedFields: ['archivedAt', 'archivedBy'],
  });

  return evidence;
};

/**
 * Soft delete evidence
 */
export const deleteEvidence = async (evidenceId, user) => {
  const { organizationId, userId } = user;

  const evidence = await Evidence.findOne({
    _id: evidenceId,
    organizationId,
    isDeleted: false,
  });

  if (!evidence) {
    const error = new Error('Evidence not found');
    error.statusCode = 404;
    throw error;
  }

  // Soft delete
  evidence.isDeleted = true;
  evidence.deletedAt = new Date();
  evidence.deletedBy = userId;
  await evidence.save();

  // Note: We keep the file in storage and rely on S3 lifecycle rules
  // for physical deletion. This keeps infrastructure simple.
  // If you ever need explicit deletion, call:
  // await storageService.deleteFile(evidence.s3Key);

  // Log activity
  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'DELETE',
    entityType: 'Evidence',
    entityId: evidence._id,
    entitySnapshot: { title: evidence.title, fileName: evidence.fileName },
  });

  return { deleted: true, id: evidenceId };
};

/**
 * Get expiring evidence alerts
 */
export const getExpiringEvidence = async (orgId, daysThreshold = 30) => {
  return Evidence.getExpiring(orgId, daysThreshold);
};

/**
 * Get evidence statistics with Vanta-style tab counts
 */
export const getEvidenceStats = async (orgId, userId = null) => {
  const stats = await Evidence.getStatistics(orgId);
  const baseQuery = { organizationId: orgId, isDeleted: false };
  const accessQuery = andAccess(baseQuery, await buildLinkedControlEntityAccessMatch(orgId, 'linkedControlIds'));
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [allCount, ownedCount, needsDocumentCount, draftCount] = await Promise.all([
    Evidence.countDocuments(accessQuery),
    userId
      ? Evidence.countDocuments(andAccess({ ...baseQuery, uploadedBy: userId }, await buildLinkedControlEntityAccessMatch(orgId, 'linkedControlIds')))
      : Promise.resolve(0),
    Evidence.countDocuments(andAccess({
      ...baseQuery,
      $or: [
        { status: 'PENDING' },
        {
          status: 'APPROVED',
          validUntil: { $gte: now, $lte: thirtyDaysFromNow },
        },
      ],
    }, await buildLinkedControlEntityAccessMatch(orgId, 'linkedControlIds'))),
    Evidence.countDocuments(andAccess({ ...baseQuery, status: 'PENDING' }, await buildLinkedControlEntityAccessMatch(orgId, 'linkedControlIds'))),
  ]);

  return {
    ...stats,
    tabs: {
      all: allCount,
      owned: ownedCount,
      needs_document: needsDocumentCount,
      draft: draftCount,
    },
  };
};

/**
 * Set evidence linked controls (replace). Empty controlIds = unlink all.
 */
export const linkEvidenceToControls = async (evidenceId, controlIds, user) => {
  const { organizationId, userId } = user;

  const evidence = await Evidence.findOne({
    _id: evidenceId,
    organizationId,
    isDeleted: false,
  });

  if (!evidence) {
    const error = new Error('Evidence not found');
    error.statusCode = 404;
    throw error;
  }

  if (controlIds.length > 0) {
    const validControls = await InternalControl.find({
      _id: { $in: controlIds },
      organizationId,
      isDeleted: false,
      isActive: { $ne: false },
    }).select('_id');

    if (validControls.length !== controlIds.length) {
      const error = new Error('One or more controls not found or do not belong to your organization');
      error.statusCode = 400;
      throw error;
    }
  }

  const before = evidence.toObject();
  evidence.linkedControlIds = controlIds;
  await evidence.save();

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'UPDATE',
    entityType: 'Evidence',
    entityId: evidence._id,
    entitySnapshot: { title: evidence.title },
    before,
    after: evidence.toObject(),
    changedFields: ['linkedControlIds'],
  });

  await evidence.populate('uploadedBy', 'firstName lastName email');
  await evidence.populate('linkedControlIds', 'identifier title');

  return evidence;
};

/**
 * Stream a file attached directly on the Evidence document (legacy / auto-generated).
 * Used for TRAINING_CERTIFICATE and older uploads that predate EvidenceVersion.
 */
export const streamEvidenceFile = async (evidenceId, orgId) => {
  const evidence = await Evidence.findOne({
    _id: evidenceId,
    organizationId: orgId,
    isDeleted: false,
  }).select('s3Key fileName mimeType');

  if (!evidence?.s3Key) {
    const error = new Error('Evidence file not found');
    error.statusCode = 404;
    throw error;
  }

  const stream = await storageService.getFileStream(evidence.s3Key);
  return {
    stream,
    fileName: evidence.fileName || 'evidence-file',
    mimeType: evidence.mimeType || 'application/octet-stream',
  };
};

export default {
  createEvidence,
  createCustomDocument,
  getEvidenceList,
  getEvidenceById,
  getEvidenceByControl,
  updateEvidence,
  reviewEvidence,
  archiveEvidence,
  unarchiveEvidence,
  deleteEvidence,
  getExpiringEvidence,
  getEvidenceStats,
  linkEvidenceToControls,
  streamEvidenceFile,
};
