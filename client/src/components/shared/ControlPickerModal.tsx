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
import { useControls } from '@/api/controls';
import { Search } from 'lucide-react';

export type ControlPickerItem = { _id: string; identifier?: string; title?: string };

type ControlPickerModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingControlIds?: string[];
  onConfirm: (controlIds: string[], selectedControls?: ControlPickerItem[]) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  confirmVerb?: 'Link' | 'Select';
};

export function ControlPickerModal({
  open,
  onOpenChange,
  existingControlIds = [],
  onConfirm,
  title = 'Link controls',
  description = 'Select controls to link.',
  confirmLabel,
  confirmVerb = 'Link',
}: ControlPickerModalProps) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const controls = useControls({
    search: search || undefined,
    limit: 100,
    sortBy: 'identifier',
    sortOrder: 'asc',
  });

  const controlList = controls.data?.controls ?? [];

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setSelectedIds(new Set(existingControlIds));
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
    if (selectedIds.size === controlList.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(controlList.map((c) => c._id)));
    }
  };

  const handleConfirm = () => {
    const ids = Array.from(selectedIds);
    const selected = controlList.filter((c) => selectedIds.has(c._id));
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
              placeholder="Search by ID or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <ScrollArea className="h-[280px] rounded-md border">
            <div className="p-2 space-y-1">
              {controls.isLoading ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Loading controls...</p>
              ) : controlList.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No controls found.</p>
              ) : (
                <>
                  <label className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium cursor-pointer hover:bg-muted/50 rounded-md">
                    <Checkbox
                      checked={
                        controlList.length > 0 ? selectedIds.size === controlList.length : false
                      }
                      onCheckedChange={handleSelectAll}
                    />
                    Select all ({controlList.length})
                  </label>
                  {controlList.map((c) => (
                    <label
                      key={c._id}
                      className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-muted/50 rounded-md"
                    >
                      <Checkbox
                        checked={selectedIds.has(c._id)}
                        onCheckedChange={() => handleToggle(c._id)}
                      />
                      <span className="font-mono text-xs text-muted-foreground">{c.identifier}</span>
                      <span>{c.title}</span>
                    </label>
                  ))}
                </>
              )}
            </div>
          </ScrollArea>
          <p className="text-xs text-muted-foreground">
            {selectedIds.size} control{selectedIds.size !== 1 ? 's' : ''} selected
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={controls.isLoading || selectedIds.size === 0}
          >
            {confirmLabel ?? (selectedIds.size > 0 ? `${confirmVerb} ${selectedIds.size} control${selectedIds.size !== 1 ? 's' : ''}` : confirmVerb)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
