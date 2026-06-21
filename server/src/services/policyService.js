/**
 * Policy Service
 * Business logic for Policy, PolicyVersion, and PolicyAttestation management
 * 
 * Uses shared enums from models/enums.js for status consistency
 */
import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mammoth from 'mammoth';
import Policy from '../models/Policy.js';
import PolicyVersion from '../models/PolicyVersion.js';
import InternalControl from '../models/InternalControl.js';
import PolicyAttestation from '../models/PolicyAttestation.js';
import User from '../models/User.js';
import PolicyTemplate from '../models/PolicyTemplate.js';
import { storageService } from './storageService.js';
import { logCrudOperation } from './activityLogger.js';
import { POLICY_STATUS, REVIEW_FREQUENCY } from '../models/enums.js';
import { _recalculateAcknowledgementRate } from './policyWorkflowService.js';
import {
  findPolicyAutomationTests,
  syncPolicyAttestationTests,
} from './policyTestAutomationService.js';
import { hashPolicyHtml, sanitizePolicyHtml } from '../utils/policyHtmlSanitizer.js';
import { andAccess, buildPolicyAccessMatch } from './frameworkAccessService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const POLICY_TEMPLATE_DIR = path.join(__dirname, '..', 'seeds', 'raw', 'Vanta-Policy-Templates');

// Helper: Convert review frequency to months (WEEKLY ≈ 0.25, NEVER = null)
const FREQUENCY_MONTHS = {
  WEEKLY: 0.25,
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUALLY: 6,
  ANNUALLY: 12,
  BIENNIALLY: 24,
  NEVER: null, // No next review
};

/**
 * Refresh file URLs for a collection of policy versions by regenerating
 * URLs from their stored fileKey (S3 signed URL or local static URL).
 * Mutates the passed-in array/objects.
 */
const attachPolicyFileUrls = async (versions) => {
  if (!versions) return versions;

  for (const version of versions) {
    if (version.fileKey) {
      // version may be a Mongoose document or a plain object (.lean())
      // storageService.getFileUrl handles both S3 and local modes.
      // eslint-disable-next-line no-param-reassign
      version.fileUrl = await storageService.getFileUrl(version.fileKey);
    }
  }

  return versions;
};

const hasNonEmptyHtml = (value) => typeof value === 'string' && value.trim() !== '';

const inferContentType = (versionLike) => {
  if (versionLike?.contentType) return versionLike.contentType;
  if (hasNonEmptyHtml(versionLike?.contentHtml)) return 'EDITOR_HTML';
  if (versionLike?.fileKey) return 'UPLOADED_FILE';
  return 'EDITOR_HTML';
};

const isEditorHtmlVersion = (versionLike) => inferContentType(versionLike) === 'EDITOR_HTML';

const preparePolicyHtmlForSave = (contentHtml) => {
  const sanitized = sanitizePolicyHtml(contentHtml || '');
  return {
    contentHtml: sanitized,
    contentHash: hashPolicyHtml(sanitized),
  };
};

const editorContentVersionFilter = {
  $or: [
    { contentType: 'EDITOR_HTML' },
    { contentType: { $exists: false }, contentHtml: { $exists: true, $nin: [null, ''] } },
    { contentType: { $exists: false }, fileKey: { $in: [null, ''] } },
    { contentType: { $exists: false }, fileKey: { $exists: false } },
  ],
};

const policyPlaceholderPattern =
  /full content would be imported from|based on template:/i;

const isPlaceholderPolicyHtml = (contentHtml = '') =>
  !hasNonEmptyHtml(contentHtml) || policyPlaceholderPattern.test(contentHtml);

const getFileExtension = (filename = '') => filename.toLowerCase().split('.').pop() || '';

const getMimeTypeForFilename = (filename = '') => {
  const ext = getFileExtension(filename);
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'doc') return 'application/msword';
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === 'txt') return 'text/plain';
  if (ext === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  return 'application/octet-stream';
};

const streamToBuffer = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const htmlEscape = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

const fetchTemplateFileBuffer = async (template) => {
  if (template?.fileKey) {
    const stream = await storageService.getFileStream(template.fileKey);
    return streamToBuffer(stream);
  }

  if (!template?.filename) return null;
  return fs.readFile(path.join(POLICY_TEMPLATE_DIR, template.filename));
};

const fetchVersionFileBuffer = async (version) => {
  if (!version?.fileKey) return null;
  const stream = await storageService.getFileStream(version.fileKey);
  return streamToBuffer(stream);
};

const convertDocumentBufferToHtml = async ({ buffer, filename }) => {
  const ext = getFileExtension(filename);
  if (ext === 'docx') {
    const result = await mammoth.convertToHtml({ buffer });
    return result.value;
  }
  if (ext === 'txt') {
    const paragraphs = buffer
      .toString('utf8')
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${htmlEscape(paragraph).replace(/\n/g, '<br>')}</p>`)
      .join('');
    return paragraphs;
  }

  const error = new Error('Only DOCX and TXT policy documents can be imported into the editor');
  error.statusCode = 400;
  throw error;
};

const resolvePolicyDocumentSource = async ({ policy, organizationId, versionId = null }) => {
  let version = null;
  if (versionId) {
    version = await PolicyVersion.findOne({
      _id: versionId,
      policyId: policy._id,
      organizationId,
    });
    if (!version) {
      const error = new Error('Policy version not found');
      error.statusCode = 404;
      throw error;
    }
  }

  if (!version && policy.currentVersionId) {
    version = await PolicyVersion.findOne({
      _id: policy.currentVersionId,
      policyId: policy._id,
      organizationId,
    });
  }

  if (version?.fileKey) {
    return {
      sourceType: 'VERSION_FILE',
      filename: version.fileName || `policy-v${version.versionNumber}`,
      fileKey: version.fileKey,
      version,
    };
  }

  const templateId =
    typeof policy.templateId === 'object' && policy.templateId?._id ? policy.templateId._id : policy.templateId;
  if (templateId) {
    const template =
      typeof policy.templateId === 'object' && policy.templateId?.filename
        ? policy.templateId
        : await PolicyTemplate.findById(templateId);

    if (template?.filename || template?.fileKey) {
      return {
        sourceType: 'TEMPLATE_FILE',
        filename: template.filename || 'policy-template.docx',
        fileKey: template.fileKey || '',
        template,
      };
    }
  }

  if (version?.contentHtml) {
    return {
      sourceType: 'EDITOR_HTML',
      filename: `policy-v${version.versionNumber}.html`,
      version,
    };
  }

  const error = new Error('No source document is available for this policy');
  error.statusCode = 404;
  throw error;
};

const getPolicyForDocumentAction = async (policyId, organizationId) => {
  const policy = await Policy.findOne({
    _id: policyId,
    organizationId,
    isDeleted: false,
  }).populate('templateId', 'slug title filename fileKey');

  if (!policy) {
    const error = new Error('Policy not found');
    error.statusCode = 404;
    throw error;
  }

  return policy;
};

// =============================================================================
// POLICY CRUD
// =============================================================================

/**
 * Create a new policy
 */
export const createPolicy = async (data, user) => {
  const { organizationId, userId } = user;
  const approverIds = Array.isArray(data.approverIds)
    ? [...new Set(data.approverIds.map((id) => String(id)))]
    : undefined;

  const policy = await Policy.create({
    organizationId,
    ...data,
    ...(approverIds !== undefined ? { approverIds } : {}),
    status: 'DRAFT',
    ownerId: data.ownerId || userId,
  });

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'CREATE',
    entityType: 'Policy',
    entityId: policy._id,
    entitySnapshot: { title: policy.title },
  });

  await policy.populate('ownerId', 'firstName lastName email');
  await policy.populate('linkedControlIds', 'identifier title');

  return policy;
};

// Map our version status to Vanta-style
const VERSION_STATUS_MAP = { DRAFT: 'DRAFT', ACTIVE: 'APPROVED', ARCHIVED: 'ARCHIVED' };

/**
 * Get paginated policy list (Vanta-aligned)
 */
export const getPolicies = async (orgId, filters, currentUserId = null) => {
  const {
    page = 1,
    limit = 20,
    tab,
    status,
    latestVersion,
    category,
    ownerId,
    approverId,
    frameworkId,
    source,
    requiresAttestation,
    reviewDue,
    search,
    sortBy = 'title',
    sortOrder = 'asc',
  } = filters;

  const query = { organizationId: orgId, isDeleted: false };

  // Vanta-style tabs
  if (tab === 'needs_my_approval') {
    query.requiresAttestation = true;
    query.status = 'ACTIVE';
    query.currentVersionId = { $ne: null };
    // Will filter by attestation in post-query (user hasn't attested)
  } else if (tab === 'needs_approval') {
    query.status = 'DRAFT';
  } else if (tab === 'needs_reassignment') {
    query.$or = [{ ownerId: null }, { approverIds: { $exists: false } }, { approverIds: { $size: 0 } }];
  }

  if (frameworkId) query.frameworkIds = frameworkId;
  if (source) query.source = source;
  if (approverId) query.approverIds = approverId;

  if (status) {
    const statuses = status.split(',').map((s) => s.trim().toUpperCase());
    const validStatuses = statuses.filter((s) => POLICY_STATUS.includes(s));
    if (validStatuses.length > 0) query.status = { $in: validStatuses };
  }

  if (latestVersion) {
    if (latestVersion === 'NOT_STARTED') {
      query.currentVersionId = null;
    } else {
      const ourStatus = latestVersion === 'APPROVED' ? 'ACTIVE' : latestVersion;
      const matchingVersionIds = await PolicyVersion.find({
        organizationId: orgId,
        status: ourStatus,
      }).distinct('_id');
      query.currentVersionId = { $in: matchingVersionIds };
    }
  }

  if (category) query.category = { $regex: category, $options: 'i' };
  if (ownerId) query.ownerId = ownerId;
  if (requiresAttestation === 'true') query.requiresAttestation = true;
  else if (requiresAttestation === 'false') query.requiresAttestation = false;
  if (reviewDue === 'true') query.nextReviewDue = { $lt: new Date() };
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  const accessQuery = andAccess(query, await buildPolicyAccessMatch(orgId));

  const total = await Policy.countDocuments(accessQuery);

  let policies = await Policy.find(accessQuery)
    .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('ownerId', 'firstName lastName email')
    .populate('approverIds', 'firstName lastName email')
    .populate('currentVersionId', 'versionNumber status effectiveDate')
    .populate('frameworkIds', 'code name')
    .populate('templateId', 'slug title filename fileKey')
    .lean();

  // Tab needs_my_approval: filter to policies user hasn't attested
  if (tab === 'needs_my_approval' && currentUserId && policies.length > 0) {
    const versionIds = policies.map((p) => p.currentVersionId?._id).filter(Boolean);
    const attested = await PolicyAttestation.find({
      policyVersionId: { $in: versionIds },
      userId: currentUserId,
    }).lean();
    const attestedSet = new Set(attested.map((a) => a.policyVersionId.toString()));
    policies = policies.filter((p) => !attestedSet.has(p.currentVersionId?._id?.toString()));
    // Note: total count may be off - for simplicity we return filtered list
  }

  // Attach personnel count (attested/total) and Vanta-aligned fields
  const versionIds = policies.map((p) => p.currentVersionId?._id).filter(Boolean);
  const attestationCounts = await PolicyAttestation.aggregate([
    { $match: { policyVersionId: { $in: versionIds } } },
    { $group: { _id: '$policyVersionId', count: { $sum: 1 } } },
  ]);
  const attestMap = new Map(attestationCounts.map((a) => [a._id.toString(), a.count]));

  for (const p of policies) {
    const cv = p.currentVersionId;
    p.renewBy = p.nextReviewDue;
    p.latestVersion = cv
      ? { status: VERSION_STATUS_MAP[cv.status] || cv.status, versionNumber: cv.versionNumber }
      : { status: 'NOT_STARTED', versionNumber: null };
    p.approver = (Array.isArray(p.approverIds) && p.approverIds.length ? p.approverIds[0] : null) || p.ownerId;
    const attested = cv ? attestMap.get(cv._id.toString()) || 0 : 0;
    const totalRequired = p.requiresAttestation
      ? Array.isArray(p.targetUserIds) && p.targetUserIds.length > 0
        ? p.targetUserIds.length
        : 0
      : 0;
    p.personnel = totalRequired > 0 ? `${attested}/${totalRequired}` : null;
  }

  return {
    policies,
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
 * Get single policy with versions
 */
export const getPolicyById = async (policyId, orgId, includeVersions = true) => {
  const accessMatch = await buildPolicyAccessMatch(orgId);
  const policy = await Policy.findOne({
    $and: [
      { _id: policyId, organizationId: orgId, isDeleted: false },
      accessMatch,
    ],
  })
    .populate('ownerId', 'firstName lastName email')
    .populate('approverIds', 'firstName lastName email')
    .populate('linkedControlIds', 'identifier title')
    .populate('frameworkIds', 'code name')
    .populate('templateId', 'slug title filename fileKey')
    .populate('currentVersionId');

  if (!policy) {
    const error = new Error('Policy not found');
    error.statusCode = 404;
    throw error;
  }

  const result = policy.toObject();

  // Ensure the current active version (if any) has a fresh file URL
  if (result.currentVersionId && result.currentVersionId.fileKey) {
    result.currentVersionId.fileUrl = await storageService.getFileUrl(
      result.currentVersionId.fileKey
    );
  }

  if (includeVersions) {
    let versions = await PolicyVersion.find({ policyId })
      .sort({ versionNumber: -1 })
      .populate('createdBy', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName email')
      .lean();

    versions = await attachPolicyFileUrls(versions);
    result.versions = versions;
  }

  if (result.requiresAttestation && result.currentVersionId) {
    result.acknowledgementProgress = await _recalculateAcknowledgementRate(policy._id);
  } else {
    result.acknowledgementProgress = {
      required: 0,
      attested: 0,
      pending: 0,
      percent: 0,
    };
  }
  result.policyTests = await findPolicyAutomationTests(result);

  return result;
};

/**
 * Update policy metadata
 */
export const updatePolicy = async (policyId, data, user) => {
  const { organizationId, userId } = user;

  const policy = await Policy.findOne({
    _id: policyId,
    organizationId,
    isDeleted: false,
  });

  if (!policy) {
    const error = new Error('Policy not found');
    error.statusCode = 404;
    throw error;
  }

  const before = policy.toObject();

  const frequencyChanged =
    data.reviewFrequency && data.reviewFrequency !== policy.reviewFrequency;

  const linkedControlIdsChanged = data.linkedControlIds !== undefined;

  const updateData = { ...data };
  if (Array.isArray(updateData.approverIds)) {
    updateData.approverIds = [...new Set(updateData.approverIds.map((id) => String(id)))];
  }
  Object.assign(policy, updateData);

  // Sync InternalControl.linkedPolicyIds when policy.linkedControlIds changes
  if (linkedControlIdsChanged) {
    const oldIds = (before.linkedControlIds || []).map((id) =>
      typeof id === 'object' ? id.toString() : String(id)
    );
    const newIds = (policy.linkedControlIds || []).map((id) =>
      typeof id === 'object' ? id.toString() : String(id)
    );
    const removedIds = oldIds.filter((id) => !newIds.includes(id));
    const addedIds = newIds.filter((id) => !oldIds.includes(id));

    if (removedIds.length > 0) {
      await InternalControl.updateMany(
        { _id: { $in: removedIds }, organizationId },
        { $pull: { linkedPolicyIds: policy._id } }
      );
    }
    if (addedIds.length > 0) {
      await InternalControl.updateMany(
        { _id: { $in: addedIds }, organizationId },
        { $addToSet: { linkedPolicyIds: policy._id } }
      );
    }
  }

  // If review frequency changed, recalculate nextReviewDue based on
  // the last review date (or now if never reviewed). NEVER = no next review.
  if (frequencyChanged) {
    const months = FREQUENCY_MONTHS[policy.reviewFrequency];
    if (months == null) {
      policy.nextReviewDue = null;
    } else {
      const baseDate = policy.lastReviewedAt || new Date();
      const nextReview = new Date(baseDate);
      nextReview.setMonth(nextReview.getMonth() + months);
      policy.nextReviewDue = nextReview;
    }
  }

  await policy.save();

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'UPDATE',
    entityType: 'Policy',
    entityId: policy._id,
    entitySnapshot: { title: policy.title },
    before,
    after: policy.toObject(),
  });

  await policy.populate('ownerId', 'firstName lastName email');
  await policy.populate('approverIds', 'firstName lastName email');
  await policy.populate('linkedControlIds', 'identifier title');

  return policy;
};

/**
 * Delete policy (soft delete)
 */
export const deletePolicy = async (policyId, user) => {
  const { organizationId, userId } = user;

  const policy = await Policy.findOne({
    _id: policyId,
    organizationId,
    isDeleted: false,
  });

  if (!policy) {
    const error = new Error('Policy not found');
    error.statusCode = 404;
    throw error;
  }

  // Remove policy from all linked controls
  if (policy.linkedControlIds && policy.linkedControlIds.length > 0) {
    await InternalControl.updateMany(
      { _id: { $in: policy.linkedControlIds }, organizationId },
      { $pull: { linkedPolicyIds: policy._id } }
    );
  }

  // Soft delete policy
  policy.isDeleted = true;
  policy.deletedAt = new Date();
  policy.deletedBy = userId;
  await policy.save();

  // Also soft delete all versions
  await PolicyVersion.updateMany(
    { policyId: policy._id },
    { isDeleted: true, deletedAt: new Date(), deletedBy: userId }
  );

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'DELETE',
    entityType: 'Policy',
    entityId: policy._id,
    entitySnapshot: { title: policy.title },
  });

  return { deleted: true, id: policyId };
};

// =============================================================================
// VERSION MANAGEMENT
// =============================================================================

/**
 * Create new policy version (with optional file)
 */
export const createVersion = async (policyId, data, file, user) => {
  const { organizationId, userId } = user;

  const policy = await Policy.findOne({
    _id: policyId,
    organizationId,
    isDeleted: false,
  });

  if (!policy) {
    const error = new Error('Policy not found');
    error.statusCode = 404;
    throw error;
  }

  // Get next version number
  const latestVersion = await PolicyVersion.findOne({ policyId }).sort({
    versionNumber: -1,
  });
  const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

  // Handle file upload if present
  let fileData = {};
  if (file) {
    const uploadResult = await storageService.uploadFile(
      file.buffer,
      organizationId.toString(),
      file.originalname,
      file.mimetype
    );
    fileData = {
      fileKey: uploadResult.key,
      fileUrl: uploadResult.url,
      fileName: file.originalname,
      fileMimeType: file.mimetype,
      fileSizeBytes: uploadResult.size,
    };
  }

  const versionData = { ...data };
  const hasEditorContent = Object.prototype.hasOwnProperty.call(versionData, 'contentHtml');
  if (hasEditorContent) {
    Object.assign(versionData, preparePolicyHtmlForSave(versionData.contentHtml));
  }

  const version = await PolicyVersion.create({
    organizationId,
    policyId,
    versionNumber: nextVersionNumber,
    status: 'DRAFT',
    ...fileData,
    ...versionData,
    contentType: hasEditorContent || !file ? 'EDITOR_HTML' : 'UPLOADED_FILE',
    ...(hasEditorContent ? { editorLastSavedAt: new Date(), editorLastSavedBy: userId } : {}),
    createdBy: userId,
  });

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'CREATE',
    entityType: 'PolicyVersion',
    entityId: version._id,
    entitySnapshot: {
      policyTitle: policy.title,
      versionNumber: nextVersionNumber,
    },
  });

  await version.populate('createdBy', 'firstName lastName email');

  return version;
};

/**
 * Create or reuse the editable draft version for the rich-text editor.
 */
export const getOrCreateEditorDraft = async (policyId, user) => {
  const { organizationId, userId } = user;

  const policy = await Policy.findOne({
    _id: policyId,
    organizationId,
    isDeleted: false,
  });

  if (!policy) {
    const error = new Error('Policy not found');
    error.statusCode = 404;
    throw error;
  }

  const latestVersion = await PolicyVersion.findOne({ policyId, organizationId }).sort({
    versionNumber: -1,
  });
  const latestContentVersion = await PolicyVersion.findOne({
    policyId,
    organizationId,
    contentHtml: { $exists: true, $nin: [null, ''] },
    ...editorContentVersionFilter,
  }).sort({ versionNumber: -1 });
  const currentVersion = policy.currentVersionId
    ? await PolicyVersion.findOne({
        _id: policy.currentVersionId,
        policyId,
        organizationId,
      })
    : null;
  const sourceVersion =
    currentVersion && isEditorHtmlVersion(currentVersion) && hasNonEmptyHtml(currentVersion.contentHtml)
      ? currentVersion
      : latestContentVersion;
  const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

  const existingDraft = await PolicyVersion.findOne({
    policyId,
    organizationId,
    status: 'DRAFT',
    ...editorContentVersionFilter,
  })
    .sort({ versionNumber: -1 })
    .populate('createdBy', 'firstName lastName email');

  if (existingDraft) {
    const draftContentEmpty =
      typeof existingDraft.contentHtml !== 'string' || existingDraft.contentHtml.trim() === '';
    if (draftContentEmpty && sourceVersion?.contentHtml && !existingDraft._id.equals(sourceVersion._id)) {
      Object.assign(existingDraft, preparePolicyHtmlForSave(sourceVersion.contentHtml));
      existingDraft.contentType = 'EDITOR_HTML';
      existingDraft.draftSourceVersionId = sourceVersion._id;
      await existingDraft.save();
    }
    return existingDraft;
  }

  const preparedContent = preparePolicyHtmlForSave(sourceVersion?.contentHtml || '');
  let draft;
  try {
    draft = await PolicyVersion.create({
      organizationId,
      policyId,
      versionNumber: nextVersionNumber,
      status: 'DRAFT',
      ...preparedContent,
      contentType: 'EDITOR_HTML',
      draftSourceVersionId: sourceVersion?._id || null,
      editorLastSavedAt: new Date(),
      editorLastSavedBy: userId,
      changelog: 'Editor draft',
      createdBy: userId,
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    draft = await PolicyVersion.findOne({
      policyId,
      organizationId,
      status: 'DRAFT',
      ...editorContentVersionFilter,
    }).sort({ versionNumber: -1 });
    if (!draft) throw error;
  }

  if (draft.versionNumber === nextVersionNumber) {
    await logCrudOperation({
      organizationId,
      actorId: userId,
      action: 'CREATE',
      entityType: 'PolicyVersion',
      entityId: draft._id,
      entitySnapshot: {
        policyTitle: policy.title,
        versionNumber: draft.versionNumber,
        source: 'editor-draft',
      },
    });
  }

  await draft.populate('createdBy', 'firstName lastName email');
  return draft;
};

export const resetEditorDraft = async (policyId, user) => {
  const { organizationId, userId } = user;

  const policy = await Policy.findOne({
    _id: policyId,
    organizationId,
    isDeleted: false,
  });

  if (!policy) {
    const error = new Error('Policy not found');
    error.statusCode = 404;
    throw error;
  }

  const draft = await PolicyVersion.findOne({
    policyId,
    organizationId,
    status: 'DRAFT',
    ...editorContentVersionFilter,
  }).sort({ versionNumber: -1 });

  if (!draft) {
    const error = new Error('No editor draft found to reset');
    error.statusCode = 404;
    throw error;
  }

  if (draft.status !== 'DRAFT') {
    const error = new Error('Only DRAFT editor versions can be reset');
    error.statusCode = 400;
    throw error;
  }

  const latestContentVersion = await PolicyVersion.findOne({
    policyId,
    organizationId,
    _id: { $ne: draft._id },
    contentHtml: { $exists: true, $nin: [null, ''] },
    ...editorContentVersionFilter,
  }).sort({ versionNumber: -1 });
  const currentVersion = policy.currentVersionId
    ? await PolicyVersion.findOne({
        _id: policy.currentVersionId,
        policyId,
        organizationId,
      })
    : null;
  const sourceVersion =
    currentVersion && isEditorHtmlVersion(currentVersion) && hasNonEmptyHtml(currentVersion.contentHtml)
      ? currentVersion
      : latestContentVersion;

  const before = draft.toObject();
  Object.assign(draft, preparePolicyHtmlForSave(sourceVersion?.contentHtml || ''));
  draft.contentType = 'EDITOR_HTML';
  draft.draftSourceVersionId = sourceVersion?._id || null;
  draft.editorLastSavedAt = new Date();
  draft.editorLastSavedBy = userId;
  await draft.save();

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'UPDATE',
    entityType: 'PolicyVersion',
    entityId: draft._id,
    entitySnapshot: {
      policyTitle: policy.title,
      versionNumber: draft.versionNumber,
      source: 'editor-draft-reset',
    },
    before,
    after: draft.toObject(),
  });

  await draft.populate('createdBy', 'firstName lastName email');
  await draft.populate('editorLastSavedBy', 'firstName lastName email');
  return draft;
};

export const getPolicyContentDocumentUrl = async (policyId, user, options = {}) => {
  const { organizationId } = user;
  const policy = await getPolicyForDocumentAction(policyId, organizationId);
  const source = await resolvePolicyDocumentSource({
    policy,
    organizationId,
    versionId: options.versionId,
  });

  if (source.fileKey) {
    return {
      url: await storageService.getFileUrl(source.fileKey),
      filename: source.filename,
      mimeType: getMimeTypeForFilename(source.filename),
      sourceType: source.sourceType,
      direct: true,
    };
  }

  if (source.template?._id) {
    return {
      url: `/policy-library/${source.template._id}/download`,
      filename: source.filename,
      mimeType: getMimeTypeForFilename(source.filename),
      sourceType: source.sourceType,
      direct: false,
    };
  }

  const error = new Error('This policy version has no backing document file');
  error.statusCode = 404;
  throw error;
};

export const importPolicyContentDocument = async (policyId, user, options = {}) => {
  const { organizationId, userId } = user;
  const policy = await getPolicyForDocumentAction(policyId, organizationId);
  const source = await resolvePolicyDocumentSource({
    policy,
    organizationId,
    versionId: options.versionId,
  });

  const draft = await getOrCreateEditorDraft(policyId, user);
  if (!isPlaceholderPolicyHtml(draft.contentHtml) && !options.force) {
    return draft;
  }

  let buffer = null;
  if (source.sourceType === 'VERSION_FILE') {
    buffer = await fetchVersionFileBuffer(source.version);
  } else if (source.sourceType === 'TEMPLATE_FILE') {
    buffer = await fetchTemplateFileBuffer(source.template);
  }

  if (!buffer) {
    const error = new Error('Unable to read source document for this policy');
    error.statusCode = 404;
    throw error;
  }

  const convertedHtml = await convertDocumentBufferToHtml({
    buffer,
    filename: source.filename,
  });
  const before = draft.toObject();
  Object.assign(draft, preparePolicyHtmlForSave(convertedHtml));
  draft.contentType = 'EDITOR_HTML';
  draft.editorLastSavedAt = new Date();
  draft.editorLastSavedBy = userId;
  if (source.version?._id) draft.draftSourceVersionId = source.version._id;
  await draft.save();

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'UPDATE',
    entityType: 'PolicyVersion',
    entityId: draft._id,
    entitySnapshot: {
      policyTitle: policy.title,
      versionNumber: draft.versionNumber,
      source: 'document-import',
      sourceType: source.sourceType,
      filename: source.filename,
    },
    before,
    after: draft.toObject(),
  });

  await draft.populate('createdBy', 'firstName lastName email');
  await draft.populate('editorLastSavedBy', 'firstName lastName email');
  return draft;
};

export const uploadPolicyImage = async (policyId, file, user) => {
  const { organizationId } = user;

  const policy = await Policy.findOne({
    _id: policyId,
    organizationId,
    isDeleted: false,
  }).select('_id');

  if (!policy) {
    const error = new Error('Policy not found');
    error.statusCode = 404;
    throw error;
  }

  if (!file) {
    const error = new Error('No image uploaded');
    error.statusCode = 400;
    throw error;
  }

  const uploadResult = await storageService.uploadFile(
    file.buffer,
    organizationId.toString(),
    `policy-${policyId}-${file.originalname}`,
    file.mimetype
  );

  return { location: uploadResult.url };
};

/**
 * Update draft version
 */
export const updateVersion = async (policyId, versionId, data, user) => {
  const { organizationId, userId } = user;

  const version = await PolicyVersion.findOne({
    _id: versionId,
    policyId,
    organizationId,
  });

  if (!version) {
    const error = new Error('Policy version not found');
    error.statusCode = 404;
    throw error;
  }

  // Only DRAFT versions can be edited
  if (version.status !== 'DRAFT') {
    // 'DRAFT'
    const error = new Error('Only DRAFT versions can be edited');
    error.statusCode = 400;
    throw error;
  }

  const before = version.toObject();
  const updateData = { ...data };
  if (Object.prototype.hasOwnProperty.call(updateData, 'contentHtml')) {
    if (!isEditorHtmlVersion(version)) {
      const error = new Error('Uploaded-file versions cannot be edited with the policy editor');
      error.statusCode = 400;
      throw error;
    }
    Object.assign(updateData, preparePolicyHtmlForSave(updateData.contentHtml));
    updateData.contentType = 'EDITOR_HTML';
    updateData.editorLastSavedAt = new Date();
    updateData.editorLastSavedBy = userId;
  }

  Object.assign(version, updateData);
  await version.save();

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'UPDATE',
    entityType: 'PolicyVersion',
    entityId: version._id,
    before,
    after: version.toObject(),
  });

  await version.populate('createdBy', 'firstName lastName email');

  return version;
};

/**
 * Publish version (DRAFT → ACTIVE)
 * Archives previous active version
 */
export const publishVersion = async (policyId, versionId, data, user) => {
  const { organizationId, userId } = user;

  const [policy, version] = await Promise.all([
    Policy.findOne({ _id: policyId, organizationId, isDeleted: false }),
    PolicyVersion.findOne({ _id: versionId, policyId, organizationId }),
  ]);

  if (!policy) {
    const error = new Error('Policy not found');
    error.statusCode = 404;
    throw error;
  }

  if (!version) {
    const error = new Error('Policy version not found');
    error.statusCode = 404;
    throw error;
  }

  // Only DRAFT versions can be published
  if (version.status !== 'DRAFT') {
    // 'DRAFT'
    const error = new Error('Only DRAFT versions can be published');
    error.statusCode = 400;
    throw error;
  }

  // Archive previous active version if exists
  if (policy.currentVersionId) {
    await PolicyVersion.findByIdAndUpdate(policy.currentVersionId, {
      status: 'ARCHIVED',
      supersededAt: new Date(),
      supersededBy: version._id,
    });
  }

  // Publish new version
  version.status = 'ACTIVE';
  version.effectiveDate = data.effectiveDate || new Date();
  version.approvedBy = userId;
  version.approvedAt = new Date();
  await version.save();

  // Update policy to point to new active version
  policy.currentVersionId = version._id;
  policy.status = 'ACTIVE';
  policy.lastReviewedAt = new Date();
  policy.lastReviewedBy = userId;

  // Calculate next review due based on frequency (NEVER = no next review)
  const months = FREQUENCY_MONTHS[policy.reviewFrequency];
  if (months != null) {
    const nextReview = new Date();
    nextReview.setMonth(nextReview.getMonth() + months);
    policy.nextReviewDue = nextReview;
  } else {
    policy.nextReviewDue = null;
  }

  await policy.save();

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'STATUS_CHANGE',
    entityType: 'PolicyVersion',
    entityId: version._id,
    entitySnapshot: {
      policyTitle: policy.title,
      versionNumber: version.versionNumber,
    },
    before: { status: 'DRAFT' },
    after: { status: 'ACTIVE' },
  });

  await version.populate('createdBy', 'firstName lastName email');
  await version.populate('approvedBy', 'firstName lastName email');
  await policy.populate('ownerId', 'firstName lastName email');

  return { policy, version };
};

/**
 * Archive a policy (set to ARCHIVED)
 */
export const archivePolicy = async (policyId, user) => {
  const { organizationId, userId } = user;

  const policy = await Policy.findOne({
    _id: policyId,
    organizationId,
    isDeleted: false,
  });

  if (!policy) {
    const error = new Error('Policy not found');
    error.statusCode = 404;
    throw error;
  }

  const beforeStatus = policy.status;
  policy.status = 'ARCHIVED';
  await policy.save();

  // Also archive current version if exists
  if (policy.currentVersionId) {
    await PolicyVersion.findByIdAndUpdate(policy.currentVersionId, {
      status: 'ARCHIVED',
    });
  }

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'STATUS_CHANGE',
    entityType: 'Policy',
    entityId: policy._id,
    entitySnapshot: { title: policy.title },
    before: { status: beforeStatus },
    after: { status: 'ARCHIVED' },
  });

  await policy.populate('ownerId', 'firstName lastName email');

  return policy;
};

// =============================================================================
// ATTESTATION
// =============================================================================

/**
 * Record attestation (employee signs policy)
 */
export const createAttestation = async (policyId, data, user, req) => {
  const { organizationId, userId } = user;

  const policy = await Policy.findOne({
    _id: policyId,
    organizationId,
    isDeleted: false,
  }).populate('currentVersionId');

  if (!policy) {
    const error = new Error('Policy not found');
    error.statusCode = 404;
    throw error;
  }

  // Policy must be ACTIVE with a current version
  if (!policy.currentVersionId || policy.status !== 'ACTIVE') {
    // 'ACTIVE'
    const error = new Error('Policy must be ACTIVE with a published version to attest');
    error.statusCode = 400;
    throw error;
  }

  // Check if already attested
  const existing = await PolicyAttestation.findOne({
    policyVersionId: policy.currentVersionId._id,
    userId,
  });

  if (existing) {
    const error = new Error('You have already attested to this policy version');
    error.statusCode = 400;
    throw error;
  }

  const attestation = await PolicyAttestation.create({
    policyVersionId: policy.currentVersionId._id,
    userId,
    signatureText: data.signatureText,
    ipAddress: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('User-Agent'),
  });

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'CREATE',
    entityType: 'PolicyAttestation',
    entityId: attestation._id,
    entitySnapshot: { policyTitle: policy.title },
  });

  await attestation.populate('userId', 'firstName lastName email');
  await attestation.populate('policyVersionId', 'versionNumber policyId');
  const rate = await _recalculateAcknowledgementRate(policy._id);
  policy.acknowledgementRate = Math.round(rate.percent);
  await policy.save();
  await syncPolicyAttestationTests(policy, { acknowledgementRate: rate.percent });

  return attestation;
};

/**
 * Get attestations for a policy's current version
 */
export const getAttestations = async (policyId, orgId, pagination) => {
  const { page = 1, limit = 20 } = pagination;

  const policy = await Policy.findOne({
    _id: policyId,
    organizationId: orgId,
    isDeleted: false,
  }).populate('currentVersionId', 'versionNumber');

  if (!policy) {
    const error = new Error('Policy not found');
    error.statusCode = 404;
    throw error;
  }

  if (!policy.currentVersionId) {
    return {
      policyTitle: policy.title,
      versionNumber: null,
      attestations: [],
      pagination: { page, limit, total: 0, pages: 0 },
    };
  }

  const query = { policyVersionId: policy.currentVersionId._id };
  const total = await PolicyAttestation.countDocuments(query);

  const attestations = await PolicyAttestation.find(query)
    .sort({ attestedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('userId', 'firstName lastName email')
    .lean();

  return {
    policyTitle: policy.title,
    versionNumber: policy.currentVersionId.versionNumber,
    attestations,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get pending attestations for a user
 */
export const getPendingAttestations = async (orgId, userId) => {
  // Get all active policies requiring attestation
  const policies = await Policy.find({
    $and: [
      {
        organizationId: orgId,
        isDeleted: false,
        status: 'ACTIVE',
        requiresAttestation: true,
        currentVersionId: { $ne: null },
      },
      await buildPolicyAccessMatch(orgId),
    ],
  })
    .populate('currentVersionId', 'versionNumber')
    .lean();

  if (policies.length === 0) {
    return [];
  }

  // Get user's existing attestations for these versions
  const versionIds = policies.map((p) => p.currentVersionId._id);
  const attestations = await PolicyAttestation.find({
    policyVersionId: { $in: versionIds },
    userId,
  }).lean();

  const attestedVersionIds = new Set(
    attestations.map((a) => a.policyVersionId.toString())
  );

  // Filter to policies not yet attested
  const pending = policies.filter(
    (p) => !attestedVersionIds.has(p.currentVersionId._id.toString())
  );

  return pending.map((p) => ({
    _id: p._id,
    title: p.title,
    category: p.category,
    versionNumber: p.currentVersionId.versionNumber,
  }));
};

/**
 * Get policy statistics
 */
export const getPolicyStats = async (orgId, userId = null) => {
  const baseMatch = {
    organizationId: new mongoose.Types.ObjectId(orgId),
    isDeleted: { $ne: true },
  };
  const accessMatch = await buildPolicyAccessMatch(orgId);
  const queryBase = andAccess(baseMatch, accessMatch);

  const [statusCounts, overdueCount, needsApprovalCount, needsReassignmentCount] =
    await Promise.all([
      Policy.aggregate([{ $match: queryBase }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Policy.countDocuments(andAccess({ ...baseMatch, nextReviewDue: { $lt: new Date() } }, accessMatch)),
      Policy.countDocuments(andAccess({ ...baseMatch, status: 'DRAFT' }, accessMatch)),
      Policy.countDocuments(andAccess({
        ...baseMatch,
        $or: [{ ownerId: null }, { approverId: null }],
      }, accessMatch)),
    ]);

  const stats = {
    byStatus: {
      DRAFT: 0,
      ACTIVE: 0,
      ARCHIVED: 0,
    },
    overdueReview: overdueCount,
    total: 0,
    tabs: {
      all: 0,
      needs_approval: needsApprovalCount,
      needs_reassignment: needsReassignmentCount,
    },
  };

  statusCounts.forEach(({ _id, count }) => {
    if (_id && stats.byStatus.hasOwnProperty(_id)) {
      stats.byStatus[_id] = count;
    }
    stats.total += count;
  });
  stats.tabs.all = stats.total;
  if (userId) {
    const pending = await getPendingAttestations(orgId, userId);
    stats.tabs.needs_my_approval = pending.length;
  } else {
    stats.tabs.needs_my_approval = 0;
  }

  return stats;
};

export default {
  createPolicy,
  getPolicies,
  getPolicyById,
  updatePolicy,
  deletePolicy,
  createVersion,
  getOrCreateEditorDraft,
  resetEditorDraft,
  getPolicyContentDocumentUrl,
  importPolicyContentDocument,
  uploadPolicyImage,
  updateVersion,
  publishVersion,
  archivePolicy,
  createAttestation,
  getAttestations,
  getPendingAttestations,
  getPolicyStats,
};
