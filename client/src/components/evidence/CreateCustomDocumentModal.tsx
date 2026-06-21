import { useState } from 'react';
import {
  Dialog,
  DialogContent,
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { FormErrorAlert } from '@/components/shared';
import { useCreateCustomDocument } from '@/api/evidence';
import type { EvidenceDetail } from '@/api/evidence';
import { Info, FileQuestion } from 'lucide-react';

type CreateCustomDocumentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (created?: EvidenceDetail) => void;
};

export function CreateCustomDocumentModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateCustomDocumentModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSensitive, setIsSensitive] = useState(false);
  const [recurrence, setRecurrence] = useState<string>('ANNUALLY');
  const [timeSensitivity, setTimeSensitivity] = useState<'anytime' | 'soc2_window'>('anytime');
  const [naDocumentsOpen, setNaDocumentsOpen] = useState(false);
  const create = useCreateCustomDocument();

  const isValid = title.trim().length >= 3;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    create.mutate(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        isSensitive,
        recurrence: recurrence as 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUALLY' | 'ANNUALLY' | 'NEVER',
      },
      {
        onSuccess: (created) => {
          onOpenChange(false);
          resetForm();
          onSuccess?.(created);
        },
      }
    );
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setIsSensitive(false);
    setRecurrence('ANNUALLY');
    setTimeSensitivity('anytime');
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New custom document</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {create.error && (
              <FormErrorAlert message={(create.error as Error).message} />
            )}
            <div className="space-y-2">
              <Label htmlFor="custom-title">Document name</Label>
              <Input
                id="custom-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder='e.g. "Clear Desk Policy Enfor"'
                required
                minLength={3}
                maxLength={200}
              />
              {title.trim().length > 0 && title.trim().length < 3 && (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  Document name must be at least 3 characters ({title.trim().length}/3)
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-description">Description</Label>
              <Textarea
                id="custom-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder='e.g. "Image of internal office space showing clear desk policy in action at 3 or more workstations."'
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="custom-sensitive"
                checked={isSensitive}
                onCheckedChange={(v) => setIsSensitive(!!v)}
              />
              <Label htmlFor="custom-sensitive" className="text-sm font-normal cursor-pointer flex items-center gap-1.5">
                This is a sensitive document
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="size-4 text-muted-foreground cursor-help shrink-0" aria-label="More info" />
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
            <div className="space-y-2">
              <Label htmlFor="custom-recurrence">Recurrence</Label>
              <p className="text-xs text-muted-foreground">
                Select how often the document needs to be renewed since the most recent upload.
              </p>
              <Select value={recurrence} onValueChange={setRecurrence}>
                <SelectTrigger id="custom-recurrence">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEVER">Never</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                  <SelectItem value="SEMI_ANNUALLY">Semi-annually</SelectItem>
                  <SelectItem value="ANNUALLY">Annually</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Time sensitivity</Label>
              <p className="text-xs text-muted-foreground">
                This only applies when you map this document to a control used by SOC 2.
              </p>
              <div className="flex gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="timeSensitivity"
                    checked={timeSensitivity === 'anytime'}
                    onChange={() => setTimeSensitivity('anytime')}
                    className="rounded-full border-input"
                  />
                  <span className="text-sm">Upload anytime</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="timeSensitivity"
                    checked={timeSensitivity === 'soc2_window'}
                    onChange={() => setTimeSensitivity('soc2_window')}
                    className="rounded-full border-input"
                  />
                  <span className="text-sm">Upload during SOC 2 observation window</span>
                </label>
              </div>
            </div>
            <DialogFooter className="flex-wrap gap-2 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setNaDocumentsOpen(true)}
              >
                <FileQuestion className="mr-2 size-4" />
                View N/A documents
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                {!isValid ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-block">
                          <Button type="submit" disabled>
                            Create document
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Document name must be at least 3 characters</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <Button
                    type="submit"
                    disabled={create.isPending}
                  >
                    {create.isPending ? 'Creating...' : 'Create document'}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={naDocumentsOpen} onOpenChange={setNaDocumentsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Non-applicable documents</DialogTitle>
          </DialogHeader>
          <p className="py-6 text-sm text-muted-foreground text-center">
            No documents marked as not applicable.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
