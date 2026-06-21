import { useQuery } from '@tanstack/react-query';
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

export type GlobalTemplate = {
  _id: string;
  identifier: string;
  title: string;
  description?: string;
  controlGroup?: string;
  frequency?: string;
  implementationGuidance?: string;
  suggestedRequirements?: {
    requirementId: string;
    frameworkId: string;
    coverage: string;
    requirement?: { _id: string; identifier: string; title: string; domain?: string };
    framework?: { _id: string; code: string; name: string };
  }[];
};

export type TemplateListParams = {
  page?: number;
  limit?: number;
  controlGroup?: string;
  frameworkCode?: string;
  search?: string;
};

export type TemplateListResponse = {
  templates: GlobalTemplate[];
  pagination: Pagination;
};

export async function getTemplatesFn(params?: TemplateListParams): Promise<TemplateListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.controlGroup) searchParams.set('controlGroup', params.controlGroup);
  if (params?.frameworkCode) searchParams.set('frameworkCode', params.frameworkCode);
  if (params?.search) searchParams.set('search', params.search);
  const query = searchParams.toString() ? `?${searchParams}` : '';

  const { data } = await api.get<ApiResponse<GlobalTemplate[]> & { meta?: { pagination: Pagination } }>(
    `/templates${query}`
  );
  if (!data.success || !Array.isArray(data.data))
    throw new Error(data.error ?? 'Unable to load templates.');
  const pagination = data.meta?.pagination;
  if (!pagination) throw new Error('Invalid response.');
  return { templates: data.data, pagination };
}

export function useTemplates(params?: TemplateListParams, enabled = true) {
  return useQuery({
    queryKey: ['templates', params],
    queryFn: () => getTemplatesFn(params),
    enabled,
  });
}

export type TemplateListItem = GlobalTemplate & {
  requirementCount?: number;
};

export function useTemplatesByFramework(
  frameworkCode: string | null,
  params?: Omit<TemplateListParams, 'frameworkCode'>,
  enabled = true
) {
  return useQuery({
    queryKey: ['templates', 'by-framework', frameworkCode, params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.limit) searchParams.set('limit', String(params.limit));
      if (params?.search) searchParams.set('search', params.search);
      if (params?.controlGroup) searchParams.set('controlGroup', params.controlGroup);
      const query = searchParams.toString() ? `?${searchParams}` : '';

      const { data } = await api.get<
        ApiResponse<TemplateListItem[]> & { meta?: { pagination: Pagination } }
      >(`/templates/by-framework/${frameworkCode}${query}`);
      if (!data.success || !Array.isArray(data.data))
        throw new Error(data.error ?? 'Unable to load templates.');
      const pagination = data.meta?.pagination;
      if (!pagination) throw new Error('Invalid response.');
      return { templates: data.data, pagination };
    },
    enabled: !!frameworkCode && enabled,
  });
}

export type TemplateCategoryItem = { controlGroup: string; count: number };

export function useTemplate(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ['templates', id],
    queryFn: () =>
      handleApi(
        () => api.get<ApiResponse<GlobalTemplate>>(`/templates/${id}`),
        'Unable to load template.'
      ),
    enabled: !!id && enabled,
  });
}

export function useTemplateCategories() {
  return useQuery({
    queryKey: ['templates', 'categories'],
    queryFn: () =>
      handleApi(
        () => api.get<ApiResponse<TemplateCategoryItem[]>>('/templates/categories'),
        'Unable to load template categories.'
      ),
  });
}
