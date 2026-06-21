import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormErrorAlert } from '@/components/shared';
import { createVendorSchema } from '@/schemas/vendor';
import { useCreateVendor } from '@/api/vendors';

type CreateVendorModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function CreateVendorModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateVendorModalProps) {
  const [companyName, setCompanyName] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('');
  const create = useCreateVendor();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = createVendorSchema.safeParse({
      name: companyName.trim(),
      website: url.trim() || undefined,
      category: category.trim() || undefined,
      riskTier: 'UNSCORED',
      status: 'ACTIVE',
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
    setCompanyName('');
    setUrl('');
    setCategory('');
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add vendor</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {create.error && (
            <FormErrorAlert message={(create.error as Error).message} />
          )}
          <div className="space-y-2">
            <Label htmlFor="companyName">Company name</Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Inc."
              required
              minLength={2}
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="url">URL</Label>
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Technology"
              maxLength={100}
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
              {create.isPending ? 'Adding...' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
