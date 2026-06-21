import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateAudit } from '@/api/audits';
import { useFrameworks } from '@/api/frameworks';
import { formatFrameworkCode } from '@/lib/formatters';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const AUDIT_TYPES = [
  { value: 'TYPE_I', label: 'Type I' },
  { value: 'TYPE_II', label: 'Type II' },
  { value: 'CERTIFICATION', label: 'Certification' },
  { value: 'INTERNAL', label: 'Internal' },
  { value: 'EXTERNAL', label: 'External' },
] as const;

type CreateAuditModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateAuditModal({ open, onOpenChange }: CreateAuditModalProps) {
  const navigate = useNavigate();
  const createAudit = useCreateAudit();
  const frameworks = useFrameworks();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [auditType, setAuditType] = useState<string>('EXTERNAL');
  const [frameworkId, setFrameworkId] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const periodEndIsPast = periodEnd && periodEnd < today;
  const periodEndBeforeStart = periodStart && periodEnd && periodEnd < periodStart;

  const resetForm = () => {
    setName('');
    setDescription('');
    setPeriodStart('');
    setPeriodEnd('');
    setAuditType('EXTERNAL');
    setFrameworkId('');
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) resetForm();
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (periodEndBeforeStart) return;

    createAudit.mutate(
      {
        name,
        description,
        periodStart,
        periodEnd,
        auditType,
        frameworkId: frameworkId || undefined,
      },
      {
        onSuccess: (audit) => {
          handleOpenChange(false);
          navigate(`/audits/${audit._id}`);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New audit</DialogTitle>
          <DialogDescription>
            Create an audit engagement shell before snapshotting evidence.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="audit-name">Audit name</Label>
            <Input
              id="audit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="audit-description">Description</Label>
            <Textarea
              id="audit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="audit-type">Audit type</Label>
              <select
                id="audit-type"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={auditType}
                onChange={(e) => setAuditType(e.target.value)}
              >
                {AUDIT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="audit-framework">Framework (optional)</Label>
              <select
                id="audit-framework"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={frameworkId}
                onChange={(e) => setFrameworkId(e.target.value)}
                disabled={frameworks.isLoading}
              >
                <option value="">Any / not specified</option>
                {(frameworks.data ?? []).map((fw) => (
                  <option key={fw._id} value={fw._id}>
                    {fw.code
                      ? `${formatFrameworkCode(fw.code)}${fw.name ? ` - ${formatFrameworkCode(fw.name)}` : ''}`
                      : formatFrameworkCode(fw.name ?? '')}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="audit-period-start">Period start</Label>
              <Input
                id="audit-period-start"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audit-period-end">Period end</Label>
              <Input
                id="audit-period-end"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                required
              />
            </div>
          </div>
          {periodEndBeforeStart && (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              Period end must be after period start.
            </p>
          )}
          {!periodEndBeforeStart && periodEndIsPast && (
            <p className="rounded-md border border-amber-400/40 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
              Warning: period end is in the past. Auditors invited to this audit will immediately have expired access.
            </p>
          )}
          {createAudit.isError && (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {(createAudit.error as Error)?.message ?? 'Failed to create audit.'}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createAudit.isPending || !name || !periodStart || !periodEnd || Boolean(periodEndBeforeStart)}
            >
              {createAudit.isPending ? 'Creating...' : 'Create audit'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
