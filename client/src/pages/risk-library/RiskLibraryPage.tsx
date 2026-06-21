import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader, FilterBar, ConfirmDialog } from '@/components/shared';
import { DataTable, type Column } from '@/components/shared';
import { FormErrorAlert, TableSkeleton, Pagination } from '@/components/shared';
import {
  useRiskTemplates,
  useRiskTemplateCategories,
  useCreateRiskTemplate,
  useUpdateRiskTemplate,
  useDeleteRiskTemplate,
  useImportToRegister,
} from '@/api/riskLibrary';
import type { RiskTemplate, CreateRiskTemplateInput } from '@/api/riskLibrary';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, ArrowDownToLine, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

const SORT_OPTIONS = [
  { value: 'title_asc', label: 'Title (A-Z)' },
  { value: 'title_desc', label: 'Title (Z-A)' },
  { value: 'category_asc', label: 'Category' },
];

export function RiskLibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const permissions = usePermissions();
  const canManageTemplates = permissions.canManageRiskTemplates;
  const canDeleteTemplates = permissions.canDeleteRiskTemplates;

  const page = Number(searchParams.get('page')) || 1;
  const limit = Number(searchParams.get('limit')) || 20;
  const search = searchParams.get('search') ?? '';
  const category = searchParams.get('category') ?? '';
  const sort = searchParams.get('sort') ?? 'title_asc';

  const [sortBy, sortOrder] = useMemo(() => {
    const [by, order] = sort.split('_');
    return [by || 'title', (order as 'asc' | 'desc') || 'asc'];
  }, [sort]);

  const params = useMemo(
    () => ({
      page,
      limit: [10, 20, 50, 100].includes(limit) ? limit : 20,
      search: search || undefined,
      category: category || undefined,
      sortBy,
      sortOrder: sortOrder as 'asc' | 'desc',
    }),
    [page, limit, search, category, sortBy, sortOrder]
  );

  const templates = useRiskTemplates(params);
  const categories = useRiskTemplateCategories();
  const createMutation = useCreateRiskTemplate();
  const updateMutation = useUpdateRiskTemplate();
  const deleteMutation = useDeleteRiskTemplate();
  const importMutation = useImportToRegister();

  const [modalOpen, setModalOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<RiskTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RiskTemplate | null>(null);

  const templateList = templates.data?.templates ?? [];
  const pagination = templates.data?.pagination;

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
      next.delete('category');
      next.delete('sort');
      next.set('page', '1');
      return next;
    });
  };

  const filterItems = [
    {
      key: 'category',
      label: 'Category',
      value: category,
      options: (categories.data ?? []).map((c) => ({ value: c, label: c })),
    },
    { key: 'sort', label: 'Sort', value: sort, options: SORT_OPTIONS, defaultValue: 'title_asc' },
  ];

  const columns: Column<RiskTemplate>[] = [
    {
      key: 'title',
      header: 'Title',
      // No width: with table-fixed, this column absorbs remaining space so the row fills the table.
      className: 'min-w-0',
      cell: (row) => (
        <div className="w-full min-w-0 space-y-1 pr-4 whitespace-normal">
          <p className="text-sm font-medium leading-tight">{row.title}</p>
          {row.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mt-1">
              {row.description}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'categoryNames',
      header: 'Categories',
      width: canManageTemplates ? '26%' : '30%',
      className: 'min-w-0 align-top',
      cell: (row) =>
        Array.isArray(row.categoryNames) && row.categoryNames.length > 0 ? (
          <div className="flex w-full min-w-0 flex-wrap gap-1.5 pr-2">
            {row.categoryNames.map((c) => (
              <Badge key={c} variant="secondary" className="whitespace-nowrap">
                {c}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: 'isGlobal',
      header: 'Source',
      width: canManageTemplates ? '6.5rem' : '7rem',
      className: 'min-w-0 whitespace-nowrap',
      cell: (row) =>
        row.isGlobal ? (
          <Badge variant="secondary">Global</Badge>
        ) : (
          <Badge variant="outline">Custom</Badge>
        ),
    },
    ...(canManageTemplates
      ? [
          {
            key: 'actions' as keyof RiskTemplate,
            header: '',
            width: '3.25rem',
            className: 'min-w-0 px-1',
            cell: (row: RiskTemplate) => (
              <div className="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        importMutation.mutate(row._id);
                      }}
                    >
                      <ArrowDownToLine className="mr-2 size-4" />
                      Import to register
                    </DropdownMenuItem>
                    {!row.isGlobal && (
                      <>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditTemplate(row);
                            setModalOpen(true);
                          }}
                        >
                          <Pencil className="mr-2 size-4" />
                          Edit
                        </DropdownMenuItem>
                        {canDeleteTemplates && (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(row);
                            }}
                          >
                            <Trash2 className="mr-2 size-4" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk Library"
        description="Browse and import reusable risk templates"
        actions={
          canManageTemplates ? (
            <Button
              size="sm"
              onClick={() => {
                setEditTemplate(null);
                setModalOpen(true);
              }}
            >
              <Plus className="mr-2 size-4" />
              Add template
            </Button>
          ) : undefined
        }
      />

      {templates.error && (
        <FormErrorAlert
          message={(templates.error as Error).message}
          onRetry={() => templates.refetch()}
        />
      )}

      <div className="space-y-4">
        <FilterBar
          searchPlaceholder="Search risk templates..."
          searchValue={search}
          onSearchChange={handleSearchChange}
          filters={filterItems}
          onFilterChange={handleFilterChange}
          onClearAll={handleClearAll}
        />

        {templates.isLoading ? (
          <TableSkeleton rows={8} columns={6} />
        ) : (
          <>
            <DataTable
              data={templateList}
              columns={columns}
              keyExtractor={(row) => row._id}
              emptyMessage="No risk templates found."
            />

            {pagination && (
              <Pagination
                page={pagination.page}
                limit={params.limit ?? 20}
                total={pagination.total}
                pages={pagination.pages}
                hasPrevPage={pagination.hasPrevPage}
                hasNextPage={pagination.hasNextPage}
                onPageChange={(p) =>
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.set('page', String(p));
                    return next;
                  })
                }
                onLimitChange={(l) =>
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.set('limit', String(l));
                    next.set('page', '1');
                    return next;
                  })
                }
                entityLabel="templates"
              />
            )}
          </>
        )}
      </div>

      {canManageTemplates && (
        <RiskTemplateModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          template={editTemplate}
          onSubmit={(input) => {
            if (editTemplate) {
              updateMutation.mutate(
                { id: editTemplate._id, input },
                { onSuccess: () => setModalOpen(false) }
              );
            } else {
              createMutation.mutate(input, { onSuccess: () => setModalOpen(false) });
            }
          }}
          isPending={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {canDeleteTemplates && (
        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title="Delete risk template"
          description={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={() => {
            if (deleteTarget) {
              deleteMutation.mutate(deleteTarget._id, {
                onSuccess: () => setDeleteTarget(null),
              });
            }
          }}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}

function RiskTemplateModal({
  open,
  onOpenChange,
  template,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: RiskTemplate | null;
  onSubmit: (input: CreateRiskTemplateInput) => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryNamesText, setCategoryNamesText] = useState('');

  const reset = () => {
    if (template) {
      setTitle(template.title);
      setDescription(template.description ?? '');
      setCategoryNamesText(
        Array.isArray(template.categoryNames) ? template.categoryNames.join(', ') : ''
      );
    } else {
      setTitle('');
      setDescription('');
      setCategoryNamesText('');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{template ? 'Edit risk template' : 'Create risk template'}</DialogTitle>
          <DialogDescription>
            {template
              ? 'Update this threat scenario (title, description, categories).'
              : 'Define a reusable threat scenario for your library. Assessments are not set here — they are done when you add the risk to your register.'}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const categoryNames = categoryNamesText
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            onSubmit({
              title,
              description: description || undefined,
              categoryNames: categoryNames.length ? categoryNames : undefined,
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="rt-title">Title</Label>
            <Input
              id="rt-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={300}
              placeholder="e.g. Unauthorized access to sensitive data"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rt-desc">Description</Label>
            <Textarea
              id="rt-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rt-categories">Categories (comma-separated)</Label>
            <Input
              id="rt-categories"
              value={categoryNamesText}
              onChange={(e) => setCategoryNamesText(e.target.value)}
              placeholder="e.g. Security, Operational, Compliance"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !title.trim()}>
              {isPending ? 'Saving...' : template ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
