import { useMemo, useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ContextualHelpButton, PageHeader, Pagination, FormErrorAlert, ConfirmDialog } from '@/components/shared';
import {
  TestsStatsBar,
  TestsFilterBar,
  TestsTable,
  type TestsFilterState,
} from '@/components/tests';
import {
  useTests,
  useTestStats,
  useDeactivateTest,
  useReactivateTest,
  type TestListParams,
} from '@/api/tests';
import { useFrameworks } from '@/api/frameworks';
import { useControls } from '@/api/controls';
import { useUsers } from '@/api/users';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';

const DEFAULT_FILTERS: TestsFilterState = {
  search: '',
  category: '',
  frameworkId: '',
  controlId: '',
  integration: '',
  ownerId: '',
  type: '',
  status: '',
  rollout: '',
};

const SORT_FIELDS = ['name', 'dueDate', 'status', 'createdAt', 'lastPassedAt'] as const;
type SortField = (typeof SORT_FIELDS)[number];

function parseSortBy(v: string | null): SortField {
  if (v && (SORT_FIELDS as readonly string[]).includes(v)) return v as SortField;
  return 'dueDate';
}

function parseSortOrder(v: string | null): 'asc' | 'desc' {
  return v === 'desc' ? 'desc' : 'asc';
}

export function TestsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [bulkDeactivateOpen, setBulkDeactivateOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const page = Number(searchParams.get('page')) || 1;
  const limit = Number(searchParams.get('limit')) || 20;
  const sortBy = parseSortBy(searchParams.get('sortBy'));
  const sortOrder = parseSortOrder(searchParams.get('sortOrder'));

  const filters: TestsFilterState = useMemo(
    () => ({
      search: searchParams.get('search') ?? '',
      category: searchParams.get('category') ?? '',
      frameworkId: searchParams.get('frameworkId') ?? '',
      controlId: searchParams.get('controlId') ?? '',
      integration: searchParams.get('integration') ?? '',
      ownerId: searchParams.get('ownerId') ?? '',
      type: searchParams.get('type') ?? '',
      status: searchParams.get('status') ?? '',
      rollout: searchParams.get('rollout') ?? '',
    }),
    [searchParams]
  );

  const showInactive = searchParams.get('showInactive') === 'true';

  const listParams = useMemo(
    () => ({
      page,
      limit: [10, 20, 50].includes(limit) ? limit : 20,
      search: filters.search || undefined,
      category: filters.category || undefined,
      frameworkId: filters.frameworkId || undefined,
      controlId: filters.controlId || undefined,
      integration: filters.integration || undefined,
      ownerId: filters.ownerId || undefined,
      type: (filters.type as 'document' | 'automated') || undefined,
      status: filters.status || undefined,
      rollout: filters.rollout || undefined,
      showInactive: showInactive || undefined,
      sortBy,
      sortOrder,
    }),
    [page, limit, filters, showInactive, sortBy, sortOrder]
  );

  const testsQuery = useTests(listParams);
  const statsQuery = useTestStats();
  const frameworks = useFrameworks();
  const controls = useControls({ limit: 200 });
  const users = useUsers({ limit: 100 });

  const deactivate = useDeactivateTest();
  const reactivate = useReactivateTest();

  const updateParams = useCallback(
    (updates: Record<string, string | number>) => {
      const next = new URLSearchParams(searchParams);
      for (const [k, v] of Object.entries(updates)) {
        if (v === '' || v == null) next.delete(k);
        else next.set(k, String(v));
      }
      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  const onFilterChange = (partial: Partial<TestsFilterState>) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(partial)) {
      if (v === '' || v == null) next.delete(k);
      else next.set(k, String(v));
    }
    next.set('page', '1');
    setSearchParams(next);
  };

  const onClearFilters = () => {
    const next = new URLSearchParams();
    next.set('page', '1');
    next.set('limit', String(limit));
    next.set('sortBy', sortBy);
    next.set('sortOrder', sortOrder);
    setSearchParams(next);
  };

  const onSortChange = useCallback(
    (field: TestListParams['sortBy'] & SortField, order: 'asc' | 'desc') => {
      const next = new URLSearchParams(searchParams);
      next.set('sortBy', field);
      next.set('sortOrder', order);
      next.set('page', '1');
      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  const testsOnPage = testsQuery.data?.tests ?? [];
  const pageIds = testsOnPage.map((t) => t._id);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const selectAllOnPage = useCallback(() => {
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (allSelected) {
        pageIds.forEach((id) => n.delete(id));
      } else {
        pageIds.forEach((id) => n.add(id));
      }
      return n;
    });
  }, [pageIds, selectedIds]);

  const handleDeactivate = async () => {
    if (!deactivateId) return;
    await deactivate.mutateAsync(deactivateId);
    setDeactivateId(null);
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.delete(deactivateId);
      return n;
    });
  };

  const handleBulkDeactivate = async () => {
    const ids = [...selectedIds];
    for (const id of ids) {
      await deactivate.mutateAsync(id);
    }
    setBulkDeactivateOpen(false);
    setSelectedIds(new Set());
  };

  if (testsQuery.error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Tests" />
        <FormErrorAlert
          message={(testsQuery.error as Error).message}
          onRetry={() => testsQuery.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="Tests" description="Compliance checks — manual evidence and future automations." />
        <div className="flex items-center gap-2">
          <ContextualHelpButton moduleId="tests" label="Status guide" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => updateParams({ showInactive: searchParams.get('showInactive') ? '' : 'true' })}
              >
                {searchParams.get('showInactive') ? 'Hide inactive tests' : 'Show inactive tests'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {statsQuery.isLoading ? (
        <Skeleton className="h-40 w-full rounded-lg" />
      ) : statsQuery.data ? (
        <TestsStatsBar stats={statsQuery.data} />
      ) : null}

      <TestsFilterBar
        value={{ ...DEFAULT_FILTERS, ...filters }}
        onChange={onFilterChange}
        onClear={onClearFilters}
        frameworks={frameworks.data ?? []}
        controls={controls.data?.controls ?? []}
        users={users.data?.users ?? []}
      />

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border/80 bg-muted/30 px-4 py-3 text-sm">
          <span className="font-medium text-foreground">
            {selectedIds.size} selected
          </span>
          <Button size="sm" variant="destructive" onClick={() => setBulkDeactivateOpen(true)}>
            Deactivate selected
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Clear selection
          </Button>
        </div>
      )}

      {testsQuery.isLoading ? (
        <Skeleton className="h-96 w-full rounded-lg" />
      ) : (
        <TestsTable
          tests={testsOnPage}
          onDeactivate={(id) => setDeactivateId(id)}
          onReactivate={(id) => reactivate.mutate(id)}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={onSortChange}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onSelectAllOnPage={selectAllOnPage}
        />
      )}

      {testsQuery.data?.pagination && (
        <Pagination
          page={testsQuery.data.pagination.page}
          limit={testsQuery.data.pagination.limit}
          total={testsQuery.data.pagination.total}
          pages={testsQuery.data.pagination.pages}
          hasPrevPage={testsQuery.data.pagination.hasPrevPage}
          hasNextPage={testsQuery.data.pagination.hasNextPage}
          onPageChange={(p) => updateParams({ page: p })}
          onLimitChange={(l) => updateParams({ limit: l, page: 1 })}
          entityLabel="tests"
        />
      )}

      <ConfirmDialog
        open={!!deactivateId}
        onOpenChange={(open) => !open && setDeactivateId(null)}
        title="Deactivate test"
        description="This test is excluded from readiness scoring while inactive. Reactivate to resume monitoring."
        confirmLabel="Deactivate"
        variant="default"
        onConfirm={handleDeactivate}
        loading={deactivate.isPending}
      />

      <ConfirmDialog
        open={bulkDeactivateOpen}
        onOpenChange={setBulkDeactivateOpen}
        title="Deactivate selected tests?"
        description={`${selectedIds.size} test(s) will be excluded from readiness scoring until reactivated.`}
        confirmLabel="Deactivate all"
        variant="destructive"
        onConfirm={handleBulkDeactivate}
        loading={deactivate.isPending}
      />
    </div>
  );
}
