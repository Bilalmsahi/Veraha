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
import { updateVendorSchema } from '@/schemas/vendor';
import { useUpdateVendor } from '@/api/vendors';
import type { VendorDetail } from '@/api/vendors';

const RISK_TIER_OPTIONS = [
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
  { value: 'UNSCORED', label: 'Unscored' },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'TERMINATED', label: 'Terminated' },
];

const ASSESSMENT_FREQUENCY_OPTIONS = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'SEMI_ANNUALLY', label: 'Semi-annually' },
  { value: 'ANNUALLY', label: 'Annually' },
];

type EditVendorModalProps = {
  vendor: VendorDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function EditVendorModal({
  vendor,
  open,
  onOpenChange,
  onSuccess,
}: EditVendorModalProps) {
  const [name, setName] = useState(vendor?.name ?? '');
  const [description, setDescription] = useState(vendor?.description ?? '');
  const [serviceType, setServiceType] = useState(vendor?.serviceType ?? '');
  const [category, setCategory] = useState(vendor?.category ?? '');
  const [website, setWebsite] = useState(vendor?.website ?? '');
  const [riskTier, setRiskTier] = useState<string>(vendor?.riskTier ?? 'MED');
  const [status, setStatus] = useState<string>(vendor?.status ?? 'ACTIVE');
  const [primaryContactName, setPrimaryContactName] = useState(vendor?.primaryContact?.name ?? '');
  const [primaryContactEmail, setPrimaryContactEmail] = useState(vendor?.primaryContact?.email ?? '');
  const [primaryContactPhone, setPrimaryContactPhone] = useState(vendor?.primaryContact?.phone ?? '');
  const [securityContactName, setSecurityContactName] = useState(vendor?.securityContact?.name ?? '');
  const [securityContactEmail, setSecurityContactEmail] = useState(vendor?.securityContact?.email ?? '');
  const [securityContactPhone, setSecurityContactPhone] = useState(vendor?.securityContact?.phone ?? '');
  const [contractStartDate, setContractStartDate] = useState(
    vendor?.contractStartDate ? String(vendor.contractStartDate).slice(0, 10) : ''
  );
  const [contractEndDate, setContractEndDate] = useState(
    vendor?.contractEndDate ? String(vendor.contractEndDate).slice(0, 10) : ''
  );
  const [hasNda, setHasNda] = useState(vendor?.hasNda ?? false);
  const [hasDpa, setHasDpa] = useState(vendor?.hasDpa ?? false);
  const [hasSla, setHasSla] = useState(vendor?.hasSla ?? false);
  const [assessmentFrequency, setAssessmentFrequency] = useState<string>(vendor?.assessmentFrequency ?? 'ANNUALLY');
  const [nextAssessmentDate, setNextAssessmentDate] = useState(
    vendor?.nextAssessmentDate ? String(vendor.nextAssessmentDate).slice(0, 10) : ''
  );
  const update = useUpdateVendor();

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setName(vendor?.name ?? '');
      setDescription(vendor?.description ?? '');
      setServiceType(vendor?.serviceType ?? '');
      setCategory(vendor?.category ?? '');
      setWebsite(vendor?.website ?? '');
      setRiskTier(vendor?.riskTier ?? 'MED');
      setStatus(vendor?.status ?? 'ACTIVE');
      setPrimaryContactName(vendor?.primaryContact?.name ?? '');
      setPrimaryContactEmail(vendor?.primaryContact?.email ?? '');
      setPrimaryContactPhone(vendor?.primaryContact?.phone ?? '');
      setSecurityContactName(vendor?.securityContact?.name ?? '');
      setSecurityContactEmail(vendor?.securityContact?.email ?? '');
      setSecurityContactPhone(vendor?.securityContact?.phone ?? '');
      setContractStartDate(vendor?.contractStartDate ? String(vendor.contractStartDate).slice(0, 10) : '');
      setContractEndDate(vendor?.contractEndDate ? String(vendor.contractEndDate).slice(0, 10) : '');
      setHasNda(vendor?.hasNda ?? false);
      setHasDpa(vendor?.hasDpa ?? false);
      setHasSla(vendor?.hasSla ?? false);
      setAssessmentFrequency(vendor?.assessmentFrequency ?? 'ANNUALLY');
      setNextAssessmentDate(vendor?.nextAssessmentDate ? String(vendor.nextAssessmentDate).slice(0, 10) : '');
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendor) return;
    const result = updateVendorSchema.safeParse({
      name,
      description: description || undefined,
      serviceType: serviceType || undefined,
      category: category || undefined,
      website: website || undefined,
      riskTier: riskTier as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNSCORED',
      status: status as 'ACTIVE' | 'INACTIVE' | 'UNDER_REVIEW' | 'TERMINATED',
      primaryContact:
        primaryContactName || primaryContactEmail || primaryContactPhone
          ? {
              name: primaryContactName || undefined,
              email: primaryContactEmail || undefined,
              phone: primaryContactPhone || undefined,
            }
          : undefined,
      securityContact:
        securityContactName || securityContactEmail || securityContactPhone
          ? {
              name: securityContactName || undefined,
              email: securityContactEmail || undefined,
              phone: securityContactPhone || undefined,
            }
          : undefined,
      contractStartDate: contractStartDate || undefined,
      contractEndDate: contractEndDate || undefined,
      hasNda,
      hasDpa,
      hasSla,
      assessmentFrequency: assessmentFrequency as 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUALLY' | 'ANNUALLY',
      nextAssessmentDate: nextAssessmentDate || undefined,
    });
    if (!result.success) return;

    const input: Record<string, unknown> = {};
    Object.entries(result.data).forEach(([k, v]) => {
      if (v !== undefined) (input as Record<string, unknown>)[k] = v;
    });

    update.mutate(
      { id: vendor._id, input },
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
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit vendor</DialogTitle>
          <DialogDescription>
            Update vendor details. Changes to risk tier or status will be reflected immediately.
          </DialogDescription>
        </DialogHeader>
        {vendor && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {update.error && (
              <FormErrorAlert message={(update.error as Error).message} />
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="serviceType">Service type (optional)</Label>
                <Input
                  id="serviceType"
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  maxLength={100}
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website (optional)</Label>
              <Input
                id="website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
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
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="assessmentFrequency">Assessment frequency</Label>
                <Select value={assessmentFrequency} onValueChange={setAssessmentFrequency}>
                  <SelectTrigger id="assessmentFrequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSESSMENT_FREQUENCY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Primary contact (optional)</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  placeholder="Name"
                  value={primaryContactName}
                  onChange={(e) => setPrimaryContactName(e.target.value)}
                  maxLength={100}
                />
                <Input
                  type="email"
                  placeholder="Email"
                  value={primaryContactEmail}
                  onChange={(e) => setPrimaryContactEmail(e.target.value)}
                />
                <Input
                  placeholder="Phone"
                  value={primaryContactPhone}
                  onChange={(e) => setPrimaryContactPhone(e.target.value)}
                  maxLength={30}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Security contact (optional)</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  placeholder="Name"
                  value={securityContactName}
                  onChange={(e) => setSecurityContactName(e.target.value)}
                  maxLength={100}
                />
                <Input
                  type="email"
                  placeholder="Email"
                  value={securityContactEmail}
                  onChange={(e) => setSecurityContactEmail(e.target.value)}
                />
                <Input
                  placeholder="Phone"
                  value={securityContactPhone}
                  onChange={(e) => setSecurityContactPhone(e.target.value)}
                  maxLength={30}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contractStartDate">Contract start (optional)</Label>
                <Input
                  id="contractStartDate"
                  type="date"
                  value={contractStartDate}
                  onChange={(e) => setContractStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contractEndDate">Contract end (optional)</Label>
                <Input
                  id="contractEndDate"
                  type="date"
                  value={contractEndDate}
                  onChange={(e) => setContractEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasNda"
                  checked={hasNda}
                  onChange={(e) => setHasNda(e.target.checked)}
                  className="rounded border-input"
                />
                <Label htmlFor="hasNda" className="font-normal cursor-pointer">
                  Has NDA
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasDpa"
                  checked={hasDpa}
                  onChange={(e) => setHasDpa(e.target.checked)}
                  className="rounded border-input"
                />
                <Label htmlFor="hasDpa" className="font-normal cursor-pointer">
                  Has DPA
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasSla"
                  checked={hasSla}
                  onChange={(e) => setHasSla(e.target.checked)}
                  className="rounded border-input"
                />
                <Label htmlFor="hasSla" className="font-normal cursor-pointer">
                  Has SLA
                </Label>
              </div>
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
