import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from './axios';
import { getApiErrorMessage } from '@/lib/apiError';

type ApiResponse<T> = { success: boolean; data: T; error: string | null };

async function handleApi<T>(fn: () => Promise<{ data: ApiResponse<T> }>, fallback: string): Promise<T> {
  try {
    const { data } = await fn();
    if (!data.success || data.data == null) throw new Error(data.error ?? fallback);
    return data.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err, fallback));
  }
}

export type AccessReviewTaskStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REVOKE_REQUESTED'
  | 'ESCALATED'
  | 'REVOKED';

export type AccessReviewTask = {
  _id: string;
  status: AccessReviewTaskStatus;
  decision?: string;
  decisionNotes?: string;
  resourceType: string;
  resourceName: string;
  accessRole: string;
  decidedAt?: string;
  revocationConfirmedAt?: string | null;
  campaignId?: { _id: string; name?: string; dueDate?: string; status?: string } | string;
  subjectUserId?: { firstName?: string; lastName?: string; email?: string; role?: string };
  reviewerId?: { _id?: string; firstName?: string; lastName?: string; email?: string; role?: string };
};

export type AccessReviewTaskSummary = {
  PENDING: number;
  APPROVED: number;
  REVOKE_REQUESTED: number;
  ESCALATED: number;
  REVOKED: number;
};

export type AccessReviewCampaign = {
  _id: string;
  name: string;
  description?: string;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  dueDate: string;
  reviewerType?: 'ADMIN' | 'MANAGER';
  resourceType?: string;
  resourceName?: string;
  totalTasks: number;
  completedTasks: number;
  createdAt?: string;
  taskSummary?: AccessReviewTaskSummary;
  tasks?: AccessReviewTask[];
};

export type AccessReviewTaskListParams = {
  status?: AccessReviewTaskStatus;
  campaignId?: string;
};

export function useAccessReviewCampaigns() {
  return useQuery({
    queryKey: ['access-reviews', 'campaigns'],
    queryFn: () => handleApi(() => api.get<ApiResponse<AccessReviewCampaign[]>>('/access-reviews/campaigns'), 'Unable to load access reviews.'),
  });
}

export function useAccessReviewCampaign(id: string | null) {
  return useQuery({
    queryKey: ['access-reviews', 'campaigns', id],
    queryFn: () => handleApi(() => api.get<ApiResponse<AccessReviewCampaign>>(`/access-reviews/campaigns/${id}`), 'Unable to load campaign.'),
    enabled: !!id,
  });
}

export function useCreateAccessReviewCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      description?: string;
      dueDate: string;
      reviewerType?: 'ADMIN' | 'MANAGER';
      resourceType?: string;
      resourceName?: string;
    }) =>
      handleApi(() => api.post<ApiResponse<AccessReviewCampaign>>('/access-reviews/campaigns', input), 'Unable to create campaign.'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-reviews'] });
      toast.success('Access review created');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useActivateAccessReviewCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => handleApi(() => api.post<ApiResponse<AccessReviewCampaign>>(`/access-reviews/campaigns/${id}/activate`), 'Unable to activate campaign.'),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['access-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['access-reviews', 'campaigns', id] });
      toast.success('Access review activated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useArchiveAccessReviewCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      handleApi(() => api.post<ApiResponse<AccessReviewCampaign>>(`/access-reviews/campaigns/${id}/archive`), 'Unable to archive campaign.'),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['access-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['access-reviews', 'campaigns', id] });
      toast.success('Campaign archived');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useDeleteAccessReviewCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      handleApi(() => api.delete<ApiResponse<{ deleted: boolean }>>(`/access-reviews/campaigns/${id}`), 'Unable to delete campaign.'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-reviews'] });
      toast.success('Campaign deleted');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useAccessReviewTasks(params?: AccessReviewTaskListParams) {
  return useQuery({
    queryKey: ['access-reviews', 'tasks', params],
    queryFn: () =>
      handleApi(
        () => api.get<ApiResponse<AccessReviewTask[]>>('/access-reviews/tasks', { params }),
        'Unable to load tasks.'
      ),
  });
}

export function useDecideAccessReviewTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, decision, notes }: { taskId: string; decision: 'APPROVE' | 'REVOKE' | 'ESCALATE'; notes?: string }) =>
      handleApi(() => api.post<ApiResponse<AccessReviewTask>>(`/access-reviews/tasks/${taskId}/decision`, { decision, notes }), 'Unable to submit decision.'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-reviews'] });
      toast.success('Decision recorded');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useReassignAccessReviewTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, reviewerId }: { taskId: string; reviewerId: string }) =>
      handleApi(
        () => api.patch<ApiResponse<AccessReviewTask>>(`/access-reviews/tasks/${taskId}/assign`, { reviewerId }),
        'Unable to reassign task.'
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-reviews'] });
      toast.success('Reviewer updated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useConfirmAccessRevocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      handleApi(() => api.post<ApiResponse<AccessReviewTask>>(`/access-reviews/tasks/${taskId}/confirm-revocation`), 'Unable to confirm revocation.'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-reviews'] });
      toast.success('Revocation confirmed');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}
