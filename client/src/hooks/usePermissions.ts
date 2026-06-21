import { useAuthStore, type UserRole } from '@/store/useAuthStore';

const ADMIN_MANAGER: UserRole[] = ['ADMIN', 'MANAGER'];
const INTERNAL_ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'EMPLOYEE'];

const hasRole = (role: UserRole | undefined, allowedRoles: UserRole[]) =>
  Boolean(role && allowedRoles.includes(role));

export function getPermissions(role: UserRole | undefined) {
  const isAdmin = role === 'ADMIN';
  const isManager = role === 'MANAGER';
  const isEmployee = role === 'EMPLOYEE';
  const isAdminOrManager = hasRole(role, ADMIN_MANAGER);
  const isInternal = hasRole(role, INTERNAL_ROLES);

  return {
    canViewOrgActivity: isAdmin || isManager || role === 'AUDITOR',
    canViewOwnActivity: isInternal,
    canViewAllUsers: isAdmin || isManager || role === 'AUDITOR',
    canViewOwnUserOnly: isEmployee,
    canInviteUsers: isAdminOrManager,
    canManageUsers: isAdminOrManager,
    canChangeUserRoles: isAdmin,
    canDeactivateUsers: isAdmin,
    canManageGroups: isAdminOrManager,
    canCreateVendors: isAdminOrManager,
    canEditVendors: isAdminOrManager,
    canDeleteVendors: isAdmin,
    canExportVendors: isAdminOrManager,
    canCreateAudits: isAdmin,
    canEditAudits: isAdmin,
    canViewAccessReviews: isAdminOrManager,
    canViewIntegrations: isAdminOrManager,
    canViewPeopleGroups: isAdminOrManager,
    canViewSettings: isAdmin,
    canViewReports: isAdmin || isManager || role === 'AUDITOR',
    canExportReports: isAdmin || isManager || role === 'AUDITOR',
    canViewPersonnelReports: isAdminOrManager,
    canAcknowledgePolicies: isInternal,
    canViewOwnPersonnelTasks: isInternal,
    canViewPersonnelAdminTabs: isAdminOrManager,
    canCreateEvidence: isAdminOrManager,
    canEditEvidence: isAdminOrManager,
    canReviewEvidence: isAdminOrManager,
    canArchiveEvidence: isAdminOrManager,
    canLinkEvidenceControls: isAdminOrManager,
    canDeleteEvidence: isAdmin,
    canCreateControls: isAdminOrManager,
    canEditControls: isAdminOrManager,
    canAssessControls: isAdminOrManager,
    canBulkUpdateControls: isAdminOrManager,
    canMapControls: isAdminOrManager,
    canCreatePolicies: isAdminOrManager,
    canEditPolicies: isAdminOrManager,
    canEditPolicyVersions: isAdminOrManager,
    canSubmitPoliciesForApproval: isAdminOrManager,
    canApprovePolicies: isAdminOrManager,
    canPublishPolicies: isAdmin,
    canArchivePolicies: isAdmin,
    canDeletePolicies: isAdmin,
    canViewRisks: isInternal,
    canCreateRisks: isAdminOrManager,
    canEditRisks: isAdminOrManager,
    canArchiveRisks: isAdminOrManager,
    canReviewRisks: isAdminOrManager,
    canLinkRiskControls: isAdminOrManager,
    canRecalculateRisks: isAdmin,
    canDeleteRisks: isAdmin,
    canViewRiskLibrary: isInternal,
    canManageRiskTemplates: isAdminOrManager,
    canDeleteRiskTemplates: isAdmin,
    canStartTestEvidenceWorkflow: isInternal,
    canSnoozeTests: isInternal,
    canDeactivateTests: isInternal,
    canArchiveTests: isAdminOrManager,
    canDeleteTests: isAdmin,
  };
}

export type Permissions = ReturnType<typeof getPermissions>;
export type PermissionKey = keyof Permissions;

export function usePermissions() {
  const role = useAuthStore((state) => state.user?.role);
  return getPermissions(role);
}
