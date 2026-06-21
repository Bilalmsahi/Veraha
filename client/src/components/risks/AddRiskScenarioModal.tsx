import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { FormErrorAlert } from '@/components/shared';
import { useCreateRisk } from '@/api/risks';
import { Info, Loader2 } from 'lucide-react';

type AddRiskScenarioModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddRiskScenarioModal({
  open,
  onOpenChange,
}: AddRiskScenarioModalProps) {
  const navigate = useNavigate();
  const [description, setDescription] = useState('');
  const [riskIdOptional, setRiskIdOptional] = useState('');
  const [addAnother, setAddAnother] = useState(false);
  const create = useCreateRisk();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = description.trim();
    if (title.length < 3) return;
    const identifier = riskIdOptional.trim() ? riskIdOptional.trim() : undefined;
    if (identifier !== undefined && identifier.length > 50) return;

    create.mutate(
      {
        title,
        description: title,
        identifier: identifier || undefined,
        likelihood: 1,
        impact: 1,
        treatment: 'MITIGATE',
      },
      {
        onSuccess: (data) => {
          const id = (data as { _id: string })._id;
          if (addAnother) {
            resetForm();
            const el = document.getElementById('description');
            if (el instanceof HTMLTextAreaElement) {
              el.focus();
            }
          } else {
            onOpenChange(false);
            resetForm();
            navigate(`/risk-management/risk-scenario/${id}`);
          }
        },
      }
    );
  };

  const resetForm = () => {
    setDescription('');
    setRiskIdOptional('');
    setAddAnother(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>Add risk scenario</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {create.error && (
            <FormErrorAlert message={(create.error as Error).message} />
          )}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="description">Description</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                      aria-label="Description help"
                    >
                      <Info className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    Describe the risk scenario so your team can assess and treat it.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Unauthorized access to production systems"
              required
              minLength={3}
              maxLength={2000}
              rows={4}
              className="resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="riskId">Risk ID Optional</Label>
            <p className="text-xs text-muted-foreground">
              Leading/trailing spaces not allowed. We will generate one if you leave this empty.
            </p>
            <Input
              id="riskId"
              value={riskIdOptional}
              onChange={(e) => setRiskIdOptional(e.target.value)}
              placeholder="e.g. R-42"
              maxLength={50}
              className="font-mono"
            />
          </div>
          <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={addAnother}
                onCheckedChange={(v) => setAddAnother(v === true)}
              />
              Add another
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={create.isPending || description.trim().length < 3}
              >
                {create.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                {create.isPending ? 'Adding...' : 'Add risk scenario'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
