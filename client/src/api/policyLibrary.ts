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

export type PolicyTemplate = {
  _id: string;
  slug: string;
  title: string;
  description?: string;
  filename: string;
  frameworkCodes: string[];
  frameworks?: { code: string; name: string }[];
  category?: string;
  source: string;
  added: boolean;
  policyId?: string;
};

export type AddPolicyFromLibraryResponse = { _id: string };

export type PolicyLibraryParams = {
  search?: string;
  frameworkCode?: string;
  added?: 'true' | 'false';
  page?: number;
  limit?: number;
};

export type PolicyLibraryResponse = {
  templates: PolicyTemplate[];
  pagination: Pagination;
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

export async function getPolicyLibraryFn(
  params?: PolicyLibraryParams
): Promise<PolicyLibraryResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page != null) searchParams.set('page', String(params.page));
  if (params?.limit != null) searchParams.set('limit', String(params.limit));
  if (params?.search) searchParams.set('search', params.search);
  if (params?.frameworkCode) searchParams.set('frameworkCode', params.frameworkCode);
  if (params?.added) searchParams.set('added', params.added);
  const query = searchParams.toString() ? `?${searchParams}` : '';

  const { data } = await api.get<ApiResponse<PolicyTemplate[]> & { meta?: Pagination }>(
    `/policy-library${query}`
  );
  if (!data.success || !Array.isArray(data.data))
    throw new Error(data.error ?? 'Unable to load policy library.');
  const pagination = data.meta;
  if (!pagination) throw new Error('Invalid policy library response.');
  return { templates: data.data, pagination };
}

export function usePolicyLibrary(params?: PolicyLibraryParams) {
  return useQuery({
    queryKey: ['policy-library', params],
    queryFn: () => getPolicyLibraryFn(params),
  });
}

export async function addPolicyFromLibraryFn(
  templateId: string
): Promise<AddPolicyFromLibraryResponse> {
  return handleApi(
    () =>
      api.post<ApiResponse<AddPolicyFromLibraryResponse>>(
        `/policy-library/${templateId}/add`
      ),
    'Unable to add policy from library.'
  );
}

export function useAddPolicyFromLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) => addPolicyFromLibraryFn(templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policy-library'] });
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      toast.success('Policy added from library');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function downloadTemplateFn(templateId: string, filename: string): Promise<void> {
  const { data } = await api.get(`/policy-library/${templateId}/download`, {
    responseType: 'blob',
  });
  const ext = filename.toLowerCase().split('.').pop();
  const mime = ext === 'xlsx'
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const blob = new Blob([data], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
