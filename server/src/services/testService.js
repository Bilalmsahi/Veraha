/**
 * Test Service — compliance checks (manual evidence + future automation)
 */
import mongoose from 'mongoose';
import Test from '../models/Test.js';
import Evidence from '../models/Evidence.js';
import InternalControl from '../models/InternalControl.js';
import EvidenceVersion from '../models/EvidenceVersion.js';
import Organization from '../models/Organization.js';
import evidenceVersionService from './evidenceVersionService.js';
import { serializeTestWorkflow } from '../utils/readinessPredicates.js';
import {
  andAccess,
  buildLinkedControlEntityAccessMatch,
} from './frameworkAccessService.js';

function notFound(message = 'Test not found') {
  const err = new Error(message);
  err.statusCode = 404;
  return err;
}

async function findTestOrThrow(testId, organizationId) {
  const accessMatch = await buildLinkedControlEntityAccessMatch(organizationId, 'linkedControlIds');
  const test = await Test.findOne({
    $and: [
      { _id: testId, organizationId, isDeleted: false },
      accessMatch,
    ],
  });
  if (!test) throw notFound();
  return test;
}

async function getReadinessConfig(organizationId) {
  const organization = await Organization.findById(organizationId).select('settings').lean();
  return organization?.settings || {};
}

function attachWorkflowFields(test, config) {
  if (!test) return test;
  return {
    ...test,
    ...serializeTestWorkflow(test, config),
  };
}

function attachWorkflowFieldsMany(tests, config) {
  return tests.map((test) => attachWorkflowFields(test, config));
}

/**
 * List tests with filters and pagination
 */
export const listTests = async (organizationId, rawQuery) => {
  const {
    page = 1,
    limit = 20,
    search,
    category,
    type,
    status,
    rollout,
    ownerId,
    frameworkId,
    controlId,
    integration,
    showInactive,
    sortBy = 'dueDate',
    sortOrder = 'asc',
  } = rawQuery;

  const query = { organizationId, isDeleted: false };

  if (!showInactive) {
    query.isActive = true;
  }

  if (search && search.trim()) {
    query.name = { $regex: search.trim(), $options: 'i' };
  }
  if (category) query.category = category;
  if (type) query.type = type;
  if (status) query.status = status;
  if (rollout) query.rollout = rollout;
  if (ownerId) query.ownerId = ownerId;

  if (controlId && mongoose.Types.ObjectId.isValid(controlId)) {
    query.linkedControlIds = new mongoose.Types.ObjectId(controlId);
  } else if (frameworkId && mongoose.Types.ObjectId.isValid(frameworkId)) {
    const controls = await InternalControl.find({
      organizationId,
      isDeleted: { $ne: true },
      'linkedRequirements.frameworkId': new mongoose.Types.ObjectId(frameworkId),
    })
      .select('_id')
      .lean();
    const ids = controls.map((c) => c._id);
    query.linkedControlIds = { $in: ids };
  }

  if (integration && integration.trim()) {
    query['automationConfig.provider'] = {
      $regex: integration.trim(),
      $options: 'i',
    };
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const accessQuery = andAccess(query, await buildLinkedControlEntityAccessMatch(organizationId, 'linkedControlIds'));

  const [tests, total, config] = await Promise.all([
    Test.find(accessQuery)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('ownerId', 'firstName lastName email')
      .populate({
        path: 'linkedControlIds',
        select: 'identifier title linkedRequirements',
        populate: {
          path: 'linkedRequirements.frameworkId',
          select: 'code name',
        },
      })
      .select('+lastPassedAt')
      .lean(),
    Test.countDocuments(accessQuery),
    getReadinessConfig(organizationId),
  ]);

  const pages = Math.ceil(total / limit) || 1;

  return {
    tests: attachWorkflowFieldsMany(tests, config),
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
 * Single test with relations
 */
export const getTestById = async (testId, organizationId) => {
  const accessMatch = await buildLinkedControlEntityAccessMatch(organizationId, 'linkedControlIds');
  const test = await Test.findOne({
    $and: [
      { _id: testId, organizationId, isDeleted: false },
      accessMatch,
    ],
  })
    .populate('ownerId', 'firstName lastName email')
    .populate('evidenceId', 'title status validUntil')
    .populate({
      path: 'linkedControlIds',
      select: 'identifier title description linkedRequirements',
      populate: {
        path: 'linkedRequirements.frameworkId',
        select: 'code name',
      },
    })
    .lean();

  if (!test) throw notFound();
  const config = await getReadinessConfig(organizationId);
  return attachWorkflowFields(test, config);
};

/**
 * Partial update; recalculateStatus runs on save
 */
export const updateTest = async (testId, organizationId, data) => {
  const test = await findTestOrThrow(testId, organizationId);

  const allowed = [
    'name',
    'description',
    'instructions',
    'evidenceGuidance',
    'category',
    'type',
    'renewalPeriod',
    'rollout',
    'ownerId',
    'dueDate',
    'linkedControlIds',
    'automationConfig',
  ];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      test[key] = data[key];
    }
  }

  test.recalculateStatus();
  await test.save();
  return getTestById(testId, organizationId);
};

export const softDeleteTest = async (testId, organizationId, userId) => {
  const test = await findTestOrThrow(testId, organizationId);
  test.isDeleted = true;
  test.deletedAt = new Date();
  test.deletedBy = userId;
  await test.save();
  return { deleted: true, id: testId };
};

export const deactivateTest = async (testId, organizationId) => {
  const test = await findTestOrThrow(testId, organizationId);
  test.isActive = false;
  test.recalculateStatus();
  await test.save();
  return getTestById(testId, organizationId);
};

export const snoozeTest = async (testId, organizationId, snoozedUntil) => {
  const test = await findTestOrThrow(testId, organizationId);
  test.snoozedUntil = snoozedUntil;
  test.recalculateStatus();
  await test.save();
  return getTestById(testId, organizationId);
};

export const reactivateTest = async (testId, organizationId) => {
  const test = await findTestOrThrow(testId, organizationId);
  test.isActive = true;
  test.snoozedUntil = null;
  test.recalculateStatus();
  await test.save();
  return getTestById(testId, organizationId);
};

/**
 * Dashboard-style stats for Tests list header
 */
export const getTestStats = async (organizationId) => {
  const now = new Date();
  const base = {
    organizationId,
    isDeleted: false,
    isActive: true,
    archivedAt: null,
    notApplicableAt: null,
    $or: [{ snoozedUntil: null }, { snoozedUntil: { $lte: now } }],
  };
  const accessQuery = andAccess(base, await buildLinkedControlEntityAccessMatch(organizationId, 'linkedControlIds'));
  const all = await Test.find(accessQuery).select('status type').lean();

  const total = all.length;
  const passing = all.filter((t) => t.status === 'ok').length;
  const attention = {
    overdue: all.filter((t) => t.status === 'overdue').length,
    dueSoon: all.filter((t) => t.status === 'due_soon').length,
    needsRemediation: all.filter((t) => t.status === 'needs_remediation').length,
  };

  const documents = all.filter((t) => t.type === 'document');
  const automated = all.filter((t) => t.type === 'automated');

  const docPassing = documents.filter((t) => t.status === 'ok').length;
  const autoPassing = automated.filter((t) => t.status === 'ok').length;

  return {
    total,
    passing,
    passingPercent: total ? Math.round((passing / total) * 100) : 0,
    attention,
    documents: {
      total: documents.length,
      passing: docPassing,
    },
    automated: {
      total: automated.length,
      passing: autoPassing,
    },
  };
};

/**
 * Ensure Evidence exists for this test, then return or create a draft version.
 */
export const startEvidenceForTest = async (testId, organizationId, user) => {
  const { userId } = user;
  const test = await findTestOrThrow(testId, organizationId);

  let evidenceId = test.evidenceId;

  if (!evidenceId) {
    const evidence = await Evidence.create({
      organizationId,
      title: test.name,
      description: test.description || '',
      linkedControlIds: test.linkedControlIds || [],
      uploadedBy: userId,
      status: 'PENDING',
      source: 'TEST',
      externalId: test._id.toString(),
      tags: ['test-evidence'],
      category: 'Test',
    });
    test.evidenceId = evidence._id;
    await test.save();
    evidenceId = evidence._id;
  }

  const existingDraft = await EvidenceVersion.findOne({
    evidenceId,
    organizationId,
    status: 'draft',
  });

  if (existingDraft) {
    return {
      evidenceId: evidenceId.toString(),
      versionId: existingDraft._id.toString(),
    };
  }

  const version = await evidenceVersionService.createDraft(evidenceId, user);
  return {
    evidenceId: evidenceId.toString(),
    versionId: version._id.toString(),
  };
};

/**
 * Version list for Test detail Evidence tab (reuses evidence versioning).
 */
export const getTestEvidenceVersions = async (testId, organizationId) => {
  const test = await findTestOrThrow(testId, organizationId);
  if (!test.evidenceId) {
    return [];
  }
  return evidenceVersionService.getVersionsByEvidenceId(test.evidenceId, organizationId);
};

export default {
  listTests,
  getTestById,
  updateTest,
  softDeleteTest,
  deactivateTest,
  snoozeTest,
  reactivateTest,
  getTestStats,
  startEvidenceForTest,
  getTestEvidenceVersions,
};
