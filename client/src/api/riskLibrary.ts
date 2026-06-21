import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from './axios';
import { getApiErrorMessage } from '@/lib/apiError';

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

export type RiskTemplate = {
  _id: string;
  title: string;
  description?: string;
  categoryNames: string[];
  isGlobal: boolean;
  organizationId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RiskTemplateListParams = {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export type RiskTemplateListResponse = {
  templates: RiskTemplate[];
  pagination: Pagination;
};

export async function getRiskTemplatesFn(
  params?: RiskTemplateListParams
): Promise<RiskTemplateListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.category) searchParams.set('category', params.category);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);
  const query = searchParams.toString() ? `?${searchParams}` : '';

  const { data } = await api.get<ApiResponse<RiskTemplate[]> & { meta?: { pagination: Pagination } }>(
    `/risk-library${query}`
  );
  if (!data.success || !Array.isArray(data.data))
    throw new Error(data.error ?? 'Unable to load risk templates.');
  const pagination = data.meta?.pagination;
  if (!pagination) throw new Error('Invalid response.');
  return { templates: data.data, pagination };
}

export function useRiskTemplates(params?: RiskTemplateListParams) {
  return useQuery({
    queryKey: ['risk-library', params],
    queryFn: () => getRiskTemplatesFn(params),
  });
}

export function useRiskTemplateCategories() {
  return useQuery({
    queryKey: ['risk-library', 'categories'],
    queryFn: () =>
      handleApi(
        () => api.get<ApiResponse<string[]>>('/risk-library/categories'),
        'Unable to load categories.'
      ),
  });
}

export type CreateRiskTemplateInput = {
  title: string;
  description?: string;
  categoryNames?: string[];
};

export function useCreateRiskTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRiskTemplateInput) =>
      handleApi(
        () => api.post<ApiResponse<RiskTemplate>>('/risk-library', input),
        'Unable to create risk template.'
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk-library'] });
      toast.success('Risk template created');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useUpdateRiskTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateRiskTemplateInput> }) =>
      handleApi(
        () => api.patch<ApiResponse<RiskTemplate>>(`/risk-library/${id}`, input),
        'Unable to update risk template.'
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk-library'] });
      toast.success('Risk template updated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useDeleteRiskTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      handleApi(
        () => api.delete<ApiResponse<{ deleted: boolean }>>(`/risk-library/${id}`),
        'Unable to delete risk template.'
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk-library'] });
      toast.success('Risk template deleted');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useImportToRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      handleApi(
        () => api.post<ApiResponse<unknown>>(`/risk-library/${id}/import`),
        'Unable to import risk to register.'
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      toast.success('Risk imported to register');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}
