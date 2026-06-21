import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from './axios';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAuthStore } from '@/store/useAuthStore';
import { useOrgStore } from '@/store/useOrgStore';
import { LAST_ACTIVITY_STORAGE_KEY } from '@/constants/sessionTimeout';
import type { User, Organization } from '@/types/models';
import type {
  LoginInput,
  RegisterInput,
  AcceptInviteInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  InviteInput,
} from '@/schemas/auth';

type AuthResponse = {
  user: User;
  organization: Organization;
  token: string;
  refreshToken?: string;
};

type ApiResponse<T> = { success: boolean; data: T; error: string | null };

export type InvitationValidation = {
  status: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  organization?: { _id: string; name: string; setupComplete?: boolean } | null;
  expiresAt?: string;
  sentAt?: string;
};

async function handleApi<T>(fn: () => Promise<{ data: ApiResponse<T> }>, fallback: string): Promise<T> {
  try {
    const { data } = await fn();
    if (!data.success || !data.data) throw new Error(data.error ?? fallback);
    return data.data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err, fallback));
  }
}

export async function loginFn(input: LoginInput): Promise<AuthResponse> {
  return handleApi(
    () => api.post<ApiResponse<AuthResponse>>('/auth/login', input),
    'Unable to sign in. Please check your credentials and try again.'
  );
}

export async function registerFn(input: RegisterInput): Promise<AuthResponse> {
  return handleApi(
    () => api.post<ApiResponse<AuthResponse>>('/auth/register', input),
    'Unable to create your account. Please try again.'
  );
}

export async function getMeFn(): Promise<{ user: User; organization: Organization }> {
  return handleApi(
    () => api.get<ApiResponse<{ user: User; organization: Organization }>>('/auth/me'),
    'Unable to load your profile. Please try again.'
  );
}

export async function logoutFn(): Promise<void> {
  const { refreshToken } = useAuthStore.getState();
  await api.post('/auth/logout', refreshToken ? { refreshToken } : undefined);
}

export async function touchActivityFn(): Promise<{ touched: boolean }> {
  return handleApi(
    () => api.post<ApiResponse<{ touched: boolean }>>('/auth/activity'),
    'Unable to update session activity.',
  );
}

export type UpdateUserSettingsInput = {
  sessionTimeoutMinutes: number;
};

export async function updateMySettingsFn(input: UpdateUserSettingsInput): Promise<{ user: User }> {
  return handleApi(
    () => api.patch<ApiResponse<{ user: User }>>('/auth/me/settings', input),
    'Unable to save session settings.',
  );
}

export async function acceptInviteFn(input: AcceptInviteInput): Promise<AuthResponse> {
  return handleApi(
    () => api.post<ApiResponse<AuthResponse>>('/auth/accept-invite', input),
    'Unable to accept the invitation. The link may have expired.'
  );
}

export async function validateInviteFn(token: string): Promise<InvitationValidation> {
  return handleApi(
    () => api.get<ApiResponse<InvitationValidation>>(`/auth/invitations/${encodeURIComponent(token)}`),
    'Unable to validate this invitation.'
  );
}

export async function trackInviteActivityFn(token: string): Promise<{ tracked: boolean }> {
  return handleApi(
    () => api.post<ApiResponse<{ tracked: boolean }>>(`/auth/invitations/${encodeURIComponent(token)}/activity`),
    'Unable to update invitation activity.'
  );
}

export async function forgotPasswordFn(input: ForgotPasswordInput): Promise<{ message: string }> {
  return handleApi(
    () => api.post<ApiResponse<{ message: string }>>('/auth/forgot-password', input),
    'Unable to send the reset link. Please try again.'
  );
}

export async function resetPasswordFn(input: ResetPasswordInput): Promise<AuthResponse> {
  return handleApi(
    () => api.post<ApiResponse<AuthResponse>>('/auth/reset-password', input),
    'Unable to reset your password. The link may have expired.'
  );
}

export async function inviteUserFn(input: InviteInput): Promise<{ user: User; message: string }> {
  return handleApi(
    () => api.post<ApiResponse<{ user: User; message: string }>>('/auth/invite', input),
    'Unable to send the invitation. Please try again.'
  );
}

export function useLogin(options?: { onSuccess?: (res: AuthResponse) => void }) {
  const setAuth = useAuthStore((s) => s.setAuth);
  const setOrg = useOrgStore((s) => s.setOrg);

  return useMutation({
    mutationFn: loginFn,
    onSuccess: (res) => {
      localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(Date.now()));
      setAuth({ token: res.token, refreshToken: res.refreshToken ?? null, user: res.user as Parameters<typeof setAuth>[0]['user'] });
      setOrg(res.organization);
      options?.onSuccess?.(res);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useRegister(options?: { onSuccess?: (res: AuthResponse) => void }) {
  const setAuth = useAuthStore((s) => s.setAuth);
  const setOrg = useOrgStore((s) => s.setOrg);

  return useMutation({
    mutationFn: registerFn,
    onSuccess: (res) => {
      localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(Date.now()));
      setAuth({ token: res.token, refreshToken: res.refreshToken ?? null, user: res.user as Parameters<typeof setAuth>[0]['user'] });
      setOrg(res.organization);
      options?.onSuccess?.(res);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useMe(enabled = true) {
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const setOrg = useOrgStore((s) => s.setOrg);

  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await getMeFn();
      setAuth({ token: useAuthStore.getState().token!, user: res.user as Parameters<typeof setAuth>[0]['user'] });
      setOrg(res.organization);
      return res;
    },
    enabled: enabled && !!token,
  });
}

export function useUpdateMySettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMySettingsFn,
    onSuccess: (res) => {
      queryClient.setQueryData(['auth', 'me'], (current: { user: User; organization: Organization } | undefined) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          user: res.user,
        };
      });
      toast.success('Session timeout saved');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useAcceptInvite(options?: { onSuccess?: (res: AuthResponse) => void }) {
  const setAuth = useAuthStore((s) => s.setAuth);
  const setOrg = useOrgStore((s) => s.setOrg);

  return useMutation({
    mutationFn: acceptInviteFn,
    onSuccess: (res) => {
      localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(Date.now()));
      setAuth({ token: res.token, refreshToken: res.refreshToken ?? null, user: res.user as Parameters<typeof setAuth>[0]['user'] });
      setOrg(res.organization);
      options?.onSuccess?.(res);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useValidateInvite(token: string) {
  return useQuery({
    queryKey: ['invite', token],
    queryFn: () => validateInviteFn(token),
    enabled: !!token,
    retry: false,
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: forgotPasswordFn,
    onSuccess: () => toast.success('Reset link sent. Check your email.'),
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useResetPassword() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const setOrg = useOrgStore((s) => s.setOrg);

  return useMutation({
    mutationFn: resetPasswordFn,
    onSuccess: (res) => {
      setAuth({ token: res.token, refreshToken: res.refreshToken ?? null, user: res.user as Parameters<typeof setAuth>[0]['user'] });
      setOrg(res.organization);
      toast.success('Password reset successfully');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useInviteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inviteUserFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      toast.success('Invitation sent');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

// =============================================================================
// OTP-BASED REGISTRATION
// =============================================================================

export async function registerSendOtpFn(input: { email: string }): Promise<{ message: string; testOtp?: string }> {
  return handleApi(
    () => api.post<ApiResponse<{ message: string; testOtp?: string }>>('/auth/register/send-otp', input),
    'Unable to send verification code.',
  );
}

export async function registerVerifyOtpFn(
  input: RegisterInput & { otp: string },
): Promise<AuthResponse> {
  return handleApi(
    () => api.post<ApiResponse<AuthResponse>>('/auth/register/verify-otp', input),
    'Unable to verify code and create account.',
  );
}

export function useRegisterSendOtp() {
  return useMutation({
    mutationFn: registerSendOtpFn,
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useRegisterVerifyOtp(options?: { onSuccess?: (res: AuthResponse) => void }) {
  const setAuth = useAuthStore((s) => s.setAuth);
  const setOrg = useOrgStore((s) => s.setOrg);

  return useMutation({
    mutationFn: registerVerifyOtpFn,
    onSuccess: (res) => {
      localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(Date.now()));
      setAuth({ token: res.token, refreshToken: res.refreshToken ?? null, user: res.user as Parameters<typeof setAuth>[0]['user'] });
      setOrg(res.organization);
      options?.onSuccess?.(res);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

// =============================================================================
// OTP-BASED FORGOT PASSWORD
// =============================================================================

export async function forgotPasswordVerifyOtpFn(input: { email: string; otp: string }): Promise<{ message: string; verified: boolean }> {
  return handleApi(
    () => api.post<ApiResponse<{ message: string; verified: boolean }>>('/auth/forgot-password/verify', input),
    'Unable to verify code.',
  );
}

export async function resetPasswordWithOtpFn(input: { email: string; password: string }): Promise<AuthResponse> {
  return handleApi(
    () => api.post<ApiResponse<AuthResponse>>('/auth/forgot-password/reset', input),
    'Unable to reset password.',
  );
}

export function useForgotPasswordVerifyOtp() {
  return useMutation({
    mutationFn: forgotPasswordVerifyOtpFn,
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useResetPasswordWithOtp(options?: { onSuccess?: (res: AuthResponse) => void }) {
  const setAuth = useAuthStore((s) => s.setAuth);
  const setOrg = useOrgStore((s) => s.setOrg);

  return useMutation({
    mutationFn: resetPasswordWithOtpFn,
    onSuccess: (res) => {
      setAuth({ token: res.token, refreshToken: res.refreshToken ?? null, user: res.user as Parameters<typeof setAuth>[0]['user'] });
      setOrg(res.organization);
      toast.success('Password reset successfully');
      options?.onSuccess?.(res);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}
