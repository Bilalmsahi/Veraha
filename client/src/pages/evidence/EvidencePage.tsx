import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ContextualHelpButton, PageHeader } from '@/components/shared';
import {
  EvidenceTable,
  EvidenceUploadModal,
  CreateCustomDocumentModal,
  RenewByFilterPopover,
} from '@/components/evidence';
import { FilterBar } from '@/components/shared';
import { useEvidenceList, useEvidenceStats } from '@/api/evidence';
import { useUsers } from '@/api/users';
import { useAuthStore } from '@/store/useAuthStore';
import { usePermissions } from '@/hooks/usePermissions';
import { useFrameworks } from '@/api/frameworks';
import { formatFrameworkCode } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { FormErrorAlert, TableSkeleton, Pagination, ListPageStatGrid } from '@/components/shared';
import { exportToCsv } from '@/lib/csvExport';
import { formatDate } from '@/lib/formatters';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Upload, Download, ChevronDown, FileText, Files, Clock, AlertCircle } from 'lucide-react';

// Vanta filter options - exact match to spec
const OVERALL_STATUS_OPTIONS = [
  { value: 'NEEDS_REMEDIATION', label: 'Needs remediation' },
  { value: 'OK', label: 'OK' },
  { value: 'DUE_SOON', label: 'Due soon' },
  { value: 'OVERDUE', label: 'Overdue' },
];

const RENEW_BY_OPTIONS: { value: string; label: string }[] = [
  { value: 'custom', label: 'Custom (Date Picker)' },
  { value: 'next_7_days', label: 'Next 7 days' },
  { value: 'next_30_days', label: 'Next 30 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'previous_month', label: 'Previous month' },
  { value: 'previous_3_months', label: 'Previous 3 months' },
  { value: 'previous_6_months', label: 'Previous 6 months' },
  { value: 'previous_12_months', label: 'Previous 12 months' },
];

const DOCUMENT_STATUS_OPTIONS = [
  { value: 'APPROVED', label: 'Complete' },
  { value: 'PENDING', label: 'Pending approval' },
  { value: '__EXPIRING_SOON__', label: 'Expiring soon' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'PENDING_DRAFT', label: 'Draft' },
  { value: '__NOT_STARTED__', label: 'Not started' },
];

const CATEGORY_OPTIONS = [
  { value: 'Custom', label: 'Custom' },
  { value: 'Engineering', label: 'Engineering' },
  { value: 'HR', label: 'HR' },
  { value: 'IT', label: 'IT' },
  { value: 'Policy', label: 'Policy' },
  { value: 'Risks', label: 'Risks' },
];

const SORT_OPTIONS = [
  { value: 'createdAt_desc', label: 'Newest first' },
  { value: 'createdAt_asc', label: 'Oldest first' },
  { value: 'title_asc', label: 'Title (A-Z)' },
  { value: 'validUntil_asc', label: 'Renew by (soonest)' },
  { value: 'validUntil_desc', label: 'Renew by (latest)' },
  { value: 'status_asc', label: 'Document status' },
];

/** Compute validUntilFrom/To for renew-by presets (for API). All dates as ISO date strings (YYYY-MM-DD). */
function getRenewByDateRange(
  preset: string,
  customFrom?: string,
  customTo?: string
): { validUntilFrom?: string; validUntilTo?: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const toIso = (d: Date) => d.toISOString().slice(0, 10);

  if (preset === 'custom' && customFrom && customTo) {
    return { validUntilFrom: customFrom, validUntilTo: customTo };
  }
  if (preset !== 'custom') {
    switch (preset) {
      case 'next_7_days':
        return {
          validUntilFrom: toIso(today),
          validUntilTo: toIso(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)),
        };
      case 'next_30_days':
        return {
          validUntilFrom: toIso(today),
          validUntilTo: toIso(new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)),
        };
      case 'this_month': {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return { validUntilFrom: toIso(start), validUntilTo: toIso(end) };
      }
      case 'last_7_days':
        return {
          validUntilFrom: toIso(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)),
          validUntilTo: toIso(today),
        };
      case 'last_30_days':
        return {
          validUntilFrom: toIso(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)),
          validUntilTo: toIso(today),
        };
      case 'previous_month': {
        const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const end = new Date(today.getFullYear(), today.getMonth(), 0);
        return { validUntilFrom: toIso(start), validUntilTo: toIso(end) };
      }
      case 'previous_3_months':
        return {
          validUntilFrom: toIso(new Date(today.getFullYear(), today.getMonth() - 3, today.getDate())),
          validUntilTo: toIso(today),
        };
      case 'previous_6_months':
        return {
          validUntilFrom: toIso(new Date(today.getFullYear(), today.getMonth() - 6, today.getDate())),
          validUntilTo: toIso(today),
        };
      case 'previous_12_months':
        return {
          validUntilFrom: toIso(new Date(today.getFullYear(), today.getMonth() - 12, today.getDate())),
          validUntilTo: toIso(today),
        };
      default:
        return {};
    }
  }
  return {};
}

export function EvidencePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [customDocOpen, setCustomDocOpen] = useState(false);
  const [renewByPopoverOpen, setRenewByPopoverOpen] = useState(false);
  const navigate = useNavigate();

  const page = Number(searchParams.get('page')) || 1;
  const limit = Number(searchParams.get('limit')) || 20;
  const tab = searchParams.get('tab') ?? 'all';
  const search = searchParams.get('search') ?? '';
  const status = searchParams.get('status') ?? '';
  const overallStatus = searchParams.get('overallStatus') ?? '';
  const renewBy = searchParams.get('renewBy') ?? '';
  const validUntilFrom = searchParams.get('validUntilFrom') ?? '';
  const validUntilTo = searchParams.get('validUntilTo') ?? '';
  const category = searchParams.get('category') ?? '';
  const uploadedBy = searchParams.get('uploadedBy') ?? '';
  const frameworkId = searchParams.get('frameworkId') ?? '';
  const sort = searchParams.get('sort') ?? 'createdAt_desc';
  const openEvidenceId = searchParams.get('open') ?? '';

  const currentUser = useAuthStore((s) => s.user);
  const permissions = usePermissions();
  const users = useUsers({ page: 1, limit: 100 });
  const frameworksData = useFrameworks();

  const [sortBy, sortOrder] = useMemo(() => {
    const [by, order] = sort.split('_');
    return [by || 'createdAt', (order as 'asc' | 'desc') || 'desc'];
  }, [sort]);

  const renewByRange = useMemo(
    () => getRenewByDateRange(renewBy, validUntilFrom || undefined, validUntilTo || undefined),
    [renewBy, validUntilFrom, validUntilTo]
  );

  const params = useMemo(
    () => {
      const documentStatus = status;
      const statusParam =
        documentStatus && documentStatus !== '__EXPIRING_SOON__' && documentStatus !== '__NOT_STARTED__'
          ? documentStatus === 'PENDING_DRAFT'
            ? 'PENDING'
            : documentStatus
          : undefined;
      const overallStatusParam =
        overallStatus || (documentStatus === '__EXPIRING_SOON__' ? 'DUE_SOON' : undefined);

      return {
        page,
        limit: [10, 20, 50, 100].includes(limit) ? limit : 20,
        tab: tab === 'all' ? undefined : (tab as 'owned' | 'needs_document' | 'draft'),
        search: search || undefined,
        status: statusParam,
        overallStatus: overallStatusParam as 'OK' | 'DUE_SOON' | 'OVERDUE' | 'NEEDS_REMEDIATION' | undefined,
        category: category || undefined,
        uploadedBy: uploadedBy || undefined,
        frameworkId: frameworkId || undefined,
        validUntilFrom: renewByRange.validUntilFrom,
        validUntilTo: renewByRange.validUntilTo,
        sortBy: sortBy as 'title' | 'createdAt' | 'validUntil' | 'status' | 'sizeBytes',
        sortOrder: sortOrder as 'asc' | 'desc',
      };
    },
    [
      page,
      limit,
      tab,
      search,
      status,
      overallStatus,
      category,
      uploadedBy,
      frameworkId,
      sortBy,
      sortOrder,
      renewByRange,
    ]
  );


  const evidenceList = useEvidenceList(params);
  const stats = useEvidenceStats();
  useEffect(() => {
    if (openEvidenceId) {
      navigate(`/documents/${openEvidenceId}`, { replace: true });
    }
  }, [openEvidenceId, navigate]);

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
      next.delete('overallStatus');
      next.delete('renewBy');
      next.delete('validUntilFrom');
      next.delete('validUntilTo');
      next.delete('category');
      next.delete('uploadedBy');
      next.delete('frameworkId');
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

  const handleSort = (key: string, order: 'asc' | 'desc') => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('sort', `${key}_${order}`);
      next.set('page', '1');
      return next;
    });
  };

  const handleRenewByApply = (
    renewByValue: string,
    validUntilFromValue?: string,
    validUntilToValue?: string
  ) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!renewByValue) {
        next.delete('renewBy');
        next.delete('validUntilFrom');
        next.delete('validUntilTo');
      } else {
        next.set('renewBy', renewByValue);
        if (validUntilFromValue) next.set('validUntilFrom', validUntilFromValue);
        else next.delete('validUntilFrom');
        if (validUntilToValue) next.set('validUntilTo', validUntilToValue);
        else next.delete('validUntilTo');
      }
      next.set('page', '1');
      return next;
    });
    setRenewByPopoverOpen(false);
  };

  const ownerStaticOptions: { value: string; label: string }[] = [
    ...(currentUser?._id ? [{ value: currentUser._id, label: 'Assigned to me' }] : []),
    { value: '__needs_reassignment__', label: 'Needs reassignment' },
    { value: '__unassigned__', label: 'Unassigned' },
  ];
  const userOptions = (users.data?.users ?? []).map((u) => ({
    value: u._id,
    label: `${u.firstName} ${u.lastName}`.trim() || u.email,
  }));
  const ownerOptions = [
    ...ownerStaticOptions,
    ...userOptions.filter((u) => u.value !== currentUser?._id),
  ];

  const frameworkOptions = useMemo(() => {
    const list = frameworksData.data ?? [];
    const byCode: Record<string, string> = {};
    list.forEach((f: { _id: string; code?: string }) => {
      if (f.code) byCode[f.code.toUpperCase().replace(/\s/g, '')] = f._id;
    });
    const result: { value: string; label: string }[] = [
      { value: '__none__', label: 'No framework' },
      { value: byCode['GDPR'] ?? '', label: 'GDPR' },
      { value: byCode['HIPAA'] ?? '', label: 'HIPAA' },
      { value: byCode['ISO27001'] ?? byCode['ISO270012022'] ?? '', label: 'ISO 27001:2022' },
      { value: byCode['SOC2'] ?? byCode['SOC'] ?? '', label: 'SOC 2' },
    ].filter((f) => f.value);
    const added = new Set(result.map((r) => r.value));
    list.forEach((f: { _id: string; code?: string }) => {
      if (f._id && !added.has(f._id)) {
        result.push({ value: f._id, label: formatFrameworkCode(f.code ?? f.name) });
        added.add(f._id);
      }
    });
    return result;
  }, [frameworksData.data]);

  const TABS = [
    { value: 'all', label: 'All', count: stats.data?.tabs?.all },
    { value: 'owned', label: 'Owned by me', count: stats.data?.tabs?.owned },
    { value: 'needs_document', label: 'Needs document', count: stats.data?.tabs?.needs_document },
    { value: 'draft', label: 'Draft', count: stats.data?.tabs?.draft },
  ];

  // Vanta filter order: Overall status, Owner, Renew by (custom Popover), Framework, Category, Document status, Sort
  const filterItems = [
    { key: 'overallStatus', label: 'Overall status', value: overallStatus, options: OVERALL_STATUS_OPTIONS },
    { key: 'uploadedBy', label: 'Owner', value: uploadedBy, options: ownerOptions },
    {
      key: 'renewBy',
      label: 'Renew by',
      value: renewBy || (validUntilFrom && validUntilTo ? 'custom' : ''),
      options: RENEW_BY_OPTIONS,
      customRender: (
        <RenewByFilterPopover
          open={renewByPopoverOpen}
          onOpenChange={setRenewByPopoverOpen}
          value={renewBy}
          validUntilFrom={validUntilFrom}
          validUntilTo={validUntilTo}
          onApply={(renewByValue, from, to) => {
            if (from != null && to != null) {
              handleRenewByApply(renewByValue, from, to);
            } else {
              const range = getRenewByDateRange(renewByValue);
              handleRenewByApply(renewByValue, range.validUntilFrom, range.validUntilTo);
            }
          }}
        />
      ),
    },
    { key: 'frameworkId', label: 'Framework', value: frameworkId, options: frameworkOptions },
    { key: 'category', label: 'Category', value: category, options: CATEGORY_OPTIONS },
    { key: 'status', label: 'Document status', value: status, options: DOCUMENT_STATUS_OPTIONS },
    { key: 'sort', label: 'Sort', value: sort, options: SORT_OPTIONS, defaultValue: 'createdAt_desc' },
  ];

  const pagination = evidenceList.data?.pagination;
  const evidence = evidenceList.data?.evidence ?? [];

  const handleExportCsv = () => {
    if (!evidence.length) return;
    exportToCsv(
      evidence,
      [
        { key: 'title', header: 'Title' },
        { key: 'fileName', header: 'File' },
        { key: 'category', header: 'Category' },
        { key: 'status', header: 'Status' },
        { key: 'validUntil', header: 'Valid until', format: (v) => formatDate(v as string) },
        {
          key: 'uploadedBy',
          header: 'Uploaded by',
          format: (v) => {
            const o = v as { firstName?: string; lastName?: string } | null | undefined;
            return o ? `${o.firstName ?? ''} ${o.lastName ?? ''}`.trim() : '';
          },
        },
        {
          key: 'evidenceUploadedAt',
          header: 'Evidence uploaded',
          format: (v) => (v ? formatDate(v as string) : '—'),
        },
      ],
      'documents'
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Upload and manage compliance evidence linked to controls"
        actions={
          <div className="flex gap-2">
            <ContextualHelpButton moduleId="documents" label="Status guide" />
            {permissions.canCreateEvidence && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>
                    Add document
                    <ChevronDown className="ml-2 size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setUploadOpen(true)}>
                    <Upload className="mr-2 size-4" />
                    Create document
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCustomDocOpen(true)}>
                    <FileText className="mr-2 size-4" />
                    New custom document
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {evidence.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleExportCsv}>
                <Download className="mr-2 size-4" />
                Export all
              </Button>
            )}
          </div>
        }
      />

      {evidenceList.error && (
        <FormErrorAlert
          message={(evidenceList.error as Error).message}
          onRetry={() => evidenceList.refetch()}
        />
      )}

      {stats.data && (
        <ListPageStatGrid
          items={[
            { label: 'Total documents', value: stats.data.total, icon: Files },
            { label: 'Pending review', value: stats.data.byStatus?.PENDING ?? 0, icon: Clock },
            { label: 'Expiring soon', value: stats.data.expirationBreakdown?.expiring_soon ?? 0, icon: AlertCircle },
            { label: 'Expired', value: stats.data.expirationBreakdown?.expired ?? 0, icon: AlertCircle },
          ]}
        />
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
                  // Vanta: when tab clicked, apply corresponding filter
                  if (t.value === 'owned' && currentUser?._id) {
                    next.set('uploadedBy', currentUser._id);
                  } else if (t.value === 'owned') {
                    next.delete('uploadedBy');
                  }
                  if (t.value === 'draft') {
                    next.set('status', 'PENDING_DRAFT');
                  } else if (t.value === 'all') {
                    next.delete('uploadedBy');
                    next.delete('status');
                  } else if (t.value === 'needs_document') {
                    next.delete('uploadedBy');
                    next.delete('status');
                  }
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
          searchPlaceholder="Search by name"
          searchValue={search}
          onSearchChange={handleSearchChange}
          filters={filterItems}
          onFilterChange={handleFilterChange}
          onClearAll={handleClearAll}
        />

        {evidenceList.isLoading ? (
          <TableSkeleton rows={8} columns={8} />
        ) : (
          <>
            <EvidenceTable
              evidence={evidence}
              onRowClick={(e) => {
                navigate(`/documents/${e._id}`);
              }}
              emptyMessage="No documents found. Upload a document to link to controls."
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
                entityLabel="documents"
              />
            )}
          </>
        )}
      </div>

      {permissions.canCreateEvidence && (
        <>
          <EvidenceUploadModal
            open={uploadOpen}
            onOpenChange={setUploadOpen}
            onSuccess={() => setUploadOpen(false)}
          />
          <CreateCustomDocumentModal
            open={customDocOpen}
            onOpenChange={setCustomDocOpen}
            onSuccess={() => setCustomDocOpen(false)}
          />
        </>
      )}
    </div>
  );
}
