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
import { reviewEvidenceSchema } from '@/schemas/evidence';
import { useReviewEvidence } from '@/api/evidence';
import type { EvidenceDetail } from '@/api/evidence';

const STATUS_OPTIONS = [
  { value: 'APPROVED', label: 'Approve' },
  { value: 'REJECTED', label: 'Reject' },
];

type ReviewEvidenceModalProps = {
  evidence: EvidenceDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function ReviewEvidenceModal({
  evidence,
  open,
  onOpenChange,
  onSuccess,
}: ReviewEvidenceModalProps) {
  const [status, setStatus] = useState<string>('APPROVED');
  const [reviewNotes, setReviewNotes] = useState('');
  const review = useReviewEvidence();
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setStatus('APPROVED');
      setReviewNotes('');
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidence) return;
    const result = reviewEvidenceSchema.safeParse({
      status: status as 'APPROVED' | 'REJECTED',
      reviewNotes: reviewNotes || undefined,
    });
    if (!result.success) return;

    review.mutate(
      { id: evidence._id, input: result.data },
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review evidence</DialogTitle>
          <DialogDescription>
            Approve or reject this evidence. Add notes to document your decision.
          </DialogDescription>
        </DialogHeader>
        {evidence && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {review.error && (
              <FormErrorAlert message={(review.error as Error).message} />
            )}
            <div className="space-y-2">
              <Label htmlFor="status">Decision</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reviewNotes">Review notes (optional)</Label>
              <Textarea
                id="reviewNotes"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Document findings or reasons for rejection..."
                rows={3}
                maxLength={1000}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={review.isPending}>
                {review.isPending ? 'Submitting...' : 'Submit review'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
