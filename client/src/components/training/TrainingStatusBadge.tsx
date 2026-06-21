import { Badge } from '@/components/ui/badge';
import type { TrainingAttemptSummary } from '@/api/personnelTasks';

export function TrainingStatusBadge({ attempt }: { attempt: TrainingAttemptSummary }) {
  if (attempt.passedAt) {
    return <Badge>Completed</Badge>;
  }
  if (attempt.readCompletedAt || (attempt.readProgressPercent ?? 0) >= 100) {
    return <Badge variant="secondary">Quiz pending</Badge>;
  }
  if ((attempt.readProgressPercent ?? 0) > 0) {
    return <Badge variant="outline">In progress</Badge>;
  }
  return <Badge variant="outline">Not started</Badge>;
}
