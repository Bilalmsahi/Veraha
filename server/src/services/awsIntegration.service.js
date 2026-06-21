/**
 * AWS Integration Service
 * Business logic for AWS accounts, findings, and companion evidence
 */
import AwsAccount from '../models/AwsAccount.js';
import AwsFinding from '../models/AwsFinding.js';
import Evidence from '../models/Evidence.js';

const ACCOUNT_UPDATE_FIELDS = ['name', 'regions', 'environmentType', 'status', 'notes', 'ownerId'];
const FINDING_UPDATE_FIELDS = [
  'title',
  'severity',
  'affectedService',
  'description',
  'region',
  'resourceType',
  'resourceId',
  'detectedOn',
  'status',
  'resolvedOn',
  'remediationNotes',
];

const FINDING_STATUSES = ['open', 'in_remediation', 'resolved', 'accepted_risk'];
const FINDING_SEVERITIES = ['critical', 'high', 'medium', 'low', 'informational'];

const getCompanionEvidenceMeta = (item, Model) => {
  if (Model === AwsAccount) {
    return {
      source: 'aws_account',
      externalId: item._id.toString(),
      title: item.name,
      description: `AWS account ${item.awsAccountId}`,
    };
  }

  return {
    source: 'aws_finding',
    externalId: item._id.toString(),
    title: item.title,
    description: item.description,
  };
};

/**
 * Create a new AWS account
 */
export const createAccount = async (organizationId, userId, data) => {
  if (!/^\d{12}$/.test(data.awsAccountId)) {
    const error = new Error('AWS Account ID must be exactly 12 digits');
    error.statusCode = 400;
    throw error;
  }

  const existing = await AwsAccount.findOne({
    organizationId,
    awsAccountId: data.awsAccountId,
    isDeleted: false,
  });

  if (existing) {
    const error = new Error('AWS account already exists in this organization');
    error.statusCode = 409;
    throw error;
  }

  return AwsAccount.create({
    organizationId,
    createdBy: userId,
    ...data,
  });
};

/**
 * Update an AWS account
 */
export const updateAccount = async (organizationId, accountId, data) => {
  const account = await AwsAccount.findOne({
    _id: accountId,
    organizationId,
    isDeleted: false,
  });

  if (!account) {
    const error = new Error('AWS account not found');
    error.statusCode = 404;
    throw error;
  }

  for (const field of ACCOUNT_UPDATE_FIELDS) {
    if (data[field] !== undefined) {
      account[field] = data[field];
    }
  }

  await account.save();
  return account;
};

/**
 * Soft-delete an AWS account (blocked when findings exist)
 */
export const deleteAccount = async (organizationId, accountId) => {
  const account = await AwsAccount.findOne({
    _id: accountId,
    organizationId,
    isDeleted: false,
  });

  if (!account) {
    const error = new Error('AWS account not found');
    error.statusCode = 404;
    throw error;
  }

  const findingCount = await AwsFinding.countDocuments({
    awsAccountId: accountId,
    isDeleted: false,
  });

  if (findingCount > 0) {
    const error = new Error(
      'Cannot delete account with existing findings. Delete all findings first.'
    );
    error.statusCode = 409;
    throw error;
  }

  account.isDeleted = true;
  account.deletedAt = new Date();
  await account.save();

  return { deleted: true };
};

/**
 * Create a finding for an AWS account
 */
export const createFinding = async (organizationId, accountId, userId, data) => {
  const account = await AwsAccount.findOne({
    _id: accountId,
    organizationId,
    isDeleted: false,
  });

  if (!account) {
    const error = new Error('AWS account not found');
    error.statusCode = 404;
    throw error;
  }

  return AwsFinding.create({
    organizationId,
    awsAccountId: accountId,
    createdBy: userId,
    ...data,
  });
};

/**
 * Update an AWS finding
 */
export const updateFinding = async (organizationId, findingId, data) => {
  const finding = await AwsFinding.findOne({
    _id: findingId,
    organizationId,
    isDeleted: false,
  });

  if (!finding) {
    const error = new Error('AWS finding not found');
    error.statusCode = 404;
    throw error;
  }

  const updates = { ...data };

  if (updates.status === 'resolved' && updates.resolvedOn === undefined) {
    updates.resolvedOn = new Date();
  }

  if (updates.status !== undefined && updates.status !== 'resolved') {
    updates.resolvedOn = null;
  }

  for (const field of FINDING_UPDATE_FIELDS) {
    if (updates[field] !== undefined) {
      finding[field] = updates[field];
    }
  }

  await finding.save();
  return finding;
};

const resolveCompanionUploadedBy = async (source, externalId) => {
  if (source === 'aws_account') {
    const account = await AwsAccount.findById(externalId).select('createdBy').lean();
    return account?.createdBy ?? null;
  }

  if (source === 'aws_finding') {
    const finding = await AwsFinding.findById(externalId).select('createdBy').lean();
    return finding?.createdBy ?? null;
  }

  return null;
};

/**
 * Create or update companion Evidence for integration-linked controls.
 * Uses create/save instead of findOneAndUpdate to avoid the Evidence pre-hook
 * that throws when the document does not exist yet during an upsert.
 *
 * @param {string|ObjectId} uploadedByOverride - Required for non-AWS sources (e.g. hr_profile)
 *   where the creator cannot be resolved from AwsAccount/AwsFinding.
 */
export const createCompanionEvidence = async (
  organizationId,
  source,
  externalId,
  title,
  description,
  controlIds,
  uploadedByOverride = null
) => {
  const filter = { organizationId, source, externalId };
  const existing = await Evidence.findOne(filter);

  if (existing) {
    existing.title = title;
    existing.description = description;
    existing.linkedControlIds = controlIds;
    return existing.save();
  }

  const uploadedBy = uploadedByOverride ?? (await resolveCompanionUploadedBy(source, externalId));

  if (!uploadedBy) {
    const error = new Error(
      `Cannot create companion evidence: unable to resolve uploadedBy for source=${source}, externalId=${externalId}`
    );
    error.statusCode = 500;
    throw error;
  }

  return Evidence.create({
    organizationId,
    source,
    externalId,
    title,
    description,
    status: 'PENDING',
    linkedControlIds: controlIds,
    uploadedBy,
  });
};

/**
 * Link controls to an AWS account or finding
 */
export const linkToControl = async (Model, organizationId, itemId, controlIds) => {
  const item = await Model.findOne({
    _id: itemId,
    organizationId,
    isDeleted: false,
  });

  if (!item) {
    const error = new Error('Item not found');
    error.statusCode = 404;
    throw error;
  }

  const existingIds = new Set(item.linkedControlIds.map((id) => id.toString()));
  const newIds = controlIds.filter((id) => !existingIds.has(id.toString()));

  if (newIds.length > 0) {
    item.linkedControlIds.push(...newIds);

    const { source, externalId, title, description } = getCompanionEvidenceMeta(item, Model);

    for (const _controlId of newIds) {
      await createCompanionEvidence(
        organizationId,
        source,
        externalId,
        title,
        description,
        item.linkedControlIds
      );
    }
  }

  await item.save();
  return item;
};

/**
 * Unlink a control from an AWS account or finding
 */
export const unlinkFromControl = async (Model, organizationId, itemId, controlId) => {
  const item = await Model.findOne({
    _id: itemId,
    organizationId,
    isDeleted: false,
  });

  if (!item) {
    const error = new Error('Item not found');
    error.statusCode = 404;
    throw error;
  }

  item.linkedControlIds = item.linkedControlIds.filter(
    (id) => id.toString() !== controlId.toString()
  );

  await item.save();

  const { source, externalId } = getCompanionEvidenceMeta(item, Model);
  const evidence = await Evidence.findOne({ organizationId, source, externalId });
  if (evidence) {
    if (item.linkedControlIds.length === 0) {
      evidence.isDeleted = true;
      evidence.deletedAt = new Date();
    } else {
      evidence.linkedControlIds = item.linkedControlIds;
    }
    await evidence.save();
  }

  return item;
};

/**
 * Get AWS integration statistics for an organization
 */
export const getStats = async (organizationId) => {
  const baseQuery = { organizationId, isDeleted: false };

  const [totalAccounts, totalFindings, statusCounts, severityCounts] = await Promise.all([
    AwsAccount.countDocuments(baseQuery),
    AwsFinding.countDocuments(baseQuery),
    AwsFinding.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    AwsFinding.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
    ]),
  ]);

  const findingsByStatus = Object.fromEntries(
    FINDING_STATUSES.map((status) => [status, 0])
  );
  const findingsBySeverity = Object.fromEntries(
    FINDING_SEVERITIES.map((severity) => [severity, 0])
  );

  statusCounts.forEach(({ _id, count }) => {
    if (_id && findingsByStatus[_id] !== undefined) {
      findingsByStatus[_id] = count;
    }
  });

  severityCounts.forEach(({ _id, count }) => {
    if (_id && findingsBySeverity[_id] !== undefined) {
      findingsBySeverity[_id] = count;
    }
  });

  return {
    totalAccounts,
    totalFindings,
    findingsByStatus,
    findingsBySeverity,
  };
};
