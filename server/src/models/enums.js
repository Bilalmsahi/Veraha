/**
 * Shared Enum Constants for Mongoose Schemas
 * Compliance Automation Platform V2
 */

// =============================================================================
// USER DOMAIN
// =============================================================================

export const ROLE = ['ADMIN', 'MANAGER', 'EMPLOYEE', 'AUDITOR'];

export const USER_STATUS = ['ACTIVE', 'SUSPENDED', 'INVITED'];

export const INVITATION_STATUS = [
  'PENDING',
  'ACCESSED',
  'ACTIVE',
  'EXPIRED',
  'REVOKED',
  'COMPLETED',
  'DISABLED',
];

// =============================================================================
// ORGANIZATION DOMAIN
// =============================================================================

export const SUBSCRIPTION_TIER = ['FREE', 'STARTUP', 'ENTERPRISE'];

// =============================================================================
// CONTROL DOMAIN
// =============================================================================

export const MANUAL_STATUS = ['PASS', 'FAIL', 'NOT_APPLICABLE'];

export const AUTOMATION_STATUS = ['PASS', 'FAIL', 'WARNING', 'NOT_CONFIGURED'];

export const FREQUENCY = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY'];

export const COVERAGE = ['FULL', 'PARTIAL', 'GAP'];

/**
 * Control list filter: template-sourced vs custom.
 * TEMPLATE value is the product name "VERAHA" (stored in query param `source`).
 */
export const CONTROL_SOURCE = {
  CUSTOM: 'CUSTOM',
  TEMPLATE: 'VERAHA',
};

// =============================================================================
// EVIDENCE DOMAIN
// =============================================================================

export const EVIDENCE_STATUS = ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'];

/** Version lifecycle for Vanta-style document evidence */
export const EVIDENCE_VERSION_STATUS = ['draft', 'active', 'expired'];

// =============================================================================
// RISK DOMAIN
// =============================================================================

export const TREATMENT = ['MITIGATE', 'ACCEPT', 'TRANSFER', 'AVOID'];

export const RISK_STATUS = ['OPEN', 'PENDING_APPROVAL', 'CLOSED', 'ARCHIVED'];

export const RISK_TIER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNSCORED'];

// =============================================================================
// POLICY DOMAIN
// =============================================================================

/**
 * Policy publish state.
 *
 * Do not use this for the approval/version pipeline. Policy.workflowStatus owns
 * DRAFT/PENDING_APPROVAL/APPROVED for the latest version workflow.
 */
export const POLICY_STATUS = ['DRAFT', 'ACTIVE', 'ARCHIVED'];

export const POLICY_WORKFLOW_STATUS = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'];

/**
 * PolicyVersion workflow (parallel to PolicyVersion.status for backward compatibility).
 * Adds REJECTED and tracks version-level submission/approval.
 */
export const POLICY_VERSION_STATUS = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'ACTIVE',
  'ARCHIVED',
];

export const POLICY_VERSION_CONTENT_TYPE = ['EDITOR_HTML', 'UPLOADED_FILE'];

// =============================================================================
// GROUP / ACCESS REQUEST DOMAIN
// =============================================================================

export const GROUP_TYPE = [
  'ALL_PERSONNEL',
  'BOARD_MEMBERS',
  'ISMS_BODY',
  'GENERAL_STAFF',
  'ENGINEERING_TEAM',
  'HR_TEAM',
  'CUSTOM',
];

export const ACCESS_REQUEST_STATUS = ['PENDING', 'APPROVED', 'REJECTED', 'REVOKED'];

// Review frequency for policies (Vanta-aligned: Annually, Every 2 years, Bi-annually, Quarterly, Monthly, Weekly, Never)
export const REVIEW_FREQUENCY = [
  'MONTHLY',
  'QUARTERLY',
  'SEMI_ANNUALLY',
  'ANNUALLY',
  'BIENNIALLY', // Every 2 years
  'WEEKLY',
  'NEVER',
];

// =============================================================================
// VENDOR DOMAIN (Vanta-style: ACTIVE | ARCHIVED; data tags are free-text)
// =============================================================================

export const VENDOR_STATUS = ['ACTIVE', 'ARCHIVED'];

// =============================================================================
// AUDIT DOMAIN
// =============================================================================

export const AUDIT_STATUS = [
  'DRAFT',
  'SCHEDULED',
  'READINESS_CHECK',
  'IN_PROGRESS',
  'COMPLETING',
  'COMPLETED',
  'ARCHIVED',
  // Legacy values retained while older records are migrated.
  'PREP',
  'FIELDWORK',
];

export const AUDIT_ASSIGNMENT_STATUS = ['ACTIVE', 'REVOKED', 'EXPIRED'];

export const AUDIT_EVIDENCE_REVIEW_STATUS = [
  'NOT_STARTED',
  'READY_FOR_AUDIT',
  'APPROVED',
  'FLAGGED',
  'NOT_APPLICABLE',
];

export const AUDIT_EVIDENCE_REQUEST_STATUS = [
  'OPEN',
  'IN_REVIEW',
  'SUBMITTED',
  'ACCEPTED',
  'COMPLETED',
  'CLOSED',
];

export const ACCESS_REVIEW_CAMPAIGN_STATUS = ['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED'];

export const ACCESS_REVIEW_TASK_STATUS = ['PENDING', 'APPROVED', 'REVOKE_REQUESTED', 'ESCALATED', 'REVOKED'];

export const ACCESS_REVIEW_DECISION = ['APPROVE', 'REVOKE', 'ESCALATE'];

// =============================================================================
// ACTIVITY LOG DOMAIN
// =============================================================================

export const ACTION = ['CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'APPROVAL_CANCELLED', 'EVIDENCE_LOCKED', 'REMINDER_SENT'];

// =============================================================================
// AUTOMATION FINDING DOMAIN
// =============================================================================

export const FINDING_STATUS = ['PASS', 'FAIL', 'WARNING'];

// =============================================================================
// TEST DOMAIN (compliance checks — automated and/or manual evidence)
// =============================================================================

/** How the test is primarily satisfied (automation may still use manual fallback) */
export const TEST_TYPE = ['document', 'automated'];

/** UI / reporting grouping */
export const TEST_CATEGORY = [
  'Engineering',
  'Human resources',
  'Policy',
  'Risks',
  'Legal',
  'Finance',
  'Management',
  'Other',
];

/** Renewal cadence for document-style tests */
export const TEST_RENEWAL_PERIOD = ['annually', 'quarterly', 'monthly', 'once'];

/**
 * Rollout: whether the test counts toward compliance posture.
 * monitor_only = track but do not fail score (Vanta-style).
 */
export const TEST_ROLLOUT = ['enabled', 'disabled', 'monitor_only'];

/**
 * Computed health for list/detail (not user-editable).
 * needs_remediation reserved for automation failures / future rules.
 */
export const TEST_STATUS = ['ok', 'overdue', 'due_soon', 'needs_remediation', 'na'];

export const TEST_WORKFLOW_STATE = [
  'ACTIVE',
  'SNOOZED',
  'INACTIVE',
  'NOT_APPLICABLE',
  'ARCHIVED',
];

export const READINESS_CONTRIBUTION = ['SATISFIED', 'FAILING', 'EXCLUDED'];

/** Last automation run outcome (when integrations exist) */
export const TEST_AUTOMATION_RESULT = ['PASS', 'FAIL', 'WARNING', 'NOT_CONFIGURED', 'PENDING'];

export const POLICY_ATTESTATION_SOURCE = ['USER', 'SYSTEM_ARCHIVE'];

// =============================================================================
// PERSONNEL TASK DOMAIN
// =============================================================================

export const PERSONNEL_TASK_TYPE = [
  'DEVICE_SETTINGS',
  'POLICY_ACK',
  'BACKGROUND_CHECK',
  'TRAINING',
];

export const PERSONNEL_TASK_LIFECYCLE = ['ONBOARDING', 'RECURRING', 'OFFBOARDING'];

export const PERSONNEL_TASK_RECURRENCE_MODE = ['NONE', 'FIXED_ANNUAL', 'ROLLING'];

export const PERSONNEL_TASK_ASSIGNEE = ['EMPLOYEE', 'ADMIN'];

export const PERSONNEL_TASK_STATUS = [
  'PENDING',
  'IN_PROGRESS',
  'AWAITING_REVIEW',
  'COMPLETE',
  'OVERDUE',
  'REJECTED',
];

export const DEVICE_EVIDENCE_REVIEW_STATUS = [
  'APPROVED',
  'SUBMITTED',
  'REJECTED',
];

export const OFFBOARDING_TYPE = ['PERMANENT', 'TEMPORARY'];

export const OFFBOARDING_STATUS = ['OPEN', 'COMPLETED', 'CANCELLED'];
