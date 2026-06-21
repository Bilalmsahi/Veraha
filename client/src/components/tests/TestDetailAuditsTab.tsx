import { Link } from 'react-router-dom';
import { useAudits } from '@/api/audits';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatFrameworkCode } from '@/lib/formatters';
import type { ComplianceTest } from '@/types/models';

type TestDetailAuditsTabProps = {
  test?: ComplianceTest;
};

function normalizeControlIds(test?: ComplianceTest): string[] {
  if (!test?.linkedControlIds?.length) return [];
  return test.linkedControlIds
    .map((control) => (typeof control === 'string' ? control : control._id))
    .filter(Boolean);
}

export function TestDetailAuditsTab({ test }: TestDetailAuditsTabProps) {
  const controlIds = normalizeControlIds(test);
  const auditsQuery = useAudits(
    controlIds.length > 0 ? { controlId: controlIds.join(','), limit: 50 } : undefined
  );

  if (!test) {
    return (
      <Card className="border-dashed border-border/80">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">Loading test...</CardContent>
      </Card>
    );
  }

  if (controlIds.length === 0) {
    return (
      <Card className="border-dashed border-border/80">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Link controls to this test to see related audit engagements.
        </CardContent>
      </Card>
    );
  }

  if (auditsQuery.isLoading) {
    return (
      <Card>
        <CardContent className="py-6 space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  const audits = auditsQuery.data?.audits ?? [];

  if (audits.length === 0) {
    return (
      <Card className="border-dashed border-border/80">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No audits include controls from this test yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Framework</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Outcome</th>
            <th className="px-4 py-3 font-medium">Period</th>
          </tr>
        </thead>
        <tbody>
          {audits.map((audit) => {
            const frameworkRaw =
              typeof audit.frameworkId === 'object' && audit.frameworkId
                ? audit.frameworkId.code || audit.frameworkId.name || ''
                : '—';
            const framework =
              frameworkRaw === '—' || !frameworkRaw ? '—' : formatFrameworkCode(frameworkRaw);
            return (
              <tr key={audit._id} className="border-t">
                <td className="px-4 py-3">
                  <Link to={`/audits/${audit._id}`} className="font-medium text-primary hover:underline">
                    {audit.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{framework}</td>
                <td className="px-4 py-3">
                  <Badge variant="secondary">{audit.status.replace(/_/g, ' ')}</Badge>
                </td>
                <td className="px-4 py-3">
                  {audit.outcome ? <Badge variant="outline">{audit.outcome.replace(/_/g, ' ')}</Badge> : '—'}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(audit.periodStart).toLocaleDateString()} –{' '}
                  {new Date(audit.periodEnd).toLocaleDateString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
