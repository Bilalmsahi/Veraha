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

export type OrgUser = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  lastLoginAt?: string | null;
  lastActivityAt?: string | null;
  createdAt: string;
  invitedAt?: string | null;
  invitationStatus?: string | null;
  invitationSentAt?: string | null;
  invitationExpiresAt?: string | null;
  invitationLastActivityAt?: string | null;
  memberState?: string;
  activeState?: 'ACTIVE' | 'INACTIVE';
};

export type UserListParams = {
  page?: number;
  limit?: number;
  role?: string;
  status?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export type UserListResponse = {
  users: OrgUser[];
  pagination: Pagination;
};

export async function getUsersFn(params?: UserListParams): Promise<UserListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.role) searchParams.set('role', params.role);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);
  const query = searchParams.toString() ? `?${searchParams}` : '';

  const { data } = await api.get<ApiResponse<OrgUser[]> & { meta?: { pagination: Pagination } }>(
    `/users${query}`
  );
  if (!data.success || !Array.isArray(data.data))
    throw new Error(data.error ?? 'Unable to load users.');
  const pagination = data.meta?.pagination;
  if (!pagination) throw new Error('Invalid response.');
  return { users: data.data, pagination };
}

export function useUsers(params?: UserListParams) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => getUsersFn(params),
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      handleApi(
        () => api.patch<ApiResponse<OrgUser>>(`/users/${userId}/role`, { role }),
        'Unable to update user role.'
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User role updated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      handleApi(
        () => api.post<ApiResponse<{ deactivated: boolean }>>(`/users/${userId}/deactivate`),
        'Unable to deactivate user.'
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deactivated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useReactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      handleApi(
        () => api.post<ApiResponse<OrgUser>>(`/users/${userId}/reactivate`),
        'Unable to reactivate user.'
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User reactivated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useResendInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      handleApi(
        () => api.post<ApiResponse<{ invitation: unknown; message: string }>>(`/users/${userId}/invitation/resend`),
        'Unable to resend invitation.'
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Invitation resent');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      handleApi(
        () => api.post<ApiResponse<{ invitation: unknown; message: string }>>(`/users/${userId}/invitation/revoke`),
        'Unable to revoke invitation.'
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Invitation revoked');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}
