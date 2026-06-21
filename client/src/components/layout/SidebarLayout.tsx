import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  FileText,
  Globe,
  LayoutDashboard,
  Laptop,
  Library,
  ClipboardCheck,
  ClipboardList,
  Menu,
  Settings,
  ShieldCheck,
  Store,
  ToggleRight,
  Users,
  ChevronLeft,
  ChevronRight,
  Plug,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore, type UserRole } from '@/store/useAuthStore';
import { TopBar } from './TopBar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

type NavItem = {
  label: string;
  to: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  allowedRoles: UserRole[];
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'General',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, allowedRoles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
      { label: 'Activity', to: '/activity', icon: Activity, allowedRoles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { label: 'Frameworks', to: '/frameworks', icon: Globe, allowedRoles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
      { label: 'Controls', to: '/controls', icon: ToggleRight, allowedRoles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
      { label: 'Tests', to: '/tests', icon: ClipboardCheck, allowedRoles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
      { label: 'Policies', to: '/policies', icon: BookOpen, allowedRoles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
      { label: 'Documents', to: '/documents', icon: FileText, allowedRoles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
      { label: 'Audits', to: '/audits', icon: ShieldCheck, allowedRoles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
      { label: 'Reports', to: '/reports', icon: BarChart3, allowedRoles: ['ADMIN', 'MANAGER', 'AUDITOR'] },
    ],
  },
  {
    label: 'Management',
    items: [
      { label: 'Risks', to: '/risks', icon: AlertTriangle, allowedRoles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
      { label: 'Risk Library', to: '/risk-library', icon: Library, allowedRoles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
      { label: 'Vendors', to: '/vendors', icon: Store, allowedRoles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
      { label: 'Personnel', to: '/personnel', icon: Users, allowedRoles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
      { label: 'Access Reviews', to: '/access-reviews', icon: ClipboardList, allowedRoles: ['ADMIN', 'MANAGER'] },
      { label: 'Devices', to: '/devices', icon: Laptop, allowedRoles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
      { label: 'Integrations', to: '/integrations', icon: Plug, allowedRoles: ['ADMIN', 'MANAGER'] },
    ],
  },
  {
    label: 'Settings',
    items: [
      { label: 'People & Groups', to: '/settings/people-groups', icon: Users, allowedRoles: ['ADMIN', 'MANAGER'] },
      { label: 'Settings', to: '/settings', icon: Settings, allowedRoles: ['ADMIN'] },
    ],
  },
];

type SidebarLayoutProps = {
  children?: React.ReactNode;
};

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const role = useAuthStore((state) => state.user?.role);
  const contentShellClass = 'w-full max-w-[120rem] 2xl:max-w-[140rem]';

  const toggleCollapsed = () => setCollapsed((prev) => !prev);

  const sidebarWidthClass = collapsed ? 'w-20' : 'w-64';

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const visibleNavGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => role && item.allowedRoles.includes(role)),
  })).filter((group) => group.items.length > 0);

  const mobileMenuTrigger = (
    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-foreground hover:bg-accent lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-left">
            <img src="/favicon.png" alt="Veraha" className="h-7 w-7 object-contain" />
            <span className="font-heading text-lg">Veraha Security</span>
          </SheetTitle>
        </SheetHeader>
        <nav className="flex-1 space-y-4 overflow-auto px-2 py-4">
          {visibleNavGroups.map((group) => (
            <div key={group.label}>
              <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavItemLink
                    key={item.to}
                    item={item}
                    collapsed={false}
                    onNavigate={() => setMobileMenuOpen(false)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="flex items-center justify-between border-t border-sidebar-border px-3 py-3">
          <ThemeToggle />
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        className={cn(
          'hidden h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 lg:flex',
          sidebarWidthClass
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center gap-2 px-4">
          {collapsed ? (
            <img
              src="/favicon.png"
              alt="Veraha"
              className="h-9 w-9 object-contain"
            />
          ) : (
            <>
              <img
                src="/logo-brand.png"
                alt="Veraha Security"
                className="h-9 object-contain dark:hidden"
              />
              <img
                src="/logo-brand-white-text.png"
                alt="Veraha Security"
                className="hidden h-9 object-contain dark:block"
              />
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className="mt-4 flex-1 space-y-4 overflow-y-auto px-2 pb-4">
          {visibleNavGroups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-white">
                  {group.label}
                </p>
              )}
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavItemLink
                    key={item.to}
                    item={item}
                    collapsed={collapsed}
                    onNavigate={undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer utilities */}
        <div className="flex items-center justify-between gap-2 border-t border-sidebar-border px-3 py-3 text-xs font-sans text-sidebar-foreground">
          <ThemeToggle />
          <button
            type="button"
            onClick={toggleCollapsed}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-1 text-[11px] font-medium text-foreground hover:bg-accent"
            title="Collapse sidebar"
          >
            {collapsed ? (
              <>
                <ChevronRight className="h-3 w-3" />
                <span className="sr-only">Expand</span>
              </>
            ) : (
              <>
                <ChevronLeft className="h-3 w-3" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar leftContent={mobileMenuTrigger} contentClassName={contentShellClass} />
        <main className="flex-1 overflow-auto bg-background">
          <div className={cn(contentShellClass, 'px-4 py-4 sm:px-6 sm:py-6')}>
            {children ?? <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
}

type NavItemLinkProps = {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
};

function NavItemLink({ item, collapsed, onNavigate }: NavItemLinkProps) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-sidebar-accent dark:hover:bg-sidebar-accent/50',
          'border-l-2 border-l-transparent',
          isActive &&
            'border-l-primary bg-sidebar-accent text-primary dark:bg-sidebar-accent/60'
        )
      }
      title={collapsed ? item.label : undefined}
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn(
              'h-4 w-4 flex-shrink-0',
              'text-primary dark:text-muted-foreground',
              isActive && 'text-primary'
            )}
          />
          {!collapsed && (
            <span className="truncate font-sans">{item.label}</span>
          )}
        </>
      )}
    </NavLink>
  );
}

export default SidebarLayout;
