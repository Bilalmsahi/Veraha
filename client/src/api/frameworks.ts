import { useQuery } from '@tanstack/react-query';
import { api } from './axios';
import { getApiErrorMessage } from '@/lib/apiError';
import type { Framework, Requirement, RequirementCategory } from '@/types/models';

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

export type FrameworkWithCount = Framework & {
  requirementCount?: number;
  readinessScore?: number;
  ready?: boolean;
  isPurchased?: boolean;
  isAccessible?: boolean;
};

export async function getFrameworksFn(): Promise<FrameworkWithCount[]> {
  return handleApi(
    () => api.get<ApiResponse<FrameworkWithCount[]>>('/frameworks'),
    'Unable to load frameworks.'
  );
}

export function useFrameworks(enabled = true) {
  return useQuery({
    queryKey: ['frameworks'],
    queryFn: getFrameworksFn,
    enabled,
  });
}

export async function getFrameworkFn(code: string): Promise<Framework> {
  return handleApi(
    () => api.get<ApiResponse<Framework>>(`/frameworks/${code}`),
    'Unable to load framework.'
  );
}

export function useFramework(code: string | null, enabled = true) {
  return useQuery({
    queryKey: ['frameworks', code],
    queryFn: () => getFrameworkFn(code!),
    enabled: !!code && enabled,
  });
}

export async function getFrameworkCategoriesFn(code: string): Promise<RequirementCategory[]> {
  return handleApi(
    () => api.get<ApiResponse<RequirementCategory[]>>(`/frameworks/${code}/categories`),
    'Unable to load requirement categories.'
  );
}

export function useFrameworkCategories(code: string | null, enabled = true) {
  return useQuery({
    queryKey: ['frameworks', code, 'categories'],
    queryFn: () => getFrameworkCategoriesFn(code!),
    enabled: !!code && enabled,
  });
}

export type RequirementsParams = {
  page?: number;
  limit?: number;
  /** Filter by requirement category (RequirementCategory _id) */
  categoryId?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export type RequirementsResponse = {
  requirements: Requirement[];
  pagination: Pagination;
};

export async function getRequirementsFn(
  code: string,
  params?: RequirementsParams
): Promise<RequirementsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.categoryId) searchParams.set('categoryId', params.categoryId);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);
  const query = searchParams.toString() ? `?${searchParams}` : '';

  const { data } = await api.get<PaginatedResponse<Requirement[]>>(
    `/frameworks/${code}/requirements${query}`
  );
  if (!data.success || !Array.isArray(data.data))
    throw new Error(data.error ?? 'Unable to load requirements.');
  const pagination = data.meta?.pagination;
  if (!pagination) throw new Error('Invalid requirements response.');
  return { requirements: data.data, pagination };
}

export function useRequirements(code: string | null, params?: RequirementsParams) {
  return useQuery({
    queryKey: ['frameworks', code, 'requirements', params],
    queryFn: () => getRequirementsFn(code!, params),
    enabled: !!code,
  });
}

export async function getRequirementFn(id: string): Promise<Requirement> {
  return handleApi(
    () => api.get<ApiResponse<Requirement>>(`/requirements/${id}`),
    'Unable to load requirement.'
  );
}

export function useRequirement(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ['requirements', id],
    queryFn: () => getRequirementFn(id!),
    enabled: !!id && enabled,
  });
}

// =============================================================================
// READINESS (Phase 5) — workflow overlay endpoint
// =============================================================================

export type FrameworkReadinessOverlay = {
  framework: { _id: string; code: string; name: string };
  readinessScore?: number;
  rollup?: {
    framework?: {
      readinessScore: number;
      ready: boolean;
    };
    requirement?: {
      total: number;
      pass: number;
      fail: number;
    };
    category?: {
      total: number;
      pass: number;
      fail: number;
    };
  };
  workflowOverlay?: {
    pass: number;
    fail: number;
    controls: Array<{
      controlId: string;
      identifier?: string;
      title?: string;
      satisfied: boolean;
      status: 'PASS' | 'FAIL';
      reasons?: { excluded?: string[]; failing?: string[] };
    }>;
  };
} & Record<string, unknown>;

export async function getFrameworkReadinessFn(code: string): Promise<FrameworkReadinessOverlay> {
  return handleApi(
    () => api.get<ApiResponse<FrameworkReadinessOverlay>>(`/frameworks/${code}/readiness`),
    'Unable to load readiness.'
  );
}

export function useFrameworkReadiness(code: string | null, enabled = true) {
  return useQuery({
    queryKey: ['readiness', code],
    queryFn: () => getFrameworkReadinessFn(code!),
    enabled: !!code && enabled,
  });
}
