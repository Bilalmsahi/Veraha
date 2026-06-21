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
import { createRiskSchema } from '@/schemas/risk';
import { useCreateRisk } from '@/api/risks';
import { Plus } from 'lucide-react';

const TREATMENT_OPTIONS = [
  { value: 'MITIGATE', label: 'Mitigate' },
  { value: 'ACCEPT', label: 'Accept' },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'AVOID', label: 'Avoid' },
];

const SCORE_OPTIONS = [1, 2, 3, 4, 5];

type CreateRiskModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function CreateRiskModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateRiskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [likelihood, setLikelihood] = useState<number>(3);
  const [impact, setImpact] = useState<number>(3);
  const [treatment, setTreatment] = useState<string>('MITIGATE');
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [nextReviewDue, setNextReviewDue] = useState('');
  const create = useCreateRisk();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = createRiskSchema.safeParse({
      title,
      description: description || undefined,
      category: category || undefined,
      likelihood,
      impact,
      treatment: treatment as 'MITIGATE' | 'ACCEPT' | 'TRANSFER' | 'AVOID',
      treatmentPlan: treatmentPlan || undefined,
      nextReviewDue: nextReviewDue || undefined,
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
    setTitle('');
    setDescription('');
    setCategory('');
    setLikelihood(3);
    setImpact(3);
    setTreatment('MITIGATE');
    setTreatmentPlan('');
    setNextReviewDue('');
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add risk scenario</DialogTitle>
          <DialogDescription>
            Create a new risk entry in the risk register. Likelihood and impact use a 1–5 scale.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {create.error && (
            <FormErrorAlert message={(create.error as Error).message} />
          )}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Unauthorized access to production systems"
              required
              minLength={3}
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the risk scenario..."
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
              placeholder="e.g. Security, Operational"
              maxLength={100}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="likelihood">Likelihood (1–5)</Label>
              <Select
                value={String(likelihood)}
                onValueChange={(v) => setLikelihood(Number(v))}
              >
                <SelectTrigger id="likelihood">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCORE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="impact">Impact (1–5)</Label>
              <Select
                value={String(impact)}
                onValueChange={(v) => setImpact(Number(v))}
              >
                <SelectTrigger id="impact">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCORE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="treatment">Treatment</Label>
            <Select value={treatment} onValueChange={setTreatment}>
              <SelectTrigger id="treatment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TREATMENT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="treatmentPlan">Treatment plan (optional)</Label>
            <Textarea
              id="treatmentPlan"
              value={treatmentPlan}
              onChange={(e) => setTreatmentPlan(e.target.value)}
              placeholder="Steps to mitigate or manage this risk..."
              rows={2}
              maxLength={2000}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nextReviewDue">Next review due (optional)</Label>
            <Input
              id="nextReviewDue"
              type="date"
              value={nextReviewDue}
              onChange={(e) => setNextReviewDue(e.target.value)}
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
              <Plus className="mr-2 size-4" />
              {create.isPending ? 'Creating...' : 'Add risk'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
