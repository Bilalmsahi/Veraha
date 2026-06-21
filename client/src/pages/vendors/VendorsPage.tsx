import { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ContextualHelpButton, PageHeader } from '@/components/shared';
import { VendorTable, CreateVendorModal } from '@/components/vendors';
import { useVendors, useVendorStats } from '@/api/vendors';
import type { VendorListItem } from '@/api/vendors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormErrorAlert, TableSkeleton, Pagination, ListPageStatGrid } from '@/components/shared';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { exportToCsv } from '@/lib/csvExport';
import { formatDate } from '@/lib/formatters';
import { usePermissions } from '@/hooks/usePermissions';
import { Download, Plus, Search, ChevronDown, X, Store, Archive, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const RISK_TIER_OPTIONS = [
  { value: 'CRITICAL', label: 'Critical', dotClass: 'bg-destructive' },
  { value: 'HIGH', label: 'High', dotClass: 'bg-destructive' },
  { value: 'MEDIUM', label: 'Medium', dotClass: 'bg-amber-500' },
  { value: 'LOW', label: 'Low', dotClass: 'bg-[var(--color-success)]' },
  { value: 'UNSCORED', label: 'Unscored', dotClass: 'bg-muted-foreground' },
];

function needsSecurityReview(row: VendorListItem): boolean {
  const tier = (row.riskTier ?? '').toUpperCase();
  const isHighOrCritical = tier === 'CRITICAL' || tier === 'HIGH';
  const next = row.nextAssessmentDate ? new Date(row.nextAssessmentDate) : null;
  const isPast = next ? next < new Date() : false;
  return (isHighOrCritical && !row.nextAssessmentDate) || (next != null && isPast);
}

export function VendorsPage() {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);

  const page = Number(searchParams.get('page')) || 1;
  const limit = Number(searchParams.get('limit')) || 20;
  const search = searchParams.get('search') ?? '';
  const tab = searchParams.get('tab') ?? 'all';
  const status = searchParams.get('status') ?? '';
  const riskTier = searchParams.get('riskTier') ?? '';
  const securityReviewStatus = searchParams.get('securityReviewStatus') ?? '';

  const params = useMemo(() => {
    let statusParam: string | undefined;
    if (tab === 'active') statusParam = 'ACTIVE';
    else if (tab === 'archived') statusParam = 'ARCHIVED';
    else statusParam = status || undefined;

    const tiers = riskTier ? riskTier.split(',').map((t) => t.trim()) : [];
    const apiTiers = tiers.filter((t) => t !== 'UNSCORED');

    return {
      page,
      limit: [10, 20, 50, 100].includes(limit) ? limit : 20,
      search: search || undefined,
      status: statusParam,
      riskTier: apiTiers.length ? apiTiers.join(',') : undefined,
      sortBy: 'name' as const,
      sortOrder: 'asc' as const,
    };
  }, [page, limit, search, tab, status, riskTier]);

  const vendors = useVendors(params);
  const stats = useVendorStats();

  const pagination = vendors.data?.pagination;

  const vendorList = useMemo(() => {
    let list = vendors.data?.vendors ?? [];

    const tiers = riskTier ? riskTier.split(',').map((t) => t.trim()) : [];
    if (tiers.length > 0) {
      list = list.filter((row) => {
        const rt = (row.riskTier ?? '').toUpperCase();
        const normalized = rt === 'MED' ? 'MEDIUM' : rt || 'UNSCORED';
        return tiers.includes(normalized) || (tiers.includes('UNSCORED') && !rt);
      });
    }

    if (securityReviewStatus === 'NEEDS_REVIEW') {
      list = list.filter(needsSecurityReview);
    } else if (securityReviewStatus === 'UP_TO_DATE') {
      list = list.filter((r) => !needsSecurityReview(r));
    }

    return list;
  }, [vendors.data?.vendors, riskTier, securityReviewStatus]);

  const activeCount = stats.data?.byStatus?.ACTIVE ?? 0;
  const archivedCount = stats.data?.byStatus?.ARCHIVED ?? 0;
  const allCount = stats.data?.total ?? 0;

  const handleTabChange = (t: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', t);
      if (t === 'active') next.set('status', 'ACTIVE');
      else if (t === 'archived') next.set('status', 'ARCHIVED');
      else next.delete('status');
      next.set('page', '1');
      return next;
    });
  };

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
      if (key === 'status') next.set('tab', 'all');
      return next;
    });
  };

  const handleReset = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('search');
      next.delete('tab');
      next.delete('status');
      next.delete('riskTier');
      next.delete('securityReviewStatus');
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

  const handleSort = (key: string, order: 'asc' | 'desc') => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('sort', `${key}_${order}`);
      next.set('page', '1');
      return next;
    });
  };

  const statusActive = status.includes('ACTIVE');
  const statusArchived = status.includes('ARCHIVED');
  const riskTiers = riskTier ? riskTier.split(',').map((t) => t.trim()) : [];

  const hasActiveFilters = !!(search || status || riskTier || securityReviewStatus);

  const handleExportCsv = () => {
    if (!vendorList.length) return;
    exportToCsv(
      vendorList,
      [
        { key: 'name', header: 'Name' },
        { key: 'website', header: 'Website' },
        { key: 'riskTier', header: 'Risk tier' },
        { key: 'status', header: 'Status' },
        { key: 'contractEndDate', header: 'Contract ends', format: (v) => formatDate(v as string) },
        { key: 'nextAssessmentDate', header: 'Next assessment', format: (v) => formatDate(v as string) },
      ],
      'vendors'
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendors"
        description="Manage third-party vendor assessments"
        actions={
          <div className="flex gap-2">
            <ContextualHelpButton moduleId="vendors" label="Status guide" />
            <PermissionGate permission="canCreateVendors">
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 size-4" />
                Add vendor
              </Button>
            </PermissionGate>
            <PermissionGate permission="canExportVendors">
              {vendorList.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleExportCsv}>
                  <Download className="mr-2 size-4" />
                  Export CSV
                </Button>
              )}
            </PermissionGate>
          </div>
        }
      />

      {permissions.canCreateVendors && (
        <CreateVendorModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSuccess={() => setCreateOpen(false)}
        />
      )}

      {vendors.error && (
        <FormErrorAlert
          message={(vendors.error as Error).message}
          onRetry={() => vendors.refetch()}
        />
      )}

      {stats.data && (
        <ListPageStatGrid
          items={[
            { label: 'Total vendors', value: stats.data.total, icon: Store },
            { label: 'Active', value: stats.data.byStatus?.ACTIVE ?? 0, icon: CheckCircle2 },
            { label: 'Archived', value: stats.data.byStatus?.ARCHIVED ?? 0, icon: Archive },
          ]}
        />
      )}

      <div className="space-y-4">
        <div className="flex gap-2 border-b">
          {[
            { value: 'active', label: 'Active', count: activeCount },
            { value: 'archived', label: 'Archived', count: archivedCount },
            { value: 'all', label: 'All', count: allCount },
          ].map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => handleTabChange(t.value)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t.value
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
              <span className="ml-1.5 text-muted-foreground">({t.count})</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search vendors"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between sm:w-auto sm:min-w-[140px]">
                <span className="truncate">
                  Vendor status
                  {(statusActive || statusArchived) &&
                    ` (${[statusActive && 'Active', statusArchived && 'Archived'].filter(Boolean).join(', ')})`}
                </span>
                <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="start">
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={statusActive}
                    onCheckedChange={(checked) => {
                      const next = checked ? 'ACTIVE' : '';
                      const archived = statusArchived ? 'ARCHIVED' : '';
                      handleFilterChange('status', [next, archived].filter(Boolean).join(','));
                    }}
                  />
                  <span className="text-sm">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={statusArchived}
                    onCheckedChange={(checked) => {
                      const active = statusActive ? 'ACTIVE' : '';
                      const next = checked ? 'ARCHIVED' : '';
                      handleFilterChange('status', [active, next].filter(Boolean).join(','));
                    }}
                  />
                  <span className="text-sm">Archived</span>
                </label>
              </div>
            </PopoverContent>
          </Popover>

          <Select
            value={securityReviewStatus || '__all__'}
            onValueChange={(v) => handleFilterChange('securityReviewStatus', v === '__all__' ? '' : v)}
          >
            <SelectTrigger size="sm" className="w-[160px]">
              <SelectValue placeholder="Security review status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Security review status</SelectItem>
              <SelectItem value="NEEDS_REVIEW">Needs review</SelectItem>
              <SelectItem value="UP_TO_DATE">Up to date</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="w-[160px] justify-between">
                <span className="truncate">
                  Inherent risk score
                  {riskTiers.length > 0 && ` (${riskTiers.length})`}
                </span>
                <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="start">
              <div className="space-y-2">
                {RISK_TIER_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={riskTiers.includes(opt.value)}
                      onCheckedChange={(checked) => {
                        const next = checked
                          ? [...riskTiers, opt.value].filter(Boolean)
                          : riskTiers.filter((t) => t !== opt.value);
                        handleFilterChange('riskTier', next.join(','));
                      }}
                    />
                    <span className={cn('size-2 rounded-full shrink-0', opt.dotClass)} aria-hidden />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <X className="mr-1 size-3.5" />
              Reset
            </Button>
          )}
        </div>

        {vendors.isLoading ? (
          <TableSkeleton rows={8} columns={7} />
        ) : (
          <>
            <VendorTable
              vendors={vendorList}
              onRowClick={(v) => navigate(`/vendors/${v._id}`)}
              emptyMessage="No vendors found."
              sortBy="name"
              sortOrder="asc"
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
                entityLabel="vendors"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
