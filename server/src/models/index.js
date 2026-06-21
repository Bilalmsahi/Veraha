/**
 * Mongoose Models - Barrel Export
 * Compliance Automation Platform V2
 * 
 * This file exports all models for convenient importing throughout the application.
 * 
 * Usage:
 *   import { User, Organization, InternalControl } from './models/index.js';
 *   // or
 *   import * as models from './models/index.js';
 */

// =============================================================================
// PLUGINS
// =============================================================================
export { default as tenantPlugin } from './plugins/tenantPlugin.js';

// =============================================================================
// ENUMS (Shared Constants)
// =============================================================================
export * from './enums.js';

// =============================================================================
// GLOBAL DOMAIN (No organizationId - Shared across all tenants)
// =============================================================================
export { default as Framework } from './Framework.js';
export { default as RequirementCategory } from './RequirementCategory.js';
export { default as Requirement } from './Requirement.js';
export { default as GlobalControlTemplate } from './GlobalControlTemplate.js';
export { default as GlobalTestTemplate } from './GlobalTestTemplate.js';
export { default as PolicyTemplate } from './PolicyTemplate.js';

// =============================================================================
// TENANT DOMAIN - Core Entities
// =============================================================================
export { default as Organization } from './Organization.js';
export { default as User } from './User.js';
export { default as Invitation } from './Invitation.js';
export { default as RefreshToken } from './RefreshToken.js';
export { default as OrganizationFramework } from './OrganizationFramework.js';
export { default as OrganizationFrameworkReadiness } from './OrganizationFrameworkReadiness.js';

// =============================================================================
// TENANT DOMAIN - Compliance Engine
// =============================================================================
export { default as InternalControl } from './InternalControl.js';
export { default as AutomationFinding } from './AutomationFinding.js';
export { default as Evidence } from './Evidence.js';
export { default as EvidenceVersion } from './EvidenceVersion.js';
export { default as EvidenceVersionFile } from './EvidenceVersionFile.js';
export { default as Test } from './Test.js';
export { default as PersonnelTaskRequirement } from './PersonnelTaskRequirement.js';
export { default as PersonnelTaskSet } from './PersonnelTaskSet.js';
export { default as PersonnelTaskState } from './PersonnelTaskState.js';
export { default as TrainingModule } from './TrainingModule.js';
export { default as TrainingAttempt } from './TrainingAttempt.js';
export { default as OffboardingEvent } from './OffboardingEvent.js';

// =============================================================================
// TENANT DOMAIN - Policy Management
// =============================================================================
export { default as Policy } from './Policy.js';
export { default as PolicyVersion } from './PolicyVersion.js';
export { default as PolicyAttestation } from './PolicyAttestation.js';
export { default as Group } from './Group.js';
export { default as AccessRequest } from './AccessRequest.js';
export { default as Comment } from './Comment.js';

// =============================================================================
// TENANT DOMAIN - Risk & Vendor Management
// =============================================================================
export { default as Risk } from './Risk.js';
export { default as RiskAssessment } from './RiskAssessment.js';
export { default as RiskTemplate } from './RiskTemplate.js';
export { default as Vendor } from './Vendor.js';
export { default as Device } from './Device.js';
export { default as DeviceEvidence } from './DeviceEvidence.js';
export { default as AwsAccount } from './AwsAccount.js';
export { default as AwsFinding } from './AwsFinding.js';
export { default as HrProfile } from './HrProfile.js';
export { default as IntegrationConnection } from './IntegrationConnection.js';

// =============================================================================
// TENANT DOMAIN - Audit Operations
// =============================================================================
export { default as Audit } from './Audit.js';
export { default as AuditControlSnapshot } from './AuditControlSnapshot.js';
export { default as AuditorProfile } from './AuditorProfile.js';
export { default as AuditorTenantMembership } from './AuditorTenantMembership.js';
export { default as AuditAssignment } from './AuditAssignment.js';
export { default as AuditEvidenceItem } from './AuditEvidenceItem.js';
export { default as AuditEvidenceRequest } from './AuditEvidenceRequest.js';
export { default as AuditFinding } from './AuditFinding.js';
export { default as AuditReport } from './AuditReport.js';
export { default as AccessReviewCampaign } from './AccessReviewCampaign.js';
export { default as AccessReviewTask } from './AccessReviewTask.js';

// =============================================================================
// TENANT DOMAIN - Activity Logging
// =============================================================================
export { default as ActivityLog } from './ActivityLog.js';
export { default as Notification } from './Notification.js';

// =============================================================================
// UTILITY MODELS
// =============================================================================
export { default as OTP } from './OTP.js';

// =============================================================================
// MODEL REGISTRY (for dynamic operations)
// =============================================================================
import Framework from './Framework.js';
import RequirementCategory from './RequirementCategory.js';
import Requirement from './Requirement.js';
import GlobalControlTemplate from './GlobalControlTemplate.js';
import GlobalTestTemplate from './GlobalTestTemplate.js';
import PolicyTemplate from './PolicyTemplate.js';
import Organization from './Organization.js';
import User from './User.js';
import Invitation from './Invitation.js';
import RefreshToken from './RefreshToken.js';
import OrganizationFramework from './OrganizationFramework.js';
import OrganizationFrameworkReadiness from './OrganizationFrameworkReadiness.js';
import InternalControl from './InternalControl.js';
import AutomationFinding from './AutomationFinding.js';
import Evidence from './Evidence.js';
import EvidenceVersion from './EvidenceVersion.js';
import EvidenceVersionFile from './EvidenceVersionFile.js';
import Test from './Test.js';
import PersonnelTaskRequirement from './PersonnelTaskRequirement.js';
import PersonnelTaskSet from './PersonnelTaskSet.js';
import PersonnelTaskState from './PersonnelTaskState.js';
import TrainingModule from './TrainingModule.js';
import TrainingAttempt from './TrainingAttempt.js';
import OffboardingEvent from './OffboardingEvent.js';
import Policy from './Policy.js';
import PolicyVersion from './PolicyVersion.js';
import PolicyAttestation from './PolicyAttestation.js';
import Group from './Group.js';
import AccessRequest from './AccessRequest.js';
import Risk from './Risk.js';
import RiskAssessment from './RiskAssessment.js';
import RiskTemplate from './RiskTemplate.js';
import Vendor from './Vendor.js';
import Device from './Device.js';
import DeviceEvidence from './DeviceEvidence.js';
import AwsAccount from './AwsAccount.js';
import AwsFinding from './AwsFinding.js';
import HrProfile from './HrProfile.js';
import IntegrationConnection from './IntegrationConnection.js';
import Audit from './Audit.js';
import AuditControlSnapshot from './AuditControlSnapshot.js';
import AuditorProfile from './AuditorProfile.js';
import AuditorTenantMembership from './AuditorTenantMembership.js';
import AuditAssignment from './AuditAssignment.js';
import AuditEvidenceItem from './AuditEvidenceItem.js';
import AuditEvidenceRequest from './AuditEvidenceRequest.js';
import AuditFinding from './AuditFinding.js';
import AuditReport from './AuditReport.js';
import AccessReviewCampaign from './AccessReviewCampaign.js';
import AccessReviewTask from './AccessReviewTask.js';
import ActivityLog from './ActivityLog.js';
import Notification from './Notification.js';
import OTP from './OTP.js';

/**
 * Registry of all models for dynamic access
 * Useful for generic operations like activity logging
 */
export const ModelRegistry = {
  // Global Domain
  Framework,
  RequirementCategory,
  Requirement,
  GlobalControlTemplate,
  GlobalTestTemplate,
  PolicyTemplate,
  // Tenant Domain
  Organization,
  User,
  Invitation,
  RefreshToken,
  OrganizationFramework,
  OrganizationFrameworkReadiness,
  InternalControl,
  AutomationFinding,
  Evidence,
  EvidenceVersion,
  EvidenceVersionFile,
  Test,
  PersonnelTaskRequirement,
  PersonnelTaskSet,
  PersonnelTaskState,
  TrainingModule,
  TrainingAttempt,
  OffboardingEvent,
  Policy,
  PolicyVersion,
  PolicyAttestation,
  Group,
  AccessRequest,
  Risk,
  RiskAssessment,
  RiskTemplate,
  Vendor,
  Device,
  DeviceEvidence,
  AwsAccount,
  AwsFinding,
  HrProfile,
  IntegrationConnection,
  Audit,
  AuditControlSnapshot,
  AuditorProfile,
  AuditorTenantMembership,
  AuditAssignment,
  AuditEvidenceItem,
  AuditEvidenceRequest,
  AuditFinding,
  AuditReport,
  AccessReviewCampaign,
  AccessReviewTask,
  ActivityLog,
  Notification,
};

/**
 * List of entity types that support soft delete
 */
export const SoftDeleteEntities = [
  'User',
  'InternalControl',
  'Policy',
  'Evidence',
  'Test',
  'PersonnelTaskRequirement',
  'PersonnelTaskSet',
  'PersonnelTaskState',
  'TrainingModule',
  'TrainingAttempt',
  'OffboardingEvent',
  'Risk',
  'Vendor',
  'Device',
  'Group',
  'AccessRequest',
  'AuditAssignment',
  'AuditEvidenceItem',
  'AuditEvidenceRequest',
  'AuditFinding',
  'AuditReport',
  'AccessReviewCampaign',
  'AccessReviewTask',
];

/**
 * List of tenant entities (require organizationId)
 */
export const TenantEntities = [
  'User',
  'Invitation',
  'RefreshToken',
  'OrganizationFramework',
  'OrganizationFrameworkReadiness',
  'InternalControl',
  'AutomationFinding',
  'Evidence',
  'Test',
  'PersonnelTaskRequirement',
  'PersonnelTaskSet',
  'PersonnelTaskState',
  'TrainingModule',
  'TrainingAttempt',
  'OffboardingEvent',
  'Policy',
  'PolicyVersion',
  'PolicyAttestation',
  'Group',
  'AccessRequest',
  'Risk',
  'Vendor',
  'Device',
  'DeviceEvidence',
  'Audit',
  'AuditControlSnapshot',
  'AuditAssignment',
  'AuditEvidenceItem',
  'AuditEvidenceRequest',
  'AuditFinding',
  'AuditReport',
  'AccessReviewCampaign',
  'AccessReviewTask',
  'ActivityLog',
  'Notification',
];

/**
 * List of global entities (no organizationId)
 */
export const GlobalEntities = [
  'Framework',
  'RequirementCategory',
  'Requirement',
  'GlobalControlTemplate',
  'GlobalTestTemplate',
  'PolicyTemplate',
  'AuditorProfile',
];

export default ModelRegistry;
