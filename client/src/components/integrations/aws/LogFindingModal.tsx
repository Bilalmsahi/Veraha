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
import { useCreateFinding } from '@/api/integrations';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accountId: string;
  accountName: string;
};

const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical', dotClass: 'bg-red-500' },
  { value: 'high', label: 'High', dotClass: 'bg-orange-500' },
  { value: 'medium', label: 'Medium', dotClass: 'bg-yellow-500' },
  { value: 'low', label: 'Low', dotClass: 'bg-blue-500' },
  { value: 'informational', label: 'Informational', dotClass: 'bg-gray-400' },
] as const;

const SERVICE_OPTIONS = [
  'EC2',
  'S3',
  'IAM',
  'RDS',
  'CloudTrail',
  'VPC',
  'GuardDuty',
  'Inspector',
  'Lambda',
  'KMS',
  'CloudWatch',
  'Other',
] as const;

function todayInputValue(): string {
  return new Date().toISOString().split('T')[0] ?? '';
}

export function LogFindingModal({ open, onOpenChange, accountId, accountName }: Props) {
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<string>('medium');
  const [affectedService, setAffectedService] = useState<string>('EC2');
  const [description, setDescription] = useState('');
  const [detectedOn, setDetectedOn] = useState(todayInputValue());
  const [region, setRegion] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [remediationNotes, setRemediationNotes] = useState('');

  const create = useCreateFinding();

  const resetForm = () => {
    setTitle('');
    setSeverity('medium');
    setAffectedService('EC2');
    setDescription('');
    setDetectedOn(todayInputValue());
    setRegion('');
    setResourceId('');
    setRemediationNotes('');
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) return;

    create.mutate(
      {
        accountId,
        data: {
          title: title.trim(),
          severity: severity as 'critical' | 'high' | 'medium' | 'low' | 'informational',
          affectedService: affectedService as (typeof SERVICE_OPTIONS)[number],
          description: description.trim(),
          detectedOn: new Date(detectedOn).toISOString(),
          region: region.trim() || undefined,
          resourceId: resourceId.trim() || undefined,
          remediationNotes: remediationNotes.trim() || undefined,
        },
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log finding</DialogTitle>
          {accountName && (
            <p className="text-sm text-muted-foreground">
              Account: {accountName}
            </p>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {create.error && (
            <FormErrorAlert message={(create.error as Error).message} />
          )}
          <div className="space-y-2">
            <Label htmlFor="findingTitle">Title</Label>
            <Input
              id="findingTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. S3 bucket is publicly accessible"
              required
              maxLength={500}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="severity">Severity</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger id="severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEVERITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">
                      <span className={cn('size-2 rounded-full shrink-0', opt.dotClass)} aria-hidden />
                      {opt.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="affectedService">Affected service</Label>
            <Select value={affectedService} onValueChange={setAffectedService}>
              <SelectTrigger id="affectedService">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_OPTIONS.map((service) => (
                  <SelectItem key={service} value={service}>
                    {service}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the security finding"
              required
              rows={4}
              maxLength={5000}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="detectedOn">Detected on</Label>
              <Input
                id="detectedOn"
                type="date"
                value={detectedOn}
                onChange={(e) => setDetectedOn(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <Input
                id="region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="us-east-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="resourceId">Resource ID</Label>
            <Input
              id="resourceId"
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
              placeholder="arn:aws:..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="remediationNotes">Remediation notes</Label>
            <Textarea
              id="remediationNotes"
              value={remediationNotes}
              onChange={(e) => setRemediationNotes(e.target.value)}
              placeholder="Optional remediation steps or notes"
              rows={3}
              maxLength={5000}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || !accountId}>
              {create.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Log finding
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
