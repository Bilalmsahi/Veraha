import { cn } from '@/lib/utils';
import type { TestStatus } from '@/types/enums';

const LABELS: Record<TestStatus, string> = {
  ok: 'OK',
  overdue: 'Overdue',
  due_soon: 'Due soon',
  needs_remediation: 'Needs remediation',
  na: 'N/A',
};

const STYLES: Record<TestStatus, string> = {
  ok: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
  overdue: 'bg-destructive/15 text-destructive border-destructive/30',
  due_soon: 'bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-500/30',
  needs_remediation: 'bg-orange-500/15 text-orange-900 dark:text-orange-200 border-orange-500/30',
  na: 'bg-muted text-muted-foreground border-border',
};

type TestStatusBadgeProps = {
  status: TestStatus;
  className?: string;
};

export function TestStatusBadge({ status, className }: TestStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium',
        STYLES[status],
        className
      )}
    >
      {LABELS[status]}
    </span>
  );
}
