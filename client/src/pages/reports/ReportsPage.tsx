import { Link } from 'react-router-dom';
import { BarChart3, ClipboardCheck, FileText, ShieldAlert, Store, Users } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/useAuthStore';

const REPORTS = [
  {
    title: 'Compliance',
    description: 'Control health, evidence status, policy acknowledgement, and framework readiness.',
    href: '/reports/compliance',
    icon: ClipboardCheck,
    roles: ['ADMIN', 'MANAGER', 'AUDITOR'],
  },
  {
    title: 'Personnel',
    description: 'Employee task completion, training progress, and device review status.',
    href: '/reports/personnel',
    icon: Users,
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    title: 'Risk',
    description: 'Residual exposure, treatment posture, open risks, and highest-priority items.',
    href: '/reports/risk',
    icon: ShieldAlert,
    roles: ['ADMIN', 'MANAGER', 'AUDITOR'],
  },
  {
    title: 'Vendor',
    description: 'Vendor risk tiers, lifecycle status, certification coverage, and high-risk vendors.',
    href: '/reports/vendor',
    icon: Store,
    roles: ['ADMIN', 'MANAGER', 'AUDITOR'],
  },
];

export function ReportsPage() {
  const role = useAuthStore((state) => state.user?.role);
  const visibleReports = REPORTS.filter((report) => role && report.roles.includes(role));
  const reportPath = (href: string) => (role === 'AUDITOR' ? href.replace('/reports', '/auditor/reports') : href);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Operational reporting for compliance, people, risk, and vendors."
        actions={
          <Button variant="outline" onClick={() => window.print()}>
            <FileText className="mr-2 size-4" />
            Print
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {visibleReports.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.href} className="rounded-md">
              <CardHeader className="gap-3 pb-2">
                <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <CardTitle className="text-base">{report.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <p className="min-h-16 text-sm text-muted-foreground">{report.description}</p>
                <Button asChild className="mt-auto w-fit">
                  <Link to={reportPath(report.href)}>
                    <BarChart3 className="mr-2 size-4" />
                    Open
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
