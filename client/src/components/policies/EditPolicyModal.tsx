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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormErrorAlert } from '@/components/shared';
import { AlertTriangle } from 'lucide-react';
import { updatePolicySchema } from '@/schemas/policy';
import { useUpdatePolicy } from '@/api/policies';
import type { PolicyListItem } from '@/api/policies';

const REVIEW_FREQUENCY_OPTIONS = [
  { value: 'ANNUALLY', label: 'Annually (recommended)' },
  { value: 'BIENNIALLY', label: 'Every 2 years' },
  { value: 'SEMI_ANNUALLY', label: 'Bi-annually' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'NEVER', label: 'Never' },
];

type EditPolicyModalProps = {
  policy: PolicyListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function EditPolicyModal({
  policy,
  open,
  onOpenChange,
  onSuccess,
}: EditPolicyModalProps) {
  const [title, setTitle] = useState(policy?.title ?? '');
  const [description, setDescription] = useState(policy?.description ?? '');
  const [category, setCategory] = useState(policy?.category ?? '');
  const [reviewFrequency, setReviewFrequency] = useState<string>(policy?.reviewFrequency ?? 'ANNUALLY');
  const [requiresAttestation, setRequiresAttestation] = useState(policy?.requiresAttestation ?? true);
  const update = useUpdatePolicy();

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setTitle(policy?.title ?? '');
      setDescription(policy?.description ?? '');
      setCategory(policy?.category ?? '');
      setReviewFrequency(policy?.reviewFrequency ?? 'ANNUALLY');
      setRequiresAttestation(policy?.requiresAttestation ?? true);
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!policy) return;
    const result = updatePolicySchema.safeParse({
      title: title || undefined,
      description: description || undefined,
      category: category || undefined,
      reviewFrequency: reviewFrequency as 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUALLY' | 'ANNUALLY' | 'BIENNIALLY' | 'WEEKLY' | 'NEVER',
      requiresAttestation,
    });
    if (!result.success) return;

    const input: Record<string, unknown> = {};
    if (result.data.title !== undefined) input.title = result.data.title;
    if (result.data.description !== undefined) input.description = result.data.description;
    if (result.data.category !== undefined) input.category = result.data.category;
    if (result.data.reviewFrequency !== undefined) input.reviewFrequency = result.data.reviewFrequency;
    if (result.data.requiresAttestation !== undefined) input.requiresAttestation = result.data.requiresAttestation;

    update.mutate(
      { id: policy._id, input },
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
          <DialogTitle>Edit policy details</DialogTitle>
          <DialogDescription>
            Update policy metadata. Version management is done separately.
          </DialogDescription>
        </DialogHeader>
        {policy && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-lg border border-amber-500/50 bg-amber-500/5 p-4">
              <div className="flex gap-3">
                <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-500" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-foreground">
                    Modifying your policy can affect your compliance posture.
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                    <li>Please ensure that you have sufficient policy coverage for related controls.</li>
                    <li>If you want to significantly change the meaning of a policy, please consider creating a custom policy instead of modifying this one. Otherwise, ongoing improvements to this policy might become irrelevant.</li>
                  </ul>
                </div>
              </div>
            </div>
            {update.error && (
              <FormErrorAlert message={(update.error as Error).message} />
            )}
            <div className="space-y-2">
              <Label htmlFor="title">Policy title</Label>
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
              <Label htmlFor="description">Policy description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description..."
                rows={2}
                maxLength={2000}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category (optional)</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Security"
                maxLength={100}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="reviewFrequency">Review frequency</Label>
                <Select
                  value={reviewFrequency}
                  onValueChange={setReviewFrequency}
                >
                  <SelectTrigger id="reviewFrequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REVIEW_FREQUENCY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Requires attestation</Label>
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="requiresAttestation"
                    checked={requiresAttestation}
                    onChange={(e) => setRequiresAttestation(e.target.checked)}
                    className="rounded border-input"
                  />
                  <Label htmlFor="requiresAttestation" className="font-normal cursor-pointer">
                    Employees must acknowledge this policy
                  </Label>
                </div>
              </div>
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
                {update.isPending ? 'Saving...' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
