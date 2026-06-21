import { useEffect, useRef, useState } from 'react';
import { type AuditActivityEntry, useAuditActivity } from '@/api/audits';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type AuditHistoryPanelProps = {
  auditId: string;
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function AuditHistoryPanel({ auditId }: AuditHistoryPanelProps) {
  const [page, setPage] = useState(1);
  const [allEntries, setAllEntries] = useState<AuditActivityEntry[]>([]);
  const seenIds = useRef(new Set<string>());
  const activity = useAuditActivity(auditId, page);

  useEffect(() => {
    if (!activity.data?.activities) return;
    const newEntries = activity.data.activities.filter((e) => !seenIds.current.has(e._id));
    if (newEntries.length === 0) return;
    newEntries.forEach((e) => seenIds.current.add(e._id));
    setAllEntries((prev) => [...prev, ...newEntries]);
  }, [activity.data]);

  if (activity.isLoading && page === 1) {
    return <p className="text-sm text-muted-foreground">Loading history...</p>;
  }

  if (allEntries.length === 0 && !activity.isFetching) {
    return <p className="text-sm text-muted-foreground">No activity recorded for this audit yet.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {allEntries.map((entry) => (
              <tr key={entry._id} className="border-t align-top">
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                  {formatTimestamp(entry.timestamp)}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="secondary">{entry.action}</Badge>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{entry.entityType}</p>
                  <p className="text-xs text-muted-foreground">{entry.entitySnapshot?.title || '—'}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {entry.actorSnapshot?.name || entry.actorSnapshot?.email || 'System'}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {entry.notes ||
                    (entry.changes?.after?.status ? `Status → ${String(entry.changes.after.status)}` : '—')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {activity.data?.pagination.hasNextPage && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage((p) => p + 1)}
          disabled={activity.isFetching}
        >
          {activity.isFetching ? 'Loading...' : 'Load more'}
        </Button>
      )}
    </div>
  );
}
