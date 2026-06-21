import { Link } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import { formatFrameworkCode, formatPercentage } from '@/lib/formatters';
import type { FrameworkReadinessItem } from '@/api/dashboard';
import { cn } from '@/lib/utils';

type ComplianceProgressProps = {
  overallScore: number;
  frameworkReadiness: FrameworkReadinessItem[];
  className?: string;
};

export function ComplianceProgress({
  overallScore,
  frameworkReadiness,
  className,
}: ComplianceProgressProps) {
  return (
    <div className={cn('space-y-6', className)}>
      <div>
        <h3 className="text-sm font-medium text-muted-foreground">Overall compliance</h3>
        <div className="mt-2 flex items-center gap-4">
          <Progress value={overallScore} className="h-3 flex-1" />
          <span className="min-w-[3rem] text-lg font-semibold text-primary">
            {formatPercentage(overallScore)}
          </span>
        </div>
      </div>

      {frameworkReadiness.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">By framework</h3>
          <div className="space-y-2">
            {frameworkReadiness.map((fw) => (
              <Link
                key={fw.code}
                to={`/frameworks/${fw.code}`}
                className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted/50"
              >
                <span className="w-24 shrink-0 text-sm font-medium">
                  {formatFrameworkCode(fw.name ?? fw.code)}
                </span>
                <Progress
                  value={fw.readinessScore}
                  className="h-2 flex-1"
                />
                <span className="min-w-[2.5rem] text-right text-sm text-muted-foreground">
                  {formatPercentage(fw.readinessScore)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
