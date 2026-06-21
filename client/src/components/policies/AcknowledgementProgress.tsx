import { useMemo } from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type UserLite = { _id: string; firstName: string; lastName: string; email: string; role: string };

type AcknowledgementProgressProps = {
  requiredUserIds: string[];
  attestedUserIds: string[];
  users: UserLite[];
  className?: string;
};

export function AcknowledgementProgress({
  requiredUserIds,
  attestedUserIds,
  users,
  className,
}: AcknowledgementProgressProps) {
  const requiredSet = useMemo(() => new Set(requiredUserIds.map(String)), [requiredUserIds]);
  const attestedSet = useMemo(() => new Set(attestedUserIds.map(String)), [attestedUserIds]);

  const required = requiredSet.size;
  const attested = [...requiredSet].filter((id) => attestedSet.has(id)).length;
  const percent = required ? Math.round((attested / required) * 100) : 0;

  const requiredUsers = useMemo(
    () => users.filter((u) => requiredSet.has(String(u._id))),
    [users, requiredSet]
  );

  const attestedUsers = requiredUsers.filter((u) => attestedSet.has(String(u._id)));
  const pendingUsers = requiredUsers.filter((u) => !attestedSet.has(String(u._id)));

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="text-base">Acknowledgement progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Acknowledged</span>
          <span className="font-medium">
            {attested}/{required} ({percent}%)
          </span>
        </div>
        <Progress value={percent} />

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium">Acknowledged</p>
            <ul className="mt-1 max-h-40 overflow-auto text-sm text-muted-foreground">
              {attestedUsers.map((u) => (
                <li key={u._id}>
                  {u.firstName} {u.lastName} ({u.email})
                </li>
              ))}
              {attestedUsers.length === 0 && <li>None yet.</li>}
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium">Pending</p>
            <ul className="mt-1 max-h-40 overflow-auto text-sm text-muted-foreground">
              {pendingUsers.map((u) => (
                <li key={u._id}>
                  {u.firstName} {u.lastName} ({u.email})
                </li>
              ))}
              {pendingUsers.length === 0 && <li>All done.</li>}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

