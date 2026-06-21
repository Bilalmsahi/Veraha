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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { FormErrorAlert } from '@/components/shared';
import { useUpdateEvidence } from '@/api/evidence';
import type { EvidenceDetail } from '@/api/evidence';
import type { UpdateEvidenceInput } from '@/schemas/evidence';

const DESCRIPTION_MAX = 5000;

type EditEvidenceModalProps = {
  evidence: EvidenceDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function EditEvidenceModal({
  evidence,
  open,
  onOpenChange,
  onSuccess,
}: EditEvidenceModalProps) {
  const [title, setTitle] = useState(evidence?.title ?? '');
  const [description, setDescription] = useState(evidence?.description ?? '');
  const [isSensitive, setIsSensitive] = useState(evidence?.tags?.includes('sensitive') ?? false);
  const update = useUpdateEvidence();

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      // Reset values from current evidence (avoid setState-in-effect lint rule)
      setTitle(evidence?.title ?? '');
      setDescription(evidence?.description ?? '');
      setIsSensitive(evidence?.tags?.includes('sensitive') ?? false);
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidence) return;
    const input: UpdateEvidenceInput = {
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      isSensitive,
    };
    update.mutate(
      { id: evidence._id, input },
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit document</DialogTitle>
          <DialogDescription>
            Update the document title and description. Maximum 5000 characters for description.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {update.error && (
            <FormErrorAlert message={(update.error as Error).message} />
          )}
          <div className="space-y-2">
            <Label htmlFor="edit-title">Document name</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
              required
              minLength={3}
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description (optional)</Label>
            <div>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description..."
                rows={4}
                maxLength={DESCRIPTION_MAX}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {description.length}/{DESCRIPTION_MAX} characters
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="edit-sensitive"
              checked={isSensitive}
              onCheckedChange={(v) => setIsSensitive(!!v)}
            />
            <Label htmlFor="edit-sensitive" className="text-sm font-normal cursor-pointer">
              Mark document as sensitive
            </Label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
