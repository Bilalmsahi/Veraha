import { cn } from '@/lib/utils';
import { RISK_LEVEL_SOFT } from '@/lib/constants';
import { SEMANTIC_BADGE_SOFT } from '@/components/shared/EnumBadge';

type RiskBadgeProps = {
  score?: number | null;
  level?: 'Low' | 'Medium' | 'High' | string | null;
  className?: string;
};

export function RiskBadge({ score, level, className }: RiskBadgeProps) {
  const unassessed = (score == null || Number.isNaN(score)) && (level == null || level === '');
  const key = unassessed ? '__unassessed__' : (level ?? 'Low');
  const softTone = RISK_LEVEL_SOFT[key];
  const style = softTone ? SEMANTIC_BADGE_SOFT[softTone] : 'bg-muted text-muted-foreground';

  const label = unassessed ? '?' : (level ?? 'Not assessed');

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        style,
        className
      )}
    >
      <span>{label}</span>
      {score != null && !Number.isNaN(score) && (
        <span className="ml-1 text-[10px] opacity-80">({score})</span>
      )}
    </span>
  );
}
