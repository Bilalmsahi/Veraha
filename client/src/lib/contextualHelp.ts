export type HelpModuleId =
  | 'controls'
  | 'tests'
  | 'documents'
  | 'policies'
  | 'risks'
  | 'frameworks'
  | 'personnel'
  | 'training'
  | 'audits'
  | 'accessReviews'
  | 'vendors'
  | 'integrations'
  | 'aws'
  | 'hr'
  | 'devices';

export type HelpTone = 'success' | 'error' | 'warning' | 'info' | 'muted';

export type HelpStatus = {
  key: string;
  label: string;
  tone: HelpTone;
  symbol?: string;
  meaning: string;
  changedBy: string;
  trigger: string;
  automation: 'Manual' | 'Automatic' | 'Manual or automatic';
  editable: string;
  ui: string;
  readiness: string;
  nextAction: string;
};

export type HelpTransition = {
  from: string;
  to: string;
  trigger: string;
  type: 'Manual' | 'Automatic' | 'Manual or automatic';
  allowedFor: string;
  impact: string;
};

export type HelpConfig = {
  module: string;
  shortDescription: string;
  overview: string;
  lifecycle: string[];
  lifecycleStyle: 'horizontal' | 'vertical' | 'loop';
  statuses: HelpStatus[];
  transitions: HelpTransition[];
  readinessImpact: string[];
  nextActions: string[];
  faqs: Array<{ question: string; answer: string }>;
};

export const auditedHelpStatusKeys: Record<HelpModuleId, string[]> = {
  controls: [
    'PASS',
    'FAIL',
    'WARNING',
    'NOT_APPLICABLE',
    'NOT_CONFIGURED',
    'MANUAL_PASS',
    'MANUAL_FAIL',
    'MANUAL_NOT_APPLICABLE',
    'AUTOMATION_PASS',
    'AUTOMATION_FAIL',
    'AUTOMATION_WARNING',
    'AUTOMATION_NOT_CONFIGURED',
  ],
  tests: [
    'ok',
    'overdue',
    'due_soon',
    'needs_remediation',
    'na',
    'ACTIVE',
    'SNOOZED',
    'INACTIVE',
    'NOT_APPLICABLE',
    'ARCHIVED',
  ],
  documents: ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'draft', 'active', 'expired', 'ARCHIVED'],
  policies: [
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'ACTIVE',
    'ARCHIVED',
    'REJECTED',
  ],
  risks: ['OPEN', 'PENDING_APPROVAL', 'CLOSED', 'ARCHIVED'],
  frameworks: ['PASS', 'FAIL'],
  personnel: [
    'ACTIVE',
    'SUSPENDED',
    'INVITED',
    'PENDING',
    'ACCESSED',
    'EXPIRED',
    'REVOKED',
    'COMPLETED',
    'DISABLED',
    'IN_PROGRESS',
    'AWAITING_REVIEW',
    'COMPLETE',
    'OVERDUE',
    'REJECTED',
  ],
  training: ['not_started', 'in_progress', 'submitted', 'passed', 'retry_wait'],
  audits: [
    'DRAFT',
    'SCHEDULED',
    'READINESS_CHECK',
    'IN_PROGRESS',
    'COMPLETING',
    'COMPLETED',
    'ARCHIVED',
    'PREP',
    'FIELDWORK',
    'NOT_STARTED',
    'READY_FOR_AUDIT',
    'APPROVED',
    'FLAGGED',
    'NOT_APPLICABLE',
    'OPEN',
    'IN_REVIEW',
    'SUBMITTED',
    'ACCEPTED',
    'CLOSED',
  ],
  accessReviews: [
    'DRAFT',
    'ACTIVE',
    'COMPLETED',
    'ARCHIVED',
    'PENDING',
    'APPROVED',
    'REVOKE_REQUESTED',
    'ESCALATED',
    'REVOKED',
  ],
  vendors: ['ACTIVE', 'ARCHIVED'],
  integrations: ['connected', 'not_connected', 'error'],
  aws: ['active', 'inactive', 'unverified', 'open', 'in_remediation', 'resolved', 'accepted_risk'],
  hr: ['active', 'on_leave', 'departed', 'pending', 'completed', 'not_required', 'failed'],
  devices: ['APPROVED', 'SUBMITTED', 'REJECTED', 'unchecked', 'checked_no_proof', 'checked_with_proof'],
};

const status = (
  key: string,
  label: string,
  tone: HelpTone,
  symbol: string,
  meaning: string,
  readiness: string,
  nextAction: string,
  options: Partial<Pick<HelpStatus, 'changedBy' | 'trigger' | 'automation' | 'editable' | 'ui'>> = {}
): HelpStatus => ({
  key,
  label,
  tone,
  symbol,
  meaning,
  changedBy: options.changedBy ?? 'A user action or backend workflow',
  trigger: options.trigger ?? 'The item is created, updated, reviewed, or recalculated',
  automation: options.automation ?? 'Manual or automatic',
  editable: options.editable ?? 'Depends on role and the action available on the page',
  ui: options.ui ?? `Shown as "${label}" in badges, filters, or summary cards`,
  readiness,
  nextAction,
});

const commonFaqs = [
  {
    question: 'Why does this status matter?',
    answer: 'Statuses drive what needs attention and, for compliance objects, whether linked controls and frameworks can be considered ready.',
  },
  {
    question: 'Can I change every status directly?',
    answer: 'No. Some statuses are computed by due dates, evidence review, workflow actions, or integration results. The page actions show what is allowed.',
  },
];

export const contextualHelpConfigs: Record<HelpModuleId, HelpConfig> = {
  controls: {
    module: 'Controls',
    shortDescription: 'Controls are the tenant-owned safeguards that prove requirements are covered.',
    overview:
      'A control gathers signals from linked tests, documents, policies, risks, manual assessment, and automation. A control is ready only when there is a real satisfied signal and no linked item is failing.',
    lifecycle: ['Not configured', 'Assessed', 'Pass or fail', 'Rolled into readiness'],
    lifecycleStyle: 'horizontal',
    statuses: [
      status('PASS', 'Pass', 'success', '✅', 'The control currently satisfies its readiness checks.', 'Counts as passing for linked requirements when linked items also pass.', 'Keep evidence, tests, and policies current.'),
      status('FAIL', 'Fail', 'error', '⚠️', 'The control has a failing linked item or lacks a satisfied signal.', 'Blocks linked requirement and framework readiness.', 'Review failing tests, documents, policies, risks, or manual assessment.'),
      status('WARNING', 'Warning', 'warning', '⚠️', 'Automation returned a warning that needs review.', 'Does not count as fully passing.', 'Review the warning and decide whether remediation or manual evidence is needed.'),
      status('NOT_APPLICABLE', 'N/A', 'muted', '🚫', 'The control or manual assessment is marked not applicable.', 'Does not pass by itself unless readiness settings allow an explicit satisfied signal elsewhere.', 'Confirm the control is truly out of scope and document why.'),
      status('NOT_CONFIGURED', 'Not configured', 'muted', '⏳', 'Automation has not been configured for this control.', 'Does not satisfy readiness by itself.', 'Configure automation or provide manual/evidence-based proof.'),
      status('MANUAL_PASS', 'Manual pass', 'success', '👤', 'A user marked the control manually satisfied.', 'Can provide the explicit satisfied signal required by readiness.', 'Keep implementation notes and evidence aligned.'),
      status('MANUAL_FAIL', 'Manual fail', 'error', '👤', 'A user marked the control manually failing.', 'Blocks readiness until changed or remediated.', 'Fix the gap, then update the manual assessment.'),
      status('MANUAL_NOT_APPLICABLE', 'Manual N/A', 'muted', '👤', 'A user marked the control manually out of scope.', 'Does not automatically pass readiness.', 'Document the scope reason.'),
      status('AUTOMATION_PASS', 'Automation pass', 'success', '🤖', 'An integration or automated check is passing.', 'Can contribute a satisfied signal when linked readiness is clean.', 'Keep integration healthy.'),
      status('AUTOMATION_FAIL', 'Automation fail', 'error', '🤖', 'An automated check failed.', 'Blocks readiness.', 'Fix the system issue and rerun/sync the check.'),
      status('AUTOMATION_WARNING', 'Automation warning', 'warning', '🤖', 'An automated check returned a warning.', 'Needs review before the control can be trusted as ready.', 'Review the warning and decide whether it is acceptable.'),
      status('AUTOMATION_NOT_CONFIGURED', 'Automation not configured', 'muted', '🤖', 'No automation is connected for this control.', 'Does not satisfy readiness.', 'Configure an integration or rely on manual/evidence proof.'),
    ],
    transitions: [
      { from: 'NOT_CONFIGURED', to: 'PASS', trigger: 'Approved evidence, passing workflow items, or manual PASS', type: 'Manual or automatic', allowedFor: 'Admins/managers for manual changes; system for rollups', impact: 'Can satisfy linked requirements.' },
      { from: 'PASS', to: 'FAIL', trigger: 'Linked evidence expires, tests fail, policies are unpublished, or risk opens', type: 'Automatic', allowedFor: 'System readiness recalculation', impact: 'Blocks requirement readiness.' },
      { from: 'FAIL', to: 'PASS', trigger: 'Remediation completes and linked items pass', type: 'Manual or automatic', allowedFor: 'Owners/admins/managers plus system recalculation', impact: 'Restores readiness contribution.' },
    ],
    readinessImpact: [
      'A requirement passes only when every mapped control passes.',
      'A control with no satisfied linked item does not pass just because nothing is failing.',
      'Linked policies, tests, evidence, and risks are evaluated before framework readiness rolls up.',
    ],
    nextActions: ['Open failing mapped items.', 'Approve valid evidence.', 'Publish and attest policies.', 'Close or archive mitigated risks.', 'Recalculate after remediation.'],
    faqs: commonFaqs,
  },
  tests: {
    module: 'Tests',
    shortDescription: 'Tests are compliance checks backed by automation or manual evidence.',
    overview:
      'Tests track whether a control check is healthy, due soon, overdue, failing, or intentionally excluded. Workflow states like snoozed and archived change how tests count toward readiness.',
    lifecycle: ['Active', 'Due soon', 'Overdue or needs remediation', 'Remediate', 'OK'],
    lifecycleStyle: 'loop',
    statuses: [
      status('ok', 'OK', 'success', '✅', 'The test is currently healthy.', 'Counts as satisfied while active.', 'Keep it monitored and renew evidence before it becomes due.'),
      status('due_soon', 'Due soon', 'warning', '⏳', 'The due date is approaching.', 'Counts as failing in readiness until renewed or resolved.', 'Upload or refresh evidence before the due date.'),
      status('overdue', 'Overdue', 'error', '⚠️', 'The test due date has passed.', 'Blocks readiness.', 'Renew the evidence or fix the underlying issue.'),
      status('needs_remediation', 'Needs remediation', 'error', '⚠️', 'An automated or seeded check requires correction.', 'Blocks readiness.', 'Review the issue, fix it, then rerun or update the check.'),
      status('na', 'N/A', 'muted', '🚫', 'The test health is not applicable.', 'Can satisfy only where app logic treats N/A as satisfied.', 'Confirm scope and keep the reason documented.'),
      status('ACTIVE', 'Active', 'info', '⏳', 'The test is enabled and participates in health/readiness rules.', 'Its health status is evaluated for readiness.', 'Keep the test current or remediate failing health.'),
      status('SNOOZED', 'Snoozed', 'muted', '⏳', 'The test is temporarily paused until a chosen date.', 'Excluded from readiness by default.', 'Unsnooze when the exception ends.'),
      status('INACTIVE', 'Inactive', 'muted', '🚫', 'The test is deactivated.', 'Excluded from readiness.', 'Reactivate if it should count again.'),
      status('NOT_APPLICABLE', 'Workflow N/A', 'muted', '🚫', 'The test workflow is marked not applicable.', 'Can be satisfied or excluded depending on organization settings.', 'Confirm the scoped reason is documented.'),
      status('ARCHIVED', 'Archived', 'success', '🔒', 'The test is deliberately retired.', 'Counts as satisfied by product readiness rules.', 'Unarchive only if the test must become active again.'),
    ],
    transitions: [
      { from: 'ACTIVE', to: 'SNOOZED', trigger: 'Snooze action with a date/reason', type: 'Manual', allowedFor: 'Authorized internal users', impact: 'Excludes test from readiness while snoozed.' },
      { from: 'ACTIVE', to: 'ARCHIVED', trigger: 'Archive action', type: 'Manual', allowedFor: 'Authorized internal users', impact: 'Treats the retired test as satisfied.' },
      { from: 'overdue', to: 'ok', trigger: 'Renewal or update clears due date issue', type: 'Manual or automatic', allowedFor: 'Owner/admin/manager or system recompute', impact: 'Restores readiness.' },
    ],
    readinessImpact: ['OK satisfies readiness.', 'Due soon, overdue, and needs remediation fail.', 'Snoozed/inactive/N/A are excluded unless organization settings change that behavior.', 'Archived tests satisfy readiness.'],
    nextActions: ['Fix failing checks.', 'Renew due evidence.', 'Use snooze only for temporary exceptions.', 'Archive retired tests deliberately.'],
    faqs: commonFaqs,
  },
  documents: {
    module: 'Documents',
    shortDescription: 'Documents store evidence used to prove controls are operating.',
    overview:
      'A document starts pending, becomes approved after review or submission, can be rejected for correction, and can expire based on validity dates.',
    lifecycle: ['Draft version', 'Submitted/active version', 'Pending review', 'Approved or rejected', 'Expired or renewed'],
    lifecycleStyle: 'vertical',
    statuses: [
      status('PENDING', 'Pending', 'warning', '⏳', 'The document exists but is not approved yet.', 'Fails readiness until approved.', 'Upload or submit the needed file, then request review.'),
      status('APPROVED', 'Approved', 'success', '✅', 'The document has been accepted and is not expired.', 'Satisfies linked controls.', 'Keep it current before valid-until date.'),
      status('REJECTED', 'Rejected', 'error', '⚠️', 'A reviewer rejected the document.', 'Fails readiness.', 'Read review notes, update the file, and resubmit.'),
      status('EXPIRED', 'Expired', 'error', '⚠️', 'The valid-until date has passed.', 'Fails readiness.', 'Create a new draft or upload renewed evidence.'),
      status('draft', 'Draft version', 'muted', '📝', 'A version is being prepared.', 'Does not satisfy readiness until submitted/approved.', 'Attach files and submit the draft.'),
      status('active', 'Active version', 'success', '✅', 'The submitted evidence version is active.', 'Updates document validity and approval state.', 'Monitor expiration and renew when needed.'),
      status('expired', 'Expired version', 'error', '⚠️', 'A document version is past its validity window.', 'Does not satisfy readiness.', 'Upload or activate a renewed version.'),
      status('ARCHIVED', 'Archived', 'muted', '🔒', 'The document is retained but removed from normal work.', 'May satisfy or exclude based on organization settings.', 'Unarchive if it should count again.'),
    ],
    transitions: [
      { from: 'draft', to: 'active', trigger: 'Submit version with at least one file', type: 'Manual', allowedFor: 'Document owner/admin/manager', impact: 'Sets document approved and updates validity.' },
      { from: 'PENDING', to: 'APPROVED', trigger: 'Reviewer approves evidence', type: 'Manual', allowedFor: 'Reviewer/admin/manager', impact: 'Can make linked controls pass.' },
      { from: 'APPROVED', to: 'EXPIRED', trigger: 'Validity date passes', type: 'Automatic', allowedFor: 'System/model hook', impact: 'Blocks readiness until renewed.' },
    ],
    readinessImpact: ['Only approved, non-expired evidence satisfies readiness.', 'Pending, rejected, and expired evidence fail.', 'Archived evidence follows organization readiness settings.'],
    nextActions: ['Submit drafts with files.', 'Respond to rejection notes.', 'Renew before expiration.', 'Archive only when intentionally retired.'],
    faqs: commonFaqs,
  },
  policies: {
    module: 'Policies',
    shortDescription: 'Policies define required behavior and often require employee acknowledgement.',
    overview:
      'Policy content is drafted, submitted for approval, approved, published as active, and then acknowledged by assigned personnel.',
    lifecycle: ['Draft', 'Pending approval', 'Approved', 'Active', 'Acknowledged', 'Archived'],
    lifecycleStyle: 'vertical',
    statuses: [
      status('DRAFT', 'Draft', 'muted', '📝', 'The policy or version is being edited.', 'Fails readiness until published active.', 'Finish content and submit for approval.'),
      status('PENDING_APPROVAL', 'Pending approval', 'warning', '⏳', 'A version is waiting for an approver.', 'Fails readiness until approved and published.', 'Approver should review and approve or reject.'),
      status('APPROVED', 'Approved', 'success', '✅', 'The version is approved but may still need publishing.', 'Does not fully satisfy readiness until policy is active and attestations are complete.', 'Publish to the target audience.'),
      status('ACTIVE', 'Active', 'success', '✅', 'The policy is published.', 'Satisfies readiness only when required acknowledgements are 100%.', 'Monitor acknowledgements and reminders.'),
      status('REJECTED', 'Rejected', 'error', '⚠️', 'The approver sent the version back to draft.', 'Fails readiness.', 'Address rejection notes and resubmit.'),
      status('ARCHIVED', 'Archived', 'muted', '🔒', 'The policy is retired.', 'Can auto-satisfy attestations depending on organization settings.', 'Unarchive only if it should become active again.'),
    ],
    transitions: [
      { from: 'DRAFT', to: 'PENDING_APPROVAL', trigger: 'Submit for approval', type: 'Manual', allowedFor: 'Policy owner/admin/manager', impact: 'Starts review workflow.' },
      { from: 'PENDING_APPROVAL', to: 'APPROVED', trigger: 'Approver approves', type: 'Manual', allowedFor: 'Assigned approver', impact: 'Allows publishing.' },
      { from: 'APPROVED', to: 'ACTIVE', trigger: 'Publish policy', type: 'Manual', allowedFor: 'Admin/manager', impact: 'Begins acknowledgement tracking.' },
      { from: 'ACTIVE', to: 'ARCHIVED', trigger: 'Archive policy', type: 'Manual', allowedFor: 'Admin/manager', impact: 'Retires policy and may auto-complete attestations.' },
    ],
    readinessImpact: ['Draft/unpublished policies fail readiness.', 'Active policies require 100% acknowledgement when attestation is required.', 'Archived policy readiness follows organization settings.'],
    nextActions: ['Submit drafts.', 'Approve/reject pending versions.', 'Publish approved versions.', 'Follow up on missing acknowledgements.'],
    faqs: commonFaqs,
  },
  risks: {
    module: 'Risks',
    shortDescription: 'Risks track threats and treatment decisions linked to controls.',
    overview:
      'Risks begin open, are assessed and treated, then close or archive when accepted or mitigated. Open risks linked to controls block readiness.',
    lifecycle: ['Open', 'Assess/treat', 'Closed', 'Archived', 'Reopen if needed'],
    lifecycleStyle: 'loop',
    statuses: [
      status('OPEN', 'Open', 'error', '⚠️', 'The risk is active and still needs treatment or approval.', 'Fails linked control readiness.', 'Review treatment, owners, and mitigating controls.'),
      status('PENDING_APPROVAL', 'Pending approval', 'warning', '⏳', 'The risk has assigned approvers and is awaiting final approval.', 'Fails linked control readiness until approved.', 'Assigned approver should approve after review.'),
      status('CLOSED', 'Closed', 'success', '✅', 'The risk has been resolved or accepted.', 'Satisfies linked control readiness.', 'Review periodically and reopen if conditions change.'),
      status('ARCHIVED', 'Archived', 'muted', '🔒', 'The risk is retained for history.', 'Satisfies readiness.', 'Unarchive/reopen only if it becomes relevant again.'),
    ],
    transitions: [
      { from: 'OPEN', to: 'PENDING_APPROVAL', trigger: 'Submit for approval', type: 'Manual', allowedFor: 'Authorized risk owners/admins/managers', impact: 'Keeps blocking linked controls while approvers review.' },
      { from: 'PENDING_APPROVAL', to: 'CLOSED', trigger: 'Assigned approver approves', type: 'Manual', allowedFor: 'Assigned approver/admin', impact: 'Stops blocking linked controls.' },
      { from: 'CLOSED', to: 'OPEN', trigger: 'Reopen risk', type: 'Manual', allowedFor: 'Authorized users', impact: 'Blocks readiness again.' },
      { from: 'OPEN', to: 'ARCHIVED', trigger: 'Archive risk', type: 'Manual', allowedFor: 'Authorized users', impact: 'Treats risk as satisfied in readiness.' },
    ],
    readinessImpact: ['Open risks fail linked controls.', 'Closed and archived risks satisfy linked controls.'],
    nextActions: ['Assign an owner.', 'Document treatment.', 'Map mitigating controls.', 'Close when accepted or mitigated.'],
    faqs: commonFaqs,
  },
  frameworks: {
    module: 'Frameworks',
    shortDescription: 'Frameworks organize requirements and readiness by compliance standard.',
    overview:
      'Framework readiness rolls up from requirements, categories, and mapped controls. Requirements pass only when all mapped controls pass.',
    lifecycle: ['Framework granted', 'Requirements mapped', 'Controls evaluated', 'Pass/fail rollup', 'Readiness score'],
    lifecycleStyle: 'horizontal',
    statuses: [
      status('PASS', 'Pass', 'success', '✅', 'A control, requirement, or category has all required children passing.', 'Counts toward framework readiness.', 'Maintain linked evidence and workflows.'),
      status('FAIL', 'Fail', 'error', '⚠️', 'At least one required child is missing, failing, or has no mapped passing control.', 'Reduces framework readiness.', 'Open failing controls and remediate mapped items.'),
    ],
    transitions: [
      { from: 'FAIL', to: 'PASS', trigger: 'All mapped controls pass', type: 'Automatic', allowedFor: 'Readiness service', impact: 'Improves requirement/category/framework score.' },
      { from: 'PASS', to: 'FAIL', trigger: 'A mapped control starts failing', type: 'Automatic', allowedFor: 'Readiness service', impact: 'Lowers framework readiness.' },
    ],
    readinessImpact: ['Framework readiness is passed requirements divided by total active requirements.', 'Categories pass only when all active requirements pass.', 'Requirements with no mapped passing controls fail.'],
    nextActions: ['Use failing item lists.', 'Fix linked controls.', 'Grant frameworks only when they should be visible to the org.'],
    faqs: commonFaqs,
  },
  personnel: {
    module: 'Personnel',
    shortDescription: 'Personnel tracks users, invitations, and employee compliance tasks.',
    overview:
      'People move through invitation and account states while assigned tasks move from pending through work, review, completion, or rejection.',
    lifecycle: ['Invited', 'Active', 'Task pending', 'In progress', 'Awaiting review', 'Complete or rejected'],
    lifecycleStyle: 'vertical',
    statuses: [
      status('ACTIVE', 'Active', 'success', '✅', 'The user can access the platform.', 'Can be assigned tasks and attest policies.', 'Keep role and group membership current.'),
      status('SUSPENDED', 'Suspended', 'error', '🚫', 'The user cannot access the platform.', 'May block assigned work from progressing.', 'Reactivate only when access should be restored.'),
      status('INVITED', 'Invited', 'info', '⏳', 'The user has been invited but has not completed access.', 'Tasks may wait until the user joins.', 'Resend or expire invite as needed.'),
      status('ACCESSED', 'Invite accessed', 'info', '⏳', 'The invite link was opened but the invitation has not been accepted.', 'User work may still be blocked.', 'Ask the user to finish accepting the invitation.'),
      status('EXPIRED', 'Invite expired', 'error', '⚠️', 'The invitation expired before completion.', 'The user cannot join from that invite.', 'Resend a fresh invite.'),
      status('REVOKED', 'Invite revoked', 'muted', '🚫', 'The invitation was intentionally cancelled.', 'No onboarding can continue from it.', 'Create a new invite only if access is still needed.'),
      status('COMPLETED', 'Invite completed', 'success', '✅', 'The invite flow completed.', 'The user can move into the active user lifecycle.', 'Assign role, groups, and tasks as needed.'),
      status('DISABLED', 'Invite disabled', 'muted', '🔒', 'The invite is disabled by policy or admin action.', 'No onboarding can continue from it.', 'Review whether the invite should remain blocked.'),
      status('PENDING', 'Pending', 'warning', '⏳', 'A personnel task has not started.', 'Incomplete personnel progress.', 'Start the assigned task.'),
      status('IN_PROGRESS', 'In progress', 'info', '👤', 'The user has begun work.', 'Still incomplete.', 'Finish the task or submit evidence.'),
      status('AWAITING_REVIEW', 'Awaiting review', 'warning', '⏳', 'A task submission needs admin review.', 'Not complete until approved.', 'Reviewer should approve or reject.'),
      status('COMPLETE', 'Complete', 'success', '✅', 'The task is done.', 'Counts toward personnel completion.', 'No action unless renewal is due later.'),
      status('OVERDUE', 'Overdue', 'error', '⚠️', 'The task is past due.', 'Blocks personnel progress.', 'Complete or reassign/remediate.'),
      status('REJECTED', 'Rejected', 'error', '⚠️', 'Submission was not accepted.', 'Blocks completion.', 'Review rejection reason and resubmit.'),
    ],
    transitions: [
      { from: 'PENDING', to: 'IN_PROGRESS', trigger: 'User starts task', type: 'Manual', allowedFor: 'Assigned user', impact: 'Shows work started.' },
      { from: 'IN_PROGRESS', to: 'AWAITING_REVIEW', trigger: 'User submits proof', type: 'Manual', allowedFor: 'Assigned user', impact: 'Waits for review.' },
      { from: 'AWAITING_REVIEW', to: 'COMPLETE', trigger: 'Reviewer approves', type: 'Manual', allowedFor: 'Admin/manager', impact: 'Completes task.' },
      { from: 'AWAITING_REVIEW', to: 'REJECTED', trigger: 'Reviewer rejects', type: 'Manual', allowedFor: 'Admin/manager', impact: 'Requires resubmission.' },
    ],
    readinessImpact: ['Personnel task completion feeds personnel progress and reports.', 'Policy acknowledgements can affect policy readiness.', 'Device and training tasks may generate evidence.'],
    nextActions: ['Complete assigned tasks.', 'Review pending submissions.', 'Resend invites for invited users.', 'Resolve overdue tasks.'],
    faqs: commonFaqs,
  },
  training: {
    module: 'Training',
    shortDescription: 'Training modules verify that personnel read content and pass quizzes.',
    overview:
      'Training progress is tracked through reading completion and quiz attempts. Passing creates completion evidence and marks related tasks complete.',
    lifecycle: ['Not started', 'In progress', 'Submitted', 'Passed or retry'],
    lifecycleStyle: 'loop',
    statuses: [
      status('not_started', 'Not started', 'muted', '📝', 'No quiz session has started.', 'Training task remains incomplete.', 'Open the module and begin reading.'),
      status('in_progress', 'In progress', 'info', '⏳', 'The user is reading or answering quiz questions.', 'Not complete yet.', 'Finish the module and submit the quiz.'),
      status('submitted', 'Submitted', 'warning', '⏳', 'The quiz was submitted and is being evaluated/stored.', 'Completion depends on pass result.', 'Review result and retry if needed.'),
      status('passed', 'Passed', 'success', '✅', 'The user met the passing score.', 'Completes training-related tasks.', 'Download certificate/evidence if needed.'),
      status('retry_wait', 'Retry wait', 'warning', '🔁', 'The user failed and may need to wait before retrying.', 'Training remains incomplete.', 'Review material and retry when allowed.'),
    ],
    transitions: [
      { from: 'not_started', to: 'in_progress', trigger: 'Start reading/quiz', type: 'Manual', allowedFor: 'Assigned user', impact: 'Begins tracking.' },
      { from: 'in_progress', to: 'submitted', trigger: 'Submit answers', type: 'Manual', allowedFor: 'Assigned user', impact: 'Calculates score.' },
      { from: 'submitted', to: 'passed', trigger: 'Passing score reached', type: 'Automatic', allowedFor: 'Training service', impact: 'Completes task.' },
    ],
    readinessImpact: ['Training affects personnel task completion and may create evidence, but framework readiness depends on the linked control workflows.'],
    nextActions: ['Read the module.', 'Pass the quiz.', 'Retry failed quizzes after any waiting period.'],
    faqs: commonFaqs,
  },
  audits: {
    module: 'Audits',
    shortDescription: 'Audits organize evidence review, auditor requests, findings, and final outcomes.',
    overview:
      'Audits move from planning into readiness checks, fieldwork, completion, and archive. Evidence and request statuses track the audit work inside that lifecycle.',
    lifecycle: ['Draft', 'Scheduled', 'Readiness check', 'In progress', 'Completing', 'Completed', 'Archived'],
    lifecycleStyle: 'vertical',
    statuses: [
      status('DRAFT', 'Draft', 'muted', '📝', 'Audit is being planned.', 'No audit readiness impact yet.', 'Define scope, dates, and framework.'),
      status('SCHEDULED', 'Scheduled', 'info', '⏳', 'Audit is planned on the calendar.', 'Prepares for readiness review.', 'Prepare scoped controls and evidence.'),
      status('READINESS_CHECK', 'Readiness check', 'warning', '⚠️', 'Team is checking audit readiness.', 'Highlights gaps before fieldwork.', 'Resolve readiness gaps.'),
      status('IN_PROGRESS', 'In progress', 'info', '🔒', 'Audit fieldwork has started and evidence snapshots can lock.', 'Audit evidence/reports drive audit progress.', 'Respond to requests and findings.'),
      status('COMPLETING', 'Completing', 'warning', '⏳', 'Audit is being finalized.', 'High/critical open findings can block completion.', 'Resolve blocking findings.'),
      status('COMPLETED', 'Completed', 'success', '✅', 'Audit is finished.', 'Counts in audit reporting.', 'Archive when retention workflow is done.'),
      status('ARCHIVED', 'Archived', 'muted', '🔒', 'Audit is retained for history.', 'No active work remains.', 'Use for reference.'),
      status('PREP', 'Prep', 'muted', '📝', 'Legacy audit preparation status.', 'Treated as pre-fieldwork audit planning.', 'Move the audit into the current workflow when possible.'),
      status('FIELDWORK', 'Fieldwork', 'info', '⏳', 'Legacy audit fieldwork status.', 'Equivalent to active audit evidence review.', 'Respond to evidence requests and findings.'),
      status('NOT_STARTED', 'Evidence not started', 'muted', '📝', 'Audit evidence has not been prepared.', 'Does not improve audit evidence readiness.', 'Prepare or snapshot evidence.'),
      status('READY_FOR_AUDIT', 'Ready for audit', 'info', '⏳', 'Evidence is ready for auditor review.', 'Moves audit evidence toward completion but still needs auditor decision.', 'Wait for auditor review or answer questions.'),
      status('APPROVED', 'Evidence approved', 'success', '✅', 'Auditor approved the audit evidence.', 'Improves audit evidence readiness.', 'No action unless it is later flagged.'),
      status('FLAGGED', 'Flagged evidence', 'error', '⚠️', 'Auditor marked evidence as an issue.', 'Reduces audit evidence readiness.', 'Fix and resubmit evidence.'),
      status('NOT_APPLICABLE', 'Evidence N/A', 'muted', '🚫', 'Audit evidence is not applicable for this audit scope.', 'Can count as resolved for audit evidence review.', 'Keep the scope reason clear.'),
      status('OPEN', 'Open request/finding', 'warning', '⏳', 'A request or finding needs action.', 'Open high/critical findings block completion.', 'Respond or remediate.'),
      status('IN_REVIEW', 'Request in review', 'info', '⏳', 'An audit request is being reviewed.', 'Still open until accepted/completed/closed.', 'Monitor reviewer feedback.'),
      status('SUBMITTED', 'Request submitted', 'warning', '⏳', 'A response has been submitted to an audit request.', 'Awaiting auditor or admin decision.', 'Wait for acceptance or respond to feedback.'),
      status('ACCEPTED', 'Request accepted', 'success', '✅', 'The request response was accepted.', 'Moves the request toward completion.', 'Complete or close the request if no further work remains.'),
      status('CLOSED', 'Request closed', 'muted', '🔒', 'The request is closed.', 'No active request work remains.', 'Reopen/create a new request only if more evidence is needed.'),
    ],
    transitions: [
      { from: 'DRAFT', to: 'SCHEDULED', trigger: 'Schedule audit', type: 'Manual', allowedFor: 'Admin/manager', impact: 'Starts planning timeline.' },
      { from: 'SCHEDULED', to: 'IN_PROGRESS', trigger: 'Start fieldwork', type: 'Manual', allowedFor: 'Admin/manager/auditor flow', impact: 'Locks audit evidence snapshots.' },
      { from: 'IN_PROGRESS', to: 'COMPLETING', trigger: 'Complete audit action', type: 'Manual', allowedFor: 'Admin/manager/auditor flow', impact: 'Checks high/critical open findings.' },
      { from: 'COMPLETED', to: 'ARCHIVED', trigger: 'Archive audit', type: 'Manual', allowedFor: 'Authorized users', impact: 'Retains historical record.' },
    ],
    readinessImpact: ['Audit readiness combines evidence review, request completion, and findings.', 'High/critical open findings block audit completion.', 'Framework readiness is separate but informs audit readiness.'],
    nextActions: ['Prepare evidence.', 'Answer requests.', 'Resolve flagged evidence.', 'Close high/critical findings before completing.'],
    faqs: commonFaqs,
  },
  accessReviews: {
    module: 'Access Reviews',
    shortDescription: 'Access reviews verify whether people should keep or lose access.',
    overview:
      'Campaigns start as drafts, activate into reviewer tasks, complete when all tasks are decided, and archive after the campaign is done.',
    lifecycle: ['Draft', 'Active', 'Tasks decided', 'Completed', 'Archived'],
    lifecycleStyle: 'horizontal',
    statuses: [
      status('DRAFT', 'Draft', 'muted', '📝', 'Campaign is being prepared.', 'No review progress yet.', 'Configure review scope and activate.'),
      status('ACTIVE', 'Active', 'info', '⏳', 'Review tasks are assigned.', 'Progress depends on non-pending task decisions.', 'Review access and decide each task.'),
      status('COMPLETED', 'Completed', 'success', '✅', 'All tasks have been decided.', 'Campaign progress is complete.', 'Archive when ready.'),
      status('ARCHIVED', 'Archived', 'muted', '🔒', 'Campaign is retained for history.', 'No active review work.', 'Use for audit trail.'),
      status('PENDING', 'Pending task', 'warning', '⏳', 'Reviewer has not decided yet.', 'Keeps campaign incomplete.', 'Approve, request revoke, or escalate.'),
      status('APPROVED', 'Approved task', 'success', '✅', 'Reviewer approved the access as appropriate.', 'Counts the review task as decided.', 'No action unless access changes later.'),
      status('REVOKE_REQUESTED', 'Revoke requested', 'warning', '⚠️', 'Reviewer requested access removal.', 'Counts as decided but needs confirmation.', 'Admin confirms revocation.'),
      status('ESCALATED', 'Escalated', 'error', '⚠️', 'Reviewer escalated decision.', 'Counts as decided but needs admin action.', 'Admin reviews and resolves.'),
      status('REVOKED', 'Revoked', 'success', '✅', 'Access removal was confirmed.', 'Task is complete.', 'No further action.'),
    ],
    transitions: [
      { from: 'DRAFT', to: 'ACTIVE', trigger: 'Activate campaign', type: 'Manual', allowedFor: 'Admin/manager', impact: 'Creates reviewer tasks.' },
      { from: 'PENDING', to: 'APPROVED', trigger: 'Reviewer approves access', type: 'Manual', allowedFor: 'Reviewer/admin', impact: 'Completes task.' },
      { from: 'REVOKE_REQUESTED', to: 'REVOKED', trigger: 'Admin confirms revocation', type: 'Manual', allowedFor: 'Admin', impact: 'Completes revocation task.' },
      { from: 'ACTIVE', to: 'COMPLETED', trigger: 'All tasks leave PENDING', type: 'Automatic', allowedFor: 'Access review service', impact: 'Campaign can be archived.' },
    ],
    readinessImpact: ['Access review progress is campaign-specific and reportable; it does not directly change framework readiness unless linked evidence or controls are updated elsewhere.'],
    nextActions: ['Activate draft campaigns.', 'Decide pending tasks.', 'Confirm revocations.', 'Archive completed campaigns.'],
    faqs: commonFaqs,
  },
  vendors: {
    module: 'Vendors',
    shortDescription: 'Vendors track third-party services, risk, contracts, and review status.',
    overview:
      'Vendors are active while in use and archived when no longer part of the active vendor program.',
    lifecycle: ['Active', 'Reviewed/assessed', 'Archived'],
    lifecycleStyle: 'horizontal',
    statuses: [
      status('ACTIVE', 'Active', 'success', '✅', 'The vendor is in use or under management.', 'Contributes to vendor program monitoring and reports.', 'Maintain assessment, contacts, data types, and contract dates.'),
      status('ARCHIVED', 'Archived', 'muted', '🔒', 'The vendor is retained for history but not active.', 'Removed from active vendor work.', 'Unarchive only if the vendor becomes active again.'),
    ],
    transitions: [
      { from: 'ACTIVE', to: 'ARCHIVED', trigger: 'Archive vendor/status update', type: 'Manual', allowedFor: 'Admin/manager', impact: 'Removes vendor from active review focus.' },
      { from: 'ARCHIVED', to: 'ACTIVE', trigger: 'Reactivate/status update', type: 'Manual', allowedFor: 'Admin/manager', impact: 'Returns vendor to active monitoring.' },
    ],
    readinessImpact: ['Vendor status does not directly drive framework readiness unless linked controls/evidence are updated.', 'Vendor risk and assessments support vendor management reporting.'],
    nextActions: ['Complete vendor assessment.', 'Track contract dates.', 'Archive inactive vendors.'],
    faqs: commonFaqs,
  },
  integrations: {
    module: 'Integrations',
    shortDescription: 'Integrations connect external systems that can create evidence or automation signals.',
    overview:
      'Connections can be not connected, connected, or in error. Integration findings and companion evidence can support controls.',
    lifecycle: ['Not connected', 'Connected', 'Error', 'Reconnect'],
    lifecycleStyle: 'loop',
    statuses: [
      status('not_connected', 'Not connected', 'muted', '🚫', 'No active connection exists.', 'No automation evidence is collected.', 'Connect the integration if needed.'),
      status('connected', 'Connected', 'success', '✅', 'The integration is configured.', 'Can support automation or companion evidence.', 'Monitor syncs and findings.'),
      status('error', 'Error', 'error', '⚠️', 'The integration needs attention.', 'May stop evidence updates or automation signals.', 'Reconnect or fix credentials/settings.'),
    ],
    transitions: [
      { from: 'not_connected', to: 'connected', trigger: 'Create/update connection', type: 'Manual', allowedFor: 'Admin/manager', impact: 'Enables integration data.' },
      { from: 'connected', to: 'error', trigger: 'Sync/auth failure', type: 'Automatic', allowedFor: 'Integration service', impact: 'Needs attention.' },
      { from: 'error', to: 'connected', trigger: 'Reconnect/fix settings', type: 'Manual', allowedFor: 'Admin/manager', impact: 'Restores integration data.' },
    ],
    readinessImpact: ['Integrations affect readiness indirectly through tests, evidence, and controls they update.'],
    nextActions: ['Connect required systems.', 'Fix error states.', 'Link generated evidence to controls.'],
    faqs: commonFaqs,
  },
  aws: {
    module: 'AWS Integration',
    shortDescription: 'AWS tracks cloud accounts and security findings.',
    overview:
      'AWS accounts indicate connection scope while findings move from open through remediation to resolved or accepted risk.',
    lifecycle: ['Account active', 'Finding open', 'In remediation', 'Resolved or accepted risk'],
    lifecycleStyle: 'loop',
    statuses: [
      status('active', 'Active account', 'success', '✅', 'The AWS account is active.', 'Can produce companion evidence and findings.', 'Monitor findings and linked controls.'),
      status('inactive', 'Inactive account', 'muted', '🚫', 'The AWS account is not active.', 'No active monitoring expected.', 'Reactivate if still in scope.'),
      status('unverified', 'Unverified account', 'warning', '⏳', 'The AWS account needs verification.', 'Automation may be incomplete.', 'Verify account configuration.'),
      status('open', 'Open finding', 'error', '⚠️', 'A finding needs remediation or acceptance.', 'May affect linked evidence/control confidence.', 'Assign remediation.'),
      status('in_remediation', 'In remediation', 'warning', '🔁', 'Work is underway to fix the finding.', 'Still needs follow-up.', 'Track remediation notes and resolve when fixed.'),
      status('resolved', 'Resolved', 'success', '✅', 'The finding has been fixed.', 'No further action unless reopened.', 'Keep evidence if needed.'),
      status('accepted_risk', 'Accepted risk', 'muted', '👤', 'The team accepted the risk.', 'Documents risk acceptance rather than remediation.', 'Review acceptance periodically.'),
    ],
    transitions: [
      { from: 'open', to: 'in_remediation', trigger: 'Status update', type: 'Manual', allowedFor: 'Admin/manager', impact: 'Shows work started.' },
      { from: 'in_remediation', to: 'resolved', trigger: 'Mark resolved', type: 'Manual', allowedFor: 'Admin/manager', impact: 'Closes finding and sets resolved date.' },
      { from: 'open', to: 'accepted_risk', trigger: 'Accept risk', type: 'Manual', allowedFor: 'Admin/manager', impact: 'Documents exception.' },
    ],
    readinessImpact: ['AWS findings do not directly roll up unless linked evidence/tests/controls use them as signals.', 'Companion evidence can support controls.'],
    nextActions: ['Verify accounts.', 'Remediate open findings.', 'Resolve or accept risks with notes.'],
    faqs: commonFaqs,
  },
  hr: {
    module: 'HR Integration',
    shortDescription: 'HR profiles connect personnel data to compliance tasks and policies.',
    overview:
      'HR profiles track employment state and background check state so personnel compliance work stays aligned with the workforce.',
    lifecycle: ['Active', 'On leave', 'Departed'],
    lifecycleStyle: 'horizontal',
    statuses: [
      status('active', 'Active', 'success', '✅', 'The employee is active.', 'Can be assigned policies and personnel tasks.', 'Keep profile and linked user current.'),
      status('on_leave', 'On leave', 'warning', '⏳', 'The employee is temporarily away.', 'Tasks may need review or deferral.', 'Confirm task expectations.'),
      status('departed', 'Departed', 'muted', '🚫', 'The employee has left.', 'Should not receive new active personnel work.', 'Complete offboarding and access review.'),
      status('pending', 'Background pending', 'warning', '⏳', 'Background check is not complete.', 'Personnel task may remain incomplete.', 'Finish or verify the check.'),
      status('completed', 'Background complete', 'success', '✅', 'Background check is complete.', 'Can satisfy related personnel tasks.', 'No action unless renewal is needed.'),
      status('not_required', 'Not required', 'muted', '🚫', 'Background check is not required.', 'Does not block if correctly scoped.', 'Document why not required.'),
      status('failed', 'Failed', 'error', '⚠️', 'Background check failed.', 'Requires review before personnel compliance can be considered complete.', 'Escalate to HR/admin.'),
    ],
    transitions: [
      { from: 'active', to: 'on_leave', trigger: 'Profile update/import', type: 'Manual or automatic', allowedFor: 'Admin/manager or HR import', impact: 'May change task handling.' },
      { from: 'active', to: 'departed', trigger: 'Profile update/import', type: 'Manual or automatic', allowedFor: 'Admin/manager or HR import', impact: 'Triggers offboarding review.' },
      { from: 'pending', to: 'completed', trigger: 'Background result update', type: 'Manual or automatic', allowedFor: 'Admin/manager or HR import', impact: 'Completes background check signal.' },
    ],
    readinessImpact: ['HR states affect personnel task accuracy and policy targeting, not framework readiness directly unless tasks/evidence update linked controls.'],
    nextActions: ['Sync or update profiles.', 'Resolve pending background checks.', 'Complete offboarding for departed personnel.'],
    faqs: commonFaqs,
  },
  devices: {
    module: 'Devices',
    shortDescription: 'Devices track endpoint ownership and device security proof.',
    overview:
      'Device settings are submitted by users and reviewed by admins. Checklist items show whether proof exists for each setting.',
    lifecycle: ['Unchecked', 'Checked without proof', 'Checked with proof', 'Submitted', 'Approved or rejected'],
    lifecycleStyle: 'vertical',
    statuses: [
      status('unchecked', 'Unchecked', 'muted', '📝', 'The checklist item has not been marked complete.', 'Device task remains incomplete.', 'Check the setting if it is complete.'),
      status('checked_no_proof', 'Checked, no proof', 'warning', '⏳', 'The user marked it complete without proof.', 'May still need review.', 'Attach proof if required.'),
      status('checked_with_proof', 'Checked with proof', 'success', '✅', 'The item includes proof.', 'Supports approval.', 'Submit for review.'),
      status('SUBMITTED', 'Submitted', 'warning', '⏳', 'Device evidence is waiting for review.', 'Personnel task may wait for approval.', 'Admin reviews proof.'),
      status('APPROVED', 'Approved', 'success', '✅', 'Device evidence was approved.', 'Can complete the device task.', 'No action unless settings change.'),
      status('REJECTED', 'Rejected', 'error', '⚠️', 'Device evidence was rejected.', 'Task remains incomplete.', 'Fix settings or upload better proof.'),
    ],
    transitions: [
      { from: 'unchecked', to: 'checked_with_proof', trigger: 'User checks item and uploads file', type: 'Manual', allowedFor: 'Assigned user', impact: 'Strengthens review submission.' },
      { from: 'SUBMITTED', to: 'APPROVED', trigger: 'Admin approves', type: 'Manual', allowedFor: 'Admin/manager', impact: 'Completes device evidence.' },
      { from: 'SUBMITTED', to: 'REJECTED', trigger: 'Admin rejects', type: 'Manual', allowedFor: 'Admin/manager', impact: 'Requires resubmission.' },
    ],
    readinessImpact: ['Device review primarily affects personnel tasks and can support evidence linked to controls.'],
    nextActions: ['Complete checklist.', 'Attach proof.', 'Submit for review.', 'Respond to rejection notes.'],
    faqs: commonFaqs,
  },
};

export function getHelpConfig(moduleId: HelpModuleId) {
  return contextualHelpConfigs[moduleId];
}

export function findHelpStatus(config: HelpConfig, currentStatus?: string | null) {
  if (!currentStatus) return null;
  const normalized = String(currentStatus);
  return config.statuses.find((item) => item.key === normalized || item.label.toLowerCase() === normalized.toLowerCase()) ?? null;
}
