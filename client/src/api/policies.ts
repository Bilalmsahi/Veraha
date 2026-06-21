import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from './axios';
import { getApiErrorMessage } from '@/lib/apiError';
import type { Policy, PolicyVersion, PolicyAttestation } from '@/types/models';
import type { TestStatus } from '@/types/enums';

type ApiResponse<T> = { success: boolean; data: T; error: string | null };
type Pagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

async function handleApi<T>(
  fn: () => Promise<{ data: ApiResponse<T> }>,
  fallback: string
): Promise<T> {
  try {
    const { data } = await fn();
    if (!data.success || data.data == null) throw new Error(data.error ?? fallback);
    return data.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err, fallback));
  }
}

export type PolicyListItem = Omit<Policy, 'ownerId' | 'currentVersionId'> & {
  ownerId?: { _id: string; firstName: string; lastName: string; email: string };
  approverIds?: Array<{ _id: string; firstName: string; lastName: string; email: string }>;
  approver?: { _id: string; firstName: string; lastName: string; email: string };
  currentVersionId?: (PolicyVersion & { fileUrl?: string }) | string | null;
  renewBy?: string;
  latestVersion?: { status: string; versionNumber: number | null };
  personnel?: string | null;
};

export type PolicyListParams = {
  page?: number;
  limit?: number;
  tab?: 'all' | 'needs_my_approval' | 'needs_approval' | 'needs_reassignment';
  status?: string;
  latestVersion?: 'APPROVED' | 'DRAFT' | 'NOT_STARTED';
  category?: string;
  frameworkId?: string;
  source?: string;
  approverId?: string;
  search?: string;
  sortBy?: 'title' | 'createdAt' | 'updatedAt' | 'status' | 'nextReviewDue';
  sortOrder?: 'asc' | 'desc';
};

export type PolicyListResponse = {
  policies: PolicyListItem[];
  pagination: Pagination;
};

export async function getPoliciesFn(params?: PolicyListParams): Promise<PolicyListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page != null) searchParams.set('page', String(params.page));
  if (params?.limit != null) searchParams.set('limit', String(params.limit));
  if (params?.tab) searchParams.set('tab', params.tab);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.latestVersion) searchParams.set('latestVersion', params.latestVersion as string);
  if (params?.category) searchParams.set('category', params.category);
  if (params?.frameworkId) searchParams.set('frameworkId', params.frameworkId);
  if (params?.source) searchParams.set('source', params.source);
  if (params?.approverId) searchParams.set('approverId', params.approverId);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);
  const query = searchParams.toString() ? `?${searchParams}` : '';

  const { data } = await api.get<ApiResponse<PolicyListItem[]> & { meta?: Pagination }>(
    `/policies${query}`
  );
  if (!data.success || !Array.isArray(data.data))
    throw new Error(data.error ?? 'Unable to load policies.');
  const pagination = data.meta;
  if (!pagination) throw new Error('Invalid policies response.');
  return { policies: data.data, pagination };
}

export function usePolicies(params?: PolicyListParams) {
  return useQuery({
    queryKey: ['policies', params],
    queryFn: () => getPoliciesFn(params),
  });
}

export type PolicyDetail = PolicyListItem & {
  frameworkIds?: Array<{ _id?: string; code?: string; name?: string } | string>;
  versions?: (PolicyVersion & { fileUrl?: string })[];
  policyTests?: {
    approvalTests: Array<{ _id: string; name: string; status: TestStatus }>;
    attestationTests: Array<{ _id: string; name: string; status: TestStatus }>;
  };
  acknowledgementProgress?: {
    required: number;
    attested: number;
    pending: number;
    percent: number;
  };
};

export type PolicyContentDocumentUrl = {
  url: string;
  filename: string;
  mimeType: string;
  sourceType: 'VERSION_FILE' | 'TEMPLATE_FILE' | 'EDITOR_HTML';
  direct: boolean;
};

export async function getPolicyFn(id: string): Promise<PolicyDetail> {
  return handleApi(
    () => api.get<ApiResponse<PolicyDetail>>(`/policies/${id}`),
    'Unable to load policy.'
  );
}

export function usePolicy(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ['policies', id],
    queryFn: () => getPolicyFn(id!),
    enabled: !!id && enabled,
  });
}

export type PolicyStats = {
  total: number;
  byStatus: Record<string, number>;
  overdueReview?: number;
  overdueCount?: number;
  tabs?: {
    all: number;
    needs_my_approval?: number;
    needs_approval: number;
    needs_reassignment: number;
  };
};

export async function getPolicyStatsFn(): Promise<PolicyStats> {
  return handleApi(
    () => api.get<ApiResponse<PolicyStats>>('/policies/stats'),
    'Unable to load policy stats.'
  );
}

export function usePolicyStats(enabled = true) {
  return useQuery({
    queryKey: ['policies', 'stats'],
    queryFn: getPolicyStatsFn,
    enabled,
  });
}

export type CreatePolicyInput = {
  title: string;
  description?: string;
  category?: string;
  reviewFrequency?: string;
  requiresAttestation?: boolean;
};

export type UpdatePolicyInput = {
  title?: string;
  description?: string;
  category?: string;
  approverIds?: string[];
  assignmentScope?: 'ALL_PERSONNEL' | 'SPECIFIC_GROUPS' | 'SPECIFIC_USERS' | 'SPECIFIC_ROLES';
  assignmentGroupIds?: string[];
  assignmentUserIds?: string[];
  targetUserIds?: string[];
  targetRoles?: Array<'ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'AUDITOR'>;
  reviewFrequency?: string;
  requiresAttestation?: boolean;
  ownerId?: string | null;
  linkedControlIds?: string[];
};

export type CreateVersionInput = {
  changelog?: string;
  effectiveDate?: string;
};


export type PolicyComment = {
  _id: string;
  content: string;
  userId: { _id: string; firstName: string; lastName: string; email: string };
  createdAt: string;
};

export async function getPolicyCommentsFn(
  policyId: string,
  params?: { page?: number }
): Promise<{ comments: PolicyComment[] }> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  const query = searchParams.toString() ? `?${searchParams}` : '';
  const { data } = await api.get<ApiResponse<PolicyComment[]> & { meta?: unknown }>(
    `/policies/${policyId}/comments${query}`
  );
  if (!data.success || !Array.isArray(data.data))
    throw new Error(data.error ?? 'Unable to load comments.');
  return { comments: data.data };
}

export function usePolicyComments(policyId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['policies', policyId, 'comments'],
    queryFn: () => getPolicyCommentsFn(policyId!),
    enabled: !!policyId && enabled,
  });
}

export async function createPolicyCommentFn(
  policyId: string,
  content: string
): Promise<PolicyComment> {
  return handleApi(
    () =>
      api.post<ApiResponse<PolicyComment>>(`/policies/${policyId}/comments`, {
        content,
      }),
    'Unable to add comment.'
  );
}

export function useCreatePolicyComment(policyId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      createPolicyCommentFn(policyId!, content),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['policies', policyId, 'comments'],
      });
      toast.success('Comment added');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export type PendingAttestationItem = {
  _id: string;
  title: string;
  category?: string;
  versionNumber?: number;
};

export type PolicyTargetUser = {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
};

export async function createPolicyFn(input: CreatePolicyInput): Promise<PolicyDetail> {
  return handleApi(
    () => api.post<ApiResponse<PolicyDetail>>('/policies', input),
    'Unable to create policy.'
  );
}

export function useCreatePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPolicyFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      toast.success('Policy created');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export type AttestationWithUser = PolicyAttestation & {
  userId?: { _id: string; firstName: string; lastName: string; email: string };
};

export type AttestationsResponse = {
  attestations: AttestationWithUser[];
  pagination: Pagination;
};

export type AttestationsResult = {
  policyTitle?: string;
  versionNumber?: number | null;
  attestations: AttestationWithUser[];
  pagination: Pagination;
};

export async function getAttestationsFn(
  policyId: string,
  params?: { page?: number; limit?: number }
): Promise<AttestationsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  const query = searchParams.toString() ? `?${searchParams}` : '';

  const result = await handleApi(
    () => api.get<ApiResponse<AttestationsResult>>(`/policies/${policyId}/attestations${query}`),
    'Unable to load attestations.'
  );
  return {
    attestations: result.attestations ?? [],
    pagination: result.pagination ?? { page: 1, limit: 20, total: 0, pages: 0, hasNextPage: false, hasPrevPage: false },
  };
}

export function useAttestations(policyId: string | null, params?: { page?: number }) {
  return useQuery({
    queryKey: ['policies', policyId, 'attestations', params?.page],
    queryFn: () => getAttestationsFn(policyId!, params),
    enabled: !!policyId,
  });
}

/** Download attestations as CSV (acceptance history) for a policy */
export async function downloadAcceptanceHistoryFn(
  policyId: string,
  policyTitle: string
): Promise<void> {
  const { attestations } = await getAttestationsFn(policyId, {
    page: 1,
    limit: 100,
  });
  const headers = ['Name', 'Email', 'Attested at'];
  const rows = attestations.map((a) => {
    const name = a.userId
      ? `${a.userId.firstName ?? ''} ${a.userId.lastName ?? ''}`.trim()
      : '—';
    const email = a.userId?.email ?? '—';
    const date = a.attestedAt ? new Date(a.attestedAt).toISOString() : '—';
    return [name, email, date];
  });
  const csv = [
    headers.join(','),
    ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `policy-acceptance-history-${policyTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function updatePolicyFn(id: string, input: UpdatePolicyInput): Promise<PolicyDetail> {
  return handleApi(
    () => api.patch<ApiResponse<PolicyDetail>>(`/policies/${id}`, input),
    'Unable to update policy.'
  );
}

export function useUpdatePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePolicyInput }) =>
      updatePolicyFn(id, input),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['policies', id] });
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      toast.success('Policy updated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function archivePolicy(id: string) {
  return api.post(`/policies/${id}/archive-workflow`);
}

export async function archivePolicyFn(id: string): Promise<PolicyDetail> {
  return handleApi(
    () => api.post<ApiResponse<PolicyDetail>>(`/policies/${id}/archive-workflow`),
    'Unable to archive policy.'
  );
}

export function useArchivePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archivePolicyFn(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['policies', id] });
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      toast.success('Policy archived');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function unarchivePolicyFn(id: string): Promise<PolicyDetail> {
  return handleApi(
    () => api.post<ApiResponse<PolicyDetail>>(`/policies/${id}/unarchive`),
    'Unable to unarchive policy.'
  );
}

export function useUnarchivePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unarchivePolicyFn(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['policies', id] });
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      toast.success('Policy unarchived');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function deletePolicyFn(id: string): Promise<{ deleted: boolean }> {
  return handleApi(
    () => api.delete<ApiResponse<{ deleted: boolean }>>(`/policies/${id}`),
    'Unable to delete policy.'
  );
}

export function useDeletePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePolicyFn(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['policies', id] });
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      toast.success('Policy deleted');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function createVersionFn(
  policyId: string,
  formData: FormData
): Promise<PolicyDetail> {
  try {
    const { data } = await api.post<ApiResponse<PolicyDetail>>(
      `/policies/${policyId}/versions`,
      formData
    );
    if (!data.success || !data.data) throw new Error(data.error ?? 'Unable to create version.');
    return data.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err, 'Unable to create version.'));
  }
}

export function useCreateVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ policyId, formData }: { policyId: string; formData: FormData }) =>
      createVersionFn(policyId, formData),
    onSuccess: (_, { policyId }) => {
      queryClient.invalidateQueries({ queryKey: ['policies', policyId] });
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      toast.success('Version created');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function getOrCreateEditorDraftFn(policyId: string): Promise<PolicyVersion> {
  try {
    const { data } = await api.post<ApiResponse<PolicyVersion>>(
      `/policies/${policyId}/editor-draft`,
      {}
    );
    if (!data.success || data.data == null) {
      throw new Error(data.error ?? 'Unable to create editor draft.');
    }
    return data.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err, 'Unable to create editor draft.'));
  }
}

export function useCreateEditorDraft() {
  return useMutation({
    mutationFn: (policyId: string) => getOrCreateEditorDraftFn(policyId),
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useEditorDraft(policyId: string | null) {
  return useQuery({
    queryKey: ['policies', policyId, 'editor-draft'],
    queryFn: () => getOrCreateEditorDraftFn(policyId!),
    enabled: !!policyId,
    retry: false,
  });
}

export async function resetEditorDraftFn(policyId: string): Promise<PolicyVersion> {
  return handleApi(
    () => api.post<ApiResponse<PolicyVersion>>(`/policies/${policyId}/editor-draft/reset`, {}),
    'Unable to reset editor draft.'
  );
}

export function useResetEditorDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (policyId: string) => resetEditorDraftFn(policyId),
    onSuccess: (_, policyId) => {
      queryClient.invalidateQueries({ queryKey: ['policies', policyId, 'editor-draft'] });
      queryClient.invalidateQueries({ queryKey: ['policies', policyId] });
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      toast.success('Editor draft reset');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function getPolicyContentDocumentUrlFn(
  policyId: string,
  versionId?: string
): Promise<PolicyContentDocumentUrl> {
  const searchParams = new URLSearchParams();
  if (versionId) searchParams.set('versionId', versionId);
  const query = searchParams.toString() ? `?${searchParams}` : '';
  return handleApi(
    () => api.get<ApiResponse<PolicyContentDocumentUrl>>(`/policies/${policyId}/content-document-url${query}`),
    'Unable to open policy document.'
  );
}

export async function openPolicyContentDocument(policyId: string, versionId?: string): Promise<void> {
  const openedWindow = window.open('about:blank', '_blank');
  if (openedWindow) {
    openedWindow.opener = null;
  }

  try {
    const result = await getPolicyContentDocumentUrlFn(policyId, versionId);
    const baseUrl =
      api.defaults.baseURL ||
      `${window.location.origin.replace(/\/$/, '')}/api/v1`;
    const url = result.direct
      ? result.url
      : new URL(result.url.replace(/^\//, ''), `${baseUrl.replace(/\/?$/, '/')}`).toString();

    if (openedWindow) {
      openedWindow.location.href = url;
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  } catch (err) {
    openedWindow?.close();
    throw err;
  }
}

export async function importPolicyContentDocumentFn(
  policyId: string,
  input?: { versionId?: string; force?: boolean }
): Promise<PolicyVersion> {
  return handleApi(
    () => api.post<ApiResponse<PolicyVersion>>(`/policies/${policyId}/editor-draft/import-source`, input ?? {}),
    'Unable to import policy document into the editor.'
  );
}

export function useImportPolicyContentDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ policyId, input }: { policyId: string; input?: { versionId?: string; force?: boolean } }) =>
      importPolicyContentDocumentFn(policyId, input),
    onSuccess: (_, { policyId }) => {
      queryClient.invalidateQueries({ queryKey: ['policies', policyId, 'editor-draft'] });
      queryClient.invalidateQueries({ queryKey: ['policies', policyId] });
      queryClient.invalidateQueries({ queryKey: ['policies'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function updatePolicyVersionContentFn(
  policyId: string,
  versionId: string,
  contentHtml: string
): Promise<PolicyVersion> {
  return handleApi(
    () =>
      api.patch<ApiResponse<PolicyVersion>>(`/policies/${policyId}/versions/${versionId}`, {
        contentHtml,
      }),
    'Unable to save policy content.'
  );
}

export function useUpdatePolicyVersionContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      policyId,
      versionId,
      contentHtml,
    }: {
      policyId: string;
      versionId: string;
      contentHtml: string;
    }) => updatePolicyVersionContentFn(policyId, versionId, contentHtml),
    onSuccess: (_, { policyId }) => {
      queryClient.invalidateQueries({ queryKey: ['policies', policyId] });
      queryClient.invalidateQueries({ queryKey: ['policies'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function updateVersionFn(
  policyId: string,
  versionId: string,
  input: { changelog?: string; effectiveDate?: string }
): Promise<PolicyDetail> {
  return handleApi(
    () =>
      api.patch<ApiResponse<PolicyDetail>>(`/policies/${policyId}/versions/${versionId}`, input),
    'Unable to update version.'
  );
}

export function useUpdateVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      policyId,
      versionId,
      input,
    }: {
      policyId: string;
      versionId: string;
      input: { changelog?: string; effectiveDate?: string };
    }) => updateVersionFn(policyId, versionId, input),
    onSuccess: (_, { policyId }) => {
      queryClient.invalidateQueries({ queryKey: ['policies', policyId] });
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      toast.success('Version updated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

// =============================================================================
// WORKFLOW (Phase 5) — new endpoints + query keys
// =============================================================================

export type PublishRecipientInput =
  | { recipientType: 'ALL_PERSONNEL'; userIds?: never; groupIds?: never }
  | { recipientType: 'SPECIFIC_USERS'; userIds: string[]; groupIds?: never }
  | { recipientType: 'SPECIFIC_GROUPS'; groupIds: string[]; userIds?: never };

export async function publishPolicyWorkflowFn(
  policyId: string,
  policyVersionId: string,
  recipients: PublishRecipientInput = { recipientType: 'ALL_PERSONNEL' }
) {
  return handleApi(
    () =>
      api.post<ApiResponse<{ policyId: string; status: string }>>(
        `/policies/${policyId}/publish`,
        { policyVersionId, ...recipients }
      ),
    'Unable to publish policy workflow.'
  );
}

export function usePublishPolicyWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      policyId,
      policyVersionId,
      recipients,
    }: {
      policyId: string;
      policyVersionId: string;
      recipients?: PublishRecipientInput;
    }) => publishPolicyWorkflowFn(policyId, policyVersionId, recipients),
    onSuccess: (_, { policyId }) => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      queryClient.invalidateQueries({ queryKey: ['policies', policyId] });
      queryClient.invalidateQueries({ queryKey: ['policy-target-users', policyId] });
      queryClient.invalidateQueries({ queryKey: ['policies', policyId, 'workflow'] });
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      queryClient.invalidateQueries({ queryKey: ['controls'] });
      queryClient.invalidateQueries({ queryKey: ['readiness'] });
      queryClient.invalidateQueries({ queryKey: ['frameworks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Policy published');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function submitPolicyForApprovalFn(policyId: string, policyVersionId: string, approverId: string) {
  return handleApi(
    () => api.post<ApiResponse<unknown>>(`/policies/${policyId}/submit-for-approval`, { policyVersionId, approverId }),
    'Unable to submit for approval.'
  );
}

export function useSubmitPolicyForApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ policyId, policyVersionId, approverId }: { policyId: string; policyVersionId: string; approverId: string }) =>
      submitPolicyForApprovalFn(policyId, policyVersionId, approverId),
    onSuccess: (_, { policyId }) => {
      queryClient.invalidateQueries({ queryKey: ['policies', policyId] });
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      toast.success('Submitted for approval');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function approvePolicyVersionFn(policyId: string, versionId: string) {
  return handleApi(
    () => api.post<ApiResponse<{ policyId: string; policyVersionId: string; status: string }>>(`/policies/${policyId}/versions/${versionId}/approve`, {}),
    'Unable to approve policy.'
  );
}

export function useApprovePolicyVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ policyId, versionId }: { policyId: string; versionId: string }) =>
      approvePolicyVersionFn(policyId, versionId),
    onSuccess: (_, { policyId }) => {
      queryClient.invalidateQueries({ queryKey: ['policies', policyId] });
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      queryClient.invalidateQueries({ queryKey: ['controls'] });
      queryClient.invalidateQueries({ queryKey: ['readiness'] });
      queryClient.invalidateQueries({ queryKey: ['frameworks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Policy approved');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function rejectPolicyVersionFn(policyId: string, versionId: string, reason?: string) {
  return handleApi(
    () => api.post<ApiResponse<{ policyId: string; policyVersionId: string; status: string }>>(`/policies/${policyId}/versions/${versionId}/reject`, { reason }),
    'Unable to reject policy.'
  );
}

export function useRejectPolicyVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ policyId, versionId, reason }: { policyId: string; versionId: string; reason?: string }) =>
      rejectPolicyVersionFn(policyId, versionId, reason),
    onSuccess: (_, { policyId }) => {
      queryClient.invalidateQueries({ queryKey: ['policies', policyId] });
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      toast.success('Policy rejected');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function cancelPolicyApprovalFn(policyId: string, versionId: string) {
  return handleApi(
    () =>
      api.post<ApiResponse<{ policyId: string; policyVersionId: string; status: string }>>(
        `/policies/${policyId}/versions/${versionId}/cancel-approval`,
        {}
      ),
    'Unable to cancel approval submission.'
  );
}

export function useCancelPolicyApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ policyId, versionId }: { policyId: string; versionId: string }) =>
      cancelPolicyApprovalFn(policyId, versionId),
    onSuccess: (_, { policyId }) => {
      queryClient.invalidateQueries({ queryKey: ['policies', policyId] });
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      toast.success('Submission cancelled');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function acknowledgePolicy(policyId: string) {
  return api.post(`/policies/${policyId}/acknowledge-workflow`);
}

export async function acknowledgePolicyWorkflowFn(policyId: string) {
  return handleApi(
    () =>
      api.post<ApiResponse<unknown>>(`/policies/${policyId}/acknowledge-workflow`, {
        signatureText: 'Acknowledged',
      }),
    'Unable to acknowledge policy.'
  );
}

export function useAcknowledgePolicyWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (policyId: string) => acknowledgePolicyWorkflowFn(policyId),
    onSuccess: (_, policyId) => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      queryClient.invalidateQueries({ queryKey: ['policies', policyId] });
      queryClient.invalidateQueries({ queryKey: ['policies', policyId, 'attestations'] });
      queryClient.invalidateQueries({ queryKey: ['policies', policyId, 'workflow'] });
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      queryClient.invalidateQueries({ queryKey: ['controls'] });
      queryClient.invalidateQueries({ queryKey: ['readiness'] });
      queryClient.invalidateQueries({ queryKey: ['frameworks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Acknowledged');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function getPendingAttestationsFn(): Promise<PendingAttestationItem[]> {
  return handleApi(
    () =>
      api.get<ApiResponse<PendingAttestationItem[]>>('/policies/pending-attestations'),
    'Unable to load pending attestations.'
  );
}

export function usePendingAttestations(enabled = true) {
  return useQuery({
    queryKey: ['policies', 'pending-attestations'],
    queryFn: getPendingAttestationsFn,
    enabled,
  });
}

export async function getPolicyTargetUsersFn(policyId: string): Promise<PolicyTargetUser[]> {
  return handleApi(
    () => api.get<ApiResponse<PolicyTargetUser[]>>(`/policies/${policyId}/target-users`),
    'Unable to load policy target users.'
  );
}

export function usePolicyTargetUsers(policyId: string | null, enabled = true) {
  return useQuery<PolicyTargetUser[]>({
    queryKey: ['policy-target-users', policyId],
    queryFn: () => getPolicyTargetUsersFn(policyId!),
    enabled: !!policyId && enabled,
  });
}
