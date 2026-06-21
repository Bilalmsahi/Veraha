import { Progress } from '@/components/ui/progress';
import { formatPercentage } from '@/lib/formatters';
import { cn } from '@/lib/utils';

type ProgressBarProps = {
  current: number;
  total: number;
  label?: string;
  showCount?: boolean;
  className?: string;
};

export function ProgressBar({
  current,
  total,
  label,
  showCount = true,
  className,
}: ProgressBarProps) {
  const value = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className={cn('space-y-2', className)}>
      {(label || showCount) && (
        <div className="flex items-center justify-between text-sm">
          {label && <span className="text-muted-foreground">{label}</span>}
          {showCount && (
            <span className="font-medium">
              {current} of {total}
              {label && ` (${formatPercentage(value)})`}
            </span>
          )}
        </div>
      )}
      <Progress value={value} className="h-2" />
    </div>
  );
}
