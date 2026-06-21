import type { RiskMatrix } from '@/api/risks';
import { cn } from '@/lib/utils';

type RiskMatrixChartProps = {
  matrix: RiskMatrix | null | undefined;
  isLoading?: boolean;
};

const HEAT_COLORS = [
  'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
  'bg-green-200 dark:bg-green-800/40 text-green-900 dark:text-green-100',
  'bg-yellow-200 dark:bg-yellow-800/40 text-yellow-900 dark:text-yellow-100',
  'bg-orange-200 dark:bg-orange-800/40 text-orange-900 dark:text-orange-100',
  'bg-red-200 dark:bg-red-800/40 text-red-900 dark:text-red-100',
];

function getHeatColor(value: number): string {
  if (value <= 0) return 'bg-muted/50 text-muted-foreground';
  const idx = Math.min(Math.ceil(value), 5) - 1;
  return HEAT_COLORS[idx] ?? HEAT_COLORS[0];
}

export function RiskMatrixChart({ matrix, isLoading }: RiskMatrixChartProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border p-4">
        <div className="h-48 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!matrix || !matrix.matrix?.length) {
    return (
      <div className="rounded-lg border p-4">
        <p className="text-sm text-muted-foreground">No risk matrix data available.</p>
      </div>
    );
  }

  const { matrix: grid, likelihoodLabels, impactLabels } = matrix;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <div className="min-w-[280px] p-4">
        <h4 className="mb-3 text-sm font-medium">Risk matrix</h4>
        <div className="flex flex-col gap-1">
          {grid.map((row, rowIdx) => (
            <div key={rowIdx} className="flex gap-1">
              {row.map((val, colIdx) => (
                <div
                  key={colIdx}
                  className={cn(
                    'flex min-w-10 flex-1 items-center justify-center rounded py-2 text-xs font-medium',
                    getHeatColor(val)
                  )}
                >
                  {val > 0 ? val : '—'}
                </div>
              ))}
            </div>
          ))}
        </div>
        {likelihoodLabels?.length && impactLabels?.length ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Rows: {likelihoodLabels.join(', ')} · Cols: {impactLabels.join(', ')}
          </p>
        ) : null}
      </div>
    </div>
  );
}
