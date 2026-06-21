import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from './axios';
import { getApiErrorMessage } from '@/lib/apiError';
import type { ApiPaginationMeta, ComplianceTest, TestStats } from '@/types/models';
import type { UpdateTestFormInput } from '@/schemas/test';
import {
  addFileToVersionFn,
  createNewDraftVersionFn,
  removeFileFromVersionFn,
  submitVersionFn,
  type EvidenceVersionWithFiles,
  type EvidenceVersionFile,
} from './evidence';

type ApiResponse<T> = { success: boolean; data: T; error: string | null };

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

export type TestListItem = ComplianceTest;

export type TestListParams = {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  type?: 'document' | 'automated';
  status?: string;
  rollout?: string;
  ownerId?: string;
  frameworkId?: string;
  controlId?: string;
  integration?: string;
  showInactive?: boolean;
  sortBy?: 'name' | 'dueDate' | 'status' | 'createdAt' | 'lastPassedAt';
  sortOrder?: 'asc' | 'desc';
};

export type TestListResponse = {
  tests: TestListItem[];
  pagination: ApiPaginationMeta;
};

export async function getTestsFn(params?: TestListParams): Promise<TestListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page != null) searchParams.set('page', String(params.page));
  if (params?.limit != null) searchParams.set('limit', String(params.limit));
  if (params?.search) searchParams.set('search', params.search);
  if (params?.category) searchParams.set('category', params.category);
  if (params?.type) searchParams.set('type', params.type);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.rollout) searchParams.set('rollout', params.rollout);
  if (params?.ownerId) searchParams.set('ownerId', params.ownerId);
  if (params?.frameworkId) searchParams.set('frameworkId', params.frameworkId);
  if (params?.controlId) searchParams.set('controlId', params.controlId);
  if (params?.integration) searchParams.set('integration', params.integration);
  if (params?.showInactive) searchParams.set('showInactive', 'true');
  if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);
  const query = searchParams.toString() ? `?${searchParams}` : '';

  const { data } = await api.get<ApiResponse<TestListItem[]> & { meta?: ApiPaginationMeta }>(
    `/tests${query}`
  );
  if (!data.success || !Array.isArray(data.data))
    throw new Error(data.error ?? 'Unable to load tests.');
  const pagination = data.meta;
  if (!pagination) throw new Error('Invalid tests response.');
  return { tests: data.data, pagination };
}

export function useTests(params?: TestListParams, enabled = true) {
  return useQuery({
    queryKey: ['tests', params],
    queryFn: () => getTestsFn(params!),
    enabled: enabled && params != null,
  });
}

export async function getTestStatsFn(): Promise<TestStats> {
  return handleApi(() => api.get<ApiResponse<TestStats>>('/tests/stats'), 'Unable to load test stats.');
}

export function useTestStats(enabled = true) {
  return useQuery({
    queryKey: ['tests', 'stats'],
    queryFn: getTestStatsFn,
    enabled,
  });
}

export async function getTestFn(id: string): Promise<TestListItem> {
  return handleApi(() => api.get<ApiResponse<TestListItem>>(`/tests/${id}`), 'Unable to load test.');
}

export function useTest(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ['tests', id],
    queryFn: () => getTestFn(id!),
    enabled: !!id && enabled,
  });
}

export async function updateTestFn(id: string, input: UpdateTestFormInput): Promise<TestListItem> {
  const body: Record<string, unknown> = { ...input };
  if (body.dueDate === '') body.dueDate = null;
  return handleApi(
    () => api.patch<ApiResponse<TestListItem>>(`/tests/${id}`, body),
    'Unable to update test.'
  );
}

function normalizeLinkedControlIds(
  raw: ComplianceTest['linkedControlIds'] | undefined
): string[] {
  if (!raw?.length) return [];
  return raw
    .map((x) => (typeof x === 'string' ? x : (x as { _id: string })._id))
    .filter(Boolean);
}

/**
 * Set which tests reference this control: removes control from unselected tests, adds to newly selected.
 */
export async function syncControlTestsFn(controlId: string, selectedTestIds: string[]): Promise<void> {
  const currently = await getTestsFn({ controlId, limit: 100 });
  const currentMap = new Map(currently.tests.map((t) => [t._id, t]));
  const selectedSet = new Set(selectedTestIds);

  for (const [id, test] of currentMap) {
    if (!selectedSet.has(id)) {
      const ids = normalizeLinkedControlIds(test.linkedControlIds).filter((cid) => cid !== controlId);
      await updateTestFn(id, { linkedControlIds: ids });
    }
  }

  for (const id of selectedTestIds) {
    if (!currentMap.has(id)) {
      const test = await getTestFn(id);
      const ids = normalizeLinkedControlIds(test.linkedControlIds);
      if (!ids.includes(controlId)) {
        await updateTestFn(id, { linkedControlIds: [...ids, controlId] });
      }
    }
  }
}

export function useSyncControlTests() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ controlId, selectedTestIds }: { controlId: string; selectedTestIds: string[] }) =>
      syncControlTestsFn(controlId, selectedTestIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      queryClient.invalidateQueries({ queryKey: ['controls'] });
      invalidateComplianceViews(queryClient);
      toast.success('Tests linked to control updated.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useUpdateTest(id: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTestFormInput) => updateTestFn(id!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      if (id) queryClient.invalidateQueries({ queryKey: ['tests', id] });
      invalidateComplianceViews(queryClient);
      toast.success('Test details updated.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function deactivateTestFn(id: string): Promise<TestListItem> {
  return handleApi(() => api.post<ApiResponse<TestListItem>>(`/tests/${id}/deactivate`, {}), 'Unable to deactivate.');
}

export async function reactivateTestFn(id: string): Promise<TestListItem> {
  return handleApi(() => api.post<ApiResponse<TestListItem>>(`/tests/${id}/reactivate`), 'Unable to reactivate.');
}

export async function snoozeTestFn(id: string, snoozedUntil: string): Promise<TestListItem> {
  return handleApi(
    () => api.post<ApiResponse<TestListItem>>(`/tests/${id}/snooze`, { snoozedUntil }),
    'Unable to snooze test.'
  );
}

export async function unsnoozeTestFn(id: string): Promise<TestListItem> {
  return handleApi(
    () => api.post<ApiResponse<TestListItem>>(`/tests/${id}/unsnooze`, {}),
    'Unable to unsnooze test.'
  );
}

export const archiveTest = (id: string) => api.post(`/tests/${id}/archive-workflow`);

export const markTestNotApplicable = (id: string) => api.post(`/tests/${id}/mark-na`);

export async function archiveTestFn(id: string): Promise<TestListItem> {
  return handleApi(
    () => api.post<ApiResponse<TestListItem>>(`/tests/${id}/archive-workflow`, {}),
    'Unable to archive test.'
  );
}

export async function markTestNotApplicableFn(id: string): Promise<TestListItem> {
  return handleApi(
    () => api.post<ApiResponse<TestListItem>>(`/tests/${id}/mark-na`, {}),
    'Unable to mark test as not applicable.'
  );
}

export function useDeactivateTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deactivateTestFn,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      queryClient.invalidateQueries({ queryKey: ['tests', id] });
      invalidateComplianceViews(queryClient);
      toast.success('Test deactivated.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useReactivateTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reactivateTestFn,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      queryClient.invalidateQueries({ queryKey: ['tests', id] });
      invalidateComplianceViews(queryClient);
      toast.success('Test reactivated.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useSnoozeTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, snoozedUntil }: { id: string; snoozedUntil: string }) =>
      snoozeTestFn(id, snoozedUntil),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      queryClient.invalidateQueries({ queryKey: ['tests', id] });
      queryClient.invalidateQueries({ queryKey: ['tests', id, 'evidence'] });
      invalidateComplianceViews(queryClient);
      toast.success('Test snoozed.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useUnsnoozeTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unsnoozeTestFn,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      queryClient.invalidateQueries({ queryKey: ['tests', id] });
      invalidateComplianceViews(queryClient);
      toast.success('Test unsnoozed.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useArchiveTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveTestFn,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      queryClient.invalidateQueries({ queryKey: ['tests', id] });
      invalidateComplianceViews(queryClient);
      toast.success('Test archived.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useMarkTestNA() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markTestNotApplicableFn,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      queryClient.invalidateQueries({ queryKey: ['tests', id] });
      invalidateComplianceViews(queryClient);
      toast.success('Test marked as not applicable.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export type DeleteTestResult = { deleted: boolean; id: string };

export async function deleteTestFn(id: string): Promise<DeleteTestResult> {
  return handleApi(
    () => api.delete<ApiResponse<DeleteTestResult>>(`/tests/${id}`),
    'Unable to delete test.'
  );
}

export function useDeleteTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTestFn,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      queryClient.removeQueries({ queryKey: ['tests', id] });
      invalidateComplianceViews(queryClient);
      toast.success('Test deleted.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export type StartTestEvidenceResult = {
  evidenceId: string;
  versionId: string;
};

export async function startTestEvidenceFn(id: string): Promise<StartTestEvidenceResult> {
  return handleApi(
    () => api.post<ApiResponse<StartTestEvidenceResult>>(`/tests/${id}/evidence/start`),
    'Unable to start evidence draft.'
  );
}

export function useStartTestEvidence(testId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => startTestEvidenceFn(testId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tests', testId] });
      queryClient.invalidateQueries({ queryKey: ['tests', testId, 'evidence'] });
      toast.success('Evidence draft ready. Add files and submit it.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function getTestEvidenceVersionsFn(testId: string): Promise<EvidenceVersionWithFiles[]> {
  return handleApi(
    () => api.get<ApiResponse<EvidenceVersionWithFiles[]>>(`/tests/${testId}/evidence`),
    'Unable to load evidence versions.'
  );
}

export function useTestEvidenceVersions(testId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['tests', testId, 'evidence'],
    queryFn: () => getTestEvidenceVersionsFn(testId!),
    enabled: !!testId && enabled,
  });
}

function invalidateTestEvidence(qc: ReturnType<typeof useQueryClient>, testId: string, evidenceId: string) {
  qc.invalidateQueries({ queryKey: ['tests', testId] });
  qc.invalidateQueries({ queryKey: ['tests', testId, 'evidence'] });
  qc.invalidateQueries({ queryKey: ['evidence', evidenceId, 'versions'] });
  qc.invalidateQueries({ queryKey: ['evidence', evidenceId] });
  invalidateComplianceViews(qc);
}

export function useAddFileToTestVersion(testId: string | null, evidenceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ versionId, file }: { versionId: string; file: File }) =>
      addFileToVersionFn(evidenceId!, versionId, file),
    onSuccess: () => {
      if (testId && evidenceId) invalidateTestEvidence(qc, testId, evidenceId);
      toast.success('File added to test evidence.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useRemoveFileFromTestVersion(testId: string | null, evidenceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ versionId, fileId }: { versionId: string; fileId: string }) =>
      removeFileFromVersionFn(evidenceId!, versionId, fileId),
    onSuccess: () => {
      if (testId && evidenceId) invalidateTestEvidence(qc, testId, evidenceId);
      toast.success('File removed from test evidence.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useSubmitTestVersion(testId: string | null, evidenceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) => submitVersionFn(evidenceId!, versionId),
    onSuccess: () => {
      if (testId && evidenceId) invalidateTestEvidence(qc, testId, evidenceId);
      invalidateComplianceViews(qc);
      toast.success('Test evidence submitted.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useNewDraftForTest(testId: string | null, evidenceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => createNewDraftVersionFn(evidenceId!),
    onSuccess: () => {
      if (testId && evidenceId) invalidateTestEvidence(qc, testId, evidenceId);
      toast.success('New test evidence draft started.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export type TestComment = {
  _id: string;
  content: string;
  userId?: { _id: string; firstName: string; lastName: string; email?: string };
  createdAt: string;
};

export type TestCommentsPage = {
  comments: TestComment[];
  pagination: ApiPaginationMeta;
};

export async function getTestCommentsFn(
  testId: string,
  params?: { page?: number; limit?: number }
): Promise<TestCommentsPage> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  const qs = searchParams.toString();
  const query = qs ? `?${qs}` : '';
  const { data } = await api.get<ApiResponse<TestComment[]> & { meta?: ApiPaginationMeta }>(
    `/tests/${testId}/comments${query}`
  );
  if (!data.success || !Array.isArray(data.data))
    throw new Error(data.error ?? 'Unable to load comments.');
  const pagination = data.meta;
  if (!pagination?.page || pagination.total == null) {
    throw new Error('Invalid comments response.');
  }
  return { comments: data.data, pagination };
}

export function useTestComments(testId: string | null, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['tests', testId, 'comments'],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getTestCommentsFn(testId!, { page: pageParam, limit: 50 }),
    getNextPageParam: (last) =>
      last.pagination.hasNextPage ? last.pagination.page + 1 : undefined,
    enabled: !!testId && enabled,
  });
}

export async function createTestCommentFn(testId: string, content: string): Promise<TestComment> {
  return handleApi(
    () => api.post<ApiResponse<TestComment>>(`/tests/${testId}/comments`, { content }),
    'Unable to add comment.'
  );
}

export function useCreateTestComment(testId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => createTestCommentFn(testId!, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tests', testId, 'comments'] });
      toast.success('Test comment added.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export type { EvidenceVersionWithFiles, EvidenceVersionFile };
export type { TestStats } from '@/types/models';
