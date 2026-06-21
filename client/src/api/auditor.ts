import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from './axios';
import { getApiErrorMessage } from '@/lib/apiError';
import type { AuditEvidenceItem, AuditFinding, AuditRequest, AuditSummary } from './audits';

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

export type AuditorEngagement = {
  _id: string;
  auditId: AuditSummary;
  organizationId?: { _id: string; name: string };
  accessStartsAt?: string | null;
  accessEndsAt?: string | null;
};

export function useAuditorEngagements() {
  return useQuery({
    queryKey: ['auditor', 'engagements'],
    queryFn: () => handleApi(() => api.get<ApiResponse<AuditorEngagement[]>>('/auditor/engagements'), 'Unable to load engagements.'),
  });
}

export function useAuditorEngagement(auditId: string | null) {
  return useQuery({
    queryKey: ['auditor', 'engagements', auditId],
    queryFn: () => handleApi(() => api.get<ApiResponse<AuditSummary>>(`/auditor/engagements/${auditId}`), 'Unable to load engagement.'),
    enabled: !!auditId,
  });
}

export function useAuditorEvidence(auditId: string | null) {
  return useQuery({
    queryKey: ['auditor', 'engagements', auditId, 'evidence'],
    queryFn: () => handleApi(() => api.get<ApiResponse<AuditEvidenceItem[]>>(`/auditor/engagements/${auditId}/evidence`), 'Unable to load evidence.'),
    enabled: !!auditId,
  });
}

export function useAuditorReviewEvidence(auditId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, action, comment }: { itemId: string; action: 'approve' | 'flag' | 'not-applicable'; comment?: string }) =>
      handleApi(
        () => api.post<ApiResponse<AuditEvidenceItem>>(`/auditor/engagements/${auditId}/evidence/${itemId}/${action}`, { comment }),
        'Unable to update evidence review.'
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auditor', 'engagements', auditId, 'evidence'] });
      toast.success('Review updated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useAuditorRequests(auditId: string | null) {
  return useQuery({
    queryKey: ['auditor', 'engagements', auditId, 'requests'],
    queryFn: () => handleApi(() => api.get<ApiResponse<AuditRequest[]>>(`/auditor/engagements/${auditId}/requests`), 'Unable to load requests.'),
    enabled: !!auditId,
  });
}

export function useGetAuditorRequest(auditId: string | null, requestId: string | null) {
  return useQuery({
    queryKey: ['auditor', 'engagements', auditId, 'requests', requestId],
    queryFn: () =>
      handleApi(
        () => api.get<ApiResponse<AuditRequest>>(`/auditor/engagements/${auditId}/requests/${requestId}`),
        'Unable to load request.'
      ),
    enabled: !!auditId && !!requestId,
  });
}

export function useCreateAuditorRequest(auditId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; description?: string; auditEvidenceItemId?: string; dueDate?: string }) =>
      handleApi(() => api.post<ApiResponse<AuditRequest>>(`/auditor/engagements/${auditId}/requests`, input), 'Unable to create request.'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auditor', 'engagements', auditId, 'requests'] });
      toast.success('Evidence request created');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useAuditorFindings(auditId: string | null) {
  return useQuery({
    queryKey: ['auditor', 'engagements', auditId, 'findings'],
    queryFn: () => handleApi(() => api.get<ApiResponse<AuditFinding[]>>(`/auditor/engagements/${auditId}/findings`), 'Unable to load findings.'),
    enabled: !!auditId,
  });
}

export function useCreateAuditorFinding(auditId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; description?: string; severity: AuditFinding['severity']; linkedControl?: string }) =>
      handleApi(
        () => api.post<ApiResponse<AuditFinding>>(`/auditor/engagements/${auditId}/findings`, input),
        'Unable to create finding.'
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auditor', 'engagements', auditId, 'findings'] });
      toast.success('Finding created');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useUploadAuditorReport(auditId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return handleApi(
        () =>
          api.post<ApiResponse<{ _id: string; fileName: string; fileUrl?: string }>>(
            `/auditor/engagements/${auditId}/report`,
            formData,
            { headers: { 'Content-Type': 'multipart/form-data' } }
          ),
        'Unable to upload report.'
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auditor', 'engagements', auditId] });
      toast.success('Report uploaded');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useAddAuditorRequestMessage(auditId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, body }: { requestId: string; body: string }) =>
      handleApi(
        () =>
          api.post<ApiResponse<AuditRequest>>(
            `/auditor/engagements/${auditId}/requests/${requestId}/messages`,
            { body }
          ),
        'Unable to send message.'
      ),
    onSuccess: (_data, { requestId }) => {
      queryClient.invalidateQueries({ queryKey: ['auditor', 'engagements', auditId, 'requests', requestId] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useCompleteAuditorAudit(auditId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => handleApi(() => api.post<ApiResponse<AuditSummary>>(`/auditor/engagements/${auditId}/complete`), 'Unable to complete audit.'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auditor', 'engagements'] });
      queryClient.invalidateQueries({ queryKey: ['auditor', 'engagements', auditId] });
      toast.success('Audit moved to completing');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}
