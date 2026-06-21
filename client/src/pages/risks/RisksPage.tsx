import { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ContextualHelpButton, PageHeader } from '@/components/shared';
import { RiskTable, AddRiskScenarioModal } from '@/components/risks';
import { FilterBar } from '@/components/shared';
import { useRisks, useRiskStats, useArchiveRisk } from '@/api/risks';
// import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/button';
import { FormErrorAlert, TableSkeleton, Pagination, ListPageStatGrid } from '@/components/shared';
import { exportToCsv } from '@/lib/csvExport';
import { formatDate, formatScore } from '@/lib/formatters';
import { Download, Plus, ChevronDown, AlertTriangle, CircleDot } from 'lucide-react';
// import {
//   Popover,
//   PopoverContent,
//   PopoverTrigger,
// } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePermissions } from '@/hooks/usePermissions';

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'NEEDS_REVIEW', label: 'Needs review' },
  { value: 'PENDING_APPROVAL', label: 'Pending approval' },
  { value: 'APPROVED', label: 'Approved' },
];

const OWNER_OPTIONS = [
  { value: '__me__', label: 'Assigned to me' },
  { value: '__needs_reassignment__', label: 'Needs reassignment' },
  { value: '__unassigned__', label: 'Unassigned' },
];

const CATEGORIES_OPTIONS = [
  'Access control',
  'Artificial intelligence',
  'Asset management',
  'Business continuity and disaster r...',
  'Communications security',
  'Compliance',
  'Cryptography',
  'Environmental, social, and govern...',
  'Fraud',
  'Incident response management',
  'Information security operations',
  'Information security policies',
  'Operations security',
  'People operations',
  'Physical and environmental security',
  'Privacy',
  'Software development and acquisi...',
  'Trustworthiness',
  'Uncategorized',
  'Vendor relationships',
].map((c) => ({ value: c, label: c }));

const INHERENT_OPTIONS = [
  { value: 'HIGH', label: 'High' },
  { value: 'MED', label: 'Med' },
  { value: 'LOW', label: 'Low' },
];

const RESIDUAL_OPTIONS = [
  { value: 'HIGH', label: 'High' },
  { value: 'MED', label: 'Med' },
  { value: 'LOW', label: 'Low' },
];

const APPROVER_OPTIONS = [
  { value: '__me__', label: 'Assigned to me' },
  { value: '__needs_reassignment__', label: 'Needs reassignment' },
];

// const ADD_FILTER_OPTIONS = [
//   { key: 'ciaCategories', label: 'CIA Categories' },
//   { key: 'identified', label: 'Identified' },
//   { key: 'source', label: 'Source' },
//   { key: 'treatmentPlan', label: 'Treatment plan' },
// ];

const TREATMENT_PLAN_OPTIONS = [
  { value: 'MITIGATE', label: 'Mitigate' },
  { value: 'ACCEPT', label: 'Accept' },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'AVOID', label: 'Avoid' },
];

export function RisksPage() {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [addScenarioOpen, setAddScenarioOpen] = useState(false);

  const page = Number(searchParams.get('page')) || 1;
  const limit = Number(searchParams.get('limit')) || 20;
  const search = searchParams.get('search') ?? '';
  const status = searchParams.get('status') ?? '';
  const owner = searchParams.get('owner') ?? '';
  const category = searchParams.get('category') ?? '';
  const inherent = searchParams.get('inherent') ?? '';
  const residual = searchParams.get('residual') ?? '';
  const approver = searchParams.get('approver') ?? '';
  const sort = searchParams.get('sort') ?? 'residualScore_desc';
  const addedFiltersParam = searchParams.get('addedFilters') ?? '';
  const treatmentPlan = searchParams.get('treatmentPlan') ?? '';
  const ciaCategories = searchParams.get('ciaCategories') ?? '';
  const identified = searchParams.get('identified') ?? '';
  const source = searchParams.get('source') ?? '';

  const addedFilterKeys = useMemo(
    () => (addedFiltersParam ? addedFiltersParam.split(',').filter(Boolean) : []),
    [addedFiltersParam]
  );

  const [sortBy, sortOrder] = useMemo(() => {
    const [by, order] = sort.split('_');
    return [by || 'residualScore', (order as 'asc' | 'desc') || 'desc'];
  }, [sort]);

  const params = useMemo(
    () => ({
      page,
      limit: [10, 20, 50, 100].includes(limit) ? limit : 20,
      search: search || undefined,
      status: status || undefined,
      owner: owner || undefined,
      category: category || undefined,
      inherent: inherent || undefined,
      residual: residual || undefined,
      approverId: approver || undefined,
      sortBy,
      sortOrder: sortOrder as 'asc' | 'desc',
      treatmentPlan: treatmentPlan || undefined,
      ciaCategories: ciaCategories || undefined,
      identified: identified || undefined,
      source: source || undefined,
    }),
    [page, limit, search, status, owner, category, inherent, residual, approver, sortBy, sortOrder, treatmentPlan, ciaCategories, identified, source]
  );

  const risks = useRisks(params);
  const stats = useRiskStats();
  const archiveRisk = useArchiveRisk();

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
      next.delete('owner');
      next.delete('category');
      next.delete('inherent');
      next.delete('residual');
      next.delete('approver');
      next.delete('sort');
      next.delete('addedFilters');
      next.delete('treatmentPlan');
      next.delete('ciaCategories');
      next.delete('identified');
      next.delete('source');
      next.set('page', '1');
      return next;
    });
  };

  // const handleAddFilter = (key: string) => {
  //   setSearchParams((prev) => {
  //     const next = new URLSearchParams(prev);
  //     const current = prev.get('addedFilters') ?? '';
  //     const list = current ? current.split(',').filter(Boolean) : [];
  //     if (!list.includes(key)) list.push(key);
  //     next.set('addedFilters', list.join(','));
  //     next.set('page', '1');
  //     return next;
  //   });
  // };

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

  const handleSort = (key: string, order: 'asc' | 'desc') => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('sort', `${key}_${order}`);
      next.set('page', '1');
      return next;
    });
  };

  const filterItems = [
    { key: 'status', label: 'Status', value: status, options: STATUS_OPTIONS },
    { key: 'owner', label: 'Owner', value: owner, options: OWNER_OPTIONS },
    { key: 'category', label: 'Categories', value: category, options: CATEGORIES_OPTIONS },
    { key: 'inherent', label: 'Inherent', value: inherent, options: INHERENT_OPTIONS },
    { key: 'residual', label: 'Residual', value: residual, options: RESIDUAL_OPTIONS },
    { key: 'approver', label: 'Approver', value: approver, options: APPROVER_OPTIONS },
  ];

  const getAddedFilterConfig = (key: string) => {
    switch (key) {
      case 'treatmentPlan':
        return { label: 'Treatment plan', value: treatmentPlan, options: TREATMENT_PLAN_OPTIONS };
      case 'ciaCategories':
        return { label: 'CIA Categories', value: ciaCategories, options: [] as { value: string; label: string }[] };
      case 'identified':
        return { label: 'Identified', value: identified, options: [] as { value: string; label: string }[] };
      case 'source':
        return { label: 'Source', value: source, options: [] as { value: string; label: string }[] };
      default:
        return { label: key, value: '', options: [] as { value: string; label: string }[] };
    }
  };

  const addedFilterItems = addedFilterKeys.map((key) => {
    const config = getAddedFilterConfig(key);
    return { key, label: config.label, value: config.value, options: config.options };
  });

  const allFilterItems = [...filterItems, ...addedFilterItems];

  const pagination = risks.data?.pagination;
  const riskList = risks.data?.risks ?? [];

  const handleExportCsv = () => {
    if (!riskList.length) return;
    exportToCsv(
      riskList,
      [
        { key: 'identifier', header: 'ID' },
        { key: 'title', header: 'Title' },
        { key: 'riskLevel', header: 'Level' },
        { key: 'residualScore', header: 'Score', format: (v) => formatScore(v as number) },
        { key: 'status', header: 'Status' },
        { key: 'treatment', header: 'Treatment' },
        { key: 'nextReviewDue', header: 'Next review', format: (v) => formatDate(v as string) },
      ],
      'risks'
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk scenarios"
        description="Manage and track compliance risks"
        actions={
          <div className="flex gap-2">
            <ContextualHelpButton moduleId="risks" label="Status guide" />
            {permissions.canCreateRisks && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 size-4" />
                    Add scenario
                    <ChevronDown className="ml-2 size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setAddScenarioOpen(true)}>
                    Manually
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/risk-library')}>
                    Via library
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled>
                    Via import (.csv, .xlsx)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {riskList.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleExportCsv}>
                <Download className="mr-2 size-4" />
                Export CSV
              </Button>
            )}
          </div>
        }
      />

      {risks.error && (
        <FormErrorAlert
          message={(risks.error as Error).message}
          onRetry={() => risks.refetch()}
        />
      )}

      {stats.data && (
        <ListPageStatGrid
          items={[
            { label: 'Total risks', value: stats.data.total, icon: AlertTriangle },
            { label: 'Open', value: stats.data.byStatus?.OPEN ?? 0, icon: CircleDot },
            { label: 'Approved', value: stats.data.byStatus?.APPROVED ?? 0, icon: CircleDot },
            { label: 'Draft', value: stats.data.byStatus?.DRAFT ?? 0, icon: CircleDot },
          ]}
        />
      )}

      <div className="space-y-4">
        <FilterBar
          searchPlaceholder="Search risks..."
          searchValue={search}
          onSearchChange={handleSearchChange}
          filters={allFilterItems}
          onFilterChange={handleFilterChange}
          onClearAll={handleClearAll}
        />

        {risks.isLoading ? (
          <TableSkeleton rows={8} columns={10} />
        ) : (
          <>
            <RiskTable
              risks={riskList}
              onRowClick={(r) => navigate(`/risk-management/risk-scenario/${r._id}`)}
              onManageAccess={permissions.canEditRisks ? (r) => navigate(`/risk-management/risk-scenario/${r._id}`) : undefined}
              onArchive={permissions.canArchiveRisks ? (r) => {
                if (!r._id || archiveRisk.isPending) return;
                archiveRisk.mutate(r._id);
              } : undefined}
              emptyMessage="No risks found."
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
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
                entityLabel="risks"
              />
            )}
          </>
        )}
      </div>

      {permissions.canCreateRisks && (
        <AddRiskScenarioModal
          open={addScenarioOpen}
          onOpenChange={setAddScenarioOpen}
        />
      )}
    </div>
  );
}
