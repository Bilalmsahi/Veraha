import { Badge } from '@/components/ui/badge';
import { formatScore } from '@/lib/formatters';
import { RISK_TIER_COLORS } from '@/lib/constants';
import type { RiskTier } from '@/types/enums';

type RiskScoreBadgeProps = {
  score: number | undefined | null;
  riskLevel?: RiskTier | 'UNKNOWN';
  className?: string;
};

export function RiskScoreBadge({ score, riskLevel, className }: RiskScoreBadgeProps) {
  const unassessed = score == null || Number.isNaN(score);
  const level = riskLevel ?? 'UNKNOWN';
  const variant = unassessed ? 'outline' : (RISK_TIER_COLORS[level as RiskTier] ?? 'outline');
  const label = unassessed ? '?' : formatScore(score);

  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}
