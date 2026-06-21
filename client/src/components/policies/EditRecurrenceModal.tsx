/**
 * Edit recurrence modal - Vanta-style.
 * Opens when user clicks "Renew annually" on policy detail.
 * Allows selecting repeat frequency and shows preview of renewal schedule.
 */
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
import { FormErrorAlert } from '@/components/shared';
import { useUpdatePolicy } from '@/api/policies';
import type { PolicyListItem } from '@/api/policies';
import { getApiErrorMessage } from '@/lib/apiError';
import { toast } from 'sonner';

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Map frontend labels to backend enum values
const RECURRENCE_OPTIONS = [
  { value: 'ANNUALLY', label: 'Annually (recommended)' },
  { value: 'BIENNIALLY', label: 'Every 2 years' },
  { value: 'SEMI_ANNUALLY', label: 'Bi-annually' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'NEVER', label: 'Never' },
] as const;

const MONTHS_PER_FREQUENCY: Record<string, number | null> = {
  WEEKLY: 0.25,
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUALLY: 6,
  ANNUALLY: 12,
  BIENNIALLY: 24,
  NEVER: null,
};

function getNextReviewDates(baseDate: Date, frequency: string, count = 3): string[] {
  const months = MONTHS_PER_FREQUENCY[frequency];
  if (months == null) return [];
  const dates: string[] = [];
  let d = new Date(baseDate);
  for (let i = 0; i < count; i++) {
    d = new Date(d);
    d.setMonth(d.getMonth() + months);
    dates.push(formatDate(d));
  }
  return dates;
}

type EditRecurrenceModalProps = {
  policy: PolicyListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function EditRecurrenceModal({
  policy,
  open,
  onOpenChange,
  onSuccess,
}: EditRecurrenceModalProps) {
  const [reviewFrequency, setReviewFrequency] = useState<string>(policy?.reviewFrequency ?? 'ANNUALLY');
  const update = useUpdatePolicy();

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setReviewFrequency(policy?.reviewFrequency ?? 'ANNUALLY');
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!policy) return;
    update.mutate(
      {
        id: policy._id,
        input: { reviewFrequency },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSuccess?.();
        },
        onError: (err) => toast.error(getApiErrorMessage(err)),
      }
    );
  };

  if (!policy) return null;

  const baseDate = policy.lastReviewedAt
    ? new Date(policy.lastReviewedAt)
    : policy.nextReviewDue
      ? new Date(policy.nextReviewDue)
      : new Date();
  const previewDates = getNextReviewDates(baseDate, reviewFrequency, 3);
  const hasChanges = (policy.reviewFrequency ?? 'ANNUALLY') !== reviewFrequency;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit recurrence</DialogTitle>
          <DialogDescription>
            Editing recurrence can affect your compliance posture. Ensure that the recurrence is
            aligned with your company policies.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {update.error && (
            <FormErrorAlert message={(update.error as Error).message} />
          )}
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                Repeat from the most recent update
              </Label>
              <div className="space-y-2">
                {RECURRENCE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="reviewFrequency"
                      value={opt.value}
                      checked={reviewFrequency === opt.value}
                      onChange={() => setReviewFrequency(opt.value)}
                      className="rounded-full border-input"
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            {previewDates.length > 0 && (
              <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-4">
                <Label className="text-sm font-medium">
                  Preview of renewal schedule based on the latest approval date:
                </Label>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {previewDates.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending || !hasChanges}>
              {update.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
