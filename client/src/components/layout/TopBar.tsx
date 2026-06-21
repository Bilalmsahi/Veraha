import { useLocation, useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/useAuthStore';
import { useQuickStats } from '@/api/dashboard';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import NotificationBell from '@/components/shared/NotificationBell';

type TopBarProps = {
  leftContent?: React.ReactNode;
  contentClassName?: string;
};

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  activity: 'Activity',
  frameworks: 'Frameworks',
  controls: 'Controls',
  tests: 'Tests',
  policies: 'Policies',
  evidence: 'Documents',
  documents: 'Documents',
  risks: 'Risks',
  vendors: 'Vendors',
  personnel: 'Personnel',
  audits: 'Audits',
  devices: 'Devices',
  'risk-library': 'Risk Library',
  'access-reviews': 'Access Reviews',
  settings: 'Settings',
};

function Breadcrumb() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);
  const label = ROUTE_LABELS[segments[0] ?? ''] ?? segments[0] ?? 'Home';

  return (
    <span className="text-sm font-medium text-muted-foreground">{label}</span>
  );
}

export function TopBar({ leftContent, contentClassName }: TopBarProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { data: quickStats } = useQuickStats();

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || user.email[0].toUpperCase()
    : '?';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div
        className={cn(
          'flex h-full w-full items-center justify-between gap-4 px-4 sm:px-6',
          contentClassName
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {leftContent}
          <Breadcrumb />
        </div>
        <div className="flex items-center gap-4">
          {quickStats && quickStats.compliancePercentage != null && (
            <div className="hidden sm:flex">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {quickStats.compliancePercentage}% compliant
              </span>
            </div>
          )}
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-primary/20 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 size-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
