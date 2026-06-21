import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/shared/EmptyState';
import { FileQuestion, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
  sortKey?: string;
  sortable?: boolean;
  width?: string;
};

type DataTableProps<T> = {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  emptyDescription?: string;
  emptyIcon?: LucideIcon;
  className?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string, order: 'asc' | 'desc') => void;
};

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  emptyMessage = 'No data found.',
  emptyDescription,
  emptyIcon: EmptyIcon = FileQuestion,
  className,
  sortBy,
  sortOrder,
  onSort,
}: DataTableProps<T>) {
  const handleSort = (col: Column<T>) => {
    const key = col.sortKey ?? col.key;
    if (!col.sortable || !onSort) return;
    const nextOrder =
      sortBy === key && sortOrder === 'asc' ? 'desc' : 'asc';
    onSort(key, nextOrder);
  };

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border', className)}>
      <div className="max-h-[calc(100vh-16rem)] overflow-auto">
        {data.length === 0 ? (
          <EmptyState
            icon={EmptyIcon}
            title={emptyMessage}
            description={emptyDescription}
            className="min-h-[200px] border-0 rounded-none"
          />
        ) : (
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((col) => {
                const isSortable = col.sortable && onSort;
                const isActive = sortBy === (col.sortKey ?? col.key);
                return (
                <TableHead
                  key={col.key}
                  className={cn(
                    'sticky top-0 z-10 bg-muted/80 backdrop-blur-sm',
                    isSortable && 'cursor-pointer select-none hover:bg-muted',
                    col.className
                  )}
                  style={col.width ? { width: col.width, minWidth: col.width } : undefined}
                  onClick={() => handleSort(col)}
                >
                  <div className="flex items-center gap-1.5">
                    {col.header}
                    {isSortable && (
                      <span className="inline-flex text-muted-foreground">
                        {!isActive ? (
                          <ArrowUpDown className="size-3.5" />
                        ) : sortOrder === 'asc' ? (
                          <ArrowUp className="size-3.5" />
                        ) : (
                          <ArrowDown className="size-3.5" />
                        )}
                      </span>
                    )}
                  </div>
                </TableHead>
              );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, index) => (
                <TableRow
                  key={keyExtractor(row)}
                  className={cn(
                    'transition-colors duration-150',
                    index % 2 === 1 && 'bg-muted/20',
                    onRowClick && 'cursor-pointer hover:bg-muted/60'
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn('py-3', col.className)}
                      style={col.width ? { width: col.width, minWidth: col.width } : undefined}
                    >
                      {col.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </Table>
        )}
      </div>
    </div>
  );
}
