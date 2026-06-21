/**
 * Evidence Version Service
 * Vanta-style versioned evidence: draft -> submit -> active; renew creates new draft.
 */
import Evidence from '../models/Evidence.js';
import EvidenceVersion from '../models/EvidenceVersion.js';
import EvidenceVersionFile from '../models/EvidenceVersionFile.js';
import { storageService } from './storageService.js';
import { logCrudOperation } from './activityLogger.js';

const DEFAULT_VALID_UNTIL_YEARS = 1;

async function assertEvidenceExists(evidenceId, organizationId) {
  const evidence = await Evidence.findOne({
    _id: evidenceId,
    organizationId,
    isDeleted: false,
  });
  if (!evidence) {
    const err = new Error('Evidence not found');
    err.statusCode = 404;
    throw err;
  }
  return evidence;
}

/**
 * List all versions for an evidence (document). Order: draft first, then active, then by completedAt desc.
 * Each version includes its files with resolved fileUrl.
 */
export const getVersionsByEvidenceId = async (evidenceId, organizationId) => {
  await assertEvidenceExists(evidenceId, organizationId);

  const versions = await EvidenceVersion.find({
    evidenceId,
    organizationId,
  })
    .sort({ status: 1, completedAt: -1, createdAt: -1 })
    .populate('submittedBy', 'firstName lastName email')
    .populate('completedBy', 'firstName lastName email')
    .lean();

  const versionIds = versions.map((v) => v._id);
  const files = await EvidenceVersionFile.find({
    versionId: { $in: versionIds },
    organizationId,
  })
    .sort({ sortOrder: 1, createdAt: 1 })
    .populate('addedBy', 'firstName lastName email')
    .lean();

  for (const f of files) {
    try {
      f.fileUrl = await storageService.getFileUrl(f.s3Key);
    } catch {
      f.fileUrl = null;
    }
  }

  const filesByVersion = new Map();
  for (const f of files) {
    const vid = f.versionId.toString();
    if (!filesByVersion.has(vid)) filesByVersion.set(vid, []);
    filesByVersion.get(vid).push(f);
  }

  const draftFirst = (a, b) => {
    if (a.status === 'draft' && b.status !== 'draft') return -1;
    if (a.status !== 'draft' && b.status === 'draft') return 1;
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (a.status !== 'active' && b.status === 'active') return 1;
    return new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt);
  };

  const sorted = [...versions].sort(draftFirst);
  return sorted.map((v) => ({
    ...v,
    files: filesByVersion.get(v._id.toString()) || [],
  }));
};

/**
 * Create a new draft version for this evidence (empty, no files yet).
 */
export const createDraft = async (evidenceId, user) => {
  const { organizationId, userId } = user;
  await assertEvidenceExists(evidenceId, organizationId);

  const existingDraft = await EvidenceVersion.findOne({
    evidenceId,
    organizationId,
    status: 'draft',
  });
  if (existingDraft) {
    const err = new Error('A draft version already exists');
    err.statusCode = 400;
    throw err;
  }

  const version = await EvidenceVersion.create({
    evidenceId,
    organizationId,
    status: 'draft',
  });

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'CREATE',
    entityType: 'EvidenceVersion',
    entityId: version._id,
    entitySnapshot: { evidenceId, status: 'draft' },
  });

  return version;
};

/**
 * Add a file to a draft version (upload to storage + create EvidenceVersionFile).
 */
export const addFileToVersion = async (versionId, evidenceId, file, user) => {
  const { organizationId, userId } = user;
  await assertEvidenceExists(evidenceId, organizationId);

  const version = await EvidenceVersion.findOne({
    _id: versionId,
    evidenceId,
    organizationId,
    status: 'draft',
  });
  if (!version) {
    const err = new Error('Draft version not found');
    err.statusCode = 404;
    throw err;
  }

  const uploadResult = await storageService.uploadFile(
    file.buffer,
    organizationId.toString(),
    file.originalname,
    file.mimetype
  );

  const count = await EvidenceVersionFile.countDocuments({ versionId });
  const versionFile = await EvidenceVersionFile.create({
    versionId,
    evidenceId,
    organizationId,
    s3Key: uploadResult.key,
    fileUrl: uploadResult.url,
    fileName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: uploadResult.size,
    addedBy: userId,
    sortOrder: count,
  });

  await versionFile.populate('addedBy', 'firstName lastName email');
  try {
    versionFile.fileUrl = await storageService.getFileUrl(versionFile.s3Key);
  } catch {
    versionFile.fileUrl = uploadResult.url;
  }
  return versionFile;
};

/**
 * Remove a file from a draft version (delete file record; optionally delete from storage).
 */
export const removeFileFromVersion = async (versionId, fileId, evidenceId, user) => {
  const { organizationId } = user;
  await assertEvidenceExists(evidenceId, organizationId);

  const version = await EvidenceVersion.findOne({
    _id: versionId,
    evidenceId,
    organizationId,
    status: 'draft',
  });
  if (!version) {
    const err = new Error('Draft version not found');
    err.statusCode = 404;
    throw err;
  }

  const versionFile = await EvidenceVersionFile.findOne({
    _id: fileId,
    versionId,
    organizationId,
  });
  if (!versionFile) {
    const err = new Error('File not found in this version');
    err.statusCode = 404;
    throw err;
  }

  await EvidenceVersionFile.deleteOne({ _id: fileId });
  try {
    await storageService.deleteFile(versionFile.s3Key);
  } catch {
    // best-effort; record is already removed
  }
  return { deleted: true };
};

/**
 * Submit a draft version: set status to active, completedAt, completedBy, validUntil.
 */
export const submitVersion = async (versionId, evidenceId, user) => {
  const { organizationId, userId } = user;
  const evidence = await assertEvidenceExists(evidenceId, organizationId);

  const version = await EvidenceVersion.findOne({
    _id: versionId,
    evidenceId,
    organizationId,
    status: 'draft',
  });
  if (!version) {
    const err = new Error('Draft version not found');
    err.statusCode = 404;
    throw err;
  }

  const fileCount = await EvidenceVersionFile.countDocuments({ versionId });
  if (fileCount === 0) {
    const err = new Error('Cannot submit a draft with no files');
    err.statusCode = 400;
    throw err;
  }

  const now = new Date();
  const validUntil = new Date(now);
  validUntil.setFullYear(validUntil.getFullYear() + DEFAULT_VALID_UNTIL_YEARS);

  version.status = 'active';
  version.submittedAt = now;
  version.submittedBy = userId;
  version.completedAt = now;
  version.completedBy = userId;
  version.validUntil = validUntil;
  await version.save();

  if (evidence.validUntil !== validUntil) {
    evidence.validUntil = validUntil;
    evidence.status = 'APPROVED';
    await evidence.save();
  }

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'UPDATE',
    entityType: 'EvidenceVersion',
    entityId: version._id,
    entitySnapshot: { evidenceId, status: 'active' },
  });

  await version.populate('completedBy', 'firstName lastName email');
  return version;
};

/**
 * Create a new empty draft (e.g. "New draft" from renew). Marks any existing draft as superseded only by having a new draft.
 */
export const createNewDraft = async (evidenceId, user) => {
  const { organizationId, userId } = user;
  await assertEvidenceExists(evidenceId, organizationId);

  const existingDraft = await EvidenceVersion.findOne({
    evidenceId,
    organizationId,
    status: 'draft',
  });
  if (existingDraft) {
    const err = new Error('A draft version already exists. Submit or remove it first.');
    err.statusCode = 400;
    throw err;
  }

  const version = await EvidenceVersion.create({
    evidenceId,
    organizationId,
    status: 'draft',
  });

  await logCrudOperation({
    organizationId,
    actorId: userId,
    action: 'CREATE',
    entityType: 'EvidenceVersion',
    entityId: version._id,
    entitySnapshot: { evidenceId, status: 'draft' },
  });

  return version;
};

export default {
  getVersionsByEvidenceId,
  createDraft,
  addFileToVersion,
  removeFileFromVersion,
  submitVersion,
  createNewDraft,
};
