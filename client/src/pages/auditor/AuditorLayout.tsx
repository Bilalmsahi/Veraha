import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BarChart3, LogOut, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/useAuthStore';
import NotificationBell from '@/components/shared/NotificationBell';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { cn } from '@/lib/utils';

export function AuditorLayout() {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link to="/auditor" className="inline-flex items-center gap-2 font-semibold">
            <ShieldCheck className="size-5 text-primary" />
            Auditor Portal
          </Link>
          <div className="flex items-center gap-2">
            <NavLink
              to="/auditor/reports"
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground',
                  isActive && 'bg-accent text-foreground'
                )
              }
            >
              <BarChart3 className="size-4" />
              Reports
            </NavLink>
            <ThemeToggle />
            <NotificationBell />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              <LogOut className="mr-2 size-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
