import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';

type GuestGuardProps = {
  children: React.ReactNode;
};

/**
 * For auth pages (login, register). Redirects to dashboard if already logged in.
 */
export function GuestGuard({ children }: GuestGuardProps) {
  const token = useAuthStore((s) => s.token);

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
