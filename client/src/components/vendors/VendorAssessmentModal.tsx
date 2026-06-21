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
import { recordAssessmentSchema } from '@/schemas/vendor';
import { useRecordAssessment } from '@/api/vendors';
import type { VendorDetail } from '@/api/vendors';

const RISK_TIER_OPTIONS = [
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
  { value: 'UNSCORED', label: 'Unscored' },
];

type VendorAssessmentModalProps = {
  vendor: VendorDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function VendorAssessmentModal({
  vendor,
  open,
  onOpenChange,
  onSuccess,
}: VendorAssessmentModalProps) {
  const [riskTier, setRiskTier] = useState<string>(
    vendor?.riskTier === 'MED' ? 'MEDIUM' : (vendor?.riskTier ?? 'MEDIUM')
  );
  const [notes, setNotes] = useState('');
  const [nextAssessmentDate, setNextAssessmentDate] = useState(
    vendor?.nextAssessmentDate ? String(vendor.nextAssessmentDate).slice(0, 10) : ''
  );
  const record = useRecordAssessment();

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setRiskTier(vendor?.riskTier === 'MED' ? 'MEDIUM' : (vendor?.riskTier ?? 'MEDIUM'));
      setNotes('');
      setNextAssessmentDate(vendor?.nextAssessmentDate ? String(vendor.nextAssessmentDate).slice(0, 10) : '');
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendor) return;
    const result = recordAssessmentSchema.safeParse({
      riskTier: riskTier as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNSCORED',
      notes: notes || undefined,
      nextAssessmentDate: nextAssessmentDate || undefined,
    });
    if (!result.success) return;

    record.mutate(
      { id: vendor._id, input: result.data },
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record assessment</DialogTitle>
          <DialogDescription>
            Record a vendor assessment. Update the risk tier and set the next assessment date.
          </DialogDescription>
        </DialogHeader>
        {vendor && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {record.error && (
              <FormErrorAlert message={(record.error as Error).message} />
            )}
            <div className="space-y-2">
              <Label htmlFor="riskTier">Risk tier</Label>
              <Select value={riskTier} onValueChange={setRiskTier}>
                <SelectTrigger id="riskTier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RISK_TIER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Assessment findings, observations..."
                rows={3}
                maxLength={2000}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nextAssessmentDate">Next assessment date (optional)</Label>
              <Input
                id="nextAssessmentDate"
                type="date"
                value={nextAssessmentDate}
                onChange={(e) => setNextAssessmentDate(e.target.value)}
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
              <Button type="submit" disabled={record.isPending}>
                {record.isPending ? 'Recording...' : 'Record assessment'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
