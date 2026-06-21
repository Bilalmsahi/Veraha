import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBulkUpdate } from '@/api/controls';
import { FormErrorAlert } from '@/components/shared';
import { X } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'PASS', label: 'Pass' },
  { value: 'FAIL', label: 'Fail' },
  { value: 'NOT_APPLICABLE', label: 'Not applicable' },
];

type BulkUpdateBarProps = {
  selectedCount: number;
  selectedIds: string[];
  onClearSelection: () => void;
  onSuccess?: () => void;
};

export function BulkUpdateBar({
  selectedCount,
  selectedIds,
  onClearSelection,
  onSuccess,
}: BulkUpdateBarProps) {
  const bulkUpdate = useBulkUpdate();
  const [status, setStatus] = useState<string>('');

  const handleApply = () => {
    if (!status || selectedIds.length === 0) return;
    bulkUpdate.mutate(
      {
        controlIds: selectedIds,
        updates: { manualStatus: status as 'PASS' | 'FAIL' | 'NOT_APPLICABLE' },
      },
      {
        onSuccess: () => {
          setStatus('');
          onClearSelection();
          onSuccess?.();
        },
      }
    );
  };

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-lg flex-col gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg sm:bottom-6 sm:left-1/2 sm:right-auto sm:max-w-none sm:w-auto sm:-translate-x-1/2 sm:flex-row sm:items-center sm:gap-4">
      {bulkUpdate.error && (
        <FormErrorAlert message={(bulkUpdate.error as Error).message} />
      )}
      <span className="text-sm font-medium">{selectedCount} selected</span>
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="h-9 w-full sm:w-[140px]">
          <SelectValue placeholder="Set status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex gap-2 sm:contents">
        <Button
          size="sm"
          className="flex-1 sm:flex-none"
          onClick={handleApply}
          disabled={!status || bulkUpdate.isPending}
        >
          {bulkUpdate.isPending ? 'Applying...' : 'Apply'}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-8 shrink-0"
          onClick={onClearSelection}
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
