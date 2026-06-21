import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from './axios';
import { getApiErrorMessage } from '@/lib/apiError';
import { useOrgStore } from '@/store/useOrgStore';
import { LAST_ACTIVITY_STORAGE_KEY } from '@/constants/sessionTimeout';
import type { Organization } from '@/types/models';

type ApiResponse<T> = { success: boolean; data: T; error: string | null };

export const FRAMEWORK_CODES = ['SOC2', 'ISO27001', 'HIPAA', 'GDPR'] as const;

async function handleApi<T>(fn: () => Promise<{ data: ApiResponse<T> }>, fallback: string): Promise<T> {
  try {
    const { data } = await fn();
    if (!data.success || !data.data) throw new Error(data.error ?? fallback);
    return data.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err, fallback));
  }
}

export async function getOrgFn(): Promise<Organization> {
  return handleApi(
    () => api.get<ApiResponse<Organization>>('/organization'),
    'Unable to load organization. Please try again.'
  );
}

export function useOrganization() {
  const setOrg = useOrgStore((s) => s.setOrg);

  return useQuery({
    queryKey: ['organization'],
    queryFn: async () => {
      const org = await getOrgFn();
      setOrg(org);
      return org;
    },
  });
}

export type UpdateOrgInput = {
  name?: string;
  settings?: {
    timezone?: string;
    dateFormat?: string;
    evidenceExpiryWarningDays?: number;
    sessionTimeoutMinutes?: number;
  };
};

export async function updateOrgFn(input: UpdateOrgInput): Promise<Organization> {
  return handleApi(
    () => api.patch<ApiResponse<Organization>>('/organization', input),
    'Unable to update organization.'
  );
}

export function useUpdateOrg() {
  const queryClient = useQueryClient();
  const setOrg = useOrgStore((s) => s.setOrg);

  return useMutation({
    mutationFn: updateOrgFn,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['organization'] });
      const prev = queryClient.getQueryData<Organization>(['organization']);
      if (prev && (input.name != null || input.settings != null)) {
        const nextOrg = {
          ...prev,
          ...(input.name != null ? { name: input.name } : {}),
          ...(input.settings != null
            ? { settings: { ...prev.settings, ...input.settings } }
            : {}),
        };
        queryClient.setQueryData(['organization'], nextOrg);
        setOrg(nextOrg);
      }
      return { prev };
    },
    onError: (err, _input, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['organization'], ctx.prev);
      toast.error(getApiErrorMessage(err));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
    },
    onSuccess: (org) => {
      setOrg(org);
      if (typeof window !== 'undefined') {
        localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(Date.now()));
      }
      toast.success('Organization updated');
    },
  });
}

export type ToggleFrameworksInput = {
  enable?: string[];
  disable?: string[];
};

export async function toggleFrameworksFn(input: ToggleFrameworksInput): Promise<Organization> {
  return handleApi(
    () => api.patch<ApiResponse<Organization>>('/organization/frameworks', input),
    'Unable to update frameworks.'
  );
}

export function useToggleFrameworks() {
  const queryClient = useQueryClient();
  const setOrg = useOrgStore((s) => s.setOrg);

  return useMutation({
    mutationFn: toggleFrameworksFn,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['organization'] });
      const prev = queryClient.getQueryData<Organization>(['organization']);
      if (prev?.settings) {
        const current = (prev.settings.enabledFrameworks ?? []) as string[];
        const next = [...current];
        input.enable?.forEach((c) => {
          if (!next.includes(c)) next.push(c);
        });
        input.disable?.forEach((c) => {
          const i = next.indexOf(c);
          if (i >= 0) next.splice(i, 1);
        });
        const nextOrg = {
          ...prev,
          settings: { ...prev.settings, enabledFrameworks: next },
        };
        queryClient.setQueryData(['organization'], nextOrg);
        setOrg(nextOrg);
      }
      return { prev };
    },
    onError: (err, _input, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['organization'], ctx.prev);
      toast.error(getApiErrorMessage(err));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onSuccess: (org) => {
      setOrg(org);
      toast.success('Frameworks updated');
    },
  });
}
