import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from './axios';
import { getApiErrorMessage } from '@/lib/apiError';
import type { Evidence } from '@/types/models';
import type { UpdateEvidenceInput, ReviewEvidenceInput } from '@/schemas/evidence';

type ApiResponse<T> = { success: boolean; data: T; error: string | null };
type Pagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

function invalidateComplianceViews(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  queryClient.invalidateQueries({ queryKey: ['frameworks'] });
  queryClient.invalidateQueries({ queryKey: ['readiness'] });
  queryClient.invalidateQueries({ queryKey: ['controls', 'readiness'] });
}

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

export type EvidenceListItem = Omit<Evidence, 'uploadedBy' | 'reviewedBy' | 'linkedControlIds'> & {
  uploadedBy?: { _id: string; firstName: string; lastName: string; email: string };
  reviewedBy?: { _id: string; firstName: string; lastName: string; email: string };
  evidenceUploadedAt?: string | null;
  linkedControlIds?: Array<{
    _id: string;
    identifier?: string;
    title?: string;
    linkedRequirements?: Array<{ frameworkId?: { code?: string; name?: string } }>;
  }>;
};

export type EvidenceListParams = {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  controlId?: string;
  uploadedBy?: string;
  frameworkId?: string;
  tab?: 'all' | 'owned' | 'needs_document' | 'draft';
  overallStatus?: 'OK' | 'DUE_SOON' | 'OVERDUE' | 'NEEDS_REMEDIATION';
  expiring?: 'true' | 'false';
  expired?: 'true' | 'false';
  validUntilFrom?: string;
  validUntilTo?: string;
  search?: string;
  sortBy?: 'title' | 'createdAt' | 'validUntil' | 'status' | 'sizeBytes';
  sortOrder?: 'asc' | 'desc';
};

export type EvidenceListResponse = {
  evidence: EvidenceListItem[];
  pagination: Pagination;
};

export async function getEvidenceListFn(params?: EvidenceListParams): Promise<EvidenceListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page != null) searchParams.set('page', String(params.page));
  if (params?.limit != null) searchParams.set('limit', String(params.limit));
  if (params?.status) searchParams.set('status', params.status);
  if (params?.category) searchParams.set('category', params.category);
  if (params?.controlId) searchParams.set('controlId', params.controlId);
  if (params?.uploadedBy) searchParams.set('uploadedBy', params.uploadedBy);
  if (params?.frameworkId) searchParams.set('frameworkId', params.frameworkId);
  if (params?.tab && params.tab !== 'all') searchParams.set('tab', params.tab);
  if (params?.overallStatus) searchParams.set('overallStatus', params.overallStatus);
  if (params?.expiring) searchParams.set('expiring', params.expiring);
  if (params?.expired) searchParams.set('expired', params.expired);
  if (params?.validUntilFrom) searchParams.set('validUntilFrom', params.validUntilFrom);
  if (params?.validUntilTo) searchParams.set('validUntilTo', params.validUntilTo);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);
  const query = searchParams.toString() ? `?${searchParams}` : '';

  const { data } = await api.get<ApiResponse<EvidenceListItem[]> & { meta?: Pagination }>(
    `/evidence${query}`
  );
  if (!data.success || !Array.isArray(data.data))
    throw new Error(data.error ?? 'Unable to load evidence.');
  const pagination = data.meta;
  if (!pagination) throw new Error('Invalid evidence response.');
  return { evidence: data.data, pagination };
}

export function useEvidenceList(params?: EvidenceListParams) {
  return useQuery({
    queryKey: ['evidence', params],
    queryFn: () => getEvidenceListFn(params),
  });
}

export type EvidenceStats = {
  total: number;
  byStatus: Record<string, number>;
  expirationBreakdown?: { expired?: number; expiring_soon?: number; valid?: number };
  tabs?: { all: number; owned: number; needs_document: number; draft: number };
};

export async function getEvidenceStatsFn(): Promise<EvidenceStats> {
  return handleApi(
    () => api.get<ApiResponse<EvidenceStats>>('/evidence/stats'),
    'Unable to load evidence stats.'
  );
}

export function useEvidenceStats(enabled = true) {
  return useQuery({
    queryKey: ['evidence', 'stats'],
    queryFn: getEvidenceStatsFn,
    enabled,
  });
}

export type PopulatedLinkedControl = {
  _id: string;
  identifier?: string;
  title?: string;
  category?: string;
  overallStatus?: string;
};

export type EvidenceDetail = Omit<EvidenceListItem, 'linkedControlIds'> & {
  linkedControlIds?: PopulatedLinkedControl[];
  source?: string;
};

function parseFilenameFromContentDisposition(header?: string): string | null {
  if (!header) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      return utf8[1];
    }
  }
  const basic = /filename="([^"]+)"/i.exec(header);
  return basic?.[1] ?? null;
}

/** Stream evidence file through API — avoids exposing storage URLs. */
export async function fetchEvidenceFile(
  evidenceId: string,
  disposition: 'inline' | 'attachment' = 'attachment'
): Promise<{ blob: Blob; fileName: string }> {
  try {
    const response = await api.get(`/evidence/${evidenceId}/file`, {
      responseType: 'blob',
      params: { disposition },
    });
    const fileName =
      parseFilenameFromContentDisposition(
        response.headers['content-disposition'] as string | undefined
      ) || 'document';
    return { blob: response.data as Blob, fileName };
  } catch (err) {
    throw new Error(getApiErrorMessage(err, 'Unable to load file.'));
  }
}

export type CreateCustomDocumentInput = {
  title: string;
  description?: string;
  isSensitive?: boolean;
  recurrence: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUALLY' | 'ANNUALLY' | 'NEVER';
  linkedControlIds?: string[];
};

export async function getEvidenceFn(id: string): Promise<EvidenceDetail> {
  return handleApi(
    () => api.get<ApiResponse<EvidenceDetail>>(`/evidence/${id}`),
    'Unable to load evidence.'
  );
}

export function useEvidence(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ['evidence', id],
    queryFn: () => getEvidenceFn(id!),
    enabled: !!id && enabled,
  });
}

export async function createEvidenceFn(formData: FormData): Promise<EvidenceDetail> {
  try {
    const { data } = await api.post<ApiResponse<EvidenceDetail>>('/evidence', formData);
    if (!data.success || !data.data) throw new Error(data.error ?? 'Upload failed.');
    return data.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err, 'Unable to upload evidence.'));
  }
}

export function useCreateEvidence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createEvidenceFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      invalidateComplianceViews(queryClient);
      toast.success('Evidence uploaded.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function createCustomDocumentFn(
  input: CreateCustomDocumentInput
): Promise<EvidenceDetail> {
  return handleApi(
    () => api.post<ApiResponse<EvidenceDetail>>('/evidence/custom', input),
    'Unable to create custom document.'
  );
}

export function useCreateCustomDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCustomDocumentFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      invalidateComplianceViews(queryClient);
      toast.success('Custom document created.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function updateEvidenceFn(id: string, input: UpdateEvidenceInput): Promise<EvidenceDetail> {
  return handleApi(
    () => api.patch<ApiResponse<EvidenceDetail>>(`/evidence/${id}`, input),
    'Unable to update evidence.'
  );
}

export function useUpdateEvidence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateEvidenceInput }) =>
      updateEvidenceFn(id, input),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      queryClient.invalidateQueries({ queryKey: ['evidence', id] });
      invalidateComplianceViews(queryClient);
      toast.success('Evidence details updated.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function reviewEvidenceFn(id: string, input: ReviewEvidenceInput): Promise<EvidenceDetail> {
  return handleApi(
    () => api.post<ApiResponse<EvidenceDetail>>(`/evidence/${id}/review`, input),
    'Unable to review evidence.'
  );
}

export function useReviewEvidence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReviewEvidenceInput }) =>
      reviewEvidenceFn(id, input),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      queryClient.invalidateQueries({ queryKey: ['evidence', id] });
      queryClient.invalidateQueries({ queryKey: ['controls'] });
      invalidateComplianceViews(queryClient);
      toast.success('Evidence review recorded.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function archiveEvidenceFn(id: string): Promise<EvidenceDetail> {
  return handleApi(
    () => api.post<ApiResponse<EvidenceDetail>>(`/evidence/${id}/archive`),
    'Unable to archive evidence.'
  );
}

export async function unarchiveEvidenceFn(id: string): Promise<EvidenceDetail> {
  return handleApi(
    () => api.post<ApiResponse<EvidenceDetail>>(`/evidence/${id}/unarchive`),
    'Unable to unarchive evidence.'
  );
}

export function useArchiveEvidence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveEvidenceFn,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      queryClient.invalidateQueries({ queryKey: ['evidence', id] });
      invalidateComplianceViews(queryClient);
      toast.success('Evidence archived.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useUnarchiveEvidence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unarchiveEvidenceFn,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      queryClient.invalidateQueries({ queryKey: ['evidence', id] });
      invalidateComplianceViews(queryClient);
      toast.success('Evidence restored from archive.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useLinkControls(options?: { showSuccessToast?: boolean }) {
  const showSuccessToast = options?.showSuccessToast !== false;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, controlIds }: { id: string; controlIds: string[] }) =>
      handleApi(
        () => api.post<ApiResponse<EvidenceDetail>>(`/evidence/${id}/controls`, { controlIds }),
        'Unable to link controls.'
      ),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      queryClient.invalidateQueries({ queryKey: ['evidence', id] });
      queryClient.invalidateQueries({ queryKey: ['controls'] });
      invalidateComplianceViews(queryClient);
      if (showSuccessToast) toast.success('Controls linked to evidence.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useDeleteEvidence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      handleApi(
        () => api.delete<ApiResponse<{ deleted: boolean }>>(`/evidence/${id}`),
        'Unable to delete evidence.'
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      invalidateComplianceViews(queryClient);
      toast.success('Evidence deleted.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useExpiringEvidence(days = 30) {
  return useQuery({
    queryKey: ['evidence', 'expiring', days],
    queryFn: () =>
      handleApi(
        () => api.get<ApiResponse<EvidenceListItem[]>>(`/evidence/expiring?days=${days}`),
        'Unable to load expiring evidence.'
      ),
  });
}

// =============================================================================
// Evidence versions (Vanta-style: draft -> submit -> active; renew = new draft)
// =============================================================================

export type EvidenceVersionStatus = 'draft' | 'active' | 'expired';

export type EvidenceVersionFile = {
  _id: string;
  versionId: string;
  fileName: string;
  fileUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
  addedBy?: { _id: string; firstName: string; lastName: string; email?: string };
  validUntil?: string | null;
  createdAt?: string;
};

export type EvidenceVersionWithFiles = {
  _id: string;
  evidenceId: string;
  organizationId: string;
  status: EvidenceVersionStatus;
  submittedAt?: string | null;
  submittedBy?: { _id: string; firstName: string; lastName: string; email?: string } | null;
  completedAt?: string | null;
  completedBy?: { _id: string; firstName: string; lastName: string; email?: string } | null;
  validUntil?: string | null;
  createdAt: string;
  updatedAt: string;
  files: EvidenceVersionFile[];
};

export async function getEvidenceVersionsFn(evidenceId: string): Promise<EvidenceVersionWithFiles[]> {
  return handleApi(
    () => api.get<ApiResponse<EvidenceVersionWithFiles[]>>(`/evidence/${evidenceId}/versions`),
    'Unable to load versions.'
  );
}

export function useEvidenceVersions(evidenceId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['evidence', evidenceId, 'versions'],
    queryFn: () => getEvidenceVersionsFn(evidenceId!),
    enabled: !!evidenceId && enabled,
  });
}

export type EvidenceVersionDraft = {
  _id: string;
  evidenceId: string;
  status: string;
  createdAt: string;
};

export async function createDraftVersionFn(evidenceId: string): Promise<EvidenceVersionDraft> {
  return handleApi(
    () => api.post<ApiResponse<EvidenceVersionDraft>>(`/evidence/${evidenceId}/versions`),
    'Unable to create draft.'
  );
}

export function useCreateDraftVersion(evidenceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => createDraftVersionFn(evidenceId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence', evidenceId, 'versions'] });
      queryClient.invalidateQueries({ queryKey: ['evidence', evidenceId] });
      toast.success('Evidence draft created.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function createNewDraftVersionFn(evidenceId: string): Promise<EvidenceVersionDraft> {
  return handleApi(
    () => api.post<ApiResponse<EvidenceVersionDraft>>(`/evidence/${evidenceId}/versions/new-draft`),
    'Unable to create new draft.'
  );
}

export function useCreateNewDraftVersion(evidenceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => createNewDraftVersionFn(evidenceId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence', evidenceId, 'versions'] });
      queryClient.invalidateQueries({ queryKey: ['evidence', evidenceId] });
      toast.success('New evidence draft started.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function addFileToVersionFn(
  evidenceId: string,
  versionId: string,
  file: File
): Promise<EvidenceVersionFile> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<ApiResponse<EvidenceVersionFile>>(
    `/evidence/${evidenceId}/versions/${versionId}/files`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  if (!data.success || !data.data) throw new Error(data.error ?? 'Unable to add file.');
  return data.data;
}

export function useAddFileToVersion(evidenceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ versionId, file }: { versionId: string; file: File }) =>
      addFileToVersionFn(evidenceId!, versionId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence', evidenceId, 'versions'] });
      queryClient.invalidateQueries({ queryKey: ['evidence', evidenceId] });
      toast.success('File added to evidence draft.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function removeFileFromVersionFn(
  evidenceId: string,
  versionId: string,
  fileId: string
): Promise<{ deleted: boolean }> {
  return handleApi(
    () =>
      api.delete<ApiResponse<{ deleted: boolean }>>(
        `/evidence/${evidenceId}/versions/${versionId}/files/${fileId}`
      ),
    'Unable to remove file.'
  );
}

export function useRemoveFileFromVersion(evidenceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ versionId, fileId }: { versionId: string; fileId: string }) =>
      removeFileFromVersionFn(evidenceId!, versionId, fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence', evidenceId, 'versions'] });
      queryClient.invalidateQueries({ queryKey: ['evidence', evidenceId] });
      toast.success('File removed from evidence draft.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function submitVersionFn(
  evidenceId: string,
  versionId: string
): Promise<EvidenceVersionWithFiles> {
  return handleApi(
    () =>
      api.post<ApiResponse<EvidenceVersionWithFiles>>(
        `/evidence/${evidenceId}/versions/${versionId}/submit`
      ),
    'Unable to submit version.'
  );
}

export function useSubmitVersion(evidenceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) => submitVersionFn(evidenceId!, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence', evidenceId, 'versions'] });
      queryClient.invalidateQueries({ queryKey: ['evidence', evidenceId] });
      invalidateComplianceViews(queryClient);
      toast.success('Evidence submitted for review.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

// Comments (match policies/:id comments API shape)
export type EvidenceComment = {
  _id: string;
  content: string;
  userId?: { _id: string; firstName: string; lastName: string; email?: string };
  createdAt: string;
};

export async function getEvidenceCommentsFn(
  evidenceId: string,
  params?: { page?: number }
): Promise<{ comments: EvidenceComment[] }> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  const qs = searchParams.toString();
  const query = qs ? `?${qs}` : '';
  const { data } = await api.get<ApiResponse<EvidenceComment[]> & { meta?: unknown }>(
    `/evidence/${evidenceId}/comments${query}`
  );
  if (!data.success || !Array.isArray(data.data))
    throw new Error(data.error ?? 'Unable to load comments.');
  return { comments: data.data };
}

export function useEvidenceComments(evidenceId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['evidence', evidenceId, 'comments'],
    queryFn: () => getEvidenceCommentsFn(evidenceId!),
    enabled: !!evidenceId && enabled,
  });
}

export async function createEvidenceCommentFn(
  evidenceId: string,
  content: string
): Promise<EvidenceComment> {
  return handleApi(
    () =>
      api.post<ApiResponse<EvidenceComment>>(`/evidence/${evidenceId}/comments`, {
        content,
      }),
    'Unable to add comment.'
  );
}

export function useCreateEvidenceComment(evidenceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      createEvidenceCommentFn(evidenceId!, content),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['evidence', evidenceId, 'comments'],
      });
      toast.success('Evidence comment added.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}
