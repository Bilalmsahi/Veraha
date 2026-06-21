import { usePermissions, type PermissionKey } from '@/hooks/usePermissions';

type PermissionGateProps = {
  permission: PermissionKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export function PermissionGate({
  permission,
  children,
  fallback = null,
}: PermissionGateProps) {
  const permissions = usePermissions();

  return permissions[permission] ? <>{children}</> : <>{fallback}</>;
}
