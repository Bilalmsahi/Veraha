import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { FormErrorAlert, ControlPickerModal } from '@/components/shared';
import type { ControlPickerItem } from '@/components/shared';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { createEvidenceSchema } from '@/schemas/evidence';
import { useCreateEvidence } from '@/api/evidence';
import type { EvidenceDetail } from '@/api/evidence';
import { Upload, Link2, X, Info } from 'lucide-react';

type EvidenceUploadModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (created?: EvidenceDetail) => void;
};

export function EvidenceUploadModal({
  open,
  onOpenChange,
  onSuccess,
}: EvidenceUploadModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [isSensitive, setIsSensitive] = useState(false);
  const [recurrence, setRecurrence] = useState<string>('ANNUALLY');
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [selectedControls, setSelectedControls] = useState<ControlPickerItem[]>([]);
  const [controlPickerOpen, setControlPickerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const create = useCreateEvidence();

  const linkedControlIds = selectedControls.map((c) => c._id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const validUntilValue = recurrence === 'NEVER' ? undefined : validUntil;
    const result = createEvidenceSchema.safeParse({
      title,
      description: description || undefined,
      category: category || undefined,
      validUntil: validUntilValue || undefined,
      linkedControlIds: linkedControlIds.length ? linkedControlIds : undefined,
    });
    if (!result.success) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', result.data.title);
    if (result.data.description) formData.append('description', result.data.description);
    if (result.data.category) formData.append('category', result.data.category);
    if (result.data.validUntil) formData.append('validUntil', new Date(result.data.validUntil).toISOString());
    formData.append('isSensitive', String(isSensitive));
    if (result.data.linkedControlIds?.length) {
      formData.append('linkedControlIds', result.data.linkedControlIds.join(','));
    }

    create.mutate(formData, {
      onSuccess: (created) => {
        onOpenChange(false);
        resetForm();
        onSuccess?.(created);
      },
    });
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('');
    setIsSensitive(false);
    setRecurrence('ANNUALLY');
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    setValidUntil(d.toISOString().slice(0, 10));
    setSelectedControls([]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleControlPickerConfirm = (ids: string[], controls?: ControlPickerItem[]) => {
    setSelectedControls(controls ?? ids.map((id) => ({ _id: id, identifier: id, title: '' })));
  };

  const removeControl = (id: string) => {
    setSelectedControls((prev) => prev.filter((c) => c._id !== id));
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create document</DialogTitle>
          <DialogDescription>
            Upload a file and link it to controls. Supported formats: PDF, images, documents.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {create.error && (
            <FormErrorAlert message={(create.error as Error).message} />
          )}
          <div className="space-y-2">
            <Label htmlFor="file">File (required)</Label>
            <Input
              id="file"
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Document name</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Access Control Policy"
              required
              minLength={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
              rows={2}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category || '__none__'} onValueChange={(v) => setCategory(v === '__none__' ? '' : v)}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  <SelectItem value="Policy">Policy</SelectItem>
                  <SelectItem value="Procedure">Procedure</SelectItem>
                  <SelectItem value="Screenshot">Screenshot</SelectItem>
                  <SelectItem value="Report">Report</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="recurrence">Renew</Label>
              <p className="text-xs text-muted-foreground">
                Select how often the document needs to be renewed since the most recent upload.
              </p>
              <Select
                value={recurrence}
                onValueChange={(v) => {
                  setRecurrence(v);
                  if (v !== 'custom') {
                    const d = new Date();
                    if (v === 'ANNUALLY') d.setFullYear(d.getFullYear() + 1);
                    else if (v === 'SEMI_ANNUALLY') d.setMonth(d.getMonth() + 6);
                    else if (v === 'QUARTERLY') d.setMonth(d.getMonth() + 3);
                    else if (v === 'MONTHLY') d.setMonth(d.getMonth() + 1);
                    setValidUntil(d.toISOString().slice(0, 10));
                  }
                }}
              >
                <SelectTrigger id="recurrence">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEVER">Never</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                  <SelectItem value="SEMI_ANNUALLY">Semi-annually</SelectItem>
                  <SelectItem value="ANNUALLY">Annually</SelectItem>
                  <SelectItem value="custom">Custom date</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isSensitive"
              checked={isSensitive}
              onCheckedChange={(v) => setIsSensitive(!!v)}
            />
            <Label htmlFor="isSensitive" className="text-sm font-normal cursor-pointer flex items-center gap-1.5">
              This is a sensitive document
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-4 text-muted-foreground cursor-help" aria-label="More info" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[240px]">
                    <p className="text-xs">
                      Sensitive documents have restricted visibility and may require additional approval for access.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
          </div>
          {recurrence === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="validUntil">Valid until</Label>
              <Input
                id="validUntil"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Link to controls (optional)</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setControlPickerOpen(true)}
              >
                <Link2 className="mr-2 size-4" />
                Select controls
              </Button>
              {selectedControls.length > 0 && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  {selectedControls.length} selected
                </span>
              )}
            </div>
            {selectedControls.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedControls.map((c) => (
                  <Badge
                    key={c._id}
                    variant="secondary"
                    className="flex items-center gap-1 py-1 pr-1"
                  >
                    <span className="font-mono text-xs">{c.identifier}</span>
                    <button
                      type="button"
                      onClick={() => removeControl(c._id)}
                      className="ml-1 rounded-full p-0.5 hover:bg-muted"
                      aria-label={`Remove ${c.identifier}`}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <ControlPickerModal
            open={controlPickerOpen}
            onOpenChange={setControlPickerOpen}
            existingControlIds={linkedControlIds}
            onConfirm={handleControlPickerConfirm}
            title="Select controls"
            description="Choose controls this evidence satisfies."
            confirmVerb="Select"
          />
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
              {create.isPending ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
