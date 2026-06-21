/**
 * Test Workflow Service (Phase 3)
 *
 * Wraps existing Test lifecycle operations with workflow-aware fields:
 * - de/activate uses Test.isActive + Test.previousWorkflowStatus
 * - snooze/unsnooze uses Test.snoozedUntil + Test.previousWorkflowStatus
 * - archive/unarchive uses Test.archivedAt/archivedBy
 */
import Test from '../models/Test.js';
import InternalControl from '../models/InternalControl.js';
import Organization from '../models/Organization.js';
import { withTransaction } from '../utils/transactions.js';
import { logCrudOperation } from './activityLogger.js';
import { serializeTestWorkflow } from '../utils/readinessPredicates.js';

function notFound(message = 'Test not found') {
  const err = new Error(message);
  err.statusCode = 404;
  return err;
}

async function findTestOrThrow({ testId, organizationId, session = null }) {
  const q = Test.findOne({ _id: testId, organizationId, isDeleted: { $ne: true } });
  if (session) q.session(session);
  const test = await q;
  if (!test) throw notFound();
  return test;
}

async function cascadeReadiness(test, organizationId) {
  if (!test.linkedControlIds?.length) return;
  await Promise.all(test.linkedControlIds.map((id) => InternalControl.updateControlReadiness(id, organizationId)));
}

async function toWorkflowDto(test, organizationId, session = null) {
  const q = Organization.findById(organizationId).select('settings').lean();
  if (session) q.session(session);
  const organization = await q;
  const raw = typeof test.toObject === 'function' ? test.toObject() : test;
  return { ...raw, ...serializeTestWorkflow(raw, organization?.settings || {}) };
}

export async function deactivateTestWorkflow({ testId, actor, reason = '' }) {
  return withTransaction(async (session) => {
    const test = await findTestOrThrow({ testId, organizationId: actor.organizationId, session });
    test.previousWorkflowStatus = test.status;
    test.isActive = false;
    test.deactivationReason = reason || '';
    test.recalculateStatus();
    await test.save({ session });

    await logCrudOperation({
      organizationId: actor.organizationId,
      actorId: actor.userId,
      action: 'STATUS_CHANGE',
      entityType: 'Test',
      entityId: test._id,
      entitySnapshot: { name: test.name },
      before: { isActive: true },
      after: { isActive: false },
      changedFields: ['isActive', 'previousWorkflowStatus', 'status'],
    });

    await cascadeReadiness(test, actor.organizationId);
    return toWorkflowDto(test, actor.organizationId, session);
  });
}

export async function reactivateTestWorkflow({ testId, actor }) {
  return withTransaction(async (session) => {
    const test = await findTestOrThrow({ testId, organizationId: actor.organizationId, session });
    test.isActive = true;
    test.snoozedUntil = null;
    test.snoozeReason = '';
    test.deactivationReason = '';
    test.previousWorkflowStatus = null;
    test.skipStatusRecompute = false;
    test.recalculateStatus();
    await test.save({ session });
    await cascadeReadiness(test, actor.organizationId);
    return toWorkflowDto(test, actor.organizationId, session);
  });
}

export async function snoozeTestWorkflow({ testId, actor, snoozedUntil, reason = '' }) {
  return withTransaction(async (session) => {
    const test = await findTestOrThrow({ testId, organizationId: actor.organizationId, session });
    test.previousWorkflowStatus = test.status;
    test.snoozedUntil = snoozedUntil ? new Date(snoozedUntil) : null;
    test.snoozeReason = reason || '';
    test.recalculateStatus();
    await test.save({ session });
    await cascadeReadiness(test, actor.organizationId);
    return toWorkflowDto(test, actor.organizationId, session);
  });
}

export async function unsnoozeTestWorkflow({ testId, actor }) {
  return withTransaction(async (session) => {
    const test = await findTestOrThrow({ testId, organizationId: actor.organizationId, session });
    test.snoozedUntil = null;
    test.snoozeReason = '';
    test.recalculateStatus();
    await test.save({ session });
    await cascadeReadiness(test, actor.organizationId);
    return toWorkflowDto(test, actor.organizationId, session);
  });
}

export async function archiveTestWorkflow({ testId, actor, reason = '' }) {
  return withTransaction(async (session) => {
    const test = await findTestOrThrow({ testId, organizationId: actor.organizationId, session });
    test.archivedAt = new Date();
    test.archivedBy = actor.userId;
    test.archiveReason = reason || '';
    test.skipStatusRecompute = false;
    test.recalculateStatus();
    await test.save({ session });
    await cascadeReadiness(test, actor.organizationId);
    return toWorkflowDto(test, actor.organizationId, session);
  });
}

export async function unarchiveTestWorkflow({ testId, actor }) {
  return withTransaction(async (session) => {
    const test = await findTestOrThrow({ testId, organizationId: actor.organizationId, session });
    test.archivedAt = null;
    test.archivedBy = null;
    test.archiveReason = '';
    test.skipStatusRecompute = false;
    test.recalculateStatus();
    await test.save({ session });
    await cascadeReadiness(test, actor.organizationId);
    return toWorkflowDto(test, actor.organizationId, session);
  });
}

export async function markNa({ testId, actor, reason = '' }) {
  return withTransaction(async (session) => {
    const test = await findTestOrThrow({ testId, organizationId: actor.organizationId, session });
    test.notApplicableAt = new Date();
    test.notApplicableBy = actor.userId;
    test.notApplicableReason = reason || '';
    test.skipStatusRecompute = false;
    test.recalculateStatus();
    await test.save({ session });
    await cascadeReadiness(test, actor.organizationId);
    return toWorkflowDto(test, actor.organizationId, session);
  });
}

export async function autoUnsnoozeExpiredTests({ organizationId }) {
  const now = new Date();
  const tests = await Test.find({
    organizationId,
    isDeleted: { $ne: true },
    snoozedUntil: { $ne: null, $lte: now },
  }).select('_id linkedControlIds snoozedUntil isActive');

  let updated = 0;
  for (const t of tests) {
    t.snoozedUntil = null;
    t.recalculateStatus();
    await t.save();
    updated++;
    await cascadeReadiness(t, organizationId);
  }
  return { updated };
}

export default {
  deactivateTestWorkflow,
  reactivateTestWorkflow,
  snoozeTestWorkflow,
  unsnoozeTestWorkflow,
  archiveTestWorkflow,
  unarchiveTestWorkflow,
  markNa,
  autoUnsnoozeExpiredTests,
};

