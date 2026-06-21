import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from './axios';
import { getApiErrorMessage } from '@/lib/apiError';

type ApiResponse<T> = { success: boolean; data: T; error: string | null; meta?: unknown };
type PaginationMeta = {
  pagination: { page: number; limit: number; total: number; pages: number; hasNextPage: boolean; hasPrevPage: boolean };
};

async function handleApi<T>(fn: () => Promise<{ data: ApiResponse<T> }>, fallback: string): Promise<T> {
  try {
    const { data } = await fn();
    if (!data.success || data.data == null) throw new Error(data.error ?? fallback);
    return data.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err, fallback));
  }
}

export type AuditStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'READINESS_CHECK'
  | 'IN_PROGRESS'
  | 'COMPLETING'
  | 'COMPLETED'
  | 'ARCHIVED'
  | 'PREP'
  | 'FIELDWORK';

export type AuditOutcome = 'PENDING' | 'PASSED' | 'PASSED_WITH_EXCEPTIONS' | 'FAILED';

export type AuditSummary = {
  _id: string;
  name: string;
  description?: string;
  status: AuditStatus;
  outcome?: AuditOutcome;
  auditType?: string;
  auditorFirm?: string;
  auditorEmail?: string;
  periodStart: string;
  periodEnd: string;
  kickoffDate?: string;
  fieldworkStartDate?: string;
  fieldworkEndDate?: string;
  reportReceivedDate?: string;
  earlyAccessDate?: string;
  scopedControlIds?: Array<string | { _id: string }>;
  frameworkId?: { _id: string; code?: string; name?: string } | string;
  evidenceStatusCounts?: Record<string, number>;
  requestStatusCounts?: Record<string, number>;
  reports?: Array<{
    _id: string;
    fileName: string;
    fileUrl?: string;
    createdAt: string;
    uploadedBy?: { firstName?: string; lastName?: string; email?: string };
  }>;
};

export type AuditEvidenceItem = {
  _id: string;
  auditId: string;
  title: string;
  description?: string;
  fileName?: string;
  fileUrl?: string;
  status: 'NOT_STARTED' | 'READY_FOR_AUDIT' | 'APPROVED' | 'FLAGGED' | 'NOT_APPLICABLE';
  flagReason?: string;
  customerResponse?: string;
  controlId?: { _id: string; identifier?: string; title?: string; overallStatus?: string };
  evidenceId?: { _id: string; title?: string; status?: string; fileName?: string; fileUrl?: string };
};

export type AuditRequestMessage = {
  _id?: string;
  author?: { firstName?: string; lastName?: string; email?: string; role?: string };
  role: 'AUDITOR' | 'INTERNAL';
  body: string;
  attachmentUrl?: string;
  createdAt?: string;
};

export type AuditRequestStatus =
  | 'OPEN'
  | 'IN_REVIEW'
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'COMPLETED'
  | 'CLOSED';

export type AuditRequest = {
  _id: string;
  title: string;
  description?: string;
  status: AuditRequestStatus;
  dueDate?: string;
  assignedTo?: { _id?: string; firstName?: string; lastName?: string; email?: string };
  messages?: AuditRequestMessage[];
  submittedItems?: Array<{ _id: string; title?: string; status?: string; fileName?: string; fileUrl?: string }>;
  submittedEvidenceId?: { _id: string; title?: string; status?: string };
  requestedBy?: { firstName?: string; lastName?: string; email?: string };
};

export type AuditFinding = {
  _id: string;
  title: string;
  description?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'REMEDIATED' | 'ACCEPTED_RISK';
  remediationNote?: string;
  linkedControl?: { _id: string; identifier?: string; title?: string };
  createdBy?: { firstName?: string; lastName?: string; email?: string };
  createdAt?: string;
};

export type AuditReadiness = {
  auditId: string;
  status: AuditStatus;
  overallReadinessScore: number;
  evidence: {
    total: number;
    reviewed: number;
    readinessPercent: number;
    byStatus: Record<string, number>;
  };
  requests: {
    total: number;
    completed: number;
    readinessPercent: number;
    byStatus: Record<string, number>;
  };
  findings: {
    total: number;
    open: number;
    bySeverity: Record<string, number>;
    openBySeverity: Record<string, number>;
  };
  milestones: {
    kickoffDate?: string;
    fieldworkStartDate?: string;
    fieldworkEndDate?: string;
    reportReceivedDate?: string;
    earlyAccessDate?: string;
  };
  blockers: string[];
  canComplete: boolean;
};

export type AuditActivityEntry = {
  _id: string;
  action: string;
  entityType: string;
  entityId: string;
  entitySnapshot?: { title?: string; identifier?: string };
  actorSnapshot?: { email?: string; name?: string; role?: string };
  timestamp: string;
  notes?: string;
  changes?: { after?: Record<string, unknown>; fields?: string[] };
};

export type AuditActivityResponse = {
  activities: AuditActivityEntry[];
  pagination: PaginationMeta['pagination'];
};

export type AuditStats = {
  total: number;
  byStatus: Record<string, number>;
  inProgress: number;
  completedThisYear: number;
  openHighCriticalFindings: number;
  upcomingDeadlines: Array<{ auditId: string; periodEnd: string; status: AuditStatus }>;
};

export type AuditorLookupResult =
  | {
      state: 'AUDITOR_EXISTS';
      email: string;
      message: string;
      user: { _id: string; email: string; firstName?: string; lastName?: string; role: string; status: string };
    }
  | {
      state: 'ROLE_CONFLICT';
      email: string;
      message: string;
      user: { _id: string; email: string; firstName?: string; lastName?: string; role: string; status: string };
    }
  | {
      state: 'NOT_FOUND';
      email: string;
      message: string;
    };

export type AuditListResponse = {
  audits: AuditSummary[];
  pagination: PaginationMeta['pagination'];
};

/** Compute evidence readiness % from status count map returned by list/detail APIs. */
export function computeEvidenceReadiness(counts?: Record<string, number>): number {
  if (!counts) return 0;
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  if (!total) return 0;
  const reviewed = (counts.APPROVED || 0) + (counts.NOT_APPLICABLE || 0);
  return Math.round((reviewed / total) * 100);
}

export const AUDIT_STATUS_TRANSITIONS: Partial<Record<AuditStatus, AuditStatus[]>> = {
  DRAFT: ['SCHEDULED', 'READINESS_CHECK'],
  SCHEDULED: ['READINESS_CHECK', 'IN_PROGRESS'],
  READINESS_CHECK: ['IN_PROGRESS', 'SCHEDULED'],
  IN_PROGRESS: ['COMPLETING'],
  COMPLETING: ['COMPLETED'],
  COMPLETED: ['ARCHIVED'],
  // Legacy status migration paths
  PREP: ['DRAFT'],
  FIELDWORK: ['IN_PROGRESS'],
};

export type AuditListParams = {
  status?: string;
  controlId?: string;
  page?: number;
  limit?: number;
};

export async function getAuditsFn(params?: AuditListParams): Promise<AuditListResponse> {
  const { data } = await api.get<ApiResponse<AuditSummary[]> & { meta?: PaginationMeta }>('/audits', {
    params,
  });
  if (!data.success || !Array.isArray(data.data)) throw new Error(data.error ?? 'Unable to load audits.');
  return { audits: data.data, pagination: data.meta!.pagination };
}

export function useAudits(params?: AuditListParams) {
  return useQuery({ queryKey: ['audits', params], queryFn: () => getAuditsFn(params) });
}

export function useAuditStats() {
  return useQuery({
    queryKey: ['audits', 'stats'],
    queryFn: () => handleApi(() => api.get<ApiResponse<AuditStats>>('/audits/stats'), 'Unable to load audit stats.'),
  });
}

export function useAudit(id: string | null) {
  return useQuery({
    queryKey: ['audits', id],
    queryFn: () => handleApi(() => api.get<ApiResponse<AuditSummary>>(`/audits/${id}`), 'Unable to load audit.'),
    enabled: !!id,
  });
}

export function useAuditReadiness(auditId: string | null) {
  return useQuery({
    queryKey: ['audits', auditId, 'readiness'],
    queryFn: () => handleApi(() => api.get<ApiResponse<AuditReadiness>>(`/audits/${auditId}/readiness`), 'Unable to load readiness.'),
    enabled: !!auditId,
  });
}

export function useAuditActivity(auditId: string | null, page = 1) {
  return useQuery({
    queryKey: ['audits', auditId, 'activity', page],
    queryFn: () =>
      handleApi(
        () => api.get<ApiResponse<AuditActivityResponse>>(`/audits/${auditId}/activity`, { params: { page, limit: 50 } }),
        'Unable to load audit history.'
      ),
    enabled: !!auditId,
  });
}

export function useCreateAudit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<AuditSummary> & { name: string; periodStart: string; periodEnd: string }) =>
      handleApi(() => api.post<ApiResponse<AuditSummary>>('/audits', input), 'Unable to create audit.'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audits'] });
      toast.success('Audit created');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useTransitionAudit(auditId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: AuditStatus) =>
      handleApi(() => api.post<ApiResponse<AuditSummary>>(`/audits/${auditId}/transition`, { status }), 'Unable to update audit status.'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audits'] });
      queryClient.invalidateQueries({ queryKey: ['audits', auditId] });
      queryClient.invalidateQueries({ queryKey: ['audits', auditId, 'readiness'] });
      toast.success('Audit status updated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useCompleteAudit(auditId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => handleApi(() => api.post<ApiResponse<AuditSummary>>(`/audits/${auditId}/complete`), 'Unable to complete audit.'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audits'] });
      queryClient.invalidateQueries({ queryKey: ['audits', auditId] });
      queryClient.invalidateQueries({ queryKey: ['audits', auditId, 'readiness'] });
      toast.success('Audit moved to completing');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useSnapshotAudit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (auditId: string) =>
      handleApi(
        () => api.post<ApiResponse<{ createdSnapshots: number; createdItems: number }>>(`/audits/${auditId}/snapshot`),
        'Unable to snapshot audit.'
      ),
    onSuccess: (_, auditId) => {
      queryClient.invalidateQueries({ queryKey: ['audits'] });
      queryClient.invalidateQueries({ queryKey: ['audits', auditId] });
      queryClient.invalidateQueries({ queryKey: ['audits', auditId, 'evidence'] });
      queryClient.invalidateQueries({ queryKey: ['audits', auditId, 'readiness'] });
      toast.success('Audit snapshot created');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useUploadAuditReport(auditId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return handleApi(
        () =>
          api.post<ApiResponse<{ _id: string; fileName: string; fileUrl?: string }>>(`/audits/${auditId}/report`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          }),
        'Unable to upload report.'
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audits', auditId] });
      toast.success('Report uploaded');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useInviteAuditor(auditId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      email: string;
      firstName?: string;
      lastName?: string;
      mode?: 'assign' | 'invite' | 'provision';
      confirmRoleChange?: boolean;
      password?: string;
    }) =>
      handleApi(() => api.post<ApiResponse<unknown>>(`/audits/${auditId}/invite-auditor`, input), 'Unable to invite auditor.'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audits', auditId] });
      toast.success('Auditor assigned');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useLookupAuditor(auditId: string | null) {
  return useMutation({
    mutationFn: (email: string) =>
      handleApi(
        () => api.post<ApiResponse<AuditorLookupResult>>(`/audits/${auditId}/auditor-lookup`, { email }),
        'Unable to verify auditor email.'
      ),
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useAuditEvidence(auditId: string | null) {
  return useQuery({
    queryKey: ['audits', auditId, 'evidence'],
    queryFn: () => handleApi(() => api.get<ApiResponse<AuditEvidenceItem[]>>(`/audits/${auditId}/evidence`), 'Unable to load audit evidence.'),
    enabled: !!auditId,
  });
}

export function useRespondAuditEvidence(auditId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, response }: { itemId: string; response: string }) =>
      handleApi(
        () => api.post<ApiResponse<AuditEvidenceItem>>(`/audits/${auditId}/evidence/${itemId}/respond`, { response }),
        'Unable to respond to evidence.'
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audits', auditId, 'evidence'] });
      queryClient.invalidateQueries({ queryKey: ['audits', auditId, 'readiness'] });
      toast.success('Evidence returned for review');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useAuditRequests(auditId: string | null) {
  return useQuery({
    queryKey: ['audits', auditId, 'requests'],
    queryFn: () => handleApi(() => api.get<ApiResponse<AuditRequest[]>>(`/audits/${auditId}/requests`), 'Unable to load audit requests.'),
    enabled: !!auditId,
  });
}

export function useUpdateAuditRequest(auditId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      ...body
    }: {
      requestId: string;
      status?: AuditRequestStatus;
      assignedTo?: string | null;
      dueDate?: string | null;
    }) =>
      handleApi(
        () => api.patch<ApiResponse<AuditRequest>>(`/audits/${auditId}/requests/${requestId}`, body),
        'Unable to update request.'
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audits', auditId, 'requests'] });
      toast.success('Request updated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useSubmitAuditEvidence(auditId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, itemId }: { requestId: string; itemId: string }) =>
      handleApi(
        () => api.post<ApiResponse<AuditRequest>>(`/audits/${auditId}/requests/${requestId}/submit-evidence`, { itemId }),
        'Unable to link evidence.'
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audits', auditId, 'requests'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useSubmitAuditRequest(auditId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, evidenceId }: { requestId: string; evidenceId?: string }) =>
      handleApi(
        () => api.post<ApiResponse<AuditRequest>>(`/audits/${auditId}/requests/${requestId}/submit`, { evidenceId }),
        'Unable to submit request.'
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audits', auditId, 'requests'] });
      queryClient.invalidateQueries({ queryKey: ['audits', auditId, 'readiness'] });
      toast.success('Request submitted');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

// ── Findings hooks ──────────────────────────────────────────────────────────

export function useAuditFindings(auditId: string | null, query?: { severity?: string; status?: string }) {
  return useQuery({
    queryKey: ['audits', auditId, 'findings', query],
    queryFn: () =>
      handleApi(
        () => api.get<ApiResponse<AuditFinding[]>>(`/audits/${auditId}/findings`, { params: query }),
        'Unable to load findings.'
      ),
    enabled: !!auditId,
  });
}

export function useCreateAuditFinding(auditId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      title: string;
      description?: string;
      severity: AuditFinding['severity'];
      linkedControl?: string | null;
    }) =>
      handleApi(
        () => api.post<ApiResponse<AuditFinding>>(`/audits/${auditId}/findings`, input),
        'Unable to create finding.'
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audits', auditId, 'findings'] });
      queryClient.invalidateQueries({ queryKey: ['audits', auditId, 'readiness'] });
      toast.success('Finding created');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useUpdateAuditFinding(auditId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      findingId,
      ...body
    }: {
      findingId: string;
      status?: AuditFinding['status'];
      remediationNote?: string;
    }) =>
      handleApi(
        () => api.patch<ApiResponse<AuditFinding>>(`/audits/${auditId}/findings/${findingId}`, body),
        'Unable to update finding.'
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audits', auditId, 'findings'] });
      queryClient.invalidateQueries({ queryKey: ['audits', auditId, 'readiness'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useDeleteAuditFinding(auditId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (findingId: string) =>
      handleApi(
        () => api.delete<ApiResponse<unknown>>(`/audits/${auditId}/findings/${findingId}`),
        'Unable to delete finding.'
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audits', auditId, 'findings'] });
      queryClient.invalidateQueries({ queryKey: ['audits', auditId, 'readiness'] });
      toast.success('Finding deleted');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

// ── Request thread hooks ─────────────────────────────────────────────────────

export function useGetAuditRequest(auditId: string | null, requestId: string | null) {
  return useQuery({
    queryKey: ['audits', auditId, 'requests', requestId],
    queryFn: () =>
      handleApi(
        () => api.get<ApiResponse<AuditRequest>>(`/audits/${auditId}/requests/${requestId}`),
        'Unable to load request.'
      ),
    enabled: !!auditId && !!requestId,
  });
}

export function useAddAuditRequestMessage(auditId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, body }: { requestId: string; body: string }) =>
      handleApi(
        () =>
          api.post<ApiResponse<AuditRequest>>(`/audits/${auditId}/requests/${requestId}/messages`, { body }),
        'Unable to send message.'
      ),
    onSuccess: (_data, { requestId }) => {
      queryClient.invalidateQueries({ queryKey: ['audits', auditId, 'requests', requestId] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}
