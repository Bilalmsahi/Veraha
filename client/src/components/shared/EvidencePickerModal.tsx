import { useState } from 'react';
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
import { useEvidenceList } from '@/api/evidence';
import { Search } from 'lucide-react';

export type EvidencePickerItem = { _id: string; title?: string; fileName?: string };

type EvidencePickerModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingEvidenceIds?: string[];
  onConfirm: (evidenceIds: string[], selectedEvidence?: EvidencePickerItem[]) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
};

export function EvidencePickerModal({
  open,
  onOpenChange,
  existingEvidenceIds = [],
  onConfirm,
  title = 'Link evidence',
  description = 'Select evidence to link to this control.',
  confirmLabel,
}: EvidencePickerModalProps) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const evidence = useEvidenceList({
    search: search || undefined,
    limit: 100,
    sortBy: 'title',
    sortOrder: 'asc',
  });

  const evidenceList = evidence.data?.evidence ?? [];

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setSelectedIds(new Set(existingEvidenceIds));
      setSearch('');
    }
    onOpenChange(nextOpen);
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
    if (selectedIds.size === evidenceList.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(evidenceList.map((e) => e._id)));
    }
  };

  const handleConfirm = () => {
    const ids = Array.from(selectedIds);
    const selected = evidenceList.filter((e) => selectedIds.has(e._id));
    onConfirm(ids, selected);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <ScrollArea className="h-[280px] rounded-md border">
            <div className="space-y-1 p-2">
              {evidence.isLoading ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Loading evidence...
                </p>
              ) : evidenceList.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No evidence found.
                </p>
              ) : (
                <>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted/50">
                    <Checkbox
                      checked={
                        evidenceList.length > 0
                          ? selectedIds.size === evidenceList.length
                          : false
                      }
                      onCheckedChange={handleSelectAll}
                    />
                    Select all ({evidenceList.length})
                  </label>
                  {evidenceList.map((e) => (
                    <label
                      key={e._id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedIds.has(e._id)}
                        onCheckedChange={() => handleToggle(e._id)}
                      />
                      <span className="truncate">{e.title ?? e.fileName ?? e._id}</span>
                    </label>
                  ))}
                </>
              )}
            </div>
          </ScrollArea>
          <p className="text-xs text-muted-foreground">
            {selectedIds.size} evidence item{selectedIds.size !== 1 ? 's' : ''} selected
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={evidence.isLoading || selectedIds.size === 0}
          >
            {confirmLabel ??
              (selectedIds.size > 0
                ? `Link ${selectedIds.size} item${selectedIds.size !== 1 ? 's' : ''}`
                : 'Link')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
