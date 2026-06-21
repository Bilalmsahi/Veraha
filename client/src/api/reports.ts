import { useQuery } from '@tanstack/react-query';
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

export type CountMap = Record<string, number>;

export type ComplianceReportParams = {
  timeframe?: '30d' | '90d' | '180d' | '1y' | 'all';
  frameworks?: string[];
  startDate?: string;
  endDate?: string;
};

export type ComplianceReport = {
  generatedAt: string;
  overall: {
    totalControls: number;
    passingControls: number;
    totalRequirements?: number;
    passingRequirements?: number;
    compliancePercent: number;
  };
  controlsByStatus: CountMap;
  evidenceByStatus: CountMap;
  policyAcknowledgement: {
    totalAssignments: number;
    acknowledged: number;
    percentAcknowledged: number;
  };
  frameworkBreakdown: Array<{
    code: string;
    name: string;
    totalControls: number;
    passingControls: number;
    totalRequirements?: number;
    passingRequirements?: number;
    readinessScore?: number;
    compliancePercent: number;
  }>;
  topFailingControls: Array<{
    _id: string;
    controlId?: string;
    title: string;
    status: string;
    updatedAt?: string;
  }>;
};

export type PersonnelReport = {
  generatedAt: string;
  totalPersonnel: number;
  taskCompletion: {
    totalTasks: number;
    completeTasks: number;
    completionPercent: number;
  };
  roleBreakdown: CountMap;
  people: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    totalTasks: number;
    completeTasks: number;
    completionPercent: number;
  }>;
  trainingByModule: Array<{
    moduleId: string;
    title: string;
    attempts: number;
    passed: number;
    passRate: number;
  }>;
  deviceReviewsByStatus: CountMap;
};

export type RiskReport = {
  generatedAt: string;
  totalOpen: number;
  residualByBand: CountMap;
  byTreatment: CountMap;
  byStatus: CountMap;
  topRisks: Array<{
    _id: string;
    title: string;
    status: string;
    residualScore?: number;
    residualBand?: string;
    treatmentType?: string;
    ownerName?: string | null;
  }>;
};

export type VendorReport = {
  generatedAt: string;
  total?: number;
  byStatus?: CountMap;
  byRiskTier?: CountMap;
  certificationCoverage: {
    totalVendors: number;
    vendorsWithCertifications: number;
    coveragePercent: number;
    certificationsByName: CountMap;
  };
  highRiskVendors: Array<{
    _id: string;
    name: string;
    riskTier?: string;
    status?: string;
    category?: string;
  }>;
};

function buildComplianceQuery(params?: ComplianceReportParams) {
  const searchParams = new URLSearchParams();
  if (params?.timeframe && params.timeframe !== 'all' && !params.startDate && !params.endDate) {
    searchParams.set('timeframe', params.timeframe);
  }
  if (params?.startDate) searchParams.set('startDate', params.startDate);
  if (params?.endDate) searchParams.set('endDate', params.endDate);
  if (params?.frameworks?.length) {
    searchParams.set('frameworks', params.frameworks.join(','));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export type ReportType = 'compliance' | 'personnel' | 'risk' | 'vendor';

export async function openReportPdf(
  type: ReportType,
  params?: ComplianceReportParams,
  disposition: 'inline' | 'attachment' = 'inline'
) {
  const query = new URLSearchParams();
  if (params?.timeframe && params.timeframe !== 'all' && !params.startDate && !params.endDate) {
    query.set('timeframe', params.timeframe);
  }
  if (params?.startDate) query.set('startDate', params.startDate);
  if (params?.endDate) query.set('endDate', params.endDate);
  if (params?.frameworks?.length) query.set('frameworks', params.frameworks.join(','));
  query.set('disposition', disposition);

  const response = await api.get(`/reports/${type}/pdf?${query.toString()}`, {
    responseType: 'blob',
  });
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const filename = `${type}-report-${new Date().toISOString().slice(0, 10)}.pdf`;

  if (disposition === 'attachment') {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function useComplianceReport(params?: ComplianceReportParams) {
  return useQuery({
    queryKey: ['reports', 'compliance', params],
    queryFn: () =>
      handleApi(
        () => api.get<ApiResponse<ComplianceReport>>(`/reports/compliance${buildComplianceQuery(params)}`),
        'Unable to load compliance report.'
      ),
  });
}

export function usePersonnelReport() {
  return useQuery({
    queryKey: ['reports', 'personnel'],
    queryFn: () =>
      handleApi(
        () => api.get<ApiResponse<PersonnelReport>>('/reports/personnel'),
        'Unable to load personnel report.'
      ),
  });
}

export function useRiskReport() {
  return useQuery({
    queryKey: ['reports', 'risk'],
    queryFn: () =>
      handleApi(
        () => api.get<ApiResponse<RiskReport>>('/reports/risk'),
        'Unable to load risk report.'
      ),
  });
}

export function useVendorReport() {
  return useQuery({
    queryKey: ['reports', 'vendor'],
    queryFn: () =>
      handleApi(
        () => api.get<ApiResponse<VendorReport>>('/reports/vendor'),
        'Unable to load vendor report.'
      ),
  });
}
