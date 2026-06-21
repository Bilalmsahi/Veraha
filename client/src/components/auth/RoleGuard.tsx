import { Navigate } from 'react-router-dom';
import { useAuthStore, type UserRole } from '@/store/useAuthStore';

type RoleGuardProps = {
  allowedRoles: UserRole[];
  children: React.ReactNode;
  fallbackPath?: string;
};

export function RoleGuard({
  allowedRoles,
  children,
  fallbackPath = '/dashboard',
}: RoleGuardProps) {
  const role = useAuthStore((state) => state.user?.role);

  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}
