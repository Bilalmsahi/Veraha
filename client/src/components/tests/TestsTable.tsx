import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowDown, ArrowUp, MoreHorizontal } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { TestStatusBadge } from './TestStatusBadge';
import type { TestListItem, TestListParams } from '@/api/tests';
import type { TestStatus, TestWorkflowState } from '@/types/enums';
import { cn } from '@/lib/utils';
import { formatFrameworkCode } from '@/lib/formatters';

function frameworkPills(test: TestListItem): { key: string; label: string }[] {
  const seen = new Map<string, string>();
  const links = test.linkedControlIds ?? [];
  for (const c of links) {
    if (typeof c !== 'object' || !c?.linkedRequirements) continue;
    for (const m of c.linkedRequirements ?? []) {
      const fw = m.frameworkId;
      if (fw && typeof fw === 'object' && '_id' in fw && fw._id) {
        const id = String(fw._id);
        const label = formatFrameworkCode(fw.name ?? fw.code ?? id);
        if (!seen.has(id)) seen.set(id, label);
      }
    }
  }
  return [...seen.entries()].map(([key, label]) => ({ key, label }));
}

type SortableColumn = NonNullable<TestListParams['sortBy']>;

type TestsTableProps = {
  tests: TestListItem[];
  isLoading?: boolean;
  onDeactivate?: (id: string) => void;
  onReactivate?: (id: string) => void;
  sortBy?: SortableColumn;
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (sortBy: SortableColumn, sortOrder: 'asc' | 'desc') => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAllOnPage?: () => void;
};

const WORKFLOW_STATUS_LABELS: Partial<Record<TestWorkflowState, string>> = {
  ARCHIVED: 'Archived',
  INACTIVE: 'Deactivated',
  NOT_APPLICABLE: 'N/A',
  SNOOZED: 'Snoozed',
};

const WORKFLOW_STATUS_STYLES: Partial<Record<TestWorkflowState, string>> = {
  ARCHIVED: 'border-border bg-muted text-muted-foreground',
  INACTIVE: 'border-border bg-muted text-muted-foreground',
  NOT_APPLICABLE: 'border-border bg-muted text-muted-foreground',
  SNOOZED: 'border-amber-500/30 bg-amber-500/15 text-amber-900 dark:text-amber-200',
};

function TestWorkflowStatusBadge({ workflowState }: { workflowState: TestWorkflowState }) {
  const label = WORKFLOW_STATUS_LABELS[workflowState];
  if (!label) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium',
        WORKFLOW_STATUS_STYLES[workflowState]
      )}
    >
      {label}
    </span>
  );
}

function SortHeader({
  label,
  column,
  sortBy,
  sortOrder,
  onSortChange,
}: {
  label: string;
  column: SortableColumn;
  sortBy?: SortableColumn;
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (sortBy: SortableColumn, sortOrder: 'asc' | 'desc') => void;
}) {
  const active = sortBy === column;
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground"
      onClick={(e) => {
        e.stopPropagation();
        if (!onSortChange) return;
        if (active) {
          onSortChange(column, sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
          onSortChange(column, 'asc');
        }
      }}
    >
      {label}
      {active &&
        (sortOrder === 'asc' ? (
          <ArrowUp className="size-3.5 shrink-0 opacity-80" aria-hidden />
        ) : (
          <ArrowDown className="size-3.5 shrink-0 opacity-80" aria-hidden />
        ))}
    </button>
  );
}

export function TestsTable({
  tests,
  isLoading,
  onDeactivate,
  onReactivate,
  sortBy,
  sortOrder,
  onSortChange,
  selectedIds,
  onToggleSelect,
  onSelectAllOnPage,
}: TestsTableProps) {
  const navigate = useNavigate();
  const selectionEnabled = Boolean(onToggleSelect && selectedIds);

  const pageIds = tests.map((t) => t._id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds?.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds?.has(id));

  if (isLoading) {
    return (
      <div className="rounded-md border border-border/80 bg-card p-12 text-center text-sm text-muted-foreground dark:bg-[#3A5255]/30">
        Loading tests…
      </div>
    );
  }

  if (!tests.length) {
    return (
      <div className="rounded-md border border-border/80 bg-card p-12 text-center text-sm text-muted-foreground dark:bg-[#3A5255]/30">
        No tests match your filters.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-border/80 bg-card dark:bg-[#3A5255]/30">
      <Table className="w-full table-fixed">
        <TableHeader>
          <TableRow className="border-border/80 hover:bg-transparent">
            <TableHead className="w-10">
              {selectionEnabled && (
                <Checkbox
                  checked={
                    allPageSelected ? true : somePageSelected ? 'indeterminate' : false
                  }
                  onCheckedChange={() => onSelectAllOnPage?.()}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Select all on this page"
                />
              )}
            </TableHead>
            <TableHead style={{ width: '30%', minWidth: '30%' }}>
              <SortHeader
                label="Name"
                column="name"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={onSortChange}
              />
            </TableHead>
            <TableHead className="font-medium text-muted-foreground" style={{ width: '10%', minWidth: '10%' }}>Owner</TableHead>
            <TableHead style={{ width: '10%', minWidth: '10%' }}>
              <SortHeader
                label="Status"
                column="status"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={onSortChange}
              />
            </TableHead>
            <TableHead className="font-medium text-muted-foreground" style={{ width: '8%', minWidth: '8%' }}>Failing entities</TableHead>
            <TableHead style={{ width: '10%', minWidth: '10%' }}>
              <SortHeader
                label="Due date"
                column="dueDate"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={onSortChange}
              />
            </TableHead>
            <TableHead style={{ width: '10%', minWidth: '10%' }}>
              <SortHeader
                label="Last passed"
                column="lastPassedAt"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={onSortChange}
              />
            </TableHead>
            <TableHead className="font-medium text-muted-foreground" style={{ width: '12%', minWidth: '12%' }}>Frameworks</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tests.map((test) => {
            const owner =
              typeof test.ownerId === 'object' && test.ownerId ? test.ownerId : null;
            const pills = frameworkPills(test);
            const due = test.dueDate ? new Date(test.dueDate) : null;
            const rowSelected = selectedIds?.has(test._id) ?? false;
            const workflowState = test.workflowState ?? (test.isActive ? 'ACTIVE' : 'INACTIVE');
            const showWorkflowStatus = workflowState !== 'ACTIVE';
            const lastPassed = test.lastPassedAt ? new Date(test.lastPassedAt) : null;
            const lastPassedText =
              workflowState === 'INACTIVE' || workflowState === 'NOT_APPLICABLE'
                ? '—'
                : test.type !== 'automated'
                  ? '—'
                  : lastPassed && !Number.isNaN(lastPassed.getTime())
                    ? formatDistanceToNow(lastPassed, { addSuffix: true })
                    : 'Never';
            const lastPassedTitle =
              workflowState === 'ACTIVE' && test.type !== 'automated'
                ? 'Pass date not available for manual tests.'
                : undefined;

            return (
              <TableRow
                key={test._id}
                className="cursor-pointer border-border/60 hover:bg-muted/40 dark:hover:bg-muted/10"
                onClick={() => navigate(`/tests/${test._id}`)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {selectionEnabled && (
                    <Checkbox
                      checked={rowSelected}
                      onCheckedChange={() => onToggleSelect?.(test._id)}
                      aria-label={`Select ${test.name}`}
                    />
                  )}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium text-foreground line-clamp-2 break-words" title={test.name}>
                      {test.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {test.category}{' '}
                      <span className="rounded bg-muted px-1.5 py-0.5 capitalize text-muted-foreground">
                        {test.type}
                      </span>
                    </p>
                  </div>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {owner ? (
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-[#409BA1] text-xs text-white">
                        {owner.firstName?.[0]}
                        {owner.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-muted text-xs text-muted-foreground">?</AvatarFallback>
                    </Avatar>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {showWorkflowStatus ? (
                      <TestWorkflowStatusBadge workflowState={workflowState} />
                    ) : (
                      <TestStatusBadge status={test.status as TestStatus} />
                    )}
                    {showWorkflowStatus && test.reason && (
                      <span
                        className="line-clamp-1 text-xs text-muted-foreground"
                        title={test.reason}
                      >
                        {test.reason}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">—</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {due && !Number.isNaN(due.getTime())
                    ? formatDistanceToNow(due, { addSuffix: true })
                    : '—'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground" title={lastPassedTitle}>
                  {lastPassedText}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {pills.slice(0, 3).map((p) => (
                      <span
                        key={p.key}
                        className={cn(
                          'rounded border border-[#409BA1]/40 bg-[#409BA1]/10 px-1.5 py-0.5 text-xs text-[#409BA1]',
                          'dark:border-[#409BA1]/50 dark:bg-[#409BA1]/20 dark:text-[#7ecbcd]'
                        )}
                      >
                        {p.label}
                      </span>
                    ))}
                    {pills.length > 3 && (
                      <span className="text-xs text-muted-foreground">+{pills.length - 3}</span>
                    )}
                    {pills.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                  </div>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/tests/${test._id}`)}>
                        Open
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {test.isActive ? (
                        <DropdownMenuItem
                          onClick={() => onDeactivate?.(test._id)}
                          disabled={!onDeactivate}
                        >
                          Deactivate (excluded)
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => onReactivate?.(test._id)}
                          disabled={!onReactivate}
                        >
                          Reactivate
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
