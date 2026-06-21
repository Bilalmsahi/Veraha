import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PageHeader, FilterBar, FormErrorAlert, Pagination, DataTable } from '@/components/shared';
import {
  usePolicyLibrary,
  useAddPolicyFromLibrary,
} from '@/api/policyLibrary';
import type { PolicyTemplate } from '@/api/policyLibrary';
import { useFrameworks } from '@/api/frameworks';
import { formatFrameworkCode } from '@/lib/formatters';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DownloadTemplateModal,
} from '@/components/policies';
import { ArrowLeft, Plus, Check, FileText } from 'lucide-react';

const ADDED_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'true', label: 'Added' },
  { value: 'false', label: 'Not added' },
];

export function PolicyLibraryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const permissions = usePermissions();
  const canAdd = permissions.canCreatePolicies;
  const [downloadModalTemplate, setDownloadModalTemplate] = useState<PolicyTemplate | null>(null);

  const page = Number(searchParams.get('page')) || 1;
  const limit = Number(searchParams.get('limit')) || 20;
  const search = searchParams.get('search') ?? '';
  const frameworkCode = searchParams.get('frameworkCode') ?? '';
  const added = searchParams.get('added') ?? '';

  const params = useMemo(
    () => ({
      page,
      limit: [10, 20, 50, 100].includes(limit) ? limit : 20,
      search: search || undefined,
      frameworkCode: frameworkCode || undefined,
      added: (added as 'true' | 'false') || undefined,
    }),
    [page, limit, search, frameworkCode, added]
  );

  const library = usePolicyLibrary(params);
  const { data: frameworksData } = useFrameworks();
  const addMutation = useAddPolicyFromLibrary();

  const frameworkOptions = (frameworksData ?? []).map((f) => ({
    value: f.code,
    label: formatFrameworkCode(f.code ?? f.name),
  }));

  const templates = library.data?.templates ?? [];
  const pagination = library.data?.pagination;

  // Sync URL when backend clamps page (e.g. page=11 but only 2 pages exists)
  useEffect(() => {
    if (pagination && pagination.page !== page && pagination.pages >= 1) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('page', String(pagination.page));
        return next;
      });
    }
  }, [pagination, page, setSearchParams]);

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
      next.delete('frameworkCode');
      next.delete('added');
      next.set('page', '1');
      return next;
    });
  };

  const handleAdd = useCallback(
    async (template: PolicyTemplate) => {
      const policy = await addMutation.mutateAsync(template._id);
      navigate(`/policies/${policy._id}`);
    },
    [addMutation, navigate]
  );

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
    { key: 'frameworkCode', label: 'Framework', value: frameworkCode, options: frameworkOptions },
    {
      key: 'added',
      label: 'Status',
      value: added,
      options: ADDED_OPTIONS.filter((o) => o.value),
    },
  ];

  const columns = useMemo(
    () => [
      {
        key: 'title',
        header: 'Title',
        cell: (row: PolicyTemplate) => (
          <span className="font-medium">{row.title}</span>
        ),
      },
      {
        key: 'description',
        header: 'Description',
        cell: (row: PolicyTemplate) => (
          <span className="line-clamp-2 text-sm text-muted-foreground">
            {row.description ?? '—'}
          </span>
        ),
      },
      {
        key: 'frameworks',
        header: 'Frameworks',
        cell: (row: PolicyTemplate) => {
          const frameworks =
            row.frameworks ??
            (row.frameworkCodes ?? []).map((c) => ({ code: c, name: c }));
          if (!frameworks.length) return <span className="text-muted-foreground">—</span>;
          return (
            <span className="flex flex-wrap gap-1 text-sm text-muted-foreground">
              {frameworks.slice(0, 3).map((f: { code: string; name: string }) => formatFrameworkCode(f.code ?? f.name)).join(' · ')}
              {frameworks.length > 3 && ` +${frameworks.length - 3}`}
            </span>
          );
        },
      },
      {
        key: 'status',
        header: 'Status',
        cell: (row: PolicyTemplate) =>
          row.added ? (
            <Badge variant="secondary" className="gap-1">
              <Check className="size-3.5" />
              Added
            </Badge>
          ) : (
            <span className="text-muted-foreground">Not added</span>
          ),
      },
      {
        key: 'actions',
        header: '',
        cell: (row: PolicyTemplate) => (
          <div className="flex items-center gap-2">
            {row.added && row.policyId ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/policies/${row.policyId}`)}
              >
                View
              </Button>
            ) : canAdd ? (
              <Button
                size="sm"
                onClick={() => handleAdd(row)}
                disabled={addMutation.isPending}
              >
                <Plus className="mr-1 size-3.5" />
                Add
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDownloadModalTemplate(row)}
            >
              <FileText className="mr-1 size-3.5" />
              View template
            </Button>
          </div>
        ),
      },
    ],
    [canAdd, addMutation.isPending, navigate, handleAdd]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/policies')}>
          <ArrowLeft className="size-4" />
        </Button>
        <PageHeader
          title="Policy Library"
          description="Add policies or supplement your existing set using Vanta's templates."
        />
      </div>

      {library.error && (
        <FormErrorAlert
          message={(library.error as Error).message}
          onRetry={() => library.refetch()}
        />
      )}

      <FilterBar
        searchPlaceholder="Search by name"
        searchValue={search}
        onSearchChange={handleSearchChange}
        filters={filterItems}
        onFilterChange={handleFilterChange}
        onClearAll={handleClearAll}
      />

      {library.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <DataTable
            data={templates}
            columns={columns}
            keyExtractor={(row) => row._id}
            emptyMessage="No policy templates found. Try adjusting your filters."
          />

          {pagination && pagination.pages > 1 && (
            <Pagination
              page={pagination.page}
              limit={params.limit ?? 20}
              total={pagination.total}
              pages={pagination.pages}
              hasPrevPage={pagination.hasPrevPage}
              hasNextPage={pagination.hasNextPage}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
              entityLabel="templates"
            />
          )}
        </>
      )}

      <DownloadTemplateModal
        template={downloadModalTemplate}
        open={!!downloadModalTemplate}
        onOpenChange={(open) => !open && setDownloadModalTemplate(null)}
      />
    </div>
  );
}
