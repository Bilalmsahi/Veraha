import { DataTable, type Column } from '@/components/shared';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { VendorListItem } from '@/api/vendors';
import { RISK_TIER_LABELS, STATUS_CSS_CLASSES } from '@/lib/constants';
import type { RiskTier, VendorStatus } from '@/types/enums';
import {
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Check,
  Circle,
  Minus,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type VendorTableProps = {
  vendors: VendorListItem[];
  onRowClick?: (vendor: VendorListItem) => void;
  emptyMessage?: string;
  className?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string, order: 'asc' | 'desc') => void;
};

function normalizeRiskTier(tier: string | undefined): RiskTier {
  if (!tier) return 'UNSCORED';
  const u = tier.toUpperCase();
  if (u === 'MED') return 'MEDIUM';
  if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNSCORED'].includes(u)) return u as RiskTier;
  return 'UNSCORED';
}

function InherentRiskCell({ row }: { row: VendorListItem }) {
  const tier = normalizeRiskTier(row.riskTier);
  const label = RISK_TIER_LABELS[tier] ?? 'Unscored';
  const iconClass = 'size-4 shrink-0';
  let Icon = Circle;
  let iconColor = 'text-muted-foreground';

  switch (tier) {
    case 'CRITICAL':
      Icon = Circle;
      iconColor = 'text-destructive fill-destructive';
      break;
    case 'HIGH':
      Icon = ArrowUp;
      iconColor = 'text-destructive';
      break;
    case 'MEDIUM':
      Icon = Minus;
      iconColor = 'text-[var(--color-warning)]';
      break;
    case 'LOW':
      Icon = ArrowDown;
      iconColor = STATUS_CSS_CLASSES.success;
      break;
    case 'UNSCORED':
    default:
      Icon = Circle;
      iconColor = 'text-muted-foreground fill-muted-foreground';
  }

  return (
    <div className="flex items-center gap-2">
      <Icon className={cn(iconClass, iconColor)} aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  );
}

function SecurityReviewCell({ row }: { row: VendorListItem }) {
  const tier = normalizeRiskTier(row.riskTier);
  const isHighOrCritical = tier === 'CRITICAL' || tier === 'HIGH';
  const nextDate = row.nextAssessmentDate ? new Date(row.nextAssessmentDate) : null;
  const isPast = nextDate ? nextDate < new Date() : false;
  const needsReview =
    (isHighOrCritical && !row.nextAssessmentDate) || (nextDate != null && isPast);

  if (needsReview) {
    return (
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="size-4 shrink-0" aria-hidden />
        <span className="text-sm">Needs review</span>
      </div>
    );
  }
  return (
    <div className={cn('flex items-center gap-2', STATUS_CSS_CLASSES.success)}>
      <Check className="size-4 shrink-0" aria-hidden />
      <span className="text-sm">Up to date</span>
    </div>
  );
}

function getVendorStatusDisplay(status: string): string {
  if (status === 'ACTIVE' || status === 'UNDER_REVIEW') return 'Active';
  if (status === 'INACTIVE' || status === 'TERMINATED') return 'Archived';
  return status;
}

function getInitials(owner: VendorListItem['ownerId']): string {
  if (!owner) return '';
  const first = owner.firstName?.trim().charAt(0) ?? '';
  const last = owner.lastName?.trim().charAt(0) ?? '';
  if (first || last) return `${first}${last}`.toUpperCase();
  return owner.email?.charAt(0)?.toUpperCase() ?? '?';
}

export function VendorTable({
  vendors,
  onRowClick,
  emptyMessage = 'No vendors found.',
  className,
  sortBy,
  sortOrder,
  onSort,
}: VendorTableProps) {
  const columns: Column<VendorListItem>[] = [
    {
      key: 'name',
      header: 'Vendor',
      width: '30%',
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          <span className="font-medium line-clamp-2 break-words" title={row.name}>
            {row.name}
          </span>
          {row.website && (
            <span className="text-xs text-muted-foreground line-clamp-1 break-all">
              {row.website}
            </span>
          )}
        </div>
      ),
      sortable: true,
      sortKey: 'name',
    },
    {
      key: 'status',
      header: 'Vendor status',
      width: '12%',
      cell: (row) => {
        const display = getVendorStatusDisplay(row.status as VendorStatus);
        const isActive = row.status === 'ACTIVE' || row.status === 'UNDER_REVIEW';
        return (
          <span
            className={cn(
              'text-sm',
              isActive ? STATUS_CSS_CLASSES.success : 'text-muted-foreground'
            )}
          >
            {display}
          </span>
        );
      },
      sortable: true,
      sortKey: 'status',
    },
    {
      key: 'riskTier',
      header: 'Inherent risk score',
      width: '14%',
      cell: (row) => <InherentRiskCell row={row} />,
      sortable: true,
      sortKey: 'riskTier',
    },
    {
      key: 'category',
      header: 'Category',
      width: '12%',
      cell: (row) => (
        <span className="text-sm text-muted-foreground line-clamp-2 break-words" title={row.category?.trim() || 'Category incomplete'}>
          {row.category?.trim() || 'Category incomplete'}
        </span>
      ),
    },
    {
      key: 'securityReview',
      header: 'Security review',
      width: '12%',
      cell: (row) => <SecurityReviewCell row={row} />,
    },
    {
      key: 'securityOwner',
      header: 'Security owner',
      width: '10%',
      cell: (row) => {
        const owner = row.ownerId;
        if (!owner) {
          return (
            <div className="flex items-center justify-center size-8 rounded-full bg-muted text-muted-foreground">
              <User className="size-4" aria-hidden />
            </div>
          );
        }
        const initials = getInitials(owner);
        return (
          <Avatar className="size-8 rounded-full bg-muted text-muted-foreground text-xs">
            <AvatarFallback>{initials || '?'}</AvatarFallback>
          </Avatar>
        );
      },
    },
    {
      key: 'businessOwner',
      header: 'Business owner',
      width: '10%',
      cell: () => (
        <div className="flex items-center justify-center size-8 rounded-full bg-muted text-muted-foreground">
          <User className="size-4" aria-hidden />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      data={vendors}
      columns={columns}
      keyExtractor={(row) => row._id}
      onRowClick={onRowClick}
      emptyMessage={emptyMessage}
      className={className}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onSort={onSort}
    />
  );
}
