import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from './axios';
import { getApiErrorMessage } from '@/lib/apiError';

type ApiResponse<T> = {
  success: boolean;
  data: T;
  error: string | null;
  meta?: { pagination?: Record<string, unknown> };
};

function buildQuery(params?: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        searchParams.set(key, String(value));
      }
    }
  }
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>, fallback: string): Promise<T> {
  const { data } = await promise;
  if (!data.success || data.data == null) {
    throw new Error(data.error ?? fallback);
  }
  return data.data;
}

async function unwrapPaginated<T>(
  promise: Promise<{ data: ApiResponse<T[]> }>,
  fallback: string
): Promise<{ data: T[]; pagination: Record<string, unknown> }> {
  const { data } = await promise;
  if (!data.success || !Array.isArray(data.data)) {
    throw new Error(data.error ?? fallback);
  }
  return {
    data: data.data,
    pagination: data.meta?.pagination ?? {},
  };
}

export type AwsAccount = {
  _id: string;
  name: string;
  awsAccountId: string;
  regions: string[];
  environmentType?: 'production' | 'staging' | 'development' | 'other';
  status: 'active' | 'inactive' | 'unverified';
  ownerId?: string;
  notes?: string;
  linkedControlIds: string[];
  createdAt: string;
};

export type AwsFinding = {
  _id: string;
  awsAccountId: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  affectedService?: string;
  description: string;
  region?: string;
  resourceType?: string;
  resourceId?: string;
  detectedOn: string;
  status: 'open' | 'in_remediation' | 'resolved' | 'accepted_risk';
  resolvedOn?: string | null;
  remediationNotes?: string;
  linkedControlIds: string[];
  createdAt: string;
};

export type HrProfile = {
  _id: string;
  fullName: string;
  workEmail: string;
  employeeNumber?: string;
  department?: string;
  jobTitle?: string;
  employmentStatus: 'active' | 'on_leave' | 'departed';
  startDate?: string;
  endDate?: string | null;
  hrSource: 'manual' | 'bamboohr_import' | 'rippling_import';
  backgroundCheckStatus: 'pending' | 'completed' | 'not_required' | 'failed';
  linkedControlIds: string[];
  userId?: string | null;
  createdAt: string;
};

export type IntegrationConnectionStatus = 'connected' | 'not_connected' | 'error';

export type IntegrationConnection = {
  _id: string;
  integrationType: string;
  status: IntegrationConnectionStatus;
  displayName?: string;
  lastUpdatedAt?: string;
};

export type IntegrationSummary = {
  aws: { connectionStatus: string; accountCount: number; openFindingsCount: number };
  hr: { connectionStatus: string; profileCount: number; activeCount: number; departedCount: number };
  mdm: {
    connectionStatus: string;
    deviceCount: number;
    compliantCount: number;
    nonCompliantCount: number;
    needsReviewCount: number;
  };
};

export type PolicyStatus = {
  total: number;
  acknowledged: number;
  pending: number;
  overdue: number;
  unlinked?: boolean;
};

export type CompanionEvidenceSource = 'aws_account' | 'aws_finding' | 'hr_profile' | 'device';

export type CompanionEvidence = {
  _id: string;
  source: CompanionEvidenceSource;
  externalId: string;
  title: string;
  description?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  linkedControlIds: string[];
  uploadedBy?: { _id: string; firstName?: string; lastName?: string; email?: string } | string | null;
  createdAt: string;
  updatedAt: string;
};

// Summary

export async function getIntegrationSummary(): Promise<IntegrationSummary> {
  return unwrap(api.get<ApiResponse<IntegrationSummary>>('/integrations/summary'), 'Unable to load integrations summary.');
}

// AWS Accounts

export async function listAwsAccounts(params?: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: AwsAccount[]; pagination: Record<string, unknown> }> {
  return unwrapPaginated(
    api.get<ApiResponse<AwsAccount[]>>(`/integrations/aws/accounts${buildQuery(params)}`),
    'Unable to load AWS accounts.'
  );
}

export async function createAwsAccount(data: Partial<AwsAccount>): Promise<AwsAccount> {
  return unwrap(api.post<ApiResponse<AwsAccount>>('/integrations/aws/accounts', data), 'Unable to create AWS account.');
}

export async function updateAwsAccount(id: string, data: Partial<AwsAccount>): Promise<AwsAccount> {
  return unwrap(
    api.patch<ApiResponse<AwsAccount>>(`/integrations/aws/accounts/${id}`, data),
    'Unable to update AWS account.'
  );
}

export async function deleteAwsAccount(id: string): Promise<void> {
  await unwrap(api.delete<ApiResponse<{ deleted: boolean }>>(`/integrations/aws/accounts/${id}`), 'Unable to delete AWS account.');
}

export async function linkAwsAccountControls(id: string, controlIds: string[]): Promise<AwsAccount> {
  return unwrap(
    api.post<ApiResponse<AwsAccount>>(`/integrations/aws/accounts/${id}/controls`, { controlIds }),
    'Unable to link controls to AWS account.'
  );
}

export async function unlinkAwsAccountControl(id: string, controlId: string): Promise<AwsAccount> {
  return unwrap(
    api.delete<ApiResponse<AwsAccount>>(`/integrations/aws/accounts/${id}/controls/${controlId}`),
    'Unable to unlink control from AWS account.'
  );
}

export async function getAwsStats(): Promise<Record<string, unknown>> {
  return unwrap(api.get<ApiResponse<Record<string, unknown>>>('/integrations/aws/stats'), 'Unable to load AWS stats.');
}

// AWS Findings

export async function listFindings(
  accountId: string,
  params?: { status?: string; severity?: string; page?: number; limit?: number }
): Promise<{ data: AwsFinding[]; pagination: Record<string, unknown> }> {
  return unwrapPaginated(
    api.get<ApiResponse<AwsFinding[]>>(`/integrations/aws/accounts/${accountId}/findings${buildQuery(params)}`),
    'Unable to load AWS findings.'
  );
}

export async function createFinding(accountId: string, data: Partial<AwsFinding>): Promise<AwsFinding> {
  return unwrap(
    api.post<ApiResponse<AwsFinding>>(`/integrations/aws/accounts/${accountId}/findings`, data),
    'Unable to create finding.'
  );
}

export async function updateFinding(id: string, data: Partial<AwsFinding>): Promise<AwsFinding> {
  return unwrap(
    api.patch<ApiResponse<AwsFinding>>(`/integrations/aws/findings/${id}`, data),
    'Unable to update finding.'
  );
}

export async function linkFindingControls(id: string, controlIds: string[]): Promise<AwsFinding> {
  return unwrap(
    api.post<ApiResponse<AwsFinding>>(`/integrations/aws/findings/${id}/controls`, { controlIds }),
    'Unable to link controls to finding.'
  );
}

export async function unlinkFindingControl(id: string, controlId: string): Promise<AwsFinding> {
  return unwrap(
    api.delete<ApiResponse<AwsFinding>>(`/integrations/aws/findings/${id}/controls/${controlId}`),
    'Unable to unlink control from finding.'
  );
}

// HR Profiles

export async function listHrProfiles(params?: {
  search?: string;
  status?: string;
  department?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: HrProfile[]; pagination: Record<string, unknown> }> {
  return unwrapPaginated(
    api.get<ApiResponse<HrProfile[]>>(`/integrations/hr${buildQuery(params)}`),
    'Unable to load HR profiles.'
  );
}

export async function createHrProfile(data: Partial<HrProfile>): Promise<HrProfile> {
  return unwrap(api.post<ApiResponse<HrProfile>>('/integrations/hr', data), 'Unable to create HR profile.');
}

export async function updateHrProfile(id: string, data: Partial<HrProfile>): Promise<HrProfile> {
  return unwrap(
    api.patch<ApiResponse<HrProfile>>(`/integrations/hr/${id}`, data),
    'Unable to update HR profile.'
  );
}

export async function importHrCSV(rows: Record<string, string>[], hrSource?: string): Promise<Record<string, unknown>> {
  return unwrap(
    api.post<ApiResponse<Record<string, unknown>>>('/integrations/hr/import', { rows, hrSource }),
    'Unable to import HR profiles.'
  );
}

export async function departEmployee(id: string, endDate?: string): Promise<HrProfile> {
  return unwrap(
    api.post<ApiResponse<HrProfile>>(`/integrations/hr/${id}/depart`, endDate ? { endDate } : {}),
    'Unable to mark employee as departed.'
  );
}

export async function getPolicyStatus(id: string): Promise<PolicyStatus> {
  return unwrap(
    api.get<ApiResponse<PolicyStatus>>(`/integrations/hr/policy-status/${id}`),
    'Unable to load policy status.'
  );
}

export async function getHrStats(): Promise<Record<string, unknown>> {
  return unwrap(api.get<ApiResponse<Record<string, unknown>>>('/integrations/hr/stats'), 'Unable to load HR stats.');
}

export async function linkHrProfileControls(id: string, controlIds: string[]): Promise<HrProfile> {
  return unwrap(
    api.post<ApiResponse<HrProfile>>(`/integrations/hr/${id}/controls`, { controlIds }),
    'Unable to link controls to HR profile.'
  );
}

export async function unlinkHrProfileControl(id: string, controlId: string): Promise<HrProfile> {
  return unwrap(
    api.delete<ApiResponse<HrProfile>>(`/integrations/hr/${id}/controls/${controlId}`),
    'Unable to unlink control from HR profile.'
  );
}

// Companion Evidence (cross-integration)

/**
 * Fetches Evidence documents linked to a control, filtered to integration sources only.
 * Uses the existing /evidence endpoint with the new `sources` filter (server-side).
 */
export async function listIntegrationEvidence(controlId: string): Promise<CompanionEvidence[]> {
  const sources: CompanionEvidenceSource[] = ['aws_account', 'aws_finding', 'hr_profile', 'device'];
  const query = buildQuery({ controlId, sources: sources.join(','), limit: 200 });
  const result = await unwrapPaginated(
    api.get<ApiResponse<CompanionEvidence[]>>(`/evidence${query}`),
    'Unable to load integration evidence.'
  );
  return result.data;
}

// Connections

export async function listConnections(): Promise<IntegrationConnection[]> {
  return unwrap(api.get<ApiResponse<IntegrationConnection[]>>('/integrations/connections'), 'Unable to load connections.');
}

export async function upsertConnection(data: {
  integrationType: string;
  status: string;
  displayName?: string;
  metadata?: Record<string, unknown>;
}): Promise<IntegrationConnection> {
  return unwrap(
    api.post<ApiResponse<IntegrationConnection>>('/integrations/connections', data),
    'Unable to save connection.'
  );
}

export async function deleteConnection(type: string): Promise<void> {
  await unwrap(
    api.delete<ApiResponse<{ deleted: boolean }>>(`/integrations/connections/${type}`),
    'Unable to delete connection.'
  );
}

// React Query hooks

export function useIntegrationSummary() {
  return useQuery({
    queryKey: ['integration-summary'],
    queryFn: getIntegrationSummary,
  });
}

export function useIntegrationEvidence(controlId: string | undefined) {
  return useQuery({
    queryKey: ['integration-evidence', controlId],
    queryFn: () => listIntegrationEvidence(controlId as string),
    enabled: Boolean(controlId),
  });
}

export function useAwsAccounts(params?: { search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['aws-accounts', params],
    queryFn: () => listAwsAccounts(params),
  });
}

export function useFindings(
  accountId: string,
  params?: { status?: string; severity?: string; page?: number; limit?: number }
) {
  return useQuery({
    queryKey: ['aws-findings', accountId, params],
    queryFn: () => listFindings(accountId, params),
    enabled: !!accountId,
  });
}

export function useHrProfiles(params?: {
  search?: string;
  status?: string;
  department?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['hr-profiles', params],
    queryFn: () => listHrProfiles(params),
  });
}

export function useConnections() {
  return useQuery({
    queryKey: ['connections'],
    queryFn: listConnections,
  });
}

export function useCreateAwsAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAwsAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aws-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['integration-summary'] });
      toast.success('AWS account created');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Unable to create AWS account.')),
  });
}

export function useUpdateAwsAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AwsAccount> }) => updateAwsAccount(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aws-accounts'] });
      toast.success('AWS account updated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Unable to update AWS account.')),
  });
}

export function useDeleteAwsAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAwsAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aws-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['integration-summary'] });
      toast.success('AWS account deleted');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Unable to delete AWS account.')),
  });
}

export function useCreateFinding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, data }: { accountId: string; data: Partial<AwsFinding> }) =>
      createFinding(accountId, data),
    onSuccess: (_, { accountId }) => {
      queryClient.invalidateQueries({ queryKey: ['aws-findings', accountId] });
      queryClient.invalidateQueries({ queryKey: ['integration-summary'] });
      toast.success('Finding created');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Unable to create finding.')),
  });
}

export function useUpdateFinding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AwsFinding> }) => updateFinding(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aws-findings'] });
      toast.success('Finding updated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Unable to update finding.')),
  });
}

export function useCreateHrProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createHrProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['integration-summary'] });
      toast.success('HR profile created');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Unable to create HR profile.')),
  });
}

export function useUpdateHrProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<HrProfile> }) => updateHrProfile(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-profiles'] });
      toast.success('HR profile updated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Unable to update HR profile.')),
  });
}

export function useImportHrCSV() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rows, hrSource }: { rows: Record<string, string>[]; hrSource?: string }) =>
      importHrCSV(rows, hrSource),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['integration-summary'] });
      toast.success('HR profiles imported');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Unable to import HR profiles.')),
  });
}

export function useDepartEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, endDate }: { id: string; endDate?: string }) => departEmployee(id, endDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-profiles'] });
      toast.success('Employee marked as departed');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Unable to mark employee as departed.')),
  });
}

export function useLinkAwsAccountControls() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, controlIds }: { id: string; controlIds: string[] }) =>
      linkAwsAccountControls(id, controlIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aws-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['integration-evidence'] });
      toast.success('Controls linked to AWS account');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Unable to link controls to AWS account.')),
  });
}

export function useUnlinkAwsAccountControl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, controlId }: { id: string; controlId: string }) =>
      unlinkAwsAccountControl(id, controlId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aws-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['integration-evidence'] });
      toast.success('Control unlinked from AWS account');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Unable to unlink control from AWS account.')),
  });
}

export function useLinkFindingControls() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, controlIds }: { id: string; controlIds: string[] }) =>
      linkFindingControls(id, controlIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aws-findings'] });
      queryClient.invalidateQueries({ queryKey: ['integration-evidence'] });
      toast.success('Controls linked to finding');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Unable to link controls to finding.')),
  });
}

export function useUnlinkFindingControl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, controlId }: { id: string; controlId: string }) =>
      unlinkFindingControl(id, controlId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aws-findings'] });
      queryClient.invalidateQueries({ queryKey: ['integration-evidence'] });
      toast.success('Control unlinked from finding');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Unable to unlink control from finding.')),
  });
}

export function useLinkHrProfileControls() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, controlIds }: { id: string; controlIds: string[] }) =>
      linkHrProfileControls(id, controlIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['integration-evidence'] });
      toast.success('Controls linked to HR profile');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Unable to link controls to HR profile.')),
  });
}

export function useUnlinkHrProfileControl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, controlId }: { id: string; controlId: string }) =>
      unlinkHrProfileControl(id, controlId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['integration-evidence'] });
      toast.success('Control unlinked from HR profile');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Unable to unlink control from HR profile.')),
  });
}

export function useUpsertConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: upsertConnection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      toast.success('Connection saved');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Unable to save connection.')),
  });
}
