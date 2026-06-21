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
import { FormErrorAlert } from '@/components/shared';
import { closeRiskSchema } from '@/schemas/risk';
import { useCloseRisk } from '@/api/risks';
import type { RiskDetail } from '@/api/risks';

type CloseRiskModalProps = {
  risk: RiskDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function CloseRiskModal({
  risk,
  open,
  onOpenChange,
  onSuccess,
}: CloseRiskModalProps) {
  const [closureReason, setClosureReason] = useState('');
  const close = useCloseRisk();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!risk) return;
    const result = closeRiskSchema.safeParse({ closureReason });
    if (!result.success) return;

    close.mutate(
      { id: risk._id, input: result.data },
      {
        onSuccess: () => {
          onOpenChange(false);
          setClosureReason('');
          onSuccess?.();
        },
      }
    );
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setClosureReason('');
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Close risk</DialogTitle>
          <DialogDescription>
            {risk
              ? `Close "${risk.title}"? Provide a reason for closure (min 10 characters).`
              : 'Select a risk to close.'}
          </DialogDescription>
        </DialogHeader>
        {risk && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {close.error && (
              <FormErrorAlert message={(close.error as Error).message} />
            )}
            <div className="space-y-2">
              <Label htmlFor="closureReason">Closure reason</Label>
              <Textarea
                id="closureReason"
                value={closureReason}
                onChange={(e) => setClosureReason(e.target.value)}
                placeholder="e.g. Risk mitigated by implementing MFA across all systems"
                required
                minLength={10}
                maxLength={1000}
                rows={4}
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
              <Button
                type="submit"
                disabled={closureReason.length < 10 || close.isPending}
              >
                {close.isPending ? 'Closing...' : 'Close risk'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
