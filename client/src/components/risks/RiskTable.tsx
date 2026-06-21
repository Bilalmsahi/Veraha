import { DataTable, type Column } from '@/components/shared';
import type { RiskListItem } from '@/api/risks';
import { RISK_SCENARIO_STATUS_LABELS } from '@/lib/constants';
import type { RiskTier, RiskStatus } from '@/types/enums';
import { RiskScoreBadge } from './RiskScoreBadge';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';

type RiskTableProps = {
  risks: RiskListItem[];
  onRowClick?: (risk: RiskListItem) => void;
  onManageAccess?: (risk: RiskListItem) => void;
  onArchive?: (risk: RiskListItem) => void;
  emptyMessage?: string;
  className?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string, order: 'asc' | 'desc') => void;
};

function ownerDisplay(owner: RiskListItem['ownerId']): string {
  if (!owner) return 'Unassigned';
  const u = owner as { firstName?: string; lastName?: string; email?: string };
  if (u.firstName || u.lastName) return [u.firstName, u.lastName].filter(Boolean).join(' ');
  return (u as { email?: string }).email ?? 'Unassigned';
}

function approvalDisplay(row: RiskListItem): string {
  if (row.status === 'CLOSED') return `${row.approvals?.length ?? 1}/1`;
  const assigned = row.assignedApproverIds?.length ?? 0;
  if (row.status === 'PENDING_APPROVAL') return `0/${assigned || 1}`;
  return assigned > 0 ? `0/${assigned}` : '-';
}

export function RiskTable({
  risks,
  onRowClick,
  onManageAccess,
  onArchive,
  emptyMessage = 'No risks found.',
  className,
  sortBy,
  sortOrder,
  onSort,
}: RiskTableProps) {
  const showActions = Boolean(onManageAccess || onArchive);
  const columns: Column<RiskListItem>[] = [
    {
      key: 'identifier',
      header: 'ID',
      width: '8%',
      cell: (row) => (
        <span className="font-mono text-sm">{row.identifier ?? '—'}</span>
      ),
      sortable: true,
      sortKey: 'identifier',
    },
    {
      key: 'title',
      header: 'Risk scenario',
      width: '30%',
      cell: (row) => (
        <span className="font-medium line-clamp-2 break-words" title={row.title}>
          {row.title}
        </span>
      ),
      sortable: true,
      sortKey: 'title',
    },
    {
      key: 'status',
      header: 'Status',
      width: '10%',
      cell: (row) => (
        <span className="text-sm">
          {RISK_SCENARIO_STATUS_LABELS[row.status as RiskStatus] ?? row.status}
        </span>
      ),
      sortable: true,
      sortKey: 'status',
    },
    {
      key: 'ownerId',
      header: 'Owner',
      width: '12%',
      cell: (row) => (
        <span className="text-muted-foreground">{ownerDisplay(row.ownerId)}</span>
      ),
    },
    {
      key: 'inherentScore',
      header: 'Inherent risk',
      width: '9%',
      cell: (row) => {
        const unassessed =
          row.likelihood == null || row.impact == null || row.inherentScore == null;
        if (unassessed)
          return (
            <Badge variant="secondary" className="bg-muted text-muted-foreground font-normal">
              ?
            </Badge>
          );
        return (
          <RiskScoreBadge
            score={row.inherentScore}
            riskLevel={row.riskLevel as RiskTier | 'UNKNOWN'}
          />
        );
      },
    },
    {
      key: 'treatment',
      header: 'Treatment plan',
      width: '12%',
      cell: (row) => (
        <span className="text-muted-foreground line-clamp-2 break-words" title={row.treatment ?? '—'}>
          {row.treatment ?? '—'}
        </span>
      ),
    },
    {
      key: 'treatmentStatus',
      header: 'Treatment status',
      width: '7%',
      cell: () => <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'residualScore',
      header: 'Residual risk',
      width: '7%',
      cell: (row) => {
        const unassessed = row.residualScore == null;
        if (unassessed)
          return (
            <Badge variant="secondary" className="bg-muted text-muted-foreground font-normal">
              ?
            </Badge>
          );
        return (
          <RiskScoreBadge
            score={row.residualScore}
            riskLevel={row.riskLevel as RiskTier | 'UNKNOWN'}
          />
        );
      },
    },
    {
      key: 'approvals',
      header: 'Approvals',
      width: '3%',
      cell: (row) => <span className="text-muted-foreground">{approvalDisplay(row)}</span>,
    },
    ...(showActions ? [{
      key: 'actions',
      header: '',
      width: '2%',
      cell: (row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onManageAccess && (
                <DropdownMenuItem
                  onClick={() => {
                    onManageAccess(row);
                  }}
                >
                  Manage access
                </DropdownMenuItem>
              )}
              {onArchive && (
                <DropdownMenuItem
                  onClick={() => {
                    onArchive(row);
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  Archive
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    }] : []),
  ];

  return (
    <DataTable
      data={risks}
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
