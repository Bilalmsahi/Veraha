import { DataTable, type Column } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDate, formatFrameworkCode } from '@/lib/formatters';
import type { EvidenceListItem } from '@/api/evidence';

/** Compute Vanta-style overall status: OK, Due soon, Overdue, or document status */
function getOverallStatus(row: EvidenceListItem): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  if (row.status === 'EXPIRED') return { label: 'Overdue', variant: 'destructive' };
  if (row.status === 'REJECTED') return { label: 'Rejected', variant: 'destructive' };
  if (row.status === 'PENDING') return { label: 'Draft', variant: 'secondary' };

  if (row.status === 'APPROVED') {
    if (!row.validUntil) return { label: 'OK', variant: 'default' };
    const validUntil = new Date(row.validUntil);
    if (validUntil < now) return { label: 'Overdue', variant: 'destructive' };
    if (validUntil <= thirtyDaysFromNow) return { label: 'Due soon', variant: 'secondary' };
    return { label: 'OK', variant: 'default' };
  }
  return { label: String(row.status ?? '—'), variant: 'outline' };
}

type EvidenceTableProps = {
  evidence: EvidenceListItem[];
  onRowClick?: (item: EvidenceListItem) => void;
  emptyMessage?: string;
  className?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string, order: 'asc' | 'desc') => void;
};

export function EvidenceTable({
  evidence,
  onRowClick,
  emptyMessage = 'No evidence found.',
  className,
  sortBy,
  sortOrder,
  onSort,
}: EvidenceTableProps) {
  const columns: Column<EvidenceListItem>[] = [
    {
      key: 'title',
      header: 'Name',
      width: '30%',
      cell: (row) => (
        <div className="min-w-0">
          <span className="font-medium line-clamp-2 break-words" title={row.title}>
            {row.title}
          </span>
          {(row.category || row.description) && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 break-words">
              {row.category && row.description
                ? `${row.category} — ${row.description}`
                : row.category || row.description}
            </p>
          )}
        </div>
      ),
      sortable: true,
      sortKey: 'title',
    },
    {
      key: 'uploadedBy',
      header: 'Owner',
      width: '14%',
      cell: (row) => {
        const u = row.uploadedBy;
        if (!u) return <span className="text-muted-foreground">Unassigned</span>;
        const initials = [u.firstName, u.lastName].filter(Boolean).map((n) => n[0]).join('').toUpperCase() || '?';
        return (
          <div className="flex items-center gap-2">
            <Avatar className="size-6">
              <AvatarFallback className="text-xs bg-muted">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-sm">
              {u.firstName} {u.lastName}
            </span>
          </div>
        );
      },
    },
    {
      key: 'tasks',
      header: 'Tasks',
      width: '6%',
      cell: () => <span className="text-muted-foreground">0</span>,
    },
    {
      key: 'overallStatus',
      header: 'Overall status',
      width: '10%',
      cell: (row) => {
        const { label, variant } = getOverallStatus(row);
        return <Badge variant={variant}>{label}</Badge>;
      },
    },
    {
      key: 'validUntil',
      header: 'Renew by',
      width: '10%',
      cell: (row) => (
        <span className="text-muted-foreground">{formatDate(row.validUntil)}</span>
      ),
      sortable: true,
      sortKey: 'validUntil',
    },
    {
      key: 'evidenceUploadedAt',
      header: 'Evidence uploaded',
      width: '10%',
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.evidenceUploadedAt ? formatDate(row.evidenceUploadedAt) : '—'}
        </span>
      ),
    },
    {
      key: 'framework',
      header: 'Framework',
      width: '10%',
      cell: (row) => {
        const frameworks = new Set<string>();
        for (const c of row.linkedControlIds ?? []) {
          for (const lr of c.linkedRequirements ?? []) {
          const fwKey = lr.frameworkId?.code ?? lr.frameworkId?.name;
          if (fwKey) frameworks.add(formatFrameworkCode(fwKey));
        }
        }
        if (frameworks.size === 0) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="flex flex-wrap gap-1">
            {[...frameworks].slice(0, 3).map((code) => (
              <span key={code} className="text-xs text-muted-foreground">
                {code}
              </span>
            ))}
            {frameworks.size > 3 && (
              <span className="text-xs text-muted-foreground">+{frameworks.size - 3}</span>
            )}
          </span>
        );
      },
    },
    {
      key: 'linkedControls',
      header: 'Controls',
      width: '8%',
      cell: (row) => {
        const count = row.linkedControlIds?.length ?? 0;
        return <span className="text-muted-foreground">{count}</span>;
      },
    },
    {
      key: 'status',
      header: 'Document status',
      width: '12%',
      cell: (row) => (
        <span className="text-sm text-muted-foreground capitalize">{row.status?.toLowerCase()}</span>
      ),
      sortable: true,
      sortKey: 'status',
    },
  ];

  return (
    <DataTable
      data={evidence}
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
