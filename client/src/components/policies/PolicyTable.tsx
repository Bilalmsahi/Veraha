import { DataTable, type Column } from '@/components/shared';
import { StatusBadge } from '@/components/shared';
import { formatDate, formatFrameworkCode } from '@/lib/formatters';
import type { PolicyListItem } from '@/api/policies';
import type { PolicyStatus } from '@/types/enums';

type PolicyTableProps = {
  policies: PolicyListItem[];
  onRowClick?: (item: PolicyListItem) => void;
  renderActions?: (policy: PolicyListItem) => React.ReactNode;
  emptyMessage?: string;
  className?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string, order: 'asc' | 'desc') => void;
};

export function PolicyTable({
  policies,
  onRowClick,
  renderActions,
  emptyMessage = 'No policies found.',
  className,
  sortBy,
  sortOrder,
  onSort,
}: PolicyTableProps) {
  const columns: Column<PolicyListItem>[] = [
    {
      key: 'title',
      header: 'Title',
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
      cell: (row) => {
        const acknowledgementRate = Number(row.acknowledgementRate ?? 0);
        const pendingAttestation =
          row.status === 'ACTIVE' && row.requiresAttestation && acknowledgementRate < 100;

        if (pendingAttestation) {
          return <StatusBadge label="Pending attestation" variant="secondary" />;
        }

        return <StatusBadge status={row.status as PolicyStatus} />;
      },
      sortable: true,
      sortKey: 'status',
    },
    {
      key: 'category',
      header: 'Category',
      width: '10%',
      cell: (row) => (
        <span className="text-muted-foreground line-clamp-2 break-words" title={row.category ?? '—'}>
          {row.category ?? '—'}
        </span>
      ),
      sortable: true,
      sortKey: 'category',
    },
    {
      key: 'framework',
      header: 'Framework',
      width: '10%',
      cell: (row) => {
        const frameworks = (row as { frameworkIds?: { code?: string; name?: string }[] })?.frameworkIds;
        if (!frameworks?.length) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="flex flex-wrap gap-1">
            {frameworks.slice(0, 3).map((f: { code?: string; name?: string }) => (
              <span key={f.code ?? ''} className="text-xs text-muted-foreground">
                {formatFrameworkCode(f.code ?? f.name)}
              </span>
            ))}
            {frameworks.length > 3 && (
              <span className="text-xs text-muted-foreground">+{frameworks.length - 3}</span>
            )}
          </span>
        );
      },
    },
    {
      key: 'renewBy',
      header: 'Renew by',
      width: '10%',
      cell: (row) => (
        <span className="text-muted-foreground">
          {formatDate((row as { renewBy?: string; nextReviewDue?: string }).renewBy ?? row.nextReviewDue)}
        </span>
      ),
      sortable: true,
      sortKey: 'nextReviewDue',
    },
    {
      key: 'latestVersion',
      header: 'Latest version',
      width: '10%',
      cell: (row) => {
        const lv = (row as { latestVersion?: { status: string } }).latestVersion;
        if (!lv) return <span className="text-muted-foreground">—</span>;
        const label =
          lv.status === 'APPROVED'
            ? 'Approved'
            : lv.status === 'PENDING_APPROVAL'
              ? 'Pending approval'
              : lv.status === 'DRAFT'
                ? 'Draft'
                : 'Not started';
        return <span className="text-sm text-muted-foreground">{label}</span>;
      },
    },
    {
      key: 'approver',
      header: 'Approver',
      width: '10%',
      cell: (row) => {
        const a = (row as { approver?: { firstName: string; lastName: string }; ownerId?: { firstName: string; lastName: string } }).approver ?? row.ownerId;
        if (!a) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="text-sm">
            {a.firstName} {a.lastName}
          </span>
        );
      },
    },
    {
      key: 'personnel',
      header: 'Personnel',
      width: '10%',
      cell: (row) => {
        const p = (row as { personnel?: string | null }).personnel;
        if (!p) return <span className="text-muted-foreground">—</span>;
        return <span className="text-sm text-muted-foreground">{p}</span>;
      },
    },
    ...(renderActions
      ? [
          {
            key: 'actions',
            header: '',
            width: '10%',
            cell: (row: PolicyListItem) => (
              <div onClick={(e) => e.stopPropagation()}>{renderActions(row)}</div>
            ),
          },
        ]
      : []),
  ];

  return (
    <DataTable
      data={policies}
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
