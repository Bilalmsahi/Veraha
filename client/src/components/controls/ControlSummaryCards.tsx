import { Link } from 'react-router-dom';
import { ToggleRight, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProgressBar } from '@/components/shared';
import type { ControlStats } from '@/api/controls';
import { OVERALL_STATUS_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';

type ControlSummaryCardsProps = {
  stats: ControlStats;
  className?: string;
};

export function ControlSummaryCards({ stats, className }: ControlSummaryCardsProps) {
  const total = stats.total ?? 0;
  const pass = stats.PASS ?? 0;
  const fail = stats.FAIL ?? 0;
  const warning = stats.WARNING ?? 0;
  const notConfigured = stats.NOT_CONFIGURED ?? 0;
  const notApplicable = stats.NOT_APPLICABLE ?? 0;
  const assessed = total - notApplicable - notConfigured;

  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
      <Card className="transition-colors hover:border-primary/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total controls
          </CardTitle>
          <ToggleRight className="size-4 text-primary" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{total}</p>
          <Link
            to="/controls"
            className="mt-2 flex text-sm font-medium text-primary hover:underline"
          >
            View all
          </Link>
        </CardContent>
      </Card>

      <Card className="transition-colors hover:border-primary/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {OVERALL_STATUS_LABELS.PASS}
          </CardTitle>
          <CheckCircle className="size-4 text-[var(--color-success)]" />
        </CardHeader>
        <CardContent>
          <ProgressBar current={pass} total={assessed > 0 ? assessed : total} showCount />
          <Link
            to="/controls?status=PASS"
            className="mt-2 flex text-sm font-medium text-primary hover:underline"
          >
            View passing
          </Link>
        </CardContent>
      </Card>

      <Card className="transition-colors hover:border-primary/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {OVERALL_STATUS_LABELS.FAIL}
          </CardTitle>
          <XCircle className="size-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{fail}</p>
          {fail > 0 && (
            <Link
              to="/controls?status=FAIL"
              className="mt-2 flex text-sm font-medium text-primary hover:underline"
            >
              View failing
            </Link>
          )}
        </CardContent>
      </Card>

      <Card className="transition-colors hover:border-primary/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {OVERALL_STATUS_LABELS.WARNING}
          </CardTitle>
          <AlertTriangle className="size-4 text-[var(--color-warning)]" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{warning}</p>
          {warning > 0 && (
            <Link
              to="/controls?status=WARNING"
              className="mt-2 flex text-sm font-medium text-primary hover:underline"
            >
              View warnings
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
