import { Card, CardContent } from '@/components/ui/card';

export function TestDetailTasksTab() {
  return (
    <Card className="border-dashed border-border/80">
      <CardContent className="py-12 text-center text-sm text-muted-foreground">
        No tasks yet. Tasks can be added in a future release.
      </CardContent>
    </Card>
  );
}
