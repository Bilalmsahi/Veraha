import { Link } from 'react-router-dom';
import {
  CheckCircle,
  ChevronRight,
  FileText,
  FlaskConical,
  Files,
  Info,
  Lock,
  Store,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useSummary } from '@/api/dashboard';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { FormErrorAlert, PageHeader } from '@/components/shared';
import { formatFrameworkCode, formatPercentage } from '@/lib/formatters';

const frameworkDisplayNames: Record<string, string> = {
  'HIPAA Security Rule': 'HIPAA',
  'General Data Protection Regulation': 'General Data Protection Regulation (GDPR)',
  'ISO/IEC 27001:2022': 'ISO 27001',
};

function getFrameworkDisplayName(name: string) {
  return formatFrameworkCode(frameworkDisplayNames[name] ?? name);
}

function getPassingRequirements(
  totalRequirements: number,
  gaps: number,
  passingRequirements?: number
) {
  return passingRequirements ?? Math.max(totalRequirements - gaps, 0);
}

export function DashboardPage() {
  const summary = useSummary();

  if (summary.isLoading) {
    return <DashboardSkeleton />;
  }

  if (summary.error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" />
        <FormErrorAlert
          message={(summary.error as Error).message}
          onRetry={() => summary.refetch()}
        />
      </div>
    );
  }

  const frameworks = summary.data?.frameworkReadiness ?? [];
  const monitoring = summary.data?.monitoring;
  const emptyMonitoringStats = { needsAttention: 0, ok: 0, total: 0 };
  const monitoringRows = [
    {
      title: 'Policies',
      icon: FileText,
      to: '/policies',
      stats: monitoring?.policies ?? emptyMonitoringStats,
    },
    {
      title: 'Tests',
      icon: FlaskConical,
      to: '/tests',
      stats: monitoring?.tests ?? emptyMonitoringStats,
    },
    {
      title: 'Vendors',
      icon: Store,
      to: '/vendors',
      stats: monitoring?.vendors ?? emptyMonitoringStats,
    },
    {
      title: 'Documents',
      icon: Files,
      to: '/documents',
      stats: monitoring?.documents ?? emptyMonitoringStats,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        actions={
          <Button type="button" variant="outline">
            <CheckCircle className="size-4" aria-hidden />
            View open tasks
          </Button>
        }
      />

      <section aria-labelledby="compliance-progress-heading">
        <div className="mb-4 flex items-end justify-between">
          <h2 id="compliance-progress-heading" className="text-xl font-semibold">
            Compliance progress
          </h2>
          <span className="text-sm text-muted-foreground">
            Last updated less than a minute ago
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {frameworks.map((fw) => {
            const displayName = getFrameworkDisplayName(fw.name);
            const isLocked = fw.isPurchased === false || fw.isAccessible === false;
            const passingRequirements = getPassingRequirements(
              fw.totalRequirements,
              fw.gaps,
              fw.passingRequirements
            );
            const cardBody = (
              <>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="flex min-w-0 items-center gap-2 text-lg font-medium">
                    <span className="truncate">{displayName}</span>
                    {isLocked ? (
                      <Badge variant="secondary" className="shrink-0 gap-1">
                        <Lock className="size-3" aria-hidden />
                        Locked
                      </Badge>
                    ) : null}
                  </CardTitle>
                  <CardAction>
                    {isLocked ? (
                      <Lock className="size-5 text-muted-foreground" aria-hidden />
                    ) : (
                      <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                    )}
                  </CardAction>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-end justify-between gap-3">
                    <p className="text-4xl font-bold">
                      {formatPercentage(fw.readinessScore)}
                    </p>
                    {isLocked ? (
                      <span className="mb-1 text-xs font-medium text-muted-foreground">
                        Contact admin to unlock
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {passingRequirements} of {fw.totalRequirements} requirements passing
                  </p>
                  <Progress value={fw.readinessScore} className="mt-4 h-2 bg-secondary" />
                </CardContent>
              </>
            );

            return (
              <Card key={fw.code} className={isLocked ? 'border-dashed' : undefined}>
                {isLocked ? (
                  cardBody
                ) : (
                  <Link to={`/frameworks/${fw.code}`} aria-label={`Open ${displayName}`}>
                    {cardBody}
                  </Link>
                )}
              </Card>
            );
          })}
          {frameworks.length === 0 && (
            <Card className="md:col-span-3">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No frameworks enabled yet.
              </CardContent>
            </Card>
          )}
        </div>

        <Link
          to="/frameworks"
          className="mt-4 inline-block text-sm text-primary hover:underline"
        >
          {'View all frameworks ->'}
        </Link>
      </section>

      <section aria-labelledby="monitoring-heading">
        <h2 id="monitoring-heading" className="mb-4 mt-10 text-xl font-semibold">
          Monitoring
        </h2>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {monitoringRows.map((row) => {
            const Icon = row.icon;
            const okPercent =
              row.stats.total > 0 ? Math.round((row.stats.ok / row.stats.total) * 100) : 0;
            return (
              <Card key={row.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon className="size-5 shrink-0 text-primary" aria-hidden />
                    <CardTitle className="truncate text-lg font-medium">{row.title}</CardTitle>
                  </div>
                  <CardAction>
                    <Link to={row.to} aria-label={`Open ${row.title}`}>
                      <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                    </Link>
                  </CardAction>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <span>Needs attention</span>
                    <Info className="size-3 shrink-0" aria-hidden />
                  </div>
                  <p className="mb-4 text-4xl font-bold">{row.stats.needsAttention}</p>
                  <Progress value={okPercent} className="h-2 mb-2 bg-secondary" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{row.stats.ok} OK</span>
                    <span>{row.stats.total} total</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/** Placeholder for when dashboard data fetching is re-enabled. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="mb-4 flex items-end justify-between">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
      </div>
      <Skeleton className="mt-4 h-4 w-40" />
      <Skeleton className="mb-4 mt-10 h-7 w-36" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="h-52 rounded-xl" />
      </div>
    </div>
  );
}
