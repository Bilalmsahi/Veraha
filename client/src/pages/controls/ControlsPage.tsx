import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ContextualHelpButton, PageHeader } from '@/components/shared';
import { usePermissions } from '@/hooks/usePermissions';
import {
  ControlSummaryCards,
  ControlTable,
  ControlDetailPanel,
  AssessControlModal,
  BulkUpdateBar,
  CreateControlModal,
  FromTemplateModal,
} from '@/components/controls';
import { FilterBar } from '@/components/shared';
import {
  useControls,
  useControlStats,
  useCategories,
  useControl,
  useRequirementCodes,
} from '@/api/controls';
import { useUsers } from '@/api/users';
import { FRAMEWORK_CODES } from '@/api/organization';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FormErrorAlert, TableSkeleton, Pagination } from '@/components/shared';
import { exportToCsv } from '@/lib/csvExport';
import { formatDate } from '@/lib/formatters';
import type { ControlListItem } from '@/api/controls';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, ChevronDown, MoreHorizontal, Plus, FileUp } from 'lucide-react';

const FRAMEWORK_LABELS: Record<string, string> = {
  SOC2: 'SOC 2',
  ISO27001: 'ISO 27001',
  HIPAA: 'HIPAA',
  GDPR: 'GDPR',
};

const STATUS_OPTIONS = [
  { value: 'PASS', label: 'OK' },
  { value: 'WARNING,FAIL,NOT_CONFIGURED,NOT_APPLICABLE', label: 'Needs evidence' },
];

const SOURCE_OPTIONS = [
  { value: 'VERAHA', label: 'Veraha (from template)' },
  { value: 'CUSTOM', label: 'Custom' },
];

const SORT_OPTIONS = [
  { value: 'identifier_asc', label: 'ID (A–Z)' },
  { value: 'title_asc', label: 'Title (A–Z)' },
  { value: 'overallStatus_asc', label: 'Status' },
  { value: 'lastAssessedAt_desc', label: 'Last assessed (recent)' },
  { value: 'createdAt_desc', label: 'Created (newest)' },
];

export function ControlsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const detailIdParam = searchParams.get('detail');
  const permissions = usePermissions();
  const [assessControl, setAssessControl] = useState<ControlListItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

  const page = Number(searchParams.get('page')) || 1;
  const limit = Number(searchParams.get('limit')) || 20;
  const search = searchParams.get('search') ?? '';
  const status = searchParams.get('status') ?? '';
  const domain = searchParams.get('domain') ?? '';
  const ownerId = searchParams.get('ownerId') ?? '';
  const source = searchParams.get('source') ?? '';
  const frameworkCode = searchParams.get('frameworkCode') ?? '';
  const requirementIdentifier = searchParams.get('requirementIdentifier') ?? '';
  const sort = searchParams.get('sort') ?? 'identifier_asc';

  const [sortBy, sortOrder] = useMemo(() => {
    const [by, order] = sort.split('_');
    return [by || 'identifier', (order as 'asc' | 'desc') || 'asc'];
  }, [sort]);

  const params = useMemo(
    () => ({
      page,
      limit: [10, 20, 50, 100].includes(limit) ? limit : 20,
      search: search || undefined,
      status: status || undefined,
      controlGroup: domain || undefined,
      ownerId: ownerId || undefined,
      source: (source as 'CUSTOM' | 'VERAHA') || undefined,
      frameworkCode: frameworkCode || undefined,
      requirementIdentifier: requirementIdentifier || undefined,
      sortBy: sortBy as 'identifier' | 'title' | 'overallStatus' | 'lastAssessedAt' | 'createdAt' | 'controlGroup',
      sortOrder: sortOrder as 'asc' | 'desc',
      includeRequirements: true,
    }),
    [page, limit, search, status, domain, ownerId, source, frameworkCode, requirementIdentifier, sortBy, sortOrder]
  );

  const controls = useControls(params);
  const stats = useControlStats();
  const categories = useCategories();
  const requirementCodes = useRequirementCodes(frameworkCode || undefined);
  const users = useUsers({ page: 1, limit: 100 });
  const validDetailId =
    detailIdParam && /^[a-f\d]{24}$/i.test(detailIdParam) ? detailIdParam : null;
  const controlDetail = useControl(validDetailId);

  const handleSearchChange = (value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set('search', value);
      else next.delete('search');
      next.set('page', '1');
      return next;
    });
  };

  const handleFilterChange = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      next.set('page', '1');
      return next;
    });
  };

  const handleClearAll = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('search');
      next.delete('status');
      next.delete('domain');
      next.delete('ownerId');
      next.delete('source');
      next.delete('frameworkCode');
      next.delete('requirementIdentifier');
      next.delete('sort');
      next.set('page', '1');
      return next;
    });
  };

  const handlePageChange = (p: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('page', String(p));
      return next;
    });
  };

  const handleLimitChange = (l: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('limit', String(l));
      next.set('page', '1');
      return next;
    });
  };

  const filterItems = [
    {
      key: 'frameworkCode',
      label: 'Framework',
      value: frameworkCode,
      options: [
        ...FRAMEWORK_CODES.map((c) => ({
          value: c,
          label: FRAMEWORK_LABELS[c] ?? c,
        })),
      ],
    },
    {
      key: 'ownerId',
      label: 'Owner',
      value: ownerId,
      options:
        users.data?.users.map((u) => ({
          value: u._id,
          label: `${u.firstName} ${u.lastName}`,
        })) ?? [],
    },
    {
      key: 'domain',
      label: 'Domain',
      value: domain,
      options:
        categories.data
          ?.filter((c) => c.controlGroup)
          .map((c) => ({
            value: c.controlGroup,
            label: `${c.controlGroup} (${c.count})`,
          })) ?? [],
    },
    { key: 'source', label: 'Source', value: source, options: SOURCE_OPTIONS },
    {
      key: 'requirementIdentifier',
      label: 'Framework code',
      value: requirementIdentifier,
      options:
        requirementCodes.data?.map((item) => ({
          value: item.identifier,
          label: item.label,
        })) ?? [],
    },
    { key: 'status', label: 'Status', value: status, options: STATUS_OPTIONS },
    { key: 'sort', label: 'ID (A–Z)', value: sort, options: SORT_OPTIONS, defaultValue: 'identifier_asc' },
  ];

  const pagination = controls.data?.pagination;
  const controlList = controls.data?.controls ?? [];

  const handleExportCsv = () => {
    if (!controlList.length) return;
    exportToCsv(
      controlList,
      [
        { key: 'identifier', header: 'ID' },
        { key: 'title', header: 'Title' },
        { key: 'category', header: 'Category' },
        { key: 'overallStatus', header: 'Status' },
        {
          key: 'owner',
          header: 'Owner',
          format: (v) => {
            const o = v as { firstName?: string; lastName?: string } | null | undefined;
            return o ? `${o.firstName ?? ''} ${o.lastName ?? ''}`.trim() : '';
          },
        },
        { key: 'lastAssessedAt', header: 'Last assessed', format: (v) => formatDate(v as string) },
        { key: 'nextAssessmentDue', header: 'Next due', format: (v) => formatDate(v as string) },
      ],
      'controls'
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Controls"
        description="Manage and assess your compliance controls"
        actions={
          <div className="flex items-center gap-2">
            <ContextualHelpButton moduleId="controls" label="Status guide" />
            {permissions.canCreateControls && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 size-4" />
                    Add control
                    <ChevronDown className="ml-2 size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setTemplateOpen(true)}>
                    <FileUp className="mr-2 size-4" />
                    From template
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCreateOpen(true)}>
                    <Plus className="mr-2 size-4" />
                    Add custom
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="size-9">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={handleExportCsv}
                  disabled={controlList.length === 0}
                >
                  <Download className="mr-2 size-4" />
                  Export all
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>View deactivated (coming soon)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {stats.error && (
        <FormErrorAlert
          message={(stats.error as Error).message}
          onRetry={() => stats.refetch()}
        />
      )}
      {controls.error && (
        <FormErrorAlert
          message={(controls.error as Error).message}
          onRetry={() => controls.refetch()}
        />
      )}

      {stats.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        stats.data && <ControlSummaryCards stats={stats.data} />
      )}

      <div className="space-y-4">
        <FilterBar
          searchPlaceholder="Search by ID or title..."
          searchValue={search}
          onSearchChange={handleSearchChange}
          filters={filterItems}
          onFilterChange={handleFilterChange}
          onClearAll={handleClearAll}
        />

        {controls.isLoading ? (
          <TableSkeleton rows={8} columns={7} />
        ) : (
          <>
            <ControlTable
              controls={controlList}
              onRowClick={(c) =>
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.set('detail', c._id);
                  return next;
                })
              }
              emptyMessage="No controls found. Add a control or enable frameworks in Settings."
              selectable={permissions.canBulkUpdateControls}
              showActions={permissions.canEditControls || permissions.canAssessControls}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />

            {pagination && (
              <Pagination
                page={pagination.page}
                limit={params.limit ?? 20}
                total={pagination.total}
                pages={pagination.pages}
                hasPrevPage={pagination.hasPrevPage}
                hasNextPage={pagination.hasNextPage}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                entityLabel="controls"
              />
            )}
          </>
        )}
      </div>

      <ControlDetailPanel
        control={controlDetail.data ?? null}
        open={!!validDetailId}
        onOpenChange={(open) => {
          if (!open) {
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.delete('detail');
              return next;
            });
          }
        }}
        onAssess={permissions.canAssessControls ? (c) => {
          setAssessControl(c as ControlListItem);
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete('detail');
            return next;
          });
        } : undefined}
      />

      {permissions.canAssessControls && (
        <AssessControlModal
          control={assessControl}
          open={!!assessControl}
          onOpenChange={(open) => !open && setAssessControl(null)}
          onSuccess={() => setAssessControl(null)}
        />
      )}

      {permissions.canBulkUpdateControls && (
        <BulkUpdateBar
          selectedCount={selectedIds.size}
          selectedIds={Array.from(selectedIds)}
          onClearSelection={() => setSelectedIds(new Set())}
        />
      )}

      {permissions.canCreateControls && (
        <>
          <CreateControlModal open={createOpen} onOpenChange={setCreateOpen} />
          <FromTemplateModal open={templateOpen} onOpenChange={setTemplateOpen} />
        </>
      )}
    </div>
  );
}
