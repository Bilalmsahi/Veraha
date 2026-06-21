import { useState, useRef } from 'react';
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
import { createVersionSchema } from '@/schemas/policy';
import { useCreateVersion } from '@/api/policies';
import { Upload } from 'lucide-react';

type CreateVersionModalProps = {
  policyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function CreateVersionModal({
  policyId,
  open,
  onOpenChange,
  onSuccess,
}: CreateVersionModalProps) {
  const [changelog, setChangelog] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const create = useCreateVersion();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = createVersionSchema.safeParse({
      changelog: changelog || undefined,
      effectiveDate: effectiveDate || undefined,
    });
    if (!result.success) return;

    const formData = new FormData();
    const file = fileRef.current?.files?.[0];
    if (file) formData.append('file', file);
    if (result.data.changelog) formData.append('changelog', result.data.changelog);
    if (result.data.effectiveDate) {
      formData.append('effectiveDate', new Date(result.data.effectiveDate).toISOString());
    }

    create.mutate(
      { policyId, formData },
      {
        onSuccess: () => {
          onOpenChange(false);
          resetForm();
          onSuccess?.();
        },
      }
    );
  };

  const resetForm = () => {
    setChangelog('');
    setEffectiveDate('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add version</DialogTitle>
          <DialogDescription>
            Upload a new policy version. Optionally add a changelog and effective date.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {create.error && (
            <FormErrorAlert message={(create.error as Error).message} />
          )}
          <div className="space-y-2">
            <Label htmlFor="file">File (optional)</Label>
            <Input
              id="file"
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="changelog">Changelog (optional)</Label>
            <Textarea
              id="changelog"
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              placeholder="What changed in this version..."
              rows={3}
              maxLength={2000}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="effectiveDate">Effective date (optional)</Label>
            <Input
              id="effectiveDate"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
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
              <Upload className="mr-2 size-4" />
              {create.isPending ? 'Creating...' : 'Add version'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
