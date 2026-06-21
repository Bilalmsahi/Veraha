import Test from '../models/Test.js';
import InternalControl from '../models/InternalControl.js';

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function policyControlIds(policy) {
  return (policy?.linkedControlIds || [])
    .map((id) => {
      if (!id) return '';
      if (typeof id === 'object' && id._id) return String(id._id);
      return String(id);
    })
    .filter(Boolean);
}

function policyTitleRegex(policy) {
  return new RegExp(escapeRegex(policy?.title || ''), 'i');
}

function basePolicyTestQuery(policy) {
  const query = {
    organizationId: policy.organizationId,
    isDeleted: { $ne: true },
    isActive: { $ne: false },
    name: policyTitleRegex(policy),
  };
  const controlIds = policyControlIds(policy);
  if (controlIds.length) query.linkedControlIds = { $in: controlIds };
  return query;
}

export async function findPolicyAutomationTests(policy, { session = null } = {}) {
  const query = basePolicyTestQuery(policy);
  const q = Test.find({
    ...query,
    $or: [
      { name: /approved/i },
      { name: /agree|acknowledg|accepted|attest/i },
    ],
  }).select('_id name status linkedControlIds');
  if (session) q.session(session);
  const tests = await q.lean();

  return {
    approvalTests: tests.filter((test) => /approved/i.test(test.name || '')),
    attestationTests: tests.filter((test) => /agree|acknowledg|accepted|attest/i.test(test.name || '')),
  };
}

async function updateTests(tests, status, { session = null } = {}) {
  const ids = tests.map((test) => test._id);
  if (!ids.length) return { matched: 0, modified: 0 };

  const set = {
    status,
    skipStatusRecompute: true,
    lastAutomationRunAt: new Date(),
    lastAutomationResult: status === 'ok' ? 'PASS' : 'FAIL',
  };
  if (status === 'ok') set.lastPassedAt = new Date();

  const result = await Test.updateMany(
    { _id: { $in: ids } },
    { $set: set },
    { session }
  );

  return {
    matched: result.matchedCount ?? result.nMatched ?? 0,
    modified: result.modifiedCount ?? result.nModified ?? 0,
  };
}

async function refreshLinkedControls(policy, { session = null } = {}) {
  const controlIds = policyControlIds(policy);
  for (const controlId of controlIds) {
    await InternalControl.updateControlReadiness(controlId, policy.organizationId, { session });
  }
}

export async function syncPolicyApprovalTests(policy, { approved, session = null } = {}) {
  const { approvalTests } = await findPolicyAutomationTests(policy, { session });
  const result = await updateTests(approvalTests, approved ? 'ok' : 'needs_remediation', { session });
  await refreshLinkedControls(policy, { session });
  return { ...result, tests: approvalTests };
}

export async function syncPolicyAttestationTests(policy, { acknowledgementRate, session = null } = {}) {
  const { attestationTests } = await findPolicyAutomationTests(policy, { session });
  const isPassing =
    !policy.requiresAttestation ||
    policy.status === 'ARCHIVED' ||
    Number(acknowledgementRate ?? policy.acknowledgementRate ?? 0) >= 100;
  const result = await updateTests(attestationTests, isPassing ? 'ok' : 'needs_remediation', { session });
  await refreshLinkedControls(policy, { session });
  return { ...result, tests: attestationTests };
}

export default {
  findPolicyAutomationTests,
  syncPolicyApprovalTests,
  syncPolicyAttestationTests,
};
