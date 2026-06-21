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
import { FormErrorAlert } from '@/components/shared';
import { createPolicySchema } from '@/schemas/policy';
import { useCreatePolicy } from '@/api/policies';
import { Plus } from 'lucide-react';

type CreatePolicyModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function CreatePolicyModal({
  open,
  onOpenChange,
  onSuccess,
}: CreatePolicyModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const create = useCreatePolicy();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = createPolicySchema.safeParse({
      title,
      description: description || undefined,
      category: undefined,
      reviewFrequency: 'ANNUALLY' as const,
      requiresAttestation: true,
    });
    if (!result.success) return;

    create.mutate(result.data, {
      onSuccess: () => {
        onOpenChange(false);
        resetForm();
        onSuccess?.();
      },
    });
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add policy</DialogTitle>
          <DialogDescription>
            Create a new policy. You can add versions and link controls after creation.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {create.error && (
            <FormErrorAlert message={(create.error as Error).message} />
          )}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="title">Policy title</Label>
              <span className="text-xs text-muted-foreground">{title.length}/200</span>
            </div>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Information Security Policy"
              required
              minLength={3}
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the policy..."
              rows={3}
              maxLength={2000}
              className="resize-none"
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
            <Button type="submit" disabled={create.isPending}>
              <Plus className="mr-2 size-4" />
              {create.isPending ? 'Adding...' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
