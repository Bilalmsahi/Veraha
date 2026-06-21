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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormErrorAlert } from '@/components/shared';
import { assessControlSchema } from '@/schemas/control';
import type { ControlListItem } from '@/api/controls';
import { useAssessControl } from '@/api/controls';
import { MANUAL_STATUS_LABELS } from '@/lib/constants';
import type { ManualStatus } from '@/types/enums';

type AssessControlModalProps = {
  control: ControlListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function AssessControlModal({
  control,
  open,
  onOpenChange,
  onSuccess,
}: AssessControlModalProps) {
  const [status, setStatus] = useState<ManualStatus | ''>('');
  const [notes, setNotes] = useState('');
  const assess = useAssessControl();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!control) return;
    const result = assessControlSchema.safeParse({ status, notes: notes || undefined });
    if (!result.success) return;
    assess.mutate(
      { id: control._id, input: result.data },
      {
        onSuccess: () => {
          onOpenChange(false);
          setStatus('');
          setNotes('');
          onSuccess?.();
        },
      }
    );
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setStatus('');
      setNotes('');
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assess control</DialogTitle>
          <DialogDescription>
            {control ? (
              <>
                Record manual assessment for <strong>{control.identifier}</strong>:{' '}
                {control.title}
              </>
            ) : (
              'Select a control to assess.'
            )}
          </DialogDescription>
        </DialogHeader>
        {control && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {assess.error && (
              <FormErrorAlert message={(assess.error as Error).message} />
            )}
            <div className="space-y-2">
              <Label htmlFor="status">Assessment result</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as ManualStatus)}
                required
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select result" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PASS">{MANUAL_STATUS_LABELS.PASS}</SelectItem>
                  <SelectItem value="FAIL">{MANUAL_STATUS_LABELS.FAIL}</SelectItem>
                  <SelectItem value="NOT_APPLICABLE">
                    {MANUAL_STATUS_LABELS.NOT_APPLICABLE}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add assessment notes..."
                rows={3}
                maxLength={2000}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!status || assess.isPending}>
                {assess.isPending ? 'Recording...' : 'Record assessment'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
