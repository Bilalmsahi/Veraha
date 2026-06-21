import { Badge } from '@/components/ui/badge';
import {
  OVERALL_STATUS_LABELS,
  OVERALL_STATUS_COLORS,
  EVIDENCE_STATUS_LABELS,
  EVIDENCE_STATUS_COLORS,
  POLICY_STATUS_LABELS,
  POLICY_STATUS_COLORS,
} from '@/lib/constants';
import type { OverallStatus, EvidenceStatus, PolicyStatus } from '@/types/enums';
import { cn } from '@/lib/utils';

type StatusVariant = 'control' | 'evidence' | 'overdue' | 'due_soon' | 'ok';

export type StatusBadgeProps = {
  status?: OverallStatus | EvidenceStatus | PolicyStatus | StatusVariant;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  label?: string;
  className?: string;
};

const OVERDUE_STYLE = 'bg-destructive/20 text-destructive border-destructive/30';
const DUE_SOON_STYLE = 'bg-[var(--color-warning)]/20 text-[var(--color-warning)] border-[var(--color-warning)]/30';
const OK_STYLE = 'bg-[var(--color-success)]/20 text-[var(--color-success)] border-[var(--color-success)]/30';

export function StatusBadge({ status, variant: variantOverride, label, className }: StatusBadgeProps) {
  if (label) {
    const variantMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      Overdue: 'destructive',
      'Due soon': 'secondary',
      OK: 'default',
      Pass: 'default',
      Fail: 'destructive',
      Warning: 'secondary',
      Pending: 'secondary',
      'Pending attestation': 'secondary',
      Approved: 'default',
      Rejected: 'destructive',
      Expired: 'destructive',
    };
    const variant = variantMap[label] ?? 'outline';
    return (
      <Badge variant={variant} className={cn(className)}>
        {label}
      </Badge>
    );
  }

  if (status === 'overdue') {
    return (
      <Badge variant="destructive" className={cn(OVERDUE_STYLE, className)}>
        Overdue
      </Badge>
    );
  }
  if (status === 'due_soon') {
    return (
      <Badge variant="secondary" className={cn(DUE_SOON_STYLE, className)}>
        Due soon
      </Badge>
    );
  }
  if (status === 'ok') {
    return (
      <Badge variant="default" className={cn(OK_STYLE, className)}>
        OK
      </Badge>
    );
  }

  if (status && status in OVERALL_STATUS_LABELS) {
    const s = status as OverallStatus;
    return (
      <Badge
        variant={OVERALL_STATUS_COLORS[s]}
        className={cn(className)}
      >
        {OVERALL_STATUS_LABELS[s]}
      </Badge>
    );
  }

  if (status && status in EVIDENCE_STATUS_LABELS) {
    const s = status as EvidenceStatus;
    return (
      <Badge
        variant={variantOverride ?? EVIDENCE_STATUS_COLORS[s]}
        className={cn(className)}
      >
        {EVIDENCE_STATUS_LABELS[s]}
      </Badge>
    );
  }

  if (status && status in POLICY_STATUS_LABELS) {
    const s = status as PolicyStatus;
    return (
      <Badge
        variant={variantOverride ?? POLICY_STATUS_COLORS[s]}
        className={cn(className)}
      >
        {POLICY_STATUS_LABELS[s]}
      </Badge>
    );
  }

  if (variantOverride && status) {
    return (
      <Badge variant={variantOverride} className={cn(className)}>
        {String(status)}
      </Badge>
    );
  }

  return null;
}
