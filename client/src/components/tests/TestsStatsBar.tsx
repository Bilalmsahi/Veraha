import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { TestStats } from '@/types/models';
import { cn } from '@/lib/utils';

type TestsStatsBarProps = {
  stats: TestStats;
};

export function TestsStatsBar({ stats }: TestsStatsBarProps) {
  const docTotal = stats.documents.total || 0;
  const autoTotal = stats.automated.total || 0;
  const docPct = docTotal ? Math.round((stats.documents.passing / docTotal) * 100) : 0;
  const autoPct = autoTotal ? Math.round((stats.automated.passing / autoTotal) * 100) : 0;
  const attentionTotal =
    stats.attention.overdue + stats.attention.dueSoon + stats.attention.needsRemediation;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-border/80 bg-card dark:bg-[#3A5255]/40">
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-foreground">Tests passing</h2>
            <span className="rounded border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {stats.passing}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-4xl font-bold tabular-nums text-foreground">
              {stats.passingPercent}%
            </span>
            <span className="text-sm text-muted-foreground">
              {stats.passing} of {stats.total} passing
            </span>
          </div>
          <Progress value={stats.passingPercent} className="h-2 bg-muted" />
          <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
            <div>
              <p className="mb-1 font-medium text-foreground">Automated tests</p>
              <Progress value={autoPct} className="mb-1 h-1.5 bg-muted" />
              <p>
                {stats.automated.passing} / {autoTotal} — {autoPct}%
              </p>
            </div>
            <div>
              <p className="mb-1 font-medium text-foreground">Documents</p>
              <Progress
                value={docPct}
                className={cn('mb-1 h-1.5 bg-muted', '[&>div]:bg-[#409BA1]')}
              />
              <p>
                {stats.documents.passing} / {docTotal} — {docPct}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card dark:bg-[#3A5255]/40">
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Tests that need attention
            </h2>
            <span className="rounded border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {attentionTotal}
            </span>
          </div>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-sm bg-destructive" />
                Overdue
              </span>
              <span className="font-semibold tabular-nums">{stats.attention.overdue}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-sm bg-orange-500" />
                Needs remediation
              </span>
              <span className="font-semibold tabular-nums">
                {stats.attention.needsRemediation}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-sm bg-amber-400" />
                Due soon
              </span>
              <span className="font-semibold tabular-nums">{stats.attention.dueSoon}</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
