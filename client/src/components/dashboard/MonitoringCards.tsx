import { Link } from 'react-router-dom';
import { ToggleRight, FileText, AlertTriangle, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProgressBar } from '@/components/shared';
import { useEvidenceStats } from '@/api/evidence';
import { useVendorStats } from '@/api/vendors';
import type { DashboardSummary } from '@/api/dashboard';
import { cn } from '@/lib/utils';

type MonitoringCardsProps = {
  summary: DashboardSummary;
  className?: string;
};

export function MonitoringCards({ summary, className }: MonitoringCardsProps) {
  const { controlCounts, alerts } = summary;
  const evidenceStats = useEvidenceStats();
  const vendorStats = useVendorStats();

  const total = controlCounts.total ?? 0;
  const pass = controlCounts.PASS ?? 0;
  const assessed =
    total - (controlCounts.NOT_APPLICABLE ?? 0) - (controlCounts.NOT_CONFIGURED ?? 0);

  const evidenceTotal = evidenceStats.data?.total ?? 0;
  const evidenceApproved = evidenceStats.data?.byStatus?.APPROVED ?? 0;

  const vendorTotal = vendorStats.data?.total ?? 0;
  const vendorActive = vendorStats.data?.byStatus?.ACTIVE ?? vendorTotal;

  const alertCount =
    (alerts.expiringEvidence ?? 0) +
    (alerts.overdueAssessments ?? 0) +
    (alerts.failingControls ?? 0) +
    (alerts.warningControls ?? 0);

  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
      <Card className="transition-colors hover:border-primary/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Controls
          </CardTitle>
          <ToggleRight className="size-4 text-primary" />
        </CardHeader>
        <CardContent>
          <ProgressBar current={pass} total={assessed > 0 ? assessed : total} showCount />
          <Link
            to="/controls"
            className="mt-3 flex items-center text-sm font-medium text-primary hover:underline"
          >
            View controls
          </Link>
        </CardContent>
      </Card>

      <Card className="transition-colors hover:border-primary/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Documents
          </CardTitle>
          <FileText className="size-4 text-primary" />
        </CardHeader>
        <CardContent>
          <ProgressBar
            current={evidenceApproved}
            total={Math.max(evidenceTotal, 1)}
            showCount
          />
          {alerts.expiringEvidence > 0 && (
            <p className="mt-1 text-xs text-amber-600">
              {alerts.expiringEvidence} expiring soon
            </p>
          )}
          <Link
            to="/documents"
            className="mt-3 flex items-center text-sm font-medium text-primary hover:underline"
          >
            View documents
          </Link>
        </CardContent>
      </Card>

      <Card className="transition-colors hover:border-primary/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Vendors
          </CardTitle>
          <Building2 className="size-4 text-primary" />
        </CardHeader>
        <CardContent>
          <ProgressBar
            current={vendorActive}
            total={Math.max(vendorTotal, 1)}
            showCount
          />
          <Link
            to="/vendors"
            className="mt-3 flex items-center text-sm font-medium text-primary hover:underline"
          >
            View vendors
          </Link>
        </CardContent>
      </Card>

      <Card className="transition-colors hover:border-primary/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Alerts
          </CardTitle>
          <AlertTriangle className="size-4 text-primary" />
        </CardHeader>
        <CardContent>
          {alertCount > 0 ? (
            <p className="text-sm text-amber-600">
              {alertCount} item{alertCount !== 1 ? 's' : ''} need attention
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">All clear</p>
          )}
          <a
            href="#alerts"
            className="mt-3 flex items-center text-sm font-medium text-primary hover:underline"
          >
            View details
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
