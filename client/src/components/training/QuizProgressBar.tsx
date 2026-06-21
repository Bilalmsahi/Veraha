import { Progress } from '@/components/ui/progress';

export function QuizProgressBar({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const value = total ? Math.round((current / total) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          Question {current} of {total}
        </span>
        <span>{value}%</span>
      </div>
      <Progress value={value} className="h-2" />
    </div>
  );
}
