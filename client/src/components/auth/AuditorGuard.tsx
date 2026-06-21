import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useMe } from '@/api/auth';

type AuditorGuardProps = {
  children: React.ReactNode;
};

export function AuditorGuard({ children }: AuditorGuardProps) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const { isLoading } = useMe(!!token);

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (user?.role !== 'AUDITOR') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
