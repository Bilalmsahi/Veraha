import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type OverlayControl = {
  controlId: string;
  identifier?: string;
  title?: string;
  status: 'PASS' | 'FAIL';
  reasons?: { excluded?: string[]; failing?: string[] };
};

type FrameworkReadinessDashboardProps = {
  pass: number;
  fail: number;
  controls: OverlayControl[];
  className?: string;
};

function statusBadge(status: OverlayControl['status']) {
  if (status === 'PASS') return <Badge variant="default">PASS</Badge>;
  return <Badge variant="destructive">FAIL</Badge>;
}

export function FrameworkReadinessDashboard({
  pass,
  fail,
  controls,
  className,
}: FrameworkReadinessDashboardProps) {
  const failItems = controls.filter((c) => c.status === 'FAIL');

  return (
    <div className={cn('space-y-4', className)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm">Pass</CardTitle>
          </CardHeader>
          <CardContent className="pb-4 text-2xl font-semibold">{pass}</CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm">Fail</CardTitle>
          </CardHeader>
          <CardContent className="pb-4 text-2xl font-semibold">{fail}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Failing items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {failItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No failing controls.</p>
          ) : (
            failItems.slice(0, 50).map((c) => (
              <div key={c.controlId} className="flex items-center justify-between rounded-md border p-2">
                <div className="flex items-center gap-2">
                  {statusBadge(c.status)}
                  <span className="text-sm font-medium">{c.identifier ?? c.controlId}</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

