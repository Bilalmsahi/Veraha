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
import { updateRiskSchema } from '@/schemas/risk';
import { useUpdateRisk } from '@/api/risks';
import type { RiskDetail } from '@/api/risks';

const TREATMENT_OPTIONS = [
  { value: 'MITIGATE', label: 'Mitigate' },
  { value: 'ACCEPT', label: 'Accept' },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'AVOID', label: 'Avoid' },
];

const SCORE_OPTIONS = [1, 2, 3, 4, 5];

type EditRiskModalProps = {
  risk: RiskDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function EditRiskModal({
  risk,
  open,
  onOpenChange,
  onSuccess,
}: EditRiskModalProps) {
  const [title, setTitle] = useState(risk?.title ?? '');
  const [description, setDescription] = useState(risk?.description ?? '');
  const [category, setCategory] = useState(risk?.category ?? '');
  const [likelihood, setLikelihood] = useState<number>(risk?.likelihood ?? 3);
  const [impact, setImpact] = useState<number>(risk?.impact ?? 3);
  const [treatment, setTreatment] = useState<string>(risk?.treatment ?? 'MITIGATE');
  const [treatmentPlan, setTreatmentPlan] = useState(risk?.treatmentPlan ?? '');
  const [nextReviewDue, setNextReviewDue] = useState(risk?.nextReviewDue ? risk.nextReviewDue.slice(0, 10) : '');
  const update = useUpdateRisk();
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setTitle(risk?.title ?? '');
      setDescription(risk?.description ?? '');
      setCategory(risk?.category ?? '');
      setLikelihood(risk?.likelihood ?? 3);
      setImpact(risk?.impact ?? 3);
      setTreatment(risk?.treatment ?? 'MITIGATE');
      setTreatmentPlan(risk?.treatmentPlan ?? '');
      setNextReviewDue(risk?.nextReviewDue ? risk.nextReviewDue.slice(0, 10) : '');
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!risk) return;
    const result = updateRiskSchema.safeParse({
      title: title || undefined,
      description: description || undefined,
      category: category || undefined,
      likelihood,
      impact,
      treatment: treatment as 'MITIGATE' | 'ACCEPT' | 'TRANSFER' | 'AVOID',
      treatmentPlan: treatmentPlan || undefined,
      nextReviewDue: nextReviewDue || undefined,
    });
    if (!result.success) return;

    const input: Record<string, unknown> = {};
    if (result.data.title !== undefined) input.title = result.data.title;
    if (result.data.description !== undefined) input.description = result.data.description;
    if (result.data.category !== undefined) input.category = result.data.category;
    if (result.data.likelihood !== undefined) input.likelihood = result.data.likelihood;
    if (result.data.impact !== undefined) input.impact = result.data.impact;
    if (result.data.treatment !== undefined) input.treatment = result.data.treatment;
    if (result.data.treatmentPlan !== undefined) input.treatmentPlan = result.data.treatmentPlan;
    if (result.data.nextReviewDue !== undefined) input.nextReviewDue = result.data.nextReviewDue;

    update.mutate(
      { id: risk._id, input },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSuccess?.();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit risk</DialogTitle>
          <DialogDescription>
            Update risk details. Changes to likelihood or impact may affect the residual score.
          </DialogDescription>
        </DialogHeader>
        {risk && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {update.error && (
              <FormErrorAlert message={(update.error as Error).message} />
            )}
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
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
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? 'Saving...' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
