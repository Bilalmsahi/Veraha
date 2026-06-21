import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';

type InternalGuardProps = {
  children: React.ReactNode;
};

export function InternalGuard({ children }: InternalGuardProps) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (user?.role === 'AUDITOR') {
    return <Navigate to="/auditor" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
