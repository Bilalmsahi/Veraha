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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormErrorAlert } from '@/components/shared';
import { useCreateAwsAccount } from '@/api/integrations';
import { Loader2 } from 'lucide-react';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

const ENVIRONMENT_OPTIONS = [
  { value: 'production', label: 'Production' },
  { value: 'staging', label: 'Staging' },
  { value: 'development', label: 'Development' },
  { value: 'other', label: 'Other' },
] as const;

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'unverified', label: 'Unverified' },
] as const;

export function AddAwsAccountModal({ open, onOpenChange }: Props) {
  const [name, setName] = useState('');
  const [awsAccountId, setAwsAccountId] = useState('');
  const [environmentType, setEnvironmentType] = useState<string>('production');
  const [status, setStatus] = useState<string>('active');
  const [regions, setRegions] = useState('');
  const [notes, setNotes] = useState('');

  const create = useCreateAwsAccount();

  const resetForm = () => {
    setName('');
    setAwsAccountId('');
    setEnvironmentType('production');
    setStatus('active');
    setRegions('');
    setNotes('');
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{12}$/.test(awsAccountId.trim())) return;

    create.mutate(
      {
        name: name.trim(),
        awsAccountId: awsAccountId.trim(),
        environmentType: environmentType as 'production' | 'staging' | 'development' | 'other',
        status: status as 'active' | 'inactive' | 'unverified',
        regions: regions
          .split(',')
          .map((r) => r.trim())
          .filter(Boolean),
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          handleOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add AWS account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {create.error && (
            <FormErrorAlert message={(create.error as Error).message} />
          )}
          <div className="space-y-2">
            <Label htmlFor="accountName">Account name</Label>
            <Input
              id="accountName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production"
              required
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="awsAccountId">AWS account ID</Label>
            <Input
              id="awsAccountId"
              value={awsAccountId}
              onChange={(e) => setAwsAccountId(e.target.value.replace(/\D/g, '').slice(0, 12))}
              placeholder="123456789012"
              required
              pattern="\d{12}"
              inputMode="numeric"
            />
            <p className="text-xs text-muted-foreground">12-digit numeric ID</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="environmentType">Environment type</Label>
            <Select value={environmentType} onValueChange={setEnvironmentType}>
              <SelectTrigger id="environmentType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENVIRONMENT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="regions">Regions</Label>
            <Input
              id="regions"
              value={regions}
              onChange={(e) => setRegions(e.target.value)}
              placeholder="us-east-1, us-west-2"
            />
            <p className="text-xs text-muted-foreground">e.g. us-east-1, us-west-2</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this account"
              rows={3}
              maxLength={2000}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Add account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
