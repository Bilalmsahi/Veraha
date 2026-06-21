import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from './axios';
import { getApiErrorMessage } from '@/lib/apiError';
import type { InternalControl } from '@/types/models';
import type { OverallStatus } from '@/types/enums';
import type { UpdateControlInput, AssessControlInput } from '@/schemas/control';
import type { EvidenceListItem } from './evidence';

type ApiResponse<T> = { success: boolean; data: T; error: string | null };
type PaginatedResponse<T> = ApiResponse<T> & {
  meta?: { pagination: Pagination };
};
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

export type ControlListItem = Omit<InternalControl, 'linkedRequirements'> & {
  requirementCount?: number;
  owner?: { _id: string; firstName: string; lastName: string; email: string };
  linkedRequirements?: ControlRequirementInfo[];
  testSummary?: { total: number; passing: number; failing: number };
  isAccessible?: boolean;
  frameworkName?: string;
  frameworkSlug?: string;
  readiness?: {
    status: 'PASS' | 'FAIL';
    satisfied: boolean;
    identifier?: string;
    title?: string;
  } | null;
};

export type ControlRequirementInfo = {
  requirementId: string;
  frameworkId: string;
  /** Display label, e.g. "SOC2 CC 6.1" */
  code: string;
  justification?: string;
};

export type ControlListParams = {
  page?: number;
  limit?: number;
  ids?: string[];
  status?: string;
  controlGroup?: string;
  source?: 'CUSTOM' | 'VERAHA';
  frameworkCode?: string;
  /** RequirementCategory _id — filter controls linked to requirements in this category */
  categoryId?: string;
  /** Filter controls linked to a specific requirement (ObjectId) */
  requirementId?: string;
  requirementIdentifier?: string;
  ownerId?: string;
  search?: string;
  sortBy?: 'identifier' | 'title' | 'overallStatus' | 'lastAssessedAt' | 'createdAt' | 'controlGroup';
  sortOrder?: 'asc' | 'desc';
  includeRequirements?: boolean;
};

export type ControlListResponse = {
  controls: ControlListItem[];
  pagination: Pagination;
};

export async function getControlsFn(params?: ControlListParams): Promise<ControlListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page != null) searchParams.set('page', String(params.page));
  if (params?.limit != null) searchParams.set('limit', String(params.limit));
  if (params?.ids?.length) searchParams.set('ids', params.ids.join(','));
  if (params?.status) searchParams.set('status', params.status);
  if (params?.controlGroup) searchParams.set('controlGroup', params.controlGroup);
  if (params?.source) searchParams.set('source', params.source);
  if (params?.frameworkCode) searchParams.set('frameworkCode', params.frameworkCode);
  if (params?.categoryId) searchParams.set('categoryId', params.categoryId);
  if (params?.requirementId) searchParams.set('requirementId', params.requirementId);
  if (params?.requirementIdentifier) searchParams.set('requirementIdentifier', params.requirementIdentifier);
  if (params?.ownerId) searchParams.set('ownerId', params.ownerId);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);
  if (params?.includeRequirements) searchParams.set('includeRequirements', '1');
  const query = searchParams.toString() ? `?${searchParams}` : '';

  const { data } = await api.get<PaginatedResponse<ControlListItem[]>>(`/controls${query}`);
  if (!data.success || !Array.isArray(data.data))
    throw new Error(data.error ?? 'Unable to load controls.');
  const pagination = data.meta?.pagination;
  if (!pagination) throw new Error('Invalid controls response.');
  return { controls: data.data, pagination };
}

export function useControls(params?: ControlListParams) {
  return useQuery({
    queryKey: ['controls', params],
    queryFn: () => getControlsFn(params),
  });
}

export function useControlsByRequirement(requirementId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['controls', 'byRequirement', requirementId],
    queryFn: () => getControlsFn({ requirementId: requirementId!, limit: 50 }),
    enabled: !!requirementId && enabled,
    staleTime: 30_000,
  });
}

export type ControlStats = Record<OverallStatus | 'total', number>;

export async function getControlStatsFn(): Promise<ControlStats> {
  return handleApi(
    () => api.get<ApiResponse<ControlStats>>('/controls/stats'),
    'Unable to load control stats.'
  );
}

export function useControlStats(enabled = true) {
  return useQuery({
    queryKey: ['controls', 'stats'],
    queryFn: getControlStatsFn,
    enabled,
  });
}

export type CategoryItem = { controlGroup: string; count: number };

export type RequirementCodeItem = {
  frameworkCode: string;
  frameworkName?: string;
  identifier: string;
  label: string;
};

export async function getRequirementCodesFn(
  frameworkCode?: string
): Promise<RequirementCodeItem[]> {
  const params = frameworkCode ? `?frameworkCode=${encodeURIComponent(frameworkCode)}` : '';
  return handleApi(
    () => api.get<ApiResponse<RequirementCodeItem[]>>(`/controls/requirement-codes${params}`),
    'Unable to load requirement codes.'
  );
}

export function useRequirementCodes(frameworkCode?: string, enabled = true) {
  return useQuery({
    queryKey: ['controls', 'requirement-codes', frameworkCode],
    queryFn: () => getRequirementCodesFn(frameworkCode),
    enabled,
  });
}

export async function getCategoriesFn(): Promise<CategoryItem[]> {
  return handleApi(
    () => api.get<ApiResponse<CategoryItem[]>>('/controls/categories'),
    'Unable to load categories.'
  );
}

export function useCategories(enabled = true) {
  return useQuery({
    queryKey: ['controls', 'categories'],
    queryFn: getCategoriesFn,
    enabled,
  });
}

export type PopulatedRequirementMap = {
  requirementId: string;
  frameworkId: string;
  requirement?: { _id: string; identifier: string; title: string };
  framework?: { _id: string; code: string; name: string };
  coverage: string;
  justification?: string;
};

export type ControlDetail = Omit<
  ControlListItem,
  'linkedRequirements' | 'linkedPolicyIds' | 'linkedRiskIds'
> & {
  sourceTemplateId?: { _id: string; identifier: string; title: string };
  linkedRequirements?: PopulatedRequirementMap[];
  linkedPolicyIds?: Array<{ _id: string; title: string; status?: string } | string>;
  linkedRiskIds?: Array<{ _id: string; title: string; status?: string; riskLevel?: string } | string>;
};

export async function getControlFn(id: string): Promise<ControlDetail> {
  return handleApi(
    () => api.get<ApiResponse<ControlDetail>>(`/controls/${id}`),
    'Unable to load control.'
  );
}

export function useControl(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ['controls', id],
    queryFn: () => getControlFn(id!),
    enabled: !!id && enabled,
  });
}

export async function updateControlFn(id: string, input: UpdateControlInput): Promise<ControlDetail> {
  return handleApi(
    () => api.patch<ApiResponse<ControlDetail>>(`/controls/${id}`, input),
    'Unable to update control.'
  );
}

export function useUpdateControl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateControlInput }) =>
      updateControlFn(id, input),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['controls'] });
      queryClient.invalidateQueries({ queryKey: ['controls', id] });
      invalidateComplianceViews(queryClient);
      toast.success('Control details updated.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function assessControlFn(id: string, input: AssessControlInput): Promise<ControlDetail> {
  return handleApi(
    () => api.post<ApiResponse<ControlDetail>>(`/controls/${id}/assess`, input),
    'Unable to record assessment.'
  );
}

export function useAssessControl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AssessControlInput }) =>
      assessControlFn(id, input),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['controls'] });
      queryClient.invalidateQueries({ queryKey: ['controls', id] });
      invalidateComplianceViews(queryClient);
      toast.success('Control assessment recorded.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export type BulkUpdateInput = {
  controlIds: string[];
  updates: { manualStatus?: 'PASS' | 'FAIL' | 'NOT_APPLICABLE'; ownerId?: string | null };
};

export function useBulkUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BulkUpdateInput) =>
      handleApi(
        () => api.post<ApiResponse<ControlDetail[]>>('/controls/bulk-update', input),
        'Unable to bulk update controls.'
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['controls'] });
      invalidateComplianceViews(queryClient);
      toast.success('Selected controls updated.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export type EvidenceByControlItem = EvidenceListItem;
export type EvidenceByControlResponse = {
  control: { _id: string; identifier?: string; title?: string };
  evidence: EvidenceByControlItem[];
  pagination: Pagination;
};

export async function getControlEvidenceFn(controlId: string): Promise<EvidenceByControlResponse> {
  return handleApi(
    () => api.get<ApiResponse<EvidenceByControlResponse>>(`/controls/${controlId}/evidence`),
    'Unable to load control evidence.'
  );
}

export function useControlEvidence(controlId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['controls', controlId, 'evidence'],
    queryFn: () => getControlEvidenceFn(controlId!),
    enabled: !!controlId && enabled,
  });
}

export type CreateControlInput = {
  identifier: string;
  title?: string;
  description?: string;
  controlGroup?: string;
  frequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  isPurchased?: boolean;
  implementationNotes?: string;
  nextAssessmentDue?: string;
  ownerId?: string | null;
};

export function useCreateControl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateControlInput) =>
      handleApi(
        () => api.post<ApiResponse<ControlDetail>>('/controls', input),
        'Unable to create control.'
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['controls'] });
      invalidateComplianceViews(queryClient);
      toast.success('Control created.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useCreateFromTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) =>
      handleApi(
        () => api.post<ApiResponse<ControlDetail>>(`/controls/from-template/${templateId}`),
        'Unable to create control from template.'
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['controls'] });
      invalidateComplianceViews(queryClient);
      toast.success('Control created from template.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useGapAnalysis(frameworkCode: string | null, enabled = true) {
  return useQuery({
    queryKey: ['controls', 'gap-analysis', frameworkCode],
    queryFn: () =>
      handleApi(
        () => api.get<ApiResponse<unknown>>(`/controls/gap-analysis/${frameworkCode}`),
        'Unable to load gap analysis.'
      ),
    enabled: !!frameworkCode && enabled,
  });
}


export type MapControlRequirementInput = {
  frameworkId: string;
  requirementId: string;
  coverage?: 'FULL' | 'PARTIAL' | 'GAP';
  justification?: string;
};

export function useMapControlRequirement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: MapControlRequirementInput }) =>
      handleApi(
        () => api.post<ApiResponse<ControlDetail>>(`/controls/${id}/requirements`, input),
        'Unable to map requirement to control.'
      ),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['controls'] });
      queryClient.invalidateQueries({ queryKey: ['controls', id] });
      invalidateComplianceViews(queryClient);
      toast.success('Framework mapping added to control.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export type ControlActivity = {
  _id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorSnapshot?: { name?: string; email?: string; role?: string } | null;
  changes?: { fields?: string[] } | null;
  notes?: string;
  timestamp: string;
};

export async function getControlHistoryFn(
  id: string,
  params?: { page?: number; limit?: number }
): Promise<{ history: ControlActivity[] }> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  const query = searchParams.toString() ? `?${searchParams.toString()}` : '';

  const { data } = await api.get<PaginatedResponse<ControlActivity[]>>(`/controls/${id}/history${query}`);
  if (!data.success || !Array.isArray(data.data)) {
    throw new Error(data.error ?? 'Unable to load control history.');
  }
  return { history: data.data };
}

export function useControlHistory(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ['controls', id, 'history'],
    queryFn: () => getControlHistoryFn(id!),
    enabled: !!id && enabled,
  });
}

export type ControlComment = {
  _id: string;
  content: string;
  userId?: { _id: string; firstName: string; lastName: string; email: string } | null;
  createdAt: string;
};

export async function getControlCommentsFn(id: string): Promise<{ comments: ControlComment[] }> {
  const { data } = await api.get<PaginatedResponse<ControlComment[]>>(`/controls/${id}/comments`);
  if (!data.success || !Array.isArray(data.data)) {
    throw new Error(data.error ?? 'Unable to load control comments.');
  }
  return { comments: data.data };
}

export function useControlComments(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ['controls', id, 'comments'],
    queryFn: () => getControlCommentsFn(id!),
    enabled: !!id && enabled,
  });
}

export async function createControlCommentFn(id: string, content: string): Promise<ControlComment> {
  return handleApi(
    () => api.post<ApiResponse<ControlComment>>(`/controls/${id}/comments`, { content }),
    'Unable to add control comment.'
  );
}

export function useCreateControlComment(id: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => createControlCommentFn(id!, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['controls', id, 'comments'] });
      toast.success('Control comment added.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}
export function useReadiness(frameworkCode: string | null, enabled = true) {
  return useQuery({
    queryKey: ['controls', 'readiness', frameworkCode],
    queryFn: () =>
      handleApi(
        () => api.get<ApiResponse<unknown>>(`/controls/readiness/${frameworkCode}`),
        'Unable to load readiness.'
      ),
    enabled: !!frameworkCode && enabled,
  });
}
