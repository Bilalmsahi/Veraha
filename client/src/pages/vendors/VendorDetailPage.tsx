import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ContextualHelpButton, PageHeader, ConfirmDialog, FormErrorAlert } from '@/components/shared';
import {
  CertificationPanel,
  EditVendorModal,
  VendorAssessmentModal,
} from '@/components/vendors';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useVendor,
  useDeleteVendor,
  useUpdateVendor,
} from '@/api/vendors';
import type { VendorDetail } from '@/api/vendors';
import type { RiskTier } from '@/types/enums';
import { formatDate } from '@/lib/formatters';
import { RISK_TIER_LABELS } from '@/lib/constants';
import { usePermissions } from '@/hooks/usePermissions';
import {
  ArrowLeft,
  MoreVertical,
  Circle,
  ArrowUp,
  ArrowDown,
  Minus,
  User,
  ClipboardCheck,
  Package,
  LayoutDashboard,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const RISK_TIER_OPTIONS: { value: RiskTier; label: string }[] = [
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
  { value: 'UNSCORED', label: 'Unscored' },
];

const DATA_TYPE_OPTIONS = [
  'PII',
  'PHI',
  'FINANCIAL',
  'CONFIDENTIAL',
  'PUBLIC',
  'Customer data',
  'Employee data',
];

function normalizeRiskTier(tier: string | undefined): RiskTier {
  if (!tier) return 'UNSCORED';
  const u = tier.toUpperCase();
  if (u === 'MED') return 'MEDIUM';
  if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNSCORED'].includes(u)) return u as RiskTier;
  return 'UNSCORED';
}

function RiskTierBadge({ tier }: { tier: RiskTier }) {
  const label = RISK_TIER_LABELS[tier] ?? 'Unscored';
  let Icon = Circle;
  let iconColor = 'text-muted-foreground';

  switch (tier) {
    case 'CRITICAL':
      Icon = Circle;
      iconColor = 'text-destructive fill-destructive';
      break;
    case 'HIGH':
      Icon = ArrowUp;
      iconColor = 'text-destructive';
      break;
    case 'MEDIUM':
      Icon = Minus;
      iconColor = 'text-amber-600 dark:text-amber-500';
      break;
    case 'LOW':
      Icon = ArrowDown;
      iconColor = 'text-green-600 dark:text-green-500';
      break;
    case 'UNSCORED':
    default:
      Icon = Circle;
      iconColor = 'text-muted-foreground fill-muted-foreground';
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-0.5 text-xs font-medium">
      <Icon className={cn('size-3 shrink-0', iconColor)} aria-hidden />
      {label}
    </span>
  );
}

function getStatusDisplay(status: string): string {
  if (status === 'ACTIVE' || status === 'UNDER_REVIEW') return 'Active';
  if (status === 'INACTIVE' || status === 'TERMINATED' || status === 'ARCHIVED') return 'Archived';
  return status;
}

function isActiveStatus(status: string): boolean {
  return status === 'ACTIVE' || status === 'UNDER_REVIEW';
}

const VENDOR_TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'about', label: 'About', icon: FileText },
  { id: 'risk', label: 'Risk management', icon: ShieldAlert },
  { id: 'security', label: 'Security review', icon: ClipboardCheck },
  { id: 'linked', label: 'Linked apps', icon: Package },
] as const;

export function VendorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const permissions = usePermissions();
  const [activeTab, setActiveTab] = useState<(typeof VENDOR_TABS)[number]['id']>('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const vendor = useVendor(id ?? null);
  const deleteVendor = useDeleteVendor();
  const updateVendor = useUpdateVendor();

  if (vendor.error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Vendor" />
        <FormErrorAlert
          message={(vendor.error as Error).message}
          onRetry={() => vendor.refetch()}
        />
      </div>
    );
  }

  if (vendor.isLoading || !vendor.data) {
    return <Skeleton className="h-96 w-full" />;
  }

  const v = vendor.data;
  const owner = typeof v.ownerId === 'object' ? v.ownerId : null;
  // const primary = v.primaryContact;
  // const security = v.securityContact;
  const riskTier = normalizeRiskTier(v.riskTier);
  const statusLabel = getStatusDisplay(v.status ?? 'ACTIVE');

  const handleArchive = () => {
    if (id) {
      updateVendor.mutate(
        { id, input: { status: 'ARCHIVED' } },
        { onSuccess: () => {} }
      );
    }
  };

  return (
    <div className="space-y-6 bg-background">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/vendors')}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground">Vendors</p>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{v.name}</h1>
              {v.category && (
                <p className="mt-1 text-sm text-muted-foreground">{v.category}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 text-xs font-medium',
                    isActiveStatus(v.status ?? '') ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'size-2 rounded-full',
                      isActiveStatus(v.status ?? '') ? 'bg-primary' : 'bg-muted-foreground'
                    )}
                  />
                  {statusLabel}
                </span>
                <RiskTierBadge tier={riskTier} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ContextualHelpButton moduleId="vendors" current={{ status: v.status }} />
              {(permissions.canEditVendors || permissions.canDeleteVendors) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {permissions.canEditVendors && (
                      <>
                        <DropdownMenuItem onClick={() => setEditOpen(true)}>
                          Edit vendor
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleArchive}>
                          Archive vendor
                        </DropdownMenuItem>
                      </>
                    )}
                    {permissions.canDeleteVendors && (
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteConfirm(true)}
                      >
                        Delete vendor
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border-b">
        <nav className="flex gap-4" aria-label="Vendor sections">
          {VENDOR_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors -mb-px',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <tab.icon className="size-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="space-y-6">
        {activeTab === 'overview' && <OverviewTab vendor={v} owner={owner} />}
        {activeTab === 'about' && (
          <AboutTab
            vendor={v}
            vendorId={id ?? ''}
            canEdit={permissions.canEditVendors}
            onSuccess={() => vendor.refetch()}
          />
        )}
        {activeTab === 'risk' && (
          <RiskManagementTab
            vendor={v}
            vendorId={id ?? ''}
            canEdit={permissions.canEditVendors}
            onSuccess={() => vendor.refetch()}
          />
        )}
        {activeTab === 'security' && (
          <SecurityReviewTab
            vendor={v}
            canEdit={permissions.canEditVendors}
            onRecordAssessment={() => setAssessmentOpen(true)}
          />
        )}
        {activeTab === 'linked' && <LinkedAppsTab />}
      </div>

      {permissions.canEditVendors && (
        <>
          <EditVendorModal
            vendor={v}
            open={editOpen}
            onOpenChange={setEditOpen}
            onSuccess={() => vendor.refetch()}
          />

          <VendorAssessmentModal
            vendor={v}
            open={assessmentOpen}
            onOpenChange={setAssessmentOpen}
            onSuccess={() => vendor.refetch()}
          />
        </>
      )}

      {permissions.canDeleteVendors && (
        <ConfirmDialog
          open={deleteConfirm}
          onOpenChange={setDeleteConfirm}
          title="Delete vendor"
          description={`Delete "${v.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={async () => {
            if (id) {
              await deleteVendor.mutateAsync(id);
              setDeleteConfirm(false);
              navigate('/vendors');
            }
          }}
          loading={deleteVendor.isPending}
        />
      )}
    </div>
  );
}

function OverviewTab({
  vendor,
  owner,
}: {
  vendor: VendorDetail;
  owner: { _id: string; firstName: string; lastName: string; email: string } | null;
}) {
  const statusLabel = getStatusDisplay(vendor.status ?? 'ACTIVE');
  const primary = vendor.primaryContact;
  const security = vendor.securityContact;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Name" value={vendor.name} />
          <Row label="Status" value={statusLabel} />
          <Row
            label="Website"
            value={
              vendor.website ? (
                <a
                  href={vendor.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {vendor.website}
                </a>
              ) : (
                '—'
              )
            }
          />
          <Row label="Category" value={vendor.category ?? '—'} />
          <Row
            label="Security owner"
            value={
              owner ? (
                <span className="inline-flex items-center gap-2">
                  <Avatar className="size-6">
                    <AvatarFallback className="text-xs">
                      {owner.firstName?.[0]}{owner.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  {owner.firstName} {owner.lastName}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <User className="size-4" />
                  Unassigned
                </span>
              )
            }
          />
          <Row
            label="Business owner"
            value={
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <User className="size-4" />
                Unassigned
              </span>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Point of Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {primary || security ? (
            <>
              {primary && (
                <div>
                  <p className="font-medium text-muted-foreground">Primary</p>
                  <p>
                    {[primary.name, primary.email, primary.phone].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
              )}
              {security && (
                <div>
                  <p className="font-medium text-muted-foreground">Security</p>
                  <p>
                    {[security.name, security.email, security.phone].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">No contacts added.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contract Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row
            label="Contract period"
            value={
              vendor.contractStartDate || vendor.contractEndDate
                ? `${formatDate(vendor.contractStartDate)} – ${formatDate(vendor.contractEndDate)}`
                : '—'
            }
          />
          <Row label="NDA" value={vendor.hasNda ? 'Yes' : 'No'} />
          <Row label="DPA" value={vendor.hasDpa ? 'Yes' : 'No'} />
          <Row label="SLA" value={vendor.hasSla ? 'Yes' : 'No'} />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function AboutTab({
  vendor,
  vendorId,
  canEdit,
  onSuccess,
}: {
  vendor: VendorDetail;
  vendorId: string;
  canEdit: boolean;
  onSuccess: () => void;
}) {
  const [description, setDescription] = useState(vendor.description ?? '');
  const [serviceType, setServiceType] = useState(vendor.serviceType ?? '');
  const updateVendor = useUpdateVendor();

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setDescription(vendor.description ?? '');
    setServiceType(vendor.serviceType ?? '');
  }, [vendor.description, vendor.serviceType]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleBlurDescription = () => {
    if (description === (vendor.description ?? '')) return;
    updateVendor.mutate(
      { id: vendorId, input: { description: description || undefined } },
      { onSuccess }
    );
  };

  const handleBlurServiceType = () => {
    if (serviceType === (vendor.serviceType ?? '')) return;
    updateVendor.mutate(
      { id: vendorId, input: { serviceType: serviceType || undefined } },
      { onSuccess }
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Description</CardTitle>
        </CardHeader>
        <CardContent>
          {canEdit ? (
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleBlurDescription}
              placeholder="Add a description..."
              rows={4}
              className="resize-none"
              disabled={updateVendor.isPending}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {description || 'No description added.'}
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Services Provided</CardTitle>
        </CardHeader>
        <CardContent>
          {canEdit ? (
            <Textarea
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              onBlur={handleBlurServiceType}
              placeholder="e.g. Cloud hosting, HR software"
              rows={3}
              className="resize-none"
              disabled={updateVendor.isPending}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {serviceType || 'No services listed.'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RiskManagementTab({
  vendor,
  vendorId,
  canEdit,
  onSuccess,
}: {
  vendor: VendorDetail;
  vendorId: string;
  canEdit: boolean;
  onSuccess: () => void;
}) {
  const riskTier = normalizeRiskTier(vendor.riskTier);
  const updateVendor = useUpdateVendor();
  const [dataTypes, setDataTypes] = useState<string[]>(vendor.dataTypes ?? []);
  const [dataShared, setDataShared] = useState<string[]>(vendor.dataShared ?? []);
  const [newDataType, setNewDataType] = useState('');
  const [newDataShared, setNewDataShared] = useState('');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setDataTypes(vendor.dataTypes ?? []);
    setDataShared(vendor.dataShared ?? []);
  }, [vendor.dataTypes, vendor.dataShared]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleRiskTierChange = (value: string) => {
    updateVendor.mutate(
      { id: vendorId, input: { riskTier: value as RiskTier } },
      { onSuccess }
    );
  };

  const addDataType = (item: string) => {
    const trimmed = item.trim();
    if (!trimmed || dataTypes.includes(trimmed)) return;
    const next = [...dataTypes, trimmed];
    setDataTypes(next);
    updateVendor.mutate(
      { id: vendorId, input: { dataTypes: next } },
      { onSuccess }
    );
    setNewDataType('');
  };

  const removeDataType = (item: string) => {
    const next = dataTypes.filter((x) => x !== item);
    setDataTypes(next);
    updateVendor.mutate(
      { id: vendorId, input: { dataTypes: next } },
      { onSuccess }
    );
  };

  const addDataShared = (item: string) => {
    const trimmed = item.trim();
    if (!trimmed || dataShared.includes(trimmed)) return;
    const next = [...dataShared, trimmed];
    setDataShared(next);
    updateVendor.mutate(
      { id: vendorId, input: { dataShared: next } },
      { onSuccess }
    );
    setNewDataShared('');
  };

  const removeDataShared = (item: string) => {
    const next = dataShared.filter((x) => x !== item);
    setDataShared(next);
    updateVendor.mutate(
      { id: vendorId, input: { dataShared: next } },
      { onSuccess }
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inherent risk score</CardTitle>
        </CardHeader>
        <CardContent>
          {canEdit ? (
            <Select value={riskTier} onValueChange={handleRiskTierChange}>
              <SelectTrigger className="w-[200px]">
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
          ) : (
            <RiskTierBadge tier={riskTier} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Types of data processed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {dataTypes.map((item) => (
              <BadgePill
                key={item}
                label={item}
                onRemove={canEdit ? () => removeDataType(item) : undefined}
              />
            ))}
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              {DATA_TYPE_OPTIONS.filter((o) => !dataTypes.includes(o)).map((opt) => (
                <Button
                  key={opt}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addDataType(opt)}
                >
                  + {opt}
                </Button>
              ))}
              <input
                type="text"
                value={newDataType}
                onChange={(e) => setNewDataType(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addDataType(newDataType);
                  }
                }}
                placeholder="Add custom..."
                className="h-8 w-32 rounded-md border bg-background px-2 text-sm"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data shared with vendor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {dataShared.map((item) => (
              <BadgePill
                key={item}
                label={item}
                onRemove={canEdit ? () => removeDataShared(item) : undefined}
              />
            ))}
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newDataShared}
                onChange={(e) => setNewDataShared(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addDataShared(newDataShared);
                  }
                }}
                placeholder="Add item..."
                className="h-8 flex-1 max-w-xs rounded-md border bg-background px-2 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addDataShared(newDataShared)}
              >
                Add
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BadgePill({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-sm">
      {label}
      {onRemove && (
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-muted-foreground/20"
        aria-label={`Remove ${label}`}
      >
        ×
      </button>
      )}
    </span>
  );
}

function SecurityReviewTab({
  vendor,
  canEdit,
  onRecordAssessment,
}: {
  vendor: VendorDetail;
  canEdit: boolean;
  onRecordAssessment: () => void;
}) {
  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={onRecordAssessment}>
            <ClipboardCheck className="mr-2 size-4" />
            Record assessment
          </Button>
        </div>
      )}
      <CertificationPanel vendor={vendor} canEdit={canEdit} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assessment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Next assessment date:</span>{' '}
            {formatDate(vendor.nextAssessmentDate) || '—'}
          </p>
          <p className="text-muted-foreground">
            Record an assessment to update risk tier and set the next review date.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function LinkedAppsTab() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16">
        <Package className="size-12 text-muted-foreground" />
        <p className="mt-4 text-center text-sm font-medium">No linked applications</p>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Application discovery is not enabled.
        </p>
      </CardContent>
    </Card>
  );
}
