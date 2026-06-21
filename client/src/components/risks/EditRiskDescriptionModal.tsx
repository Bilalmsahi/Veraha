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
import { Textarea } from '@/components/ui/textarea';
import { FormErrorAlert } from '@/components/shared';
import { useUpdateRisk } from '@/api/risks';
import type { RiskDetail } from '@/api/risks';

type EditRiskDescriptionModalProps = {
  risk: RiskDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function EditRiskDescriptionModal({
  risk,
  open,
  onOpenChange,
  onSuccess,
}: EditRiskDescriptionModalProps) {
  const [description, setDescription] = useState(risk?.title ?? risk?.description ?? '');
  const update = useUpdateRisk();

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDescription(risk?.title ?? risk?.description ?? '');
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!risk) return;
    const title = description.trim();
    if (title.length < 3) return;

    update.mutate(
      {
        id: risk._id,
        input: { title, description: title },
      },
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
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>Edit description</DialogTitle>
          <DialogDescription>
            Updating the description will require the risk scenario to be reapproved. You can always
            revert back to the previously approved version.
          </DialogDescription>
        </DialogHeader>
        {risk && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {update.error && (
              <FormErrorAlert message={(update.error as Error).message} />
            )}
            <div className="space-y-2">
              <label htmlFor="edit-risk-description" className="text-sm font-medium">
                Description
              </label>
              <Textarea
                id="edit-risk-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                minLength={3}
                maxLength={2000}
                rows={4}
                className="resize-none"
                placeholder="Describe the risk scenario..."
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
              <Button type="submit" disabled={update.isPending || description.trim().length < 3}>
                {update.isPending ? 'Saving...' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
