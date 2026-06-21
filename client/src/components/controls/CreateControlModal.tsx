import { useState } from 'react';
import { useCreateControl } from '@/api/controls';
import type { CreateControlInput } from '@/api/controls';
import { FRAMEWORK_CODES } from '@/api/organization';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DOMAIN_OPTIONS = [
  'Asset Management',
  'Access Control',
  'Security Awareness',
  'Business Continuity',
  'Cloud Security',
  'Compliance',
  'Data Security',
  'Incident Response',
];

const FRAMEWORK_LABELS: Record<string, string> = {
  SOC2: 'SOC 2',
  ISO27001: 'ISO 27001',
  HIPAA: 'HIPAA',
  GDPR: 'GDPR',
};

export function CreateControlModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createMutation = useCreateControl();
  const [identifier, setIdentifier] = useState('');
  const [description, setDescription] = useState('');
  const [controlGroup, setControlGroup] = useState('');
  const [title, setTitle] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [frameworkCode, setFrameworkCode] = useState('');

  const reset = () => {
    setIdentifier('');
    setDescription('');
    setCategory('');
    setTitle('');
    setEffectiveDate('');
    setFrameworkCode('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: CreateControlInput = {
      identifier: identifier.trim(),
      title: title.trim() || description.trim().slice(0, 120) || identifier.trim(),
      description: description.trim() || undefined,
      controlGroup: controlGroup.trim() || undefined,
      implementationNotes: frameworkCode.trim()
        ? `Framework code: ${frameworkCode.trim()}`
        : undefined,
      nextAssessmentDue: effectiveDate || undefined,
    };
    createMutation.mutate(input, {
      onSuccess: () => {
        reset();
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New control</DialogTitle>
          <DialogDescription>
            Add a custom control aligned to your framework scope.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cc-desc">Description</Label>
            <Textarea
              id="cc-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
              required
              placeholder='e.g. "The company maintains..."'
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cc-domain">Control group</Label>
              <Select value={controlGroup || undefined} onValueChange={setControlGroup}>
                <SelectTrigger id="cc-domain">
                  <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent>
                  {DOMAIN_OPTIONS.map((domain) => (
                    <SelectItem key={domain} value={domain}>
                      {domain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-id">Control ID</Label>
              <Input
                id="cc-id"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                placeholder='e.g. "C-1"'
                maxLength={50}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cc-title">Control name <span className="text-xs text-muted-foreground">Optional</span></Label>
            <Input
              id="cc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='e.g. "Organization structure documented"'
              maxLength={300}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cc-effective">Effective date</Label>
              <Input
                id="cc-effective"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-framework">Framework code <span className="text-xs text-muted-foreground">Optional</span></Label>
              <Select
                value={frameworkCode || '__none__'}
                onValueChange={(value) => setFrameworkCode(value === '__none__' ? '' : value)}
              >
                <SelectTrigger id="cc-framework">
                  <SelectValue placeholder="Select framework" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {FRAMEWORK_CODES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {FRAMEWORK_LABELS[code] ?? code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || !identifier.trim() || !description.trim()}>
              {createMutation.isPending ? 'Adding...' : 'Add control'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
