/**
 * Label maps and color maps for enums - used for badges, selects, etc.
 */

import type {
  Role,
  UserStatus,
  ManualStatus,
  AutomationStatus,
  OverallStatus,
  EvidenceStatus,
  RiskTier,
  RiskStatus,
  PolicyStatus,
  VendorStatus,
  AuditStatus,
  Action,
} from '@/types/enums';

export type SemanticSoftTone = 'success' | 'error' | 'warning' | 'info' | 'muted';

// Shadcn badge variants: default | secondary | destructive | outline
export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
  AUDITOR: 'Auditor',
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  INVITED: 'Invited',
};

export const USER_STATUS_COLORS: Record<
  UserStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  ACTIVE: 'default',
  SUSPENDED: 'destructive',
  INVITED: 'secondary',
};

export const EXTENDED_USER_STATUS_LABELS: Record<string, string> = {
  ...USER_STATUS_LABELS,
  DISABLED: 'Disabled',
  REVOKED: 'Revoked',
};

export const EXTENDED_USER_STATUS_SOFT: Record<string, SemanticSoftTone> = {
  ACTIVE: 'success',
  INVITED: 'info',
  SUSPENDED: 'error',
  DISABLED: 'error',
  REVOKED: 'muted',
};

export const ROLE_COLORS: Record<Role, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ADMIN: 'default',
  MANAGER: 'secondary',
  EMPLOYEE: 'outline',
  AUDITOR: 'secondary',
};

export const ROLE_SOFT_TONE: Record<Role, SemanticSoftTone> = {
  ADMIN: 'info',
  MANAGER: 'info',
  EMPLOYEE: 'muted',
  AUDITOR: 'warning',
};

export const INVITATION_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  ACCESSED: 'Accessed',
  COMPLETED: 'Completed',
  EXPIRED: 'Expired',
  REVOKED: 'Revoked',
};

export const INVITATION_STATUS_SOFT: Record<string, SemanticSoftTone> = {
  PENDING: 'info',
  ACCESSED: 'warning',
  COMPLETED: 'success',
  EXPIRED: 'error',
  REVOKED: 'muted',
};

export const FINDING_SEVERITY_LABELS: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export const FINDING_SEVERITY_SOFT: Record<string, SemanticSoftTone> = {
  LOW: 'muted',
  MEDIUM: 'warning',
  HIGH: 'warning',
  CRITICAL: 'error',
};

export const RISK_LEVEL_SOFT: Record<string, SemanticSoftTone> = {
  Low: 'success',
  Medium: 'warning',
  High: 'error',
};

export const MANUAL_STATUS_LABELS: Record<ManualStatus, string> = {
  PASS: 'Pass',
  FAIL: 'Fail',
  NOT_APPLICABLE: 'N/A',
};

export const AUTOMATION_STATUS_LABELS: Record<AutomationStatus, string> = {
  PASS: 'Pass',
  FAIL: 'Fail',
  WARNING: 'Warning',
  NOT_CONFIGURED: 'Not configured',
};

export const OVERALL_STATUS_LABELS: Record<OverallStatus, string> = {
  PASS: 'Pass',
  FAIL: 'Fail',
  WARNING: 'Warning',
  NOT_APPLICABLE: 'N/A',
  NOT_CONFIGURED: 'Not configured',
};

export const OVERALL_STATUS_COLORS: Record<
  OverallStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  PASS: 'default',
  FAIL: 'destructive',
  WARNING: 'secondary',
  NOT_APPLICABLE: 'outline',
  NOT_CONFIGURED: 'outline',
};

export const EVIDENCE_STATUS_LABELS: Record<EvidenceStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
};

export const EVIDENCE_STATUS_COLORS: Record<
  EvidenceStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  PENDING: 'secondary',
  APPROVED: 'default',
  REJECTED: 'destructive',
  EXPIRED: 'destructive',
};

export const RISK_TIER_LABELS: Record<RiskTier, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  UNSCORED: 'Unscored',
};

export const RISK_TIER_COLORS: Record<
  RiskTier,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  CRITICAL: 'destructive',
  HIGH: 'destructive',
  MEDIUM: 'secondary',
  LOW: 'default',
  UNSCORED: 'outline',
};

export const RISK_STATUS_LABELS: Record<RiskStatus, string> = {
  OPEN: 'Open',
  PENDING_APPROVAL: 'Pending approval',
  CLOSED: 'Closed',
  ARCHIVED: 'Archived',
};

// Vanta-style risk scenario status labels
export const RISK_SCENARIO_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Draft',
  PENDING_APPROVAL: 'Pending approval',
  CLOSED: 'Approved',
  DRAFT: 'Draft',
  NEEDS_REVIEW: 'Needs review',
  PENDING_APPROVAL: 'Pending approval',
  APPROVED: 'Approved',
  ARCHIVED: 'Archived',
};

export const POLICY_STATUS_LABELS: Record<PolicyStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'OK',
  ARCHIVED: 'Archived',
};

export const POLICY_STATUS_COLORS: Record<
  PolicyStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  DRAFT: 'secondary',
  ACTIVE: 'default',
  ARCHIVED: 'outline',
};

export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  UNDER_REVIEW: 'Under review',
  TERMINATED: 'Terminated',
};

export const VENDOR_STATUS_COLORS: Record<
  VendorStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  ACTIVE: 'default',
  INACTIVE: 'outline',
  UNDER_REVIEW: 'secondary',
  TERMINATED: 'destructive',
};

export const AUDIT_STATUS_LABELS: Record<AuditStatus, string> = {
  PREP: 'Prep',
  FIELDWORK: 'Fieldwork',
  COMPLETED: 'Completed',
};

export const ACTION_LABELS: Record<Action, string> = {
  CREATE: 'Created',
  UPDATE: 'Updated',
  DELETE: 'Deleted',
  STATUS_CHANGE: 'Status changed',
};

// Semantic CSS class names for status colors (uses globals.css tokens)
export const STATUS_CSS_CLASSES = {
  success: 'text-[var(--color-success)]',
  error: 'text-[var(--color-error)]',
  warning: 'text-[var(--color-warning)]',
} as const;
