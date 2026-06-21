import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from './axios';
import { getApiErrorMessage } from '@/lib/apiError';

type ApiResponse<T> = { success: boolean; data: T; error: string | null };

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

export type Group = {
  _id: string;
  organizationId: string;
  type: string;
  name: string;
  slug: string;
  description?: string;
  memberUserIds?: string[];
  personnelTaskSetId?: string | null;
  activePolicyCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export async function getGroupsFn(params?: { type?: string; search?: string }): Promise<Group[]> {
  const searchParams = new URLSearchParams();
  if (params?.type) searchParams.set('type', params.type);
  if (params?.search) searchParams.set('search', params.search);
  const query = searchParams.toString() ? `?${searchParams}` : '';

  return handleApi(() => api.get<ApiResponse<Group[]>>(`/groups${query}`), 'Unable to load groups.');
}

export function useGroups(params?: { type?: string; search?: string }, enabled = true) {
  return useQuery({
    queryKey: ['groups', params],
    queryFn: () => getGroupsFn(params),
    enabled,
  });
}

export async function createGroupFn(input: {
  name: string;
  slug?: string;
  description?: string;
  type?: string;
  memberUserIds?: string[];
}): Promise<Group> {
  const slug = input.slug ?? input.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return handleApi(
    () => api.post<ApiResponse<Group>>('/groups', { ...input, slug: slug || `group-${Date.now()}` }),
    'Unable to create group.'
  );
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createGroupFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast.success('Group created');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function updateGroupFn(id: string, input: Partial<Omit<Group, '_id' | 'organizationId'>>): Promise<Group> {
  return handleApi(() => api.patch<ApiResponse<Group>>(`/groups/${id}`, input), 'Unable to update group.');
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Omit<Group, '_id' | 'organizationId'>> }) =>
      updateGroupFn(id, input),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups', id] });
      toast.success('Group updated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function deleteGroupFn(id: string): Promise<{ deleted: boolean; id: string }> {
  return handleApi(() => api.delete<ApiResponse<{ deleted: boolean; id: string }>>(`/groups/${id}`), 'Unable to delete group.');
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteGroupFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast.success('Group deleted');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function addGroupMembersFn(id: string, userIds: string[]): Promise<Group> {
  return handleApi(
    () => api.post<ApiResponse<Group>>(`/groups/${id}/members/add`, { userIds }),
    'Unable to add members.'
  );
}

export async function removeGroupMembersFn(id: string, userIds: string[]): Promise<Group> {
  return handleApi(
    () => api.post<ApiResponse<Group>>(`/groups/${id}/members/remove`, { userIds }),
    'Unable to remove members.'
  );
}

export function useUpdateGroupMembers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; action: 'add' | 'remove'; userIds: string[] }) =>
      args.action === 'add' ? addGroupMembersFn(args.id, args.userIds) : removeGroupMembersFn(args.id, args.userIds),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups', id] });
      toast.success('Group members updated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

