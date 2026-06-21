import { useState, useMemo } from 'react';
import { useTemplates } from '@/api/templates';
import { useCreateFromTemplate } from '@/api/controls';
import type { GlobalTemplate } from '@/api/templates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Search, Plus, Check, Loader2 } from 'lucide-react';

export function FromTemplateModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const params = useMemo(
    () => ({ page, limit: 50, search: search || undefined }),
    [page, search]
  );

  const templates = useTemplates(params, open);
  const createFromTemplate = useCreateFromTemplate();
  const [createdIds, setCreatedIds] = useState<Set<string>>(new Set());
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleImport = (template: GlobalTemplate) => {
    setLoadingId(template._id);
    createFromTemplate.mutate(template._id, {
      onSuccess: () => {
        setCreatedIds((prev) => new Set(prev).add(template._id));
        setLoadingId(null);
      },
      onSettled: () => setLoadingId(null),
    });
  };

  const templateList = templates.data?.templates ?? [];
  const pagination = templates.data?.pagination;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setSearch(''); setPage(1); setCreatedIds(new Set()); } onOpenChange(v); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add control from template</DialogTitle>
          <DialogDescription>
            Browse global control templates and add them to your organization.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[400px] rounded-md border">
          {templates.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : templateList.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No templates found.
            </p>
          ) : (
            <div className="divide-y">
              {templateList.map((t) => {
                const isCreated = createdIds.has(t._id);
                const isLoading = loadingId === t._id;
                return (
                  <div
                    key={t._id}
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">{t.identifier}</span>
                        {t.controlGroup && <Badge variant="outline" className="text-[10px]">{t.controlGroup}</Badge>}
                      </div>
                      <p className="mt-0.5 text-sm font-medium leading-snug">{t.title}</p>
                      {t.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{t.description}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={isCreated ? 'secondary' : 'outline'}
                      disabled={isCreated || isLoading}
                      onClick={() => handleImport(t)}
                      className="shrink-0"
                    >
                      {isLoading ? (
                        <Loader2 className="mr-1 size-3 animate-spin" />
                      ) : isCreated ? (
                        <Check className="mr-1 size-3" />
                      ) : (
                        <Plus className="mr-1 size-3" />
                      )}
                      {isCreated ? 'Added' : 'Add'}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {pagination.page} of {pagination.pages} ({pagination.total} templates)
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!pagination.hasPrevPage}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!pagination.hasNextPage}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
