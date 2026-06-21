import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  FileText,
  Laptop,
  Pencil,
  Plus,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import { DeviceSettingsForm, ChecklistItemPanel } from '@/components/devices';
import { DeviceControlsPanel } from '@/components/devices/DeviceControlsPanel';
import {
  DeviceSettingsChecklistFields,
  complianceToChecklistState,
  checklistStateToCompliance,
  checklistStateToSubmission,
  hasChecklistActivity,
  emptyChecklistState,
  useDeviceSettingsChecklistState,
} from '@/components/devices';
import {
  DEVICE_SETTINGS_CHECKLIST,
  getChecklistItemStatus,
} from '@/constants/deviceSettingsChecklist';
import type { DeviceSettingsChecklistState } from '@/components/devices/DeviceSettingsChecklistFields';
import { ContextualHelpButton, PageHeader, DataTable, TableSkeleton, EmptyState, ConfirmDialog, FormErrorAlert, Pagination } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  getAssignedUserName,
  isDeviceCompliant,
  useCreateDevice,
  useDeleteDevice,
  useDeleteDeviceEvidence,
  useDevice,
  useDevices,
  useDeviceStats,
  useUpdateDevice,
  useSubmitDeviceSettings,
  type Device,
  type DeviceEvidence,
  type DeviceInput,
  type DeviceOs,
} from '@/api/devices';
import { useReviewDeviceSubmission } from '@/api/personnelTasks';
import { useAuthStore } from '@/store/useAuthStore';
import { useUsers } from '@/api/users';
import { formatDate, formatDateTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';

const OS_OPTIONS: DeviceOs[] = ['macOS', 'Windows', 'Linux', 'Other'];

type ComplianceFilter = 'all' | 'compliant' | 'issues';

const emptyForm: DeviceInput = {
  name: '',
  assignedUserId: '',
  os: 'macOS',
  serialNumber: '',
  compliance: {
    antivirusInstalled: false,
    diskEncryptionEnabled: false,
    screenLockEnabled: false,
    passwordManagerInstalled: false,
  },
  notes: '',
};

function getAssignedUserId(device?: Device | null) {
  if (!device) return '';
  return typeof device.assignedUserId === 'string'
    ? device.assignedUserId
    : device.assignedUserId?._id ?? '';
}

function toFormInput(device?: Device | null): DeviceInput {
  if (!device) return emptyForm;
  return {
    name: device.name,
    assignedUserId: getAssignedUserId(device),
    os: device.os,
    serialNumber: device.serialNumber ?? '',
    compliance: {
      antivirusInstalled: Boolean(device.compliance?.antivirusInstalled),
      diskEncryptionEnabled: Boolean(device.compliance?.diskEncryptionEnabled),
      screenLockEnabled: Boolean(device.compliance?.screenLockEnabled),
      passwordManagerInstalled: Boolean(device.compliance?.passwordManagerInstalled),
    },
    notes: device.notes ?? '',
  };
}

function checklistSubmissionNeeded(
  state: DeviceSettingsChecklistState,
  initial: DeviceSettingsChecklistState,
  isEditing: boolean
) {
  if (!hasChecklistActivity(state)) return false;
  if (!isEditing) return true;

  return DEVICE_SETTINGS_CHECKLIST.some((item) => {
    const current = state[item.key];
    const baseline = initial[item.key];
    return current.checked !== baseline.checked || Boolean(current.file);
  });
}

function CheckCell({ value }: { value: boolean }) {
  return value ? (
    <CheckCircle2 className="size-4 text-green-600 dark:text-green-500" aria-label="Passing" />
  ) : (
    <XCircle className="size-4 text-destructive" aria-label="Failing" />
  );
}

function OverallComplianceBadge({ status }: { status?: Device['overallComplianceStatus'] }) {
  if (!status) return <span className="text-sm text-muted-foreground">—</span>;

  const config = {
    compliant: {
      label: 'Compliant',
      className: 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400',
    },
    non_compliant: {
      label: 'Non-compliant',
      className: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400',
    },
    needs_review: {
      label: 'Needs review',
      className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400',
    },
  }[status];

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

function StatCard({
  title,
  value,
  tone = 'default',
}: {
  title: string;
  value: number;
  tone?: 'default' | 'success' | 'warning';
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            'text-2xl font-semibold',
            tone === 'success' && 'text-green-600 dark:text-green-500',
            tone === 'warning' && 'text-amber-600 dark:text-amber-500'
          )}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

type AddEditDeviceModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device?: Device | null;
  onSuccess?: () => void;
};

function AddEditDeviceModal({
  open,
  onOpenChange,
  device,
  onSuccess,
}: AddEditDeviceModalProps) {
  const [form, setForm] = useState<DeviceInput>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [initialChecklist, setInitialChecklist] = useState(emptyChecklistState());
  const users = useUsers({ limit: 100, sortBy: 'firstName', sortOrder: 'asc' });
  const create = useCreateDevice();
  const update = useUpdateDevice();
  const submitSettings = useSubmitDeviceSettings();
  const checklist = useDeviceSettingsChecklistState();
  const isEditing = Boolean(device?._id);
  const isPending = create.isPending || update.isPending || submitSettings.isPending;
  const apiError = create.error || update.error || submitSettings.error;

  useEffect(() => {
    if (open) {
      const nextForm = toFormInput(device);
      const nextChecklist = complianceToChecklistState(nextForm.compliance);
      setForm(nextForm);
      checklist.reset(nextChecklist);
      setInitialChecklist(nextChecklist);
      setErrors({});
      setSubmitError(null);
    }
  }, [device, open]);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Device name is required.';
    if (!form.assignedUserId) next.assignedUserId = 'Assigned user is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validate() || checklist.hasErrors) return;

    setSubmitError(null);

    const payload: DeviceInput = {
      ...form,
      name: form.name.trim(),
      serialNumber: form.serialNumber?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
      compliance: checklistStateToCompliance(checklist.state),
    };

    try {
      let deviceId = device?._id;

      if (deviceId) {
        await update.mutateAsync({ id: deviceId, input: payload });
      } else {
        const created = await create.mutateAsync(payload);
        deviceId = created._id;
      }

      if (
        deviceId &&
        checklistSubmissionNeeded(checklist.state, initialChecklist, isEditing)
      ) {
        await submitSettings.mutateAsync({
          deviceId,
          submission: checklistStateToSubmission(checklist.state),
        });
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      setSubmitError((error as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit device' : 'Add device'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {(apiError || submitError) && (
            <FormErrorAlert message={submitError || (apiError as Error).message} />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="device-name">Device name</Label>
              <Input
                id="device-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="e.g. Aisha-MacBook-Pro"
                aria-invalid={Boolean(errors.name)}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="assigned-user">Assigned user</Label>
              <Select
                value={form.assignedUserId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, assignedUserId: value }))}
              >
                <SelectTrigger id="assigned-user" aria-invalid={Boolean(errors.assignedUserId)}>
                  <SelectValue placeholder={users.isLoading ? 'Loading users...' : 'Select user'} />
                </SelectTrigger>
                <SelectContent>
                  {(users.data?.users ?? []).map((user) => {
                    const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email;
                    return (
                      <SelectItem key={user._id} value={user._id}>
                        {name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {errors.assignedUserId && (
                <p className="text-xs text-destructive">{errors.assignedUserId}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="device-os">Operating system</Label>
              <Select
                value={form.os}
                onValueChange={(value) => setForm((prev) => ({ ...prev, os: value as DeviceOs }))}
              >
                <SelectTrigger id="device-os">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OS_OPTIONS.map((os) => (
                    <SelectItem key={os} value={os}>
                      {os}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="serial-number">Serial number</Label>
              <Input
                id="serial-number"
                value={form.serialNumber ?? ''}
                onChange={(event) => setForm((prev) => ({ ...prev, serialNumber: event.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Device security checklist</Label>
            <p className="text-xs text-muted-foreground">
              Check completed settings and optionally attach proof screenshots or PDFs for each item.
            </p>
            <DeviceSettingsChecklistFields
              idPrefix="add-device-proof"
              state={checklist.state}
              fileErrors={checklist.fileErrors}
              onCheckedChange={checklist.setChecked}
              onFileChange={checklist.setFile}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="device-notes">Notes</Label>
            <Textarea
              id="device-notes"
              value={form.notes ?? ''}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Optional compliance notes"
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type DeviceDetailSheetProps = {
  deviceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (device: Device) => void;
};

function SubmissionCard({
  item,
  deviceId,
  isAdmin,
  onDelete,
}: {
  item: DeviceEvidence;
  deviceId: string;
  isAdmin: boolean;
  onDelete: (id: string) => void;
}) {
  const reviewMutation = useReviewDeviceSubmission();
  const [reviewNote, setReviewNote] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const isPending = item.reviewStatus === 'SUBMITTED' || !item.reviewStatus;

  const handleReview = async (status: 'APPROVED' | 'REJECTED') => {
    await reviewMutation.mutateAsync({ evidenceId: item._id, status, note: reviewNote });
    setReviewOpen(false);
    setReviewNote('');
  };

  const statusBadge = () => {
    if (item.reviewStatus === 'APPROVED') return <Badge variant="default">Approved</Badge>;
    if (item.reviewStatus === 'REJECTED') return <Badge variant="destructive">Rejected</Badge>;
    if (item.reviewStatus === 'SUBMITTED') return <Badge variant="secondary">Awaiting review</Badge>;
    return null;
  };

  return (
    <div className="rounded-md border">
      {/* Card header */}
      <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="font-medium">{item.label}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{formatDate(item.uploadedAt)}</span>
            {statusBadge()}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(item._id)}
          aria-label="Delete submission"
          className="shrink-0"
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>

      {/* Checklist proof panels — shown expanded for admins */}
      {(item.checklistItems?.length ?? 0) > 0 && (
        <>
          <Separator />
          <div className="space-y-2 p-3">
            {(item.checklistItems ?? []).map((entry) => (
              <ChecklistItemPanel
                key={entry.key}
                deviceId={deviceId}
                evidenceId={item._id}
                label={entry.label}
                status={getChecklistItemStatus({ checked: entry.checked, evidenceFileId: entry.evidenceFileId })}
                evidenceFileId={entry.evidenceFileId}
                evidenceFile={entry.evidenceFile}
              />
            ))}
          </div>
        </>
      )}

      {/* Admin approve / reject */}
      {isAdmin && isPending && (
        <>
          <Separator />
          <div className="space-y-3 p-3">
            {!reviewOpen ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleReview('APPROVED')}
                  disabled={reviewMutation.isPending}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setReviewOpen(true)}
                >
                  Add note & decide
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Optional review note for the audit trail"
                  rows={2}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleReview('APPROVED')}
                    disabled={reviewMutation.isPending}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleReview('REJECTED')}
                    disabled={reviewMutation.isPending}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setReviewOpen(false); setReviewNote(''); }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function DeviceDetailSheet({ deviceId, open, onOpenChange, onEdit }: DeviceDetailSheetProps) {
  const device = useDevice(deviceId, open);
  const deleteEvidence = useDeleteDeviceEvidence();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER';
  const [evidenceToDelete, setEvidenceToDelete] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const detail = device.data;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{detail?.name ?? 'Device detail'}</SheetTitle>
          <SheetDescription>Manual endpoint compliance record and proof files.</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-6">
          {device.isLoading ? (
            <TableSkeleton rows={4} columns={2} />
          ) : device.error ? (
            <FormErrorAlert message={(device.error as Error).message} onRetry={() => device.refetch()} />
          ) : detail ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['Assigned user', getAssignedUserName(detail.assignedUserId)],
                  ['Operating system', detail.os],
                  ['Serial number', detail.serialNumber || 'Not provided'],
                  ['Last updated', formatDateTime(detail.lastUpdated)],
                ].map(([labelText, value]) => (
                  <div key={labelText} className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">{labelText}</p>
                    <p className="mt-1 text-sm font-medium break-words">{value}</p>
                  </div>
                ))}
              </div>

              {detail.notes && (
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{detail.notes}</p>
                </div>
              )}

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">Compliance status</h3>
                  <Button size="sm" variant="outline" onClick={() => onEdit(detail)}>
                    <Pencil className="mr-2 size-4" />
                    Edit
                  </Button>
                </div>
                <div className="space-y-2">
                  {[
                    ['Disk encrypted', detail.compliance.diskEncryptionEnabled],
                    ['Screenlock enabled', detail.compliance.screenLockEnabled],
                    ['Antivirus installed', detail.compliance.antivirusInstalled],
                    ['Password manager', detail.compliance.passwordManagerInstalled],
                  ].map(([labelText, passing]) => (
                    <div key={labelText as string} className="flex items-center justify-between rounded-md border p-3">
                      <span className="text-sm">{labelText}</span>
                      <Badge variant={passing ? 'default' : 'destructive'}>
                        {passing ? 'Passing' : 'Failing'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">Device settings task</h3>
                  <Button size="sm" onClick={() => setSettingsOpen(true)}>
                    Submit settings
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Confirm disk encryption, screen lock, antivirus, and password manager. Optional proof can be attached per item.
                </p>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold">Controls & Evidence</h3>

                <DeviceControlsPanel
                  deviceId={detail._id}
                  linkedControlIds={detail.linkedControlIds ?? []}
                  organizationId={detail.organizationId}
                />

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-medium">Submission history</h4>
                    {isAdmin && detail.evidence.some(
                      (e) => !e.reviewStatus || e.reviewStatus === 'SUBMITTED'
                    ) && (
                      <Badge variant="secondary" className="text-xs">
                        {detail.evidence.filter((e) => !e.reviewStatus || e.reviewStatus === 'SUBMITTED').length} pending
                      </Badge>
                    )}
                  </div>

                  {detail.evidence.length === 0 ? (
                    <EmptyState
                      icon={FileText}
                      title="No submissions yet"
                      description="Complete the device settings checklist to submit your attestation."
                      className="py-10"
                    />
                  ) : (
                    <div className="space-y-3">
                      {detail.evidence.map((item) => (
                        <SubmissionCard
                          key={item._id}
                          item={item}
                          deviceId={detail._id}
                          isAdmin={isAdmin}
                          onDelete={setEvidenceToDelete}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </>
          ) : null}
        </div>

        <ConfirmDialog
          open={Boolean(evidenceToDelete)}
          onOpenChange={(next) => !next && setEvidenceToDelete(null)}
          title="Delete evidence?"
          description="This removes the uploaded proof file from this device."
          confirmLabel="Delete"
          loading={deleteEvidence.isPending}
          onConfirm={async () => {
            if (deviceId && evidenceToDelete) {
              await deleteEvidence.mutateAsync({ deviceId, evidenceId: evidenceToDelete });
              setEvidenceToDelete(null);
            }
          }}
        />
      </SheetContent>
    </Sheet>

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Device settings</SheetTitle>
            <SheetDescription>
              Check each completed setting and optionally attach proof screenshots or PDFs.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {deviceId && (
              <DeviceSettingsForm
                deviceId={deviceId}
                deviceName={detail?.name}
                onSuccess={() => {
                  setSettingsOpen(false);
                  device.refetch();
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function DevicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ComplianceFilter>('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [settingsDeviceId, setSettingsDeviceId] = useState<string | null>(null);
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null);

  useEffect(() => {
    const deviceId = searchParams.get('deviceId');
    const openSettings = searchParams.get('settings') === '1';
    if (deviceId) {
      if (openSettings) {
        setSettingsDeviceId(deviceId);
      } else {
        setSelectedDeviceId(deviceId);
      }
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('deviceId');
        next.delete('settings');
        return next;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const params = useMemo(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      complianceStatus: status,
      sortBy: 'name',
      sortOrder: 'asc' as const,
    }),
    [limit, page, search, status]
  );

  const devices = useDevices(params);
  const stats = useDeviceStats();
  const deleteDevice = useDeleteDevice();
  const rows = devices.data?.devices ?? [];

  const columns: Column<Device>[] = [
    {
      key: 'name',
      header: 'Device name',
      width: '20%',
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-medium line-clamp-1 break-words">{row.name}</p>
          {row.serialNumber && <p className="text-xs text-muted-foreground line-clamp-1">{row.serialNumber}</p>}
        </div>
      ),
    },
    {
      key: 'assignedUser',
      header: 'Assigned user',
      width: '17%',
      cell: (row) => <span className="text-sm">{getAssignedUserName(row.assignedUserId)}</span>,
    },
    {
      key: 'os',
      header: 'OS',
      width: '9%',
      cell: (row) => <span className="text-sm">{row.os}</span>,
    },
    {
      key: 'antivirus',
      header: 'Antivirus',
      width: '10%',
      cell: (row) => <CheckCell value={row.compliance.antivirusInstalled} />,
    },
    {
      key: 'encrypted',
      header: 'Encrypted',
      width: '10%',
      cell: (row) => <CheckCell value={row.compliance.diskEncryptionEnabled} />,
    },
    {
      key: 'screenlock',
      header: 'Screenlock',
      width: '9%',
      cell: (row) => <CheckCell value={row.compliance.screenLockEnabled} />,
    },
    {
      key: 'passwordManager',
      header: 'Password mgr',
      width: '9%',
      cell: (row) => <CheckCell value={row.compliance.passwordManagerInstalled} />,
    },
    {
      key: 'overallStatus',
      header: 'Status',
      width: '11%',
      cell: (row) => <OverallComplianceBadge status={row.overallComplianceStatus} />,
    },
    {
      key: 'lastUpdated',
      header: 'Last updated',
      width: '10%',
      cell: (row) => <span className="text-sm text-muted-foreground">{formatDate(row.lastUpdated)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '11%',
      cell: (row) => (
        <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setEditingDevice(row);
              setModalOpen(true);
            }}
            aria-label="Edit device"
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeviceToDelete(row)}
            aria-label="Delete device"
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const openAddModal = () => {
    setEditingDevice(null);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Devices"
        description="Register devices and track manual endpoint compliance proof."
        actions={
          <div className="flex flex-wrap gap-2">
            <ContextualHelpButton moduleId="devices" label="Status guide" />
            <Button size="sm" onClick={openAddModal}>
              <Plus className="mr-2 size-4" />
              Add device
            </Button>
          </div>
        }
      />

      {devices.error && (
        <FormErrorAlert message={(devices.error as Error).message} onRetry={() => devices.refetch()} />
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total devices" value={stats.data?.total ?? 0} />
        <StatCard title="Compliant devices" value={stats.data?.compliant ?? 0} tone="success" />
        <StatCard title="Devices with issues" value={stats.data?.issues ?? 0} tone="warning" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search devices or users"
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as ComplianceFilter);
            setPage(1);
          }}
        >
          <SelectTrigger size="sm" className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All devices</SelectItem>
            <SelectItem value="compliant">Compliant</SelectItem>
            <SelectItem value="issues">Issues</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {devices.isLoading ? (
        <TableSkeleton rows={8} columns={8} />
      ) : rows.length === 0 && !search && status === 'all' ? (
        <EmptyState
          icon={Laptop}
          title="No devices registered"
          description="Add employee endpoints and record antivirus, encryption, and screenlock status."
          action={{ label: 'Add your first device', onClick: openAddModal }}
        />
      ) : (
        <>
          <DataTable
            data={rows}
            columns={columns}
            keyExtractor={(row) => row._id}
            onRowClick={(row) => setSelectedDeviceId(row._id)}
            emptyMessage="No devices match your filters."
            emptyDescription="Try another search or compliance status."
            emptyIcon={Laptop}
          />

          {devices.data?.pagination && (
            <Pagination
              page={devices.data.pagination.page}
              limit={limit}
              total={devices.data.pagination.total}
              pages={devices.data.pagination.pages}
              hasPrevPage={devices.data.pagination.hasPrevPage}
              hasNextPage={devices.data.pagination.hasNextPage}
              onPageChange={setPage}
              onLimitChange={(nextLimit) => {
                setLimit(nextLimit);
                setPage(1);
              }}
              entityLabel="devices"
            />
          )}
        </>
      )}

      <AddEditDeviceModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        device={editingDevice}
        onSuccess={() => setEditingDevice(null)}
      />

      <DeviceDetailSheet
        deviceId={selectedDeviceId}
        open={Boolean(selectedDeviceId)}
        onOpenChange={(open) => !open && setSelectedDeviceId(null)}
        onEdit={(device) => {
          setEditingDevice(device);
          setModalOpen(true);
        }}
      />

      <Sheet open={Boolean(settingsDeviceId)} onOpenChange={(open) => !open && setSettingsDeviceId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Device settings</SheetTitle>
            <SheetDescription>
              Check each completed setting and optionally attach proof screenshots or PDFs.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {settingsDeviceId && (
              <DeviceSettingsForm
                deviceId={settingsDeviceId}
                onSuccess={() => setSettingsDeviceId(null)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={Boolean(deviceToDelete)}
        onOpenChange={(open) => !open && setDeviceToDelete(null)}
        title="Delete device?"
        description={`This will remove ${deviceToDelete?.name ?? 'this device'} and its compliance record.`}
        confirmLabel="Delete"
        loading={deleteDevice.isPending}
        onConfirm={async () => {
          if (deviceToDelete) {
            await deleteDevice.mutateAsync(deviceToDelete._id);
            setDeviceToDelete(null);
            if (selectedDeviceId === deviceToDelete._id) setSelectedDeviceId(null);
          }
        }}
      />
    </div>
  );
}
