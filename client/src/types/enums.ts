/**
 * Enum types - mirrors server models/enums.js
 */

// USER DOMAIN
export type Role = 'ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'AUDITOR';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'INVITED';

// ORGANIZATION DOMAIN
export type SubscriptionTier = 'FREE' | 'STARTUP' | 'ENTERPRISE';

// CONTROL DOMAIN
export type ManualStatus = 'PASS' | 'FAIL' | 'NOT_APPLICABLE';
export type AutomationStatus = 'PASS' | 'FAIL' | 'WARNING' | 'NOT_CONFIGURED';
export type OverallStatus =
  | 'PASS'
  | 'FAIL'
  | 'WARNING'
  | 'NOT_APPLICABLE'
  | 'NOT_CONFIGURED';
export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
export type Coverage = 'FULL' | 'PARTIAL' | 'GAP';

// EVIDENCE DOMAIN
export type EvidenceStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

// RISK DOMAIN
export type Treatment = 'MITIGATE' | 'ACCEPT' | 'TRANSFER' | 'AVOID';
export type RiskStatus = 'OPEN' | 'PENDING_APPROVAL' | 'CLOSED' | 'ARCHIVED';
export type RiskTier = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNSCORED';

// POLICY DOMAIN
export type PolicyStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'ARCHIVED';
export type PolicyWorkflowStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED';
export type PolicyVersionStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'ACTIVE'
  | 'ARCHIVED';
export type ReviewFrequency =
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'SEMI_ANNUALLY'
  | 'ANNUALLY'
  | 'BIENNIALLY'
  | 'WEEKLY'
  | 'NEVER';

// GROUP / ACCESS REQUEST DOMAIN
export type GroupType =
  | 'ALL_PERSONNEL'
  | 'BOARD_MEMBERS'
  | 'ISMS_BODY'
  | 'GENERAL_STAFF'
  | 'ENGINEERING_TEAM'
  | 'HR_TEAM'
  | 'CUSTOM';

export type AccessRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED';

// VENDOR DOMAIN
export type VendorStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'UNDER_REVIEW'
  | 'TERMINATED';
export type DataType =
  | 'PII'
  | 'PHI'
  | 'FINANCIAL'
  | 'CONFIDENTIAL'
  | 'PUBLIC';

// AUDIT DOMAIN
export type AuditStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'READINESS_CHECK'
  | 'IN_PROGRESS'
  | 'COMPLETING'
  | 'COMPLETED'
  | 'ARCHIVED'
  | 'PREP'
  | 'FIELDWORK';

// ACTIVITY LOG DOMAIN
export type Action = 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';

// AUTOMATION FINDING DOMAIN
export type FindingStatus = 'PASS' | 'FAIL' | 'WARNING';

// TEST DOMAIN
export type TestStatus =
  | 'ok'
  | 'overdue'
  | 'due_soon'
  | 'needs_remediation'
  | 'na';
export type ReadinessContribution = 'SATISFIED' | 'FAILING' | 'EXCLUDED';
export type TestWorkflowState =
  | 'ACTIVE'
  | 'SNOOZED'
  | 'INACTIVE'
  | 'NOT_APPLICABLE'
  /**
   * Product extension - no direct Vanta equivalent.
   * Closest Vanta analog is DEACTIVATED. Archived tests contribute
   * SATISFIED to readiness, unlike DEACTIVATED which contributes EXCLUDED.
   * This distinction is intentional: archive = deliberate closure,
   * deactivate = temporary suppression.
   */
  | 'ARCHIVED';
export type TestType = 'document' | 'automated';
export type TestCategory =
  | 'Engineering'
  | 'Human resources'
  | 'Policy'
  | 'Risks'
  | 'Legal'
  | 'Finance'
  | 'Management'
  | 'Other';
export type TestRollout = 'enabled' | 'disabled' | 'monitor_only';
export type TestRenewalPeriod = 'annually' | 'quarterly' | 'monthly' | 'once';
