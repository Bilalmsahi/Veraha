import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type EnumBadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export type SemanticSoftTone = 'success' | 'error' | 'warning' | 'info' | 'muted';

export const SEMANTIC_BADGE_SOFT: Record<SemanticSoftTone, string> = {
  success: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
  error: 'bg-[var(--color-error-soft)] text-[var(--color-error)]',
  warning: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
  info: 'bg-primary/10 text-primary',
  muted: 'bg-muted text-muted-foreground',
};

type EnumBadgeProps = {
  label: string;
  variant?: EnumBadgeVariant;
  softTone?: SemanticSoftTone;
  className?: string;
};

export function EnumBadge({ label, variant = 'secondary', softTone, className }: EnumBadgeProps) {
  return (
    <Badge variant={variant} className={cn(softTone && SEMANTIC_BADGE_SOFT[softTone], className)}>
      {label}
    </Badge>
  );
}
