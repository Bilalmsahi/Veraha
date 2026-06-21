import { useQuery } from '@tanstack/react-query';
import { api } from './axios';
import { getApiErrorMessage } from '@/lib/apiError';
import type { OverallStatus } from '@/types/enums';

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

// ─── Quick Stats (header) ───────────────────────────────────────────────────
export type QuickStats = {
  totalControls: number;
  passingControls: number;
  failingControls: number;
  warningControls: number;
  compliancePercentage: number;
};

export async function getQuickStatsFn(): Promise<QuickStats> {
  return handleApi(
    () => api.get<ApiResponse<QuickStats>>('/dashboard/quick-stats'),
    'Unable to load dashboard stats.'
  );
}

export function useQuickStats(enabled = true) {
  return useQuery({
    queryKey: ['dashboard', 'quick-stats'],
    queryFn: getQuickStatsFn,
    enabled,
  });
}

// ─── Summary (dashboard overview) ────────────────────────────────────────────
export type FrameworkReadinessItem = {
  code: string;
  name: string;
  readinessScore: number;
  complianceScore: number;
  gaps: number;
  passingRequirements?: number;
  totalRequirements: number;
  ready?: boolean;
  isPurchased?: boolean;
  isAccessible?: boolean;
};

export type MonitoringStatsItem = {
  needsAttention: number;
  ok: number;
  total: number;
};

export type DashboardSummary = {
  organization: {
    name: string;
    setupComplete: boolean;
    subscriptionTier?: string;
  };
  overallScore: number;
  controlCounts: Record<OverallStatus | 'total', number>;
  frameworkReadiness: FrameworkReadinessItem[];
  monitoring: {
    policies: MonitoringStatsItem;
    tests: MonitoringStatsItem;
    vendors: MonitoringStatsItem;
    documents: MonitoringStatsItem;
  };
  alerts: {
    expiringEvidence: number;
    overdueAssessments: number;
    failingControls: number;
    warningControls: number;
  };
};

export async function getSummaryFn(): Promise<DashboardSummary> {
  return handleApi(
    () => api.get<ApiResponse<DashboardSummary>>('/dashboard/summary'),
    'Unable to load compliance summary.'
  );
}

export function useSummary(enabled = true) {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: getSummaryFn,
    enabled,
  });
}

// ─── Frameworks (per-framework readiness) ─────────────────────────────────────
export type FrameworkReadinessDetail = {
  _id: string;
  code: string;
  name: string;
  version?: string;
  readinessScore: number;
  complianceScore: number;
  coveragePercentage: number;
  gapPercentage: number;
  totalRequirements: number;
  gaps: number;
  partial: number;
  covered: number;
  statusBreakdown?: Record<string, number>;
  recommendation?: string;
  ready?: boolean;
  isPurchased?: boolean;
  isAccessible?: boolean;
};

export async function getFrameworksFn(): Promise<FrameworkReadinessDetail[]> {
  return handleApi(
    () => api.get<ApiResponse<FrameworkReadinessDetail[]>>('/dashboard/frameworks'),
    'Unable to load framework readiness.'
  );
}

export function useFrameworks(enabled = true) {
  return useQuery({
    queryKey: ['dashboard', 'frameworks'],
    queryFn: getFrameworksFn,
    enabled,
  });
}

// ─── Activity (paginated) ────────────────────────────────────────────────────
export type ActivityItem = {
  _id: string;
  action: string;
  entityType: string;
  entityId?: string;
  entitySnapshot?: Record<string, unknown>;
  actor?: { _id: string; name: string; email: string };
  timestamp: string;
  notes?: string;
  metadata?: Record<string, unknown>;
};

export type ActivityResponse = {
  activities: ActivityItem[];
  pagination: Pagination;
};

export async function getActivityFn(params?: {
  page?: number;
  limit?: number;
}): Promise<ActivityResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page != null) searchParams.set('page', String(params.page));
  if (params?.limit != null) searchParams.set('limit', String(params.limit));
  const query = searchParams.toString() ? `?${searchParams}` : '';

  const { data } = await api.get<PaginatedResponse<ActivityItem[]>>(
    `/dashboard/activity${query}`
  );
  if (!data.success || !Array.isArray(data.data))
    throw new Error(data.error ?? 'Unable to load activity.');
  const pagination = data.meta?.pagination;
  if (!pagination) throw new Error('Invalid activity response.');
  return {
    activities: data.data,
    pagination,
  };
}

export function useActivity(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['dashboard', 'activity', params?.page ?? 1, params?.limit ?? 20],
    queryFn: () => getActivityFn(params),
  });
}

// ─── Alerts ──────────────────────────────────────────────────────────────────
export type ExpiringEvidenceAlert = {
  _id: string;
  title: string;
  validUntil: string;
  daysUntilExpiry: number;
  linkedControls?: Array<{ _id: string; identifier?: string; title?: string }>;
};

export type OverdueAssessmentAlert = {
  _id: string;
  identifier: string;
  title: string;
  nextAssessmentDue: string;
  lastAssessedAt?: string;
  daysOverdue: number;
  overallStatus: string;
};

export type NeverAssessedAlert = {
  _id: string;
  identifier: string;
  title: string;
  controlGroup?: string;
  daysSinceCreation: number;
};

export type DashboardAlerts = {
  expiringEvidence: ExpiringEvidenceAlert[];
  overdueAssessments: OverdueAssessmentAlert[];
  failingControls: Array<{ _id: string; identifier?: string; title?: string; controlGroup?: string }>;
  warningControls: Array<{ _id: string; identifier?: string; title?: string; controlGroup?: string }>;
  neverAssessed: NeverAssessedAlert[];
};

export async function getAlertsFn(): Promise<DashboardAlerts> {
  return handleApi(
    () => api.get<ApiResponse<DashboardAlerts>>('/dashboard/alerts'),
    'Unable to load alerts.'
  );
}

export function useAlerts(enabled = true) {
  return useQuery({
    queryKey: ['dashboard', 'alerts'],
    queryFn: getAlertsFn,
    enabled,
  });
}
