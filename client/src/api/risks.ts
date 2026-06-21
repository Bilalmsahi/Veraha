import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from './axios';
import { getApiErrorMessage } from '@/lib/apiError';
import type { Risk } from '@/types/models';
import type {
  CreateRiskInput,
  UpdateRiskInput,
  CloseRiskInput,
  LinkControlsInput,
  ReopenRiskInput,
  ReviewRiskInput,
  SubmitRiskApprovalInput,
} from '@/schemas/risk';

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

export type RiskListItem = Omit<Risk, 'ownerId' | 'assignedApproverIds'> & {
  ownerId?: { _id: string; firstName: string; lastName: string; email: string };
  assignedApproverIds?: PopulatedUser[];
};

export type RiskListParams = {
  page?: number;
  limit?: number;
  status?: string;
  owner?: string;
  category?: string;
  inherent?: string;
  residual?: string;
  approverId?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  treatmentPlan?: string;
  ciaCategories?: string;
  identified?: string;
  source?: string;
};

export type RiskListResponse = {
  risks: RiskListItem[];
  pagination: Pagination;
};

export async function getRisksFn(params?: RiskListParams): Promise<RiskListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.status) searchParams.set('status', params.status);
  if (params?.owner) searchParams.set('owner', params.owner);
  if (params?.category) searchParams.set('category', params.category);
  if (params?.inherent) searchParams.set('inherent', params.inherent);
  if (params?.residual) searchParams.set('residual', params.residual);
  if (params?.approverId) searchParams.set('approverId', params.approverId);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.sortBy) searchParams.set('sortBy', params.sortBy ?? 'residualScore');
  if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder ?? 'desc');
  if (params?.treatmentPlan) searchParams.set('treatmentPlan', params.treatmentPlan);
  if (params?.ciaCategories) searchParams.set('ciaCategories', params.ciaCategories);
  if (params?.identified) searchParams.set('identified', params.identified);
  if (params?.source) searchParams.set('source', params.source);
  const query = searchParams.toString() ? `?${searchParams}` : '';

  const { data } = await api.get<ApiResponse<RiskListItem[]> & { meta?: Pagination }>(
    `/risks${query}`
  );
  if (!data.success || !Array.isArray(data.data))
    throw new Error(data.error ?? 'Unable to load risks.');
  const pagination = data.meta;
  if (!pagination) throw new Error('Invalid risks response.');
  return { risks: data.data, pagination };
}

export function useRisks(params?: RiskListParams) {
  return useQuery({
    queryKey: ['risks', params],
    queryFn: () => getRisksFn(params),
  });
}

export type RiskStats = {
  total: number;
  byStatus: Record<string, number>;
  byLevel: Record<string, number>;
};

export async function getRiskStatsFn(): Promise<RiskStats> {
  return handleApi(
    () => api.get<ApiResponse<RiskStats>>('/risks/stats'),
    'Unable to load risk stats.'
  );
}

export function useRiskStats(enabled = true) {
  return useQuery({
    queryKey: ['risks', 'stats'],
    queryFn: getRiskStatsFn,
    enabled,
  });
}

export type RiskMatrix = {
  matrix: number[][];
  likelihoodLabels: string[];
  impactLabels: string[];
};

export async function getRiskMatrixFn(): Promise<RiskMatrix> {
  return handleApi(
    () => api.get<ApiResponse<RiskMatrix>>('/risks/matrix'),
    'Unable to load risk matrix.'
  );
}

export function useRiskMatrix(enabled = true) {
  return useQuery({
    queryKey: ['risks', 'matrix'],
    queryFn: getRiskMatrixFn,
    enabled,
  });
}

export type PopulatedControl = {
  _id: string;
  identifier?: string;
  title?: string;
  description?: string;
};

export type PopulatedUser = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
};

export type RiskDetail = Omit<RiskListItem, 'mitigatingControlIds' | 'assignedApproverIds'> & {
  mitigatingControlIds?: PopulatedControl[];
  assignedApproverIds?: PopulatedUser[];
};

export type RiskAssessment = {
  _id: string;
  riskId: string;
  assessedById:
    | string
    | {
        _id: string;
        firstName?: string;
        lastName?: string;
        email?: string;
      };
  assessedAt: string;
  notes?: string | null;
  snapshot: {
    inherentLikelihood: number;
    inherentImpact: number;
    inherentScore: number;
    inherentBand: 'Low' | 'Medium' | 'High';
    residualLikelihood: number;
    residualImpact: number;
    residualScore: number;
    residualBand: 'Low' | 'Medium' | 'High';
    treatmentType: string;
    mappedControlIds: Array<{
      _id: string;
      identifier?: string;
      title?: string;
    }>;
  };
};

export async function getRiskFn(id: string): Promise<RiskDetail> {
  return handleApi(
    () => api.get<ApiResponse<RiskDetail>>(`/risks/${id}`),
    'Unable to load risk.'
  );
}

export function useRisk(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ['risks', id],
    queryFn: () => getRiskFn(id!),
    enabled: !!id && enabled,
  });
}

export async function getRiskAssessmentsFn(id: string): Promise<RiskAssessment[]> {
  return handleApi(
    () => api.get<ApiResponse<RiskAssessment[]>>(`/risks/${id}/assessments`),
    'Unable to load risk assessments.'
  );
}

export function useRiskAssessments(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ['risks', id, 'assessments'],
    queryFn: () => getRiskAssessmentsFn(id!),
    enabled: !!id && enabled,
  });
}

export function useCreateRisk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRiskInput) =>
      handleApi(() => api.post<ApiResponse<RiskDetail>>('/risks', input), 'Unable to create risk.'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Risk created');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useUpdateRisk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRiskInput }) =>
      handleApi(() => api.patch<ApiResponse<RiskDetail>>(`/risks/${id}`, input), 'Unable to update risk.'),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      queryClient.invalidateQueries({ queryKey: ['risks', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Risk updated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useCloseRisk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CloseRiskInput }) =>
      handleApi(() => api.post<ApiResponse<RiskDetail>>(`/risks/${id}/close`, input), 'Unable to close risk.'),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      queryClient.invalidateQueries({ queryKey: ['risks', id] });
      toast.success('Risk closed');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useApproveRisk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string | null }) =>
      handleApi(
        () => api.post<ApiResponse<RiskDetail>>(`/risks/${id}/approve`, { notes: notes ?? null }),
        'Unable to approve risk.'
      ),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      queryClient.invalidateQueries({ queryKey: ['risks', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Risk approved');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useSubmitRiskApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SubmitRiskApprovalInput }) =>
      handleApi(
        () => api.post<ApiResponse<RiskDetail>>(`/risks/${id}/submit-approval`, input),
        'Unable to submit risk for approval.'
      ),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      queryClient.invalidateQueries({ queryKey: ['risks', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Risk submitted for approval');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useLinkControls() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: LinkControlsInput }) =>
      handleApi(() => api.post<ApiResponse<RiskDetail>>(`/risks/${id}/controls`, input), 'Unable to link controls.'),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      queryClient.invalidateQueries({ queryKey: ['risks', id] });
      toast.success('Controls linked');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useReopenRisk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input?: ReopenRiskInput }) =>
      handleApi(() => api.post<ApiResponse<RiskDetail>>(`/risks/${id}/reopen`, input ?? {}), 'Unable to reopen risk.'),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      queryClient.invalidateQueries({ queryKey: ['risks', id] });
      toast.success('Risk reopened');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useReviewRisk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReviewRiskInput }) =>
      handleApi(() => api.post<ApiResponse<RiskDetail>>(`/risks/${id}/review`, input), 'Unable to review risk.'),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      queryClient.invalidateQueries({ queryKey: ['risks', id] });
      toast.success('Risk reviewed');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useUnlinkControls() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: LinkControlsInput }) =>
      handleApi(() => api.delete<ApiResponse<RiskDetail>>(`/risks/${id}/controls`, { data: input }), 'Unable to unlink controls.'),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      queryClient.invalidateQueries({ queryKey: ['risks', id] });
      toast.success('Controls unlinked');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useRecalculateResidual() {
  // Deprecated: residual risk is now managed manually via 3x3 inputs.
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // No-op to keep backward compatibility if called.
      return {} as RiskDetail;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      queryClient.invalidateQueries({ queryKey: ['risks', id] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function archiveRiskFn(id: string): Promise<RiskDetail> {
  return handleApi(
    () => api.post<ApiResponse<RiskDetail>>(`/risks/${id}/archive`, {}),
    'Unable to archive risk.'
  );
}

export function useArchiveRisk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveRiskFn(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      queryClient.invalidateQueries({ queryKey: ['risks', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Risk archived');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function deleteRiskFn(id: string): Promise<{ deleted: boolean }> {
  return handleApi(
    () => api.delete<ApiResponse<{ deleted: boolean }>>(`/risks/${id}`),
    'Unable to delete risk.'
  );
}

export function useDeleteRisk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRiskFn(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      queryClient.invalidateQueries({ queryKey: ['risks', id] });
      toast.success('Risk deleted');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function getTopRisksFn(limit = 10): Promise<RiskListItem[]> {
  return handleApi(
    () => api.get<ApiResponse<RiskListItem[]>>(`/risks/top?limit=${limit}`),
    'Unable to load top risks.'
  );
}

export function useTopRisks(limit = 10, enabled = true) {
  return useQuery({
    queryKey: ['risks', 'top', limit],
    queryFn: () => getTopRisksFn(limit),
    enabled,
  });
}

export async function getStaleRisksFn(days = 30): Promise<RiskListItem[]> {
  return handleApi(
    () => api.get<ApiResponse<RiskListItem[]>>(`/risks/stale?days=${days}`),
    'Unable to load stale risks.'
  );
}

export function useStaleRisks(days = 30, enabled = true) {
  return useQuery({
    queryKey: ['risks', 'stale', days],
    queryFn: () => getStaleRisksFn(days),
    enabled,
  });
}

export type BatchRecalculateResult = {
  updated?: number;
  total?: number;
};

export async function batchRecalculateFn(): Promise<BatchRecalculateResult> {
  return handleApi(
    () => api.post<ApiResponse<BatchRecalculateResult>>('/risks/batch-recalculate'),
    'Unable to recalculate all risks.'
  );
}

export function useBatchRecalculate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: batchRecalculateFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      toast.success('All risks recalculated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

// =============================================================================
// RISK COMMENTS
// =============================================================================

export type RiskComment = {
  _id: string;
  content: string;
  userId?: { firstName?: string; lastName?: string; email?: string };
  createdAt: string;
};

export async function getRiskCommentsFn(
  riskId: string,
  params?: { page?: number }
): Promise<{ comments: RiskComment[] }> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  const query = searchParams.toString() ? `?${searchParams}` : '';
  const { data } = await api.get<ApiResponse<RiskComment[]> & { meta?: unknown }>(
    `/risks/${riskId}/comments${query}`
  );
  if (!data.success || !Array.isArray(data.data))
    throw new Error(data.error ?? 'Unable to load comments.');
  return { comments: data.data };
}

export function useRiskComments(riskId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['risks', riskId, 'comments'],
    queryFn: () => getRiskCommentsFn(riskId!),
    enabled: !!riskId && enabled,
  });
}

export function useCreateRiskComment(riskId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      handleApi(
        () =>
          api.post<ApiResponse<RiskComment>>(`/risks/${riskId}/comments`, {
            content,
          }),
        'Unable to add comment.'
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risks', riskId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['risks', riskId] });
      toast.success('Comment added');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}
