const DEFAULT_READINESS_CONFIG = {
  archiveAutoPassesAttestation: true,
  archiveEvidenceCountsAsSatisfied: true,
  naCountsAsSatisfied: false,
  snoozeBlocksReadiness: false,
};

export function normalizeReadinessConfig(settings = {}) {
  return {
    ...DEFAULT_READINESS_CONFIG,
    ...Object.fromEntries(
      Object.entries(settings || {}).filter(([, value]) => typeof value !== 'undefined')
    ),
  };
}

export function deriveWorkflowState(test, now = new Date()) {
  if (test?.archivedAt) return 'ARCHIVED';
  if (test?.notApplicableAt) return 'NOT_APPLICABLE';
  if (test?.snoozedUntil && new Date(test.snoozedUntil) > now) return 'SNOOZED';
  if (test?.isActive === false) return 'INACTIVE';
  return 'ACTIVE';
}

export function computeTestReadinessContribution(workflowState, status, config = {}) {
  const readinessConfig = normalizeReadinessConfig(config);

  // ARCHIVED is a product-defined terminal state meaning deliberate closure.
  // Unlike INACTIVE (excluded from scoring), ARCHIVED counts as satisfied
  // because the test was consciously retired, not just suppressed.
  if (workflowState === 'ARCHIVED') return 'SATISFIED';
  if (workflowState === 'NOT_APPLICABLE') {
    return readinessConfig.naCountsAsSatisfied ? 'SATISFIED' : 'EXCLUDED';
  }
  if (workflowState === 'SNOOZED') return 'EXCLUDED';
  if (workflowState === 'INACTIVE') return 'EXCLUDED';
  return status === 'ok' || status === 'na' ? 'SATISFIED' : 'FAILING';
}

export function serializeTestWorkflow(test, config = {}, now = new Date()) {
  const workflowState = deriveWorkflowState(test, now);
  const readinessContribution = computeTestReadinessContribution(
    workflowState,
    test?.status,
    config
  );

  let reason = null;
  if (workflowState === 'SNOOZED') reason = test?.snoozeReason || null;
  if (workflowState === 'INACTIVE') reason = test?.deactivationReason || null;
  if (workflowState === 'NOT_APPLICABLE') reason = test?.notApplicableReason || null;
  if (workflowState === 'ARCHIVED') reason = test?.archiveReason || null;

  return { workflowState, readinessContribution, reason };
}

export function computePolicyReadinessContribution(policy, config = {}) {
  const readinessConfig = normalizeReadinessConfig(config);
  const archived = Boolean(policy?.archivedAt) || policy?.status === 'ARCHIVED';
  if (archived) {
    return readinessConfig.archiveAutoPassesAttestation ? 'SATISFIED' : 'EXCLUDED';
  }
  if (policy?.status !== 'ACTIVE') return 'FAILING';
  if (policy?.requiresAttestation && Number(policy?.acknowledgementRate || 0) < 100) {
    return 'FAILING';
  }
  return 'SATISFIED';
}

export function computeEvidenceReadinessContribution(evidence, config = {}, now = new Date()) {
  const readinessConfig = normalizeReadinessConfig(config);
  if (evidence?.archivedAt) {
    return readinessConfig.archiveEvidenceCountsAsSatisfied ? 'SATISFIED' : 'EXCLUDED';
  }
  const expired = evidence?.validUntil && now > new Date(evidence.validUntil);
  return evidence?.status === 'APPROVED' && !expired ? 'SATISFIED' : 'FAILING';
}

export function computeRiskReadinessContribution(risk) {
  if (risk?.archivedAt || risk?.status === 'ARCHIVED' || risk?.status === 'CLOSED') {
    return 'SATISFIED';
  }
  return 'FAILING';
}

function evaluateItems(items, getContribution) {
  const contributions = items.map(getContribution);
  const failing = contributions.filter((value) => value === 'FAILING').length;
  const satisfied = contributions.filter((value) => value === 'SATISFIED').length;
  const excluded = contributions.filter((value) => value === 'EXCLUDED').length;
  return {
    contributions,
    failing,
    satisfied,
    excluded,
    passed: failing === 0,
  };
}

export function evaluateControlSatisfaction(control, linkedItems, config = {}) {
  const { policies = [], tests = [], evidence = [], risks = [] } = linkedItems || {};
  const now = new Date();

  const policyResult = evaluateItems(policies, (policy) =>
    computePolicyReadinessContribution(policy, config)
  );
  const testResult = evaluateItems(tests, (test) =>
    computeTestReadinessContribution(deriveWorkflowState(test, now), test?.status, config)
  );
  const evidenceResult = evaluateItems(evidence, (item) =>
    computeEvidenceReadinessContribution(item, config, now)
  );
  const riskResult = evaluateItems(risks, computeRiskReadinessContribution);

  const explicitControlPass =
    control?.automationStatus === 'PASS' ||
    (control?.automationStatus === 'NOT_CONFIGURED' && control?.manualStatus === 'PASS') ||
    (!control?.automationStatus && control?.manualStatus === 'PASS') ||
    control?.overallStatus === 'PASS';
  const hasSatisfiedWorkflowItem =
    policyResult.satisfied > 0 ||
    testResult.satisfied > 0 ||
    evidenceResult.satisfied > 0 ||
    riskResult.satisfied > 0;
  const hasSatisfiedSignal = explicitControlPass || hasSatisfiedWorkflowItem;

  const passed =
    policyResult.passed &&
    testResult.passed &&
    evidenceResult.passed &&
    riskResult.passed &&
    hasSatisfiedSignal;

  const reasons = { failing: [], excluded: [] };
  if (!hasSatisfiedSignal) reasons.failing.push('missing_satisfied_signal');
  if (!policyResult.passed) reasons.failing.push('missing_satisfied_policy');
  if (!testResult.passed) reasons.failing.push('missing_passing_test');
  if (!evidenceResult.passed) reasons.failing.push('missing_approved_evidence');
  if (!riskResult.passed) reasons.failing.push('open_risk');
  if (policyResult.excluded) reasons.excluded.push('policy_excluded');
  if (testResult.excluded) reasons.excluded.push('test_excluded');
  if (evidenceResult.excluded) reasons.excluded.push('evidence_excluded');

  return {
    controlId: control?._id ?? control?.controlId,
    satisfied: passed,
    status: passed ? 'PASS' : 'FAIL',
    readiness: {
      policies: policyResult,
      tests: testResult,
      evidence: evidenceResult,
      risks: riskResult,
    },
    reasons,
  };
}
