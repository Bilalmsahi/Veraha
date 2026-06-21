import { useMemo } from 'react';
import { useAuditEvidence } from '@/api/audits';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

type AuditReadinessTabProps = {
  auditId: string;
};

type ControlGroup = {
  controlId: string;
  identifier: string;
  title: string;
  items: Array<{ status: string }>;
};

const REVIEWED_STATUSES = new Set(['APPROVED', 'NOT_APPLICABLE']);

function computeGroupReadiness(items: Array<{ status: string }>) {
  if (items.length === 0) return 0;
  const reviewed = items.filter((item) => REVIEWED_STATUSES.has(item.status)).length;
  return Math.round((reviewed / items.length) * 100);
}

export function AuditReadinessTab({ auditId }: AuditReadinessTabProps) {
  const evidence = useAuditEvidence(auditId);

  const { groups, aggregatePercent } = useMemo(() => {
    const items = evidence.data ?? [];
    const byControl = new Map<string, ControlGroup>();

    for (const item of items) {
      const controlKey = item.controlId?._id ?? 'unscoped';
      const existing = byControl.get(controlKey);
      if (existing) {
        existing.items.push({ status: item.status });
      } else {
        byControl.set(controlKey, {
          controlId: controlKey,
          identifier: item.controlId?.identifier ?? 'Unscoped',
          title: item.controlId?.title ?? 'Evidence without control',
          items: [{ status: item.status }],
        });
      }
    }

    const grouped = Array.from(byControl.values()).sort((a, b) =>
      a.identifier.localeCompare(b.identifier)
    );

    const totalItems = items.length;
    const reviewedItems = items.filter((item) => REVIEWED_STATUSES.has(item.status)).length;
    const aggregate = totalItems ? Math.round((reviewedItems / totalItems) * 100) : 0;

    return { groups: grouped, aggregatePercent: aggregate };
  }, [evidence.data]);

  if (evidence.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading control readiness...</p>;
  }

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No evidence items yet. Take a snapshot to populate audit evidence.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-sm font-medium">Aggregate evidence readiness</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pb-4">
          <p className="text-3xl font-semibold">{aggregatePercent}%</p>
          <Progress value={aggregatePercent} />
        </CardContent>
      </Card>

      <div className="space-y-3">
        {groups.map((group) => {
          const readiness = computeGroupReadiness(group.items);
          const counts = group.items.reduce<Record<string, number>>((acc, item) => {
            acc[item.status] = (acc[item.status] || 0) + 1;
            return acc;
          }, {});

          return (
            <Card key={group.controlId}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 py-4">
                <div>
                  <CardTitle className="text-base">{group.identifier}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{group.title}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold">{readiness}%</p>
                  <p className="text-xs text-muted-foreground">{group.items.length} evidence items</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pb-4">
                <Progress value={readiness} />
                <div className="flex flex-wrap gap-2">
                  {Object.entries(counts).map(([status, count]) => (
                    <Badge key={status} variant="secondary">
                      {status.replace(/_/g, ' ')}: {count}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
