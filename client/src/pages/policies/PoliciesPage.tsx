import { useState, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ContextualHelpButton, PageHeader, ConfirmDialog } from '@/components/shared';
import {
  PolicyTable,
  PolicyActions,
  CreatePolicyModal,
  EditPolicyModal,
} from '@/components/policies';
import { FilterBar } from '@/components/shared';
import {
  usePolicies,
  usePolicyStats,
  usePendingAttestations,
  useArchivePolicy,
  useDeletePolicy,
  downloadAcceptanceHistoryFn,
} from '@/api/policies';
import { useFrameworks } from '@/api/frameworks';
import { formatFrameworkCode } from '@/lib/formatters';
import type { PolicyListItem, PolicyListParams } from '@/api/policies';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FormErrorAlert, Pagination, ListPageStatGrid } from '@/components/shared';
import { Plus, CheckCircle, BookOpen, Clock, FileWarning } from 'lucide-react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/apiError';
import { usePermissions } from '@/hooks/usePermissions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'OK' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const SOURCE_OPTIONS = [
  { value: 'VANTA', label: 'Vanta' },
  { value: 'CUSTOM', label: 'Custom' },
];

const LATEST_VERSION_OPTIONS = [
  { value: 'APPROVED', label: 'Approved' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'NOT_STARTED', label: 'Not started' },
];

const CATEGORY_OPTIONS = [
  { value: 'Security', label: 'Security' },
  { value: 'Privacy', label: 'Privacy' },
  { value: 'HR', label: 'HR' },
  { value: 'Operations', label: 'Operations' },
  { value: 'Compliance', label: 'Compliance' },
];

const SORT_OPTIONS = [
  { value: 'title_asc', label: 'Title (A–Z)' },
  { value: 'title_desc', label: 'Title (Z–A)' },
  { value: 'status_asc', label: 'Status' },
  { value: 'createdAt_desc', label: 'Newest first' },
  { value: 'nextReviewDue_asc', label: 'Review due soon' },
];

const LATEST_VERSION_VALUES = new Set<NonNullable<PolicyListParams['latestVersion']>>([
  'APPROVED',
  'DRAFT',
  'NOT_STARTED',
]);

export function PoliciesPage() {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const { data: frameworksData } = useFrameworks();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [editPolicy, setEditPolicy] = useState<PolicyListItem | null>(null);
  const [archivePolicy, setArchivePolicy] = useState<PolicyListItem | null>(null);
  const [deletePolicy, setDeletePolicy] = useState<PolicyListItem | null>(null);

  const page = Number(searchParams.get('page')) || 1;
  const limit = Number(searchParams.get('limit')) || 20;
  const tab = searchParams.get('tab') ?? 'all';
  const search = searchParams.get('search') ?? '';
  const latestVersionParam = searchParams.get('latestVersion');
  const latestVersion = latestVersionParam && LATEST_VERSION_VALUES.has(
    latestVersionParam as NonNullable<PolicyListParams['latestVersion']>
  )
    ? (latestVersionParam as NonNullable<PolicyListParams['latestVersion']>)
    : undefined;
  const status = searchParams.get('status') ?? '';
  const category = searchParams.get('category') ?? '';
  const frameworkId = searchParams.get('frameworkId') ?? '';
  const source = searchParams.get('source') ?? '';
  const sort = searchParams.get('sort') ?? 'title_asc';

  const [sortBy, sortOrder] = useMemo(() => {
    const [by, order] = sort.split('_');
    return [by || 'title', (order as 'asc' | 'desc') || 'asc'];
  }, [sort]);

  const params = useMemo(
    () => ({
      page,
      limit: [10, 20, 50, 100].includes(limit) ? limit : 20,
      tab: tab === 'all' ? undefined : (tab as 'needs_my_approval' | 'needs_approval' | 'needs_reassignment'),
      latestVersion,
      search: search || undefined,
      status: status || undefined,
      category: category || undefined,
      frameworkId: frameworkId || undefined,
      source: source || undefined,
      sortBy: sortBy as 'title' | 'createdAt' | 'updatedAt' | 'status' | 'nextReviewDue',
      sortOrder: sortOrder as 'asc' | 'desc',
    }),
    [page, limit, tab, search, latestVersion, status, category, frameworkId, source, sortBy, sortOrder]
  );

  const policies = usePolicies(params);
  const stats = usePolicyStats();
  const pendingAttestations = usePendingAttestations();
  const archiveMutation = useArchivePolicy();
  const deleteMutation = useDeletePolicy();

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
      next.delete('tab');
      next.delete('latestVersion');
      next.delete('search');
      next.delete('status');
      next.delete('category');
      next.delete('frameworkId');
      next.delete('source');
      next.delete('sort');
      next.set('page', '1');
      return next;
    });
  };

  const TABS = [
    { value: 'all', label: 'All', count: stats.data?.tabs?.all },
    { value: 'needs_my_approval', label: 'Needs my approval', count: stats.data?.tabs?.needs_my_approval },
    { value: 'needs_approval', label: 'Needs approval', count: stats.data?.tabs?.needs_approval },
    { value: 'needs_reassignment', label: 'Needs reassignment', count: stats.data?.tabs?.needs_reassignment },
  ];

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

  const handleDownloadAcceptanceHistory = async (policy: PolicyListItem) => {
    try {
      await downloadAcceptanceHistoryFn(policy._id, policy.title);
      toast.success('Download started');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const frameworkOptions = (frameworksData ?? []).map((f) => ({
    value: f._id,
    label: formatFrameworkCode(f.code ?? f.name),
  }));
  const filterItems = [
    { key: 'status', label: 'Overall status', value: status, options: [{ value: '__all__', label: 'All' }, ...STATUS_OPTIONS] },
    { key: 'latestVersion', label: 'Latest version', value: latestVersion ?? '', options: [{ value: '__all__', label: 'All' }, ...LATEST_VERSION_OPTIONS] },
    { key: 'category', label: 'Category', value: category, options: [{ value: '__all__', label: 'All' }, ...CATEGORY_OPTIONS] },
    { key: 'frameworkId', label: 'Framework', value: frameworkId, options: [{ value: '__all__', label: 'All' }, ...frameworkOptions] },
    { key: 'source', label: 'Source', value: source, options: [{ value: '__all__', label: 'All' }, ...SOURCE_OPTIONS] },
    { key: 'sort', label: 'Sort', value: sort, options: SORT_OPTIONS, defaultValue: 'title_asc' },
  ];

  const pagination = policies.data?.pagination;
  const policyList = policies.data?.policies ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Policies"
        description="Manage organization policies and attestations"
        actions={
          <div className="flex gap-2">
            <ContextualHelpButton moduleId="policies" label="Status guide" />
            {permissions.canCreatePolicies ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 size-4" />
                    Add policy
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate('/policies/library')}>
                    Add from policy library
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCreateOpen(true)}>
                    Create new policy
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        }
      />

      {policies.error && (
        <FormErrorAlert
          message={(policies.error as Error).message}
          onRetry={() => policies.refetch()}
        />
      )}

      {stats.data && (
        <ListPageStatGrid
          items={[
            { label: 'Total policies', value: stats.data.total, icon: BookOpen },
            { label: 'Active', value: stats.data.byStatus?.ACTIVE ?? 0, icon: CheckCircle },
            { label: 'Draft', value: stats.data.byStatus?.DRAFT ?? 0, icon: FileWarning },
            {
              label: 'Overdue review',
              value: stats.data.overdueReview ?? stats.data.overdueCount ?? 0,
              icon: Clock,
            },
          ]}
        />
      )}

      {pendingAttestations.data && pendingAttestations.data.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="size-4 text-primary" />
              Pending attestations ({pendingAttestations.data.length})
            </CardTitle>
            <CardDescription>
              You have policies awaiting your attestation.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-2">
              {pendingAttestations.data.slice(0, 5).map((item) => (
                <li key={item._id}>
                  <Link
                    to={`/policies/${item._id}`}
                    className="block rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted/50"
                  >
                    {item.title}
                    {item.versionNumber != null && (
                      <span className="ml-2 text-muted-foreground">
                        (v{item.versionNumber})
                      </span>
                    )}
                  </Link>
                </li>
              ))}
              {pendingAttestations.data.length > 5 && (
                <li className="px-2 text-xs text-muted-foreground">
                  +{pendingAttestations.data.length - 5} more
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <div className="flex gap-2 border-b">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.set('tab', t.value);
                  next.set('page', '1');
                  return next;
                });
              }}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t.value
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
              {t.count != null && (
                <span className="ml-1.5 text-muted-foreground">({t.count})</span>
              )}
            </button>
          ))}
        </div>

        <FilterBar
          searchPlaceholder="Search policies..."
          searchValue={search}
          onSearchChange={handleSearchChange}
          filters={filterItems}
          onFilterChange={handleFilterChange}
          onClearAll={handleClearAll}
        />

        {policies.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <>
            <PolicyTable
              policies={policyList}
              onRowClick={(p) => navigate(`/policies/${p._id}`)}
              renderActions={(p) => (
                <PolicyActions
                  policy={p}
                  onView={() => navigate(`/policies/${p._id}`)}
                  onEditContent={() => navigate(`/policies/${p._id}/edit`)}
                  onEdit={() => setEditPolicy(p)}
                  onArchive={() => setArchivePolicy(p)}
                  onDelete={() => setDeletePolicy(p)}
                  onDownloadAcceptanceHistory={() => handleDownloadAcceptanceHistory(p)}
                />
              )}
              emptyMessage="No policies found."
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
                entityLabel="policies"
              />
            )}
          </>
        )}
      </div>

      {permissions.canCreatePolicies && (
        <CreatePolicyModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSuccess={() => setCreateOpen(false)}
        />
      )}

      {permissions.canEditPolicies && (
        <EditPolicyModal
          policy={editPolicy}
          open={!!editPolicy}
          onOpenChange={(open) => !open && setEditPolicy(null)}
          onSuccess={() => setEditPolicy(null)}
        />
      )}

      {permissions.canArchivePolicies && (
        <ConfirmDialog
          open={!!archivePolicy}
          onOpenChange={(open) => !open && setArchivePolicy(null)}
        title="Archive policy"
        description={
          archivePolicy
            ? `Archive "${archivePolicy.title}"? Archiving this policy will automatically complete any pending acknowledgements and mark this policy as satisfied for linked controls. This action is recorded in the audit log.`
            : ''
        }
        confirmLabel="Archive"
        variant="default"
        onConfirm={async () => {
          if (archivePolicy) {
            await archiveMutation.mutateAsync(archivePolicy._id);
            setArchivePolicy(null);
          }
        }}
        loading={archiveMutation.isPending}
        />
      )}

      {permissions.canDeletePolicies && (
        <ConfirmDialog
          open={!!deletePolicy}
          onOpenChange={(open) => !open && setDeletePolicy(null)}
        title="Delete policy"
        description={
          deletePolicy
            ? `Delete "${deletePolicy.title}"? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (deletePolicy) {
            await deleteMutation.mutateAsync(deletePolicy._id);
            setDeletePolicy(null);
            navigate('/policies');
          }
        }}
        loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
