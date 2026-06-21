import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTests, useSyncControlTests } from '@/api/tests';
import { Search } from 'lucide-react';

type TestPickerModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  controlId: string;
  onSuccess?: () => void;
};

export function TestPickerModal({
  open,
  onOpenChange,
  controlId,
  onSuccess,
}: TestPickerModalProps) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const catalog = useTests(
    {
      search: search || undefined,
      limit: 200,
      sortBy: 'name',
      sortOrder: 'asc',
      showInactive: true,
    },
    open
  );

  const linked = useTests(
    {
      controlId,
      limit: 200,
    },
    open
  );

  const testList = useMemo(() => catalog.data?.tests ?? [], [catalog.data?.tests]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSearch('');
      setSelectedIds(new Set());
      onOpenChange(false);
      return;
    }
    const linkedIds = linked.data?.tests?.map((t) => t._id) ?? [];
    setSelectedIds(new Set(linkedIds));
    setSearch('');
    onOpenChange(true);
  };

  const handleToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === testList.length && testList.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(testList.map((t) => t._id)));
    }
  };

  const sync = useSyncControlTests();

  const handleConfirm = () => {
    sync.mutate(
      { controlId, selectedTestIds: Array.from(selectedIds) },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSuccess?.();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Link tests to control</DialogTitle>
          <DialogDescription>
            Select compliance tests to associate with this control. Uncheck to remove the link.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <ScrollArea className="h-[280px] rounded-md border">
            <div className="space-y-1 p-2">
              {catalog.isLoading ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Loading tests…</p>
              ) : testList.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No tests found.</p>
              ) : (
                <>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted/50">
                    <Checkbox
                      checked={testList.length > 0 && selectedIds.size === testList.length}
                      onCheckedChange={handleSelectAll}
                    />
                    Select all ({testList.length})
                  </label>
                  {testList.map((t) => (
                    <label
                      key={t._id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedIds.has(t._id)}
                        onCheckedChange={() => handleToggle(t._id)}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium">{t.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground capitalize">
                          {t.type}
                        </span>
                      </span>
                    </label>
                  ))}
                </>
              )}
            </div>
          </ScrollArea>
          <p className="text-xs text-muted-foreground">
            {selectedIds.size} test{selectedIds.size !== 1 ? 's' : ''} linked
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={catalog.isLoading || sync.isPending}>
            {sync.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
