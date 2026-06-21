import type { ComponentType } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type IntegrationCardProps = {
  title: string;
  icon: ComponentType<{ className?: string }>;
  connectionStatus: string;
  stats: Array<{ label: string; value: number | string }>;
  onConfigure?: () => void;
  onView?: () => void;
  viewLabel?: string;
};

function getStatusConfig(status: string) {
  switch (status) {
    case 'connected':
    case 'active':
      return {
        label: status === 'connected' ? 'Connected' : 'Active',
        className: 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
      };
    case 'error':
      return {
        label: 'Error',
        className: 'border-transparent bg-destructive/15 text-destructive',
      };
    case 'not_configured':
    case 'inactive':
      return {
        label: status === 'inactive' ? 'Inactive' : 'Not configured',
        className: 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
      };
    case 'not_connected':
    default:
      return {
        label: 'Not connected',
        className: 'border-transparent bg-muted text-muted-foreground',
      };
  }
}

export function IntegrationCard({
  title,
  icon: Icon,
  connectionStatus,
  stats,
  onConfigure,
  onView,
  viewLabel = 'View',
}: IntegrationCardProps) {
  const statusConfig = getStatusConfig(connectionStatus);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="size-5 text-primary" aria-hidden />
          </div>
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
        <Badge className={cn('shrink-0', statusConfig.className)}>{statusConfig.label}</Badge>
      </CardHeader>

      <CardContent className="flex-1">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border bg-muted/30 px-3 py-2.5"
            >
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{stat.value}</p>
            </div>
          ))}
        </div>
      </CardContent>

      <CardFooter className="mt-auto gap-2 border-t pt-6">
        {onConfigure && (
          <Button variant="ghost" size="sm" onClick={onConfigure}>
            Configure
          </Button>
        )}
        {onView && (
          <Button size="sm" onClick={onView} className={onConfigure ? '' : 'ml-auto'}>
            {viewLabel}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
