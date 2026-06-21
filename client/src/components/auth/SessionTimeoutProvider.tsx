import { useAuthStore } from '@/store/useAuthStore';
import { useOrgStore } from '@/store/useOrgStore';
import { useMe } from '@/api/auth';
import { getSessionTimeoutMinutes } from '@/constants/sessionTimeout';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { SessionTimeoutModal } from '@/components/auth/SessionTimeoutModal';

export function SessionTimeoutProvider() {
  const token = useAuthStore((state) => state.token);
  const org = useOrgStore((state) => state.org);
  useMe(!!token);
  const timeoutMinutes = getSessionTimeoutMinutes(org?.settings);

  const { showWarning, stayLoggedIn, logOutNow } = useSessionTimeout({
    enabled: !!token,
    timeoutMinutes,
  });

  if (!token) {
    return null;
  }

  return (
    <SessionTimeoutModal
      open={showWarning}
      onStayLoggedIn={() => {
        void stayLoggedIn();
      }}
      onLogOutNow={logOutNow}
    />
  );
}
