import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from './axios';
import { getApiErrorMessage } from '@/lib/apiError';
import type { Vendor } from '@/types/models';
import type {
  CreateVendorInput,
  UpdateVendorInput,
  RecordAssessmentInput,
} from '@/schemas/vendor';

/** Vanta risk tiers - matches schema and UI */
export type RiskTier = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNSCORED';

/** Vanta vendor lifecycle - ACTIVE | ARCHIVED (map INACTIVE/TERMINATED to ARCHIVED when needed) */
export type VendorStatusUI = 'ACTIVE' | 'ARCHIVED';

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

export type VendorListItem = Omit<Vendor, 'ownerId'> & {
  ownerId?: { _id: string; firstName: string; lastName: string; email: string };
  riskTier?: RiskTier;
  dataTypes?: string[];
  dataShared?: string[];
};

export type VendorListParams = {
  page?: number;
  limit?: number;
  status?: string;
  riskTier?: string;
  category?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export type VendorListResponse = {
  vendors: VendorListItem[];
  pagination: Pagination;
};

export async function getVendorsFn(params?: VendorListParams): Promise<VendorListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.status) searchParams.set('status', params.status);
  if (params?.riskTier) searchParams.set('riskTier', params.riskTier);
  if (params?.category) searchParams.set('category', params.category);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.sortBy) searchParams.set('sortBy', params.sortBy ?? 'name');
  if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder ?? 'asc');
  const query = searchParams.toString() ? `?${searchParams}` : '';

  const { data } = await api.get<ApiResponse<VendorListItem[]> & { meta?: Pagination }>(
    `/vendors${query}`
  );
  if (!data.success || !Array.isArray(data.data))
    throw new Error(data.error ?? 'Unable to load vendors.');
  const pagination = data.meta;
  if (!pagination) throw new Error('Invalid vendors response.');
  return { vendors: data.data, pagination };
}

export function useVendors(params?: VendorListParams) {
  return useQuery({
    queryKey: ['vendors', params],
    queryFn: () => getVendorsFn(params),
  });
}

export type VendorStats = {
  total: number;
  byStatus: Record<string, number>;
  byRiskTier: Record<string, number>;
};

export async function getVendorStatsFn(): Promise<VendorStats> {
  return handleApi(
    () => api.get<ApiResponse<VendorStats>>('/vendors/stats'),
    'Unable to load vendor stats.'
  );
}

export function useVendorStats(enabled = true) {
  return useQuery({
    queryKey: ['vendors', 'stats'],
    queryFn: getVendorStatsFn,
    enabled,
  });
}

export type PopulatedControl = { _id: string; identifier?: string; title?: string };

export type VendorDetail = Omit<VendorListItem, 'linkedControlIds'> & {
  linkedControlIds?: PopulatedControl[];
};

export async function getVendorFn(id: string): Promise<VendorDetail> {
  return handleApi(
    () => api.get<ApiResponse<VendorDetail>>(`/vendors/${id}`),
    'Unable to load vendor.'
  );
}

export function useVendor(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ['vendors', id],
    queryFn: () => getVendorFn(id!),
    enabled: !!id && enabled,
  });
}

export function useCreateVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVendorInput) =>
      handleApi(() => api.post<ApiResponse<VendorDetail>>('/vendors', input), 'Unable to create vendor.'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast.success('Vendor created');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useUpdateVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateVendorInput }) =>
      handleApi(() => api.patch<ApiResponse<VendorDetail>>(`/vendors/${id}`, input), 'Unable to update vendor.'),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendors', id] });
      toast.success('Vendor updated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useDeleteVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      handleApi(() => api.delete<ApiResponse<{ deleted: boolean }>>(`/vendors/${id}`), 'Unable to delete vendor.'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast.success('Vendor deleted');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export type UpdateStatusInput = { status: string; reason?: string };

export function useUpdateVendorStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateStatusInput }) =>
      handleApi(() => api.post<ApiResponse<VendorDetail>>(`/vendors/${id}/status`, input), 'Unable to update status.'),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendors', id] });
      toast.success('Status updated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useRecordAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: RecordAssessmentInput }) =>
      handleApi(() => api.post<ApiResponse<VendorDetail>>(`/vendors/${id}/assess`, input), 'Unable to record assessment.'),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendors', id] });
      toast.success('Assessment recorded');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useLinkControls() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, controlIds }: { id: string; controlIds: string[] }) =>
      handleApi(() => api.post<ApiResponse<VendorDetail>>(`/vendors/${id}/controls`, { controlIds }), 'Unable to link controls.'),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendors', id] });
      toast.success('Controls linked');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useUnlinkControls() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, controlIds }: { id: string; controlIds: string[] }) =>
      handleApi(() => api.delete<ApiResponse<VendorDetail>>(`/vendors/${id}/controls`, { data: { controlIds } }), 'Unable to unlink controls.'),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendors', id] });
      toast.success('Controls unlinked');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export type AddCertificationInput = { name: string; validUntil?: Date | string };

export function useAddCertification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input, file }: { id: string; input: AddCertificationInput; file?: File }) => {
      const formData = new FormData();
      formData.append('name', input.name);
      if (input.validUntil) {
        formData.append('validUntil', typeof input.validUntil === 'string' ? input.validUntil : input.validUntil.toISOString());
      }
      if (file) formData.append('file', file);
      return handleApi(
        () => api.post<ApiResponse<VendorDetail>>(`/vendors/${id}/certifications`, formData),
        'Unable to add certification.'
      );
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendors', id] });
      toast.success('Certification added');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useRemoveCertification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, certIndex }: { id: string; certIndex: number }) =>
      handleApi(() => api.delete<ApiResponse<VendorDetail>>(`/vendors/${id}/certifications/${certIndex}`), 'Unable to remove certification.'),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['vendors', id] });
      toast.success('Certification removed');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useAssessmentsDue(days = 30) {
  return useQuery({
    queryKey: ['vendors', 'assessments-due', days],
    queryFn: () =>
      handleApi(
        () => api.get<ApiResponse<VendorListItem[]>>(`/vendors/assessments-due?days=${days}`),
        'Unable to load assessments due.'
      ),
  });
}

export function useExpiringContracts(days = 90) {
  return useQuery({
    queryKey: ['vendors', 'expiring-contracts', days],
    queryFn: () =>
      handleApi(
        () => api.get<ApiResponse<VendorListItem[]>>(`/vendors/expiring-contracts?days=${days}`),
        'Unable to load expiring contracts.'
      ),
  });
}

export function useHighRiskVendors() {
  return useQuery({
    queryKey: ['vendors', 'high-risk'],
    queryFn: () =>
      handleApi(
        () => api.get<ApiResponse<VendorListItem[]>>('/vendors/high-risk'),
        'Unable to load high-risk vendors.'
      ),
  });
}
