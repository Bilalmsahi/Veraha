import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from './axios';
import { getApiErrorMessage } from '@/lib/apiError';
import type { OrgUser } from './users';
import type { DeviceSettingsChecklistItem, DeviceSettingsChecklistKey } from '@/constants/deviceSettingsChecklist';

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

export type DeviceOs = 'macOS' | 'Windows' | 'Linux' | 'Other';

export type DeviceCompliance = {
  antivirusInstalled: boolean;
  diskEncryptionEnabled: boolean;
  screenLockEnabled: boolean;
  passwordManagerInstalled: boolean;
  antivirusName?: string;
  osUpToDate?: boolean;
  lastVerifiedDate?: string | null;
};

export type DeviceEvidenceFile = {
  _id: string;
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number | null;
};

export type DeviceEvidenceChecklistItem = DeviceSettingsChecklistItem & {
  evidenceFile?: DeviceEvidenceFile | null;
};

export type DeviceEvidence = {
  _id: string;
  deviceId: string;
  label: string;
  checklistItems: DeviceEvidenceChecklistItem[];
  evidenceFiles: DeviceEvidenceFile[];
  reviewStatus?: 'APPROVED' | 'SUBMITTED' | 'REJECTED';
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadedAt: string;
};

export type Device = {
  _id: string;
  organizationId: string;
  name: string;
  assignedUserId: OrgUser | string;
  os: DeviceOs;
  serialNumber?: string;
  deviceType?: DeviceType;
  osVersion?: string;
  mdmSource?: MdmSource;
  mdmEnrollmentStatus?: MdmEnrollmentStatus;
  overallComplianceStatus?: 'compliant' | 'non_compliant' | 'needs_review';
  linkedControlIds?: string[];
  compliance: DeviceCompliance;
  notes?: string;
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
};

export type DeviceDetail = Device & {
  evidence: DeviceEvidence[];
};

export type DeviceType = 'laptop' | 'desktop' | 'mobile' | 'server' | 'other';
export type MdmSource = 'manual' | 'jamf' | 'kandji' | 'intune' | 'jumpcloud' | 'ninjaone' | 'other';
export type MdmEnrollmentStatus = 'enrolled' | 'not_enrolled' | 'unknown';

export type DeviceInput = {
  name: string;
  assignedUserId: string;
  os: DeviceOs;
  osVersion?: string;
  serialNumber?: string;
  deviceType?: DeviceType;
  mdmSource?: MdmSource;
  mdmEnrollmentStatus?: MdmEnrollmentStatus;
  compliance: DeviceCompliance;
  notes?: string;
};

export type DeviceSettingsSubmission = {
  checklistItems: Array<{ key: DeviceSettingsChecklistKey; checked: boolean }>;
  files: Partial<Record<DeviceSettingsChecklistKey, File>>;
};

export type DeviceProofAccess = {
  url: string;
  mimeType: string;
  originalName: string;
  expiresIn: number | null;
};

export type DeviceListParams = {
  page?: number;
  limit?: number;
  search?: string;
  complianceStatus?: 'all' | 'compliant' | 'issues';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export type DeviceListResponse = {
  devices: Device[];
  pagination: Pagination;
};

export type DeviceStats = {
  total: number;
  compliant: number;
  issues: number;
};

const FILE_FIELD_BY_KEY: Record<DeviceSettingsChecklistKey, string> = {
  diskEncryptionEnabled: 'file_diskEncryptionEnabled',
  screenLockEnabled: 'file_screenLockEnabled',
  antivirus: 'file_antivirus',
  passwordManager: 'file_passwordManager',
};

export function isDeviceCompliant(device: Pick<Device, 'compliance'>) {
  return (
    device.compliance.antivirusInstalled &&
    device.compliance.diskEncryptionEnabled &&
    device.compliance.screenLockEnabled &&
    device.compliance.passwordManagerInstalled
  );
}

export function getAssignedUserName(user: Device['assignedUserId']) {
  if (!user || typeof user === 'string') return 'Unassigned';
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fullName || user.email;
}

export async function getDevicesFn(params?: DeviceListParams): Promise<DeviceListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.search) searchParams.set('search', params.search);
  if (params?.complianceStatus) searchParams.set('complianceStatus', params.complianceStatus);
  if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);
  const query = searchParams.toString() ? `?${searchParams}` : '';

  const { data } = await api.get<ApiResponse<Device[]> & { meta?: Pagination }>(`/devices${query}`);
  if (!data.success || !Array.isArray(data.data)) {
    throw new Error(data.error ?? 'Unable to load devices.');
  }
  if (!data.meta) throw new Error('Invalid devices response.');
  return { devices: data.data, pagination: data.meta };
}

export function useDevices(params?: DeviceListParams) {
  return useQuery({
    queryKey: ['devices', params],
    queryFn: () => getDevicesFn(params),
  });
}

export function useDevice(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ['devices', id],
    queryFn: () =>
      handleApi(() => api.get<ApiResponse<DeviceDetail>>(`/devices/${id}`), 'Unable to load device.'),
    enabled: !!id && enabled,
  });
}

export function useDeviceStats() {
  return useQuery({
    queryKey: ['devices', 'stats'],
    queryFn: () =>
      handleApi(() => api.get<ApiResponse<DeviceStats>>('/devices/stats'), 'Unable to load device stats.'),
  });
}

export function useCreateDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DeviceInput) =>
      handleApi(() => api.post<ApiResponse<Device>>('/devices', input), 'Unable to create device.'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success('Device added');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useUpdateDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: DeviceInput }) =>
      handleApi(() => api.put<ApiResponse<Device>>(`/devices/${id}`, input), 'Unable to update device.'),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['devices', id] });
      toast.success('Device updated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useDeleteDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      handleApi(() => api.delete<ApiResponse<{ deleted: boolean }>>(`/devices/${id}`), 'Unable to delete device.'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success('Device deleted');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useSubmitDeviceSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, submission }: { deviceId: string; submission: DeviceSettingsSubmission }) => {
      const formData = new FormData();
      formData.append('checklistItems', JSON.stringify(submission.checklistItems));
      for (const [key, file] of Object.entries(submission.files)) {
        if (file) {
          formData.append(FILE_FIELD_BY_KEY[key as DeviceSettingsChecklistKey], file);
        }
      }
      return handleApi(
        () => api.post<ApiResponse<DeviceEvidence>>(`/devices/${deviceId}/device-settings`, formData),
        'Unable to submit device settings.'
      );
    },
    onSuccess: (_, { deviceId }) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['devices', deviceId] });
      queryClient.invalidateQueries({ queryKey: ['personnel-tasks'] });
      toast.success('Device settings submitted');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function getDeviceProofAccessUrl(
  deviceId: string,
  evidenceId: string,
  fileId: string
): Promise<DeviceProofAccess> {
  return handleApi(
    () =>
      api.get<ApiResponse<DeviceProofAccess>>(
        `/devices/${deviceId}/evidence/${evidenceId}/proof/${fileId}/access-url`
      ),
    'Unable to load proof file.'
  );
}

export function useDeleteDeviceEvidence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, evidenceId }: { deviceId: string; evidenceId: string }) =>
      handleApi(
        () => api.delete<ApiResponse<{ deleted: boolean }>>(`/devices/${deviceId}/evidence/${evidenceId}`),
        'Unable to delete evidence.'
      ),
    onSuccess: (_, { deviceId }) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['devices', deviceId] });
      toast.success('Evidence deleted');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export async function linkDeviceControls(id: string, controlIds: string[]): Promise<Device> {
  return handleApi(
    () => api.post<ApiResponse<Device>>(`/devices/${id}/controls`, { controlIds }),
    'Failed to link controls'
  );
}

export async function unlinkDeviceControl(id: string, controlId: string): Promise<Device> {
  return handleApi(
    () => api.delete<ApiResponse<Device>>(`/devices/${id}/controls/${controlId}`),
    'Failed to unlink control'
  );
}

export function useLinkDeviceControls() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, controlIds }: { id: string; controlIds: string[] }) =>
      linkDeviceControls(id, controlIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success('Controls linked');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to link controls')),
  });
}

export function useUnlinkDeviceControl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, controlId }: { id: string; controlId: string }) =>
      unlinkDeviceControl(id, controlId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success('Control unlinked');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to unlink control')),
  });
}
