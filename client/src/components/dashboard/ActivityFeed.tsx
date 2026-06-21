import { Link } from 'react-router-dom';
import { formatDateTime } from '@/lib/formatters';
import { ACTION_LABELS } from '@/lib/constants';
import type { ActivityItem } from '@/api/dashboard';
import { cn } from '@/lib/utils';

type ActivityFeedProps = {
  activities: ActivityItem[];
  maxItems?: number;
  viewAllLink?: string;
  className?: string;
};

export function ActivityFeed({
  activities,
  maxItems = 10,
  viewAllLink = '/activity',
  className,
}: ActivityFeedProps) {
  const display = activities.slice(0, maxItems);

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Recent activity</h3>
        {activities.length > maxItems && (
          <Link
            to={viewAllLink}
            className="text-sm font-medium text-primary hover:underline"
          >
            View all
          </Link>
        )}
      </div>
      <ul className="space-y-2">
        {display.length === 0 ? (
          <li className="py-4 text-center text-sm text-muted-foreground">
            No recent activity
          </li>
        ) : (
          display.map((a) => (
            <ActivityItemRow key={a._id} item={a} />
          ))
        )}
      </ul>
    </div>
  );
}

function ActivityItemRow({ item }: { item: ActivityItem }) {
  const actionLabel =
    ACTION_LABELS[item.action as keyof typeof ACTION_LABELS] ?? item.action;
  const actorName = item.actor?.name ?? item.actor?.email ?? 'System';
  const entityLabel = getEntityLabel(item);

  return (
    <li className="flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted/30">
      <span>
        <span className="font-medium">{actorName}</span>
        <span className="text-muted-foreground"> {actionLabel.toLowerCase()} </span>
        <span>{entityLabel}</span>
      </span>
      <span className="text-xs text-muted-foreground">
        {formatDateTime(item.timestamp)}
      </span>
    </li>
  );
}

function getEntityLabel(item: ActivityItem): string {
  const type = item.entityType ?? 'item';
  const id = item.entityId;
  const snapshot = item.entitySnapshot as Record<string, unknown> | undefined;
  const title =
    (snapshot?.title as string) ??
    (snapshot?.identifier as string) ??
    (snapshot?.name as string) ??
    id ??
    type;
  return `${type}: ${title}`;
}
