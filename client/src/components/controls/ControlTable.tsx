import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import type { ControlListItem } from '@/api/controls';
import { formatFrameworkCode } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { Lock, MoreHorizontal } from 'lucide-react';

type ControlTableProps = {
  controls: ControlListItem[];
  onRowClick?: (control: ControlListItem) => void;
  emptyMessage?: string;
  className?: string;
  selectable?: boolean;
  showActions?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
};

export function ControlTable({
  controls,
  onRowClick,
  emptyMessage = 'No controls found.',
  className,
  selectable,
  showActions = true,
  selectedIds = new Set(),
  onSelectionChange,
}: ControlTableProps) {
  const getFrameworkLabels = (row: ControlListItem) => {
    const labels = (row.linkedRequirements ?? [])
      .map((req) => req.code.split(' ')[0])
      .filter(Boolean)
      .map((frag) => formatFrameworkCode(frag));
    const unique = [...new Set(labels)];
    if (unique.length === 0) return '—';
    return unique.join(' · ');
  };

  const toggleSelectAll = (checked: boolean | 'indeterminate') => {
    if (!onSelectionChange) return;
    if (checked === true) {
      onSelectionChange(new Set(controls.map((c) => c._id)));
    } else {
      onSelectionChange(new Set());
    }
  };

  const columns: { key: string; header: string; width?: string; cell: (row: ControlListItem) => React.ReactNode }[] = [
    {
      key: 'identifier',
      header: 'ID',
      width: '10%',
      cell: (row) => (
        <span className="font-mono text-sm">{row.identifier}</span>
      ),
    },
    {
      key: 'control',
      header: 'Control',
      width: '30%',
      cell: (row) => (
        <div className="min-w-0 space-y-1">
          <p className="font-medium line-clamp-2 break-words" title={row.title}>{row.title}</p>
          <p className="text-xs leading-4 text-muted-foreground line-clamp-2 break-words whitespace-normal">
            {row.description || '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'owner',
      header: 'Owner',
      width: '15%',
      cell: (row) => (
        (() => {
          const owner = row.owner;
          if (!owner) return <span className="text-muted-foreground">Unassigned</span>;
          return (
            <span className="text-sm">
              {owner.firstName} {owner.lastName}
            </span>
          );
        })()
      ),
    },
    {
      key: 'frameworks',
      header: 'Frameworks',
      width: '18%',
      cell: (row) => {
        const labels = getFrameworkLabels(row);
        return (
          <span className="text-sm text-muted-foreground">{labels}</span>
        );
      },
    },
    {
      key: 'status',
      header: 'Tests',
      width: '10%',
      cell: (row) => {
        const summary = row.testSummary;
        if (!summary || summary.total === 0) {
          return <span className="text-sm text-muted-foreground">-</span>;
        }
        const passing = summary.passing === summary.total;
        return (
          <span className={cn('text-sm', passing ? 'text-emerald-600' : 'text-amber-600')}>
            {summary.passing}/{summary.total}
          </span>
        );
      },
    },
    ...(showActions ? [{
      key: 'actions',
      header: '',
      width: '7%',
      cell: () => (
        <button
          type="button"
          className="inline-flex size-7 items-center justify-center rounded hover:bg-muted/60"
          aria-label="Row actions"
        >
          <MoreHorizontal className="size-4 text-muted-foreground" />
        </button>
      ),
    }] : []),
  ];

  return (
    <div className={cn('rounded-lg border border-border', className)}>
      <div className="max-h-[calc(100vh-16rem)] overflow-y-auto">
        <div className="overflow-x-auto">
          <Table className="min-w-[980px] table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {selectable && (
                <TableHead className="sticky top-0 z-10 w-12 bg-muted/80 backdrop-blur-sm">
                  <Checkbox
                  checked={
                    controls.length > 0
                      ? selectedIds.size === controls.length
                        ? true
                        : selectedIds.size > 0
                          ? 'indeterminate'
                          : false
                      : false
                  }
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
            )}
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm"
                style={col.width ? { width: col.width, minWidth: col.width } : undefined}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {controls.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length + (selectable ? 1 : 0)}
                className="h-24 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            controls.map((row, index) => (
              (() => {
                const locked = row.isAccessible === false || row.isPurchased === false;
                return (
              <TableRow
                key={row._id}
                className={cn(
                  'transition-colors duration-150',
                  index % 2 === 1 && 'bg-muted/20',
                  locked && 'opacity-60 select-none',
                  onRowClick && !locked && 'cursor-pointer hover:bg-muted/60'
                )}
                onClick={() => !locked && onRowClick?.(row)}
              >
                {selectable && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(row._id)}
                      onCheckedChange={() => {
                        const next = new Set(selectedIds);
                        if (next.has(row._id)) next.delete(row._id);
                        else next.add(row._id);
                        onSelectionChange?.(next);
                      }}
                    />
                  </TableCell>
                )}
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className="py-3"
                    style={col.width ? { width: col.width, minWidth: col.width } : undefined}
                  >
                    {col.key === 'identifier' && locked ? (
                      <span className="inline-flex items-center gap-2">
                        <Lock className="size-4 text-muted-foreground" aria-label="Locked - upgrade to access" />
                        {col.cell(row)}
                      </span>
                    ) : col.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
                );
              })()
            ))
          )}
        </TableBody>
      </Table>
        </div>
      </div>
    </div>
  );
}
