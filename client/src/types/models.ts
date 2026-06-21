/**
 * Model interfaces - mirrors server Mongoose schemas
 */

import type {
  Role,
  UserStatus,
  SubscriptionTier,
  ManualStatus,
  AutomationStatus,
  OverallStatus,
  Frequency,
  Coverage,
  EvidenceStatus,
  Treatment,
  RiskStatus,
  RiskTier,
  PolicyStatus,
  PolicyWorkflowStatus,
  PolicyVersionStatus,
  ReviewFrequency,
  VendorStatus,
  DataType,
  AuditStatus,
  Action,
  TestStatus,
  TestWorkflowState,
  ReadinessContribution,
  TestType,
  TestCategory,
  TestRollout,
  TestRenewalPeriod,
} from './enums';

// Re-export for convenience
export type {
  Role,
  UserStatus,
  SubscriptionTier,
  ManualStatus,
  AutomationStatus,
  OverallStatus,
  Frequency,
  Coverage,
  EvidenceStatus,
  Treatment,
  RiskStatus,
  RiskTier,
  PolicyStatus,
  PolicyWorkflowStatus,
  PolicyVersionStatus,
  ReviewFrequency,
  VendorStatus,
  DataType,
  AuditStatus,
  Action,
  TestStatus,
  TestWorkflowState,
  ReadinessContribution,
  TestType,
  TestCategory,
  TestRollout,
  TestRenewalPeriod,
};

/** Compliance test check (automated and/or manual evidence) */
export interface ComplianceTest {
  _id: string;
  organizationId: string;
  notionId?: string;
  name: string;
  description?: string;
  instructions?: string;
  evidenceGuidance?: string;
  category: TestCategory;
  type: TestType;
  renewalPeriod?: TestRenewalPeriod;
  rollout: TestRollout;
  status: TestStatus;
  workflowState?: TestWorkflowState;
  readinessContribution?: ReadinessContribution;
  reason?: string | null;
  ownerId?: string | { _id: string; firstName: string; lastName: string; email?: string };
  dueDate?: string | null;
  lastRenewedAt?: string | null;
  lastPassedAt?: string | null;
  isActive: boolean;
  snoozedUntil?: string | null;
  notApplicableAt?: string | null;
  archivedAt?: string | null;
  linkedControlIds?: Array<
    | string
    | {
        _id: string;
        identifier?: string;
        title?: string;
        linkedRequirements?: Array<{
          frameworkId?: { _id?: string; code?: string; name?: string };
        }>;
      }
  >;
  evidenceId?: string | { _id: string; title?: string; status?: string; validUntil?: string };
  automationConfig?: {
    provider?: string;
    integrationId?: string;
    checkType?: string;
    parameters?: unknown;
    lastRunAt?: string;
    nextRunAt?: string;
  };
  lastAutomationRunAt?: string | null;
  lastAutomationResult?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Shared pagination shape from list/comment APIs (`meta` on responses) */
export interface ApiPaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/** GET /tests/stats — dashboard-style counts for Tests list header */
export interface TestStats {
  total: number;
  passing: number;
  passingPercent: number;
  attention: {
    overdue: number;
    dueSoon: number;
    needsRemediation: number;
  };
  documents: { total: number; passing: number };
  automated: { total: number; passing: number };
}

/** Tests list URL + filter bar state */
export type TestsFilterState = {
  search: string;
  category: string;
  frameworkId: string;
  controlId: string;
  integration: string;
  ownerId: string;
  type: string;
  status: string;
  rollout: string;
};

export interface User {
  _id: string;
  organizationId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: UserStatus;
  fullName?: string;
  settings?: {
    sessionTimeoutMinutes?: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface Organization {
  _id: string;
  name: string;
  domain?: string;
  slug?: string;
  subscriptionTier: SubscriptionTier;
  setupComplete: boolean;
  settings?: {
    timezone?: string;
    dateFormat?: string;
    evidenceExpiryWarningDays?: number;
    sessionTimeoutMinutes?: number;
    archiveAutoPassesAttestation?: boolean;
    archiveEvidenceCountsAsSatisfied?: boolean;
    naCountsAsSatisfied?: boolean;
    snoozeBlocksReadiness?: boolean;
    enabledFrameworks?: string[];
  };
  createdAt?: string;
  updatedAt?: string;
}

/** Level 2 — requirement category under a framework (e.g. SOC 2 CC 5.0) */
export interface RequirementCategory {
  _id: string;
  frameworkId: string;
  code: string;
  title: string;
  order?: number;
  isActive?: boolean;
  requirementCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Framework {
  _id: string;
  code: string;
  name: string;
  version: string;
  description?: string;
  isActive?: boolean;
  /** Requirement categories for this framework (from GET /frameworks/:code) */
  categories?: Array<Pick<RequirementCategory, '_id' | 'code' | 'title' | 'order'>>;
  requirementCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

/** Level 3 — requirement sub-category (leaf), linked to RequirementCategory */
export interface Requirement {
  _id: string;
  frameworkId: string;
  /** ObjectId string, or populated category when API uses populate("categoryId") */
  categoryId: string | Pick<RequirementCategory, '_id' | 'code' | 'title' | 'order'>;
  identifier: string;
  title: string;
  description?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ControlRequirementMap {
  requirementId: string;
  frameworkId: string;
  coverage: Coverage;
  justification?: string;
}

export interface InternalControl {
  _id: string;
  organizationId: string;
  sourceTemplateId?: string;
  identifier: string;
  title: string;
  description?: string;
  /** Functional grouping (e.g. Asset Management), not framework requirement category */
  controlGroup?: string;
  manualStatus: ManualStatus;
  automationStatus: AutomationStatus;
  overallStatus: OverallStatus;
  frequency: Frequency;
  isPurchased?: boolean;
  isActive?: boolean;
  ownerId?: string;
  linkedRequirements?: ControlRequirementMap[];
  linkedPolicyIds?: string[];
  linkedRiskIds?: string[];
  lastAssessedAt?: string;
  lastAssessedBy?: string;
  nextAssessmentDue?: string;
  implementationNotes?: string;
  createdAt?: string;
  updatedAt?: string;
  owner?: { _id: string; firstName: string; lastName: string; email: string };
}

export interface Evidence {
  _id: string;
  organizationId: string;
  title: string;
  description?: string;
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  validFrom?: string;
  validUntil?: string;
  status: EvidenceStatus;
  linkedControlIds?: string[];
  uploadedBy: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  category?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Policy {
  _id: string;
  organizationId: string;
  title: string;
  description?: string;
  status: PolicyStatus;
  workflowStatus?: PolicyWorkflowStatus;
  currentVersionId?: string;
  linkedControlIds?: string[];
  ownerId?: string;
  approverIds?: string[];
  category?: string;
  reviewFrequency: ReviewFrequency;
  lastReviewedAt?: string;
  nextReviewDue?: string;
  requiresAttestation?: boolean;
  assignmentScope?: 'ALL_PERSONNEL' | 'SPECIFIC_GROUPS' | 'SPECIFIC_USERS' | 'SPECIFIC_ROLES';
  assignmentGroupIds?: string[];
  assignmentUserIds?: string[];
  targetUserIds?: string[];
  targetRoles?: Array<'ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'AUDITOR'>;
  acknowledgementRate?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PolicyVersion {
  _id: string;
  policyId: string;
  versionNumber: number;
  status: PolicyVersionStatus;
  approverId?: string | null;
  contentHtml?: string;
  contentType?: 'EDITOR_HTML' | 'UPLOADED_FILE';
  draftSourceVersionId?: string | PolicyVersion | null;
  editorLastSavedAt?: string | null;
  editorLastSavedBy?: string | User | null;
  contentHash?: string;
  fileKey?: string;
  fileUrl?: string;
  fileName?: string;
  effectiveDate?: string;
  createdBy: string;
  changelog?: string;
  submittedForApprovalAt?: string | null;
  submittedBy?: string | null;
  approvedBy?: string;
  approvedAt?: string;
  rejectedAt?: string | null;
  rejectedBy?: string | null;
  rejectionReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PolicyAttestation {
  _id: string;
  policyVersionId: string;
  userId: string;
  attestedAt: string;
  signatureText?: string;
  source?: 'USER' | 'SYSTEM_ARCHIVE';
}

export interface Risk {
  _id: string;
  organizationId: string;
  identifier?: string;
  title: string;
  description?: string;
  category?: string;
  categories?: string[];
  ciaCategories?: Array<'Confidentiality' | 'Integrity' | 'Availability'>;
  likelihood: number | null | undefined;
  impact: number | null | undefined;
  residualLikelihood?: number | null;
  residualImpact?: number | null;
  inherentScore?: number;
  residualScore?: number;
  riskLevel?: RiskTier | 'UNKNOWN';
  inherentRisk?: {
    likelihood?: number;
    impact?: number;
    score?: number;
    level?: 'Low' | 'Medium' | 'High';
  };
  residualRisk?: {
    likelihood?: number;
    impact?: number;
    score?: number;
    level?: 'Low' | 'Medium' | 'High';
  };
  assessmentNotes?: string;
  treatment: Treatment | null | undefined;
  treatmentPlan?: string;
  status: RiskStatus;
  mitigatingControlIds?: string[];
  assignedApproverIds?: string[];
  submittedForApprovalAt?: string | null;
  submittedForApprovalBy?: string | User | null;
  ownerId?: string;
  identifiedAt?: string;
  identifiedBy?: User;
  lastReviewedAt?: string;
  lastReviewedBy?: User;
  nextReviewDue?: string;
  closedAt?: string;
  closureReason?: string;
  closedBy?: User;
  approvals?: Array<{
    approverId?: User;
    approvedAt?: string;
  }>;
  lastAssessmentId?: string | null;
  templateId?: string | null;
  reviewStatus?: 'NOT_REVIEWED' | 'REVIEWED';
  createdAt?: string;
  updatedAt?: string;
}

export interface Vendor {
  _id: string;
  organizationId: string;
  name: string;
  description?: string;
  serviceType?: string;
  category?: string;
  website?: string;
  riskTier: RiskTier;
  status: VendorStatus;
  linkedControlIds?: string[];
  primaryContact?: { name?: string; email?: string; phone?: string };
  securityContact?: { name?: string; email?: string; phone?: string };
  contractStartDate?: string;
  contractEndDate?: string;
  hasNda?: boolean;
  hasDpa?: boolean;
  hasSla?: boolean;
  lastAssessmentDate?: string;
  nextAssessmentDate?: string;
  assessmentFrequency?: ReviewFrequency;
  certifications?: Array<{
    name?: string;
    validUntil?: string;
    documentUrl?: string;
    uploadedAt?: string;
  }>;
  dataTypes?: DataType[];
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ActivityLog {
  _id: string;
  organizationId: string;
  actorId?: string;
  actorSnapshot?: { email?: string; name?: string; role?: string };
  action: Action;
  entityType: string;
  entityId: string;
  entitySnapshot?: { title?: string; identifier?: string };
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    fields?: string[];
  };
  timestamp: string;
  notes?: string;
}

export interface Audit {
  _id: string;
  organizationId: string;
  name: string;
  description?: string;
  frameworkId?: { _id: string; code?: string; name?: string } | string;
  auditType?: string;
  auditorName?: string;
  auditorFirm?: string;
  auditorEmail?: string;
  periodStart: string;
  periodEnd: string;
  kickoffDate?: string;
  fieldworkStartDate?: string;
  fieldworkEndDate?: string;
  reportReceivedDate?: string;
  earlyAccessDate?: string;
  scopedControlIds?: Array<string | { _id: string }>;
  status: AuditStatus;
  outcome?: string;
  evidenceStatusCounts?: Record<string, number>;
  requestStatusCounts?: Record<string, number>;
  reports?: Array<{
    _id: string;
    fileName: string;
    fileUrl?: string;
    createdAt: string;
    uploadedBy?: { firstName?: string; lastName?: string; email?: string };
  }>;
  createdAt?: string;
  updatedAt?: string;
}
