import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog, EnumBadge } from '@/components/shared';
import {
  getPolicyStatus,
  useDepartEmployee,
  useLinkHrProfileControls,
  useUnlinkHrProfileControl,
  type HrProfile,
  type PolicyStatus,
} from '@/api/integrations';
import { LinkedControlsList } from '@/components/integrations/LinkedControlsList';
import { formatDate } from '@/lib/formatters';
import { FileText, Shield, UserX } from 'lucide-react';

type HrProfileDrawerProps = {
  profile: HrProfile | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

const EMPLOYMENT_STATUS_LABELS: Record<HrProfile['employmentStatus'], { label: string; tone: 'success' | 'warning' | 'error' }> = {
  active: { label: 'Active', tone: 'success' },
  on_leave: { label: 'On Leave', tone: 'warning' },
  departed: { label: 'Departed', tone: 'error' },
};

const HR_SOURCE_LABELS: Record<HrProfile['hrSource'], string> = {
  manual: 'Manual',
  bamboohr_import: 'BambooHR',
  rippling_import: 'Rippling',
};

const BACKGROUND_CHECK_LABELS: Record<HrProfile['backgroundCheckStatus'], { label: string; tone: 'success' | 'warning' | 'error' | 'muted' }> = {
  pending: { label: 'Pending', tone: 'warning' },
  completed: { label: 'Completed', tone: 'success' },
  not_required: { label: 'Not required', tone: 'muted' },
  failed: { label: 'Failed', tone: 'error' },
};

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="break-words text-sm">{children}</div>
    </div>
  );
}

function PolicyStatTiles({ policyStatus }: { policyStatus: PolicyStatus }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Policies</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{policyStatus.total}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Acknowledged</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{policyStatus.acknowledged}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export function HrProfileDrawer({ profile, open, onOpenChange }: HrProfileDrawerProps) {
  const [activeTab, setActiveTab] = useState('details');
  const [departConfirmOpen, setDepartConfirmOpen] = useState(false);
  const departMutation = useDepartEmployee();

  const policyStatusQuery = useQuery({
    queryKey: ['policy-status', profile?._id],
    queryFn: () => getPolicyStatus(profile!._id),
    enabled: open && activeTab === 'policies' && !!profile?._id,
  });

  const linkControls = useLinkHrProfileControls();
  const unlinkControl = useUnlinkHrProfileControl();

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setActiveTab('details');
      setDepartConfirmOpen(false);
    }
    onOpenChange(next);
  };

  if (!profile) return null;

  const statusConfig = EMPLOYMENT_STATUS_LABELS[profile.employmentStatus];
  const bgCheckConfig = BACKGROUND_CHECK_LABELS[profile.backgroundCheckStatus];

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <SheetHeader className="border-b">
            <SheetTitle className="break-words pr-8">{profile.fullName}</SheetTitle>
            <SheetDescription className="break-all">{profile.workEmail}</SheetDescription>
          </SheetHeader>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex min-w-0 flex-1 flex-col overflow-hidden"
          >
            <div className="px-4 pt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="policies">Policies</TabsTrigger>
                <TabsTrigger value="controls">Controls</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent
              value="details"
              className="mt-4 min-w-0 flex-1 space-y-6 overflow-y-auto px-4 pb-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailField label="Full Name">{profile.fullName}</DetailField>
                <DetailField label="Work Email">{profile.workEmail}</DetailField>
                <DetailField label="Department">{profile.department || '—'}</DetailField>
                <DetailField label="Job Title">{profile.jobTitle || '—'}</DetailField>
                <DetailField label="Status">
                  <EnumBadge label={statusConfig.label} softTone={statusConfig.tone} />
                </DetailField>
                <DetailField label="Start Date">{formatDate(profile.startDate)}</DetailField>
                {profile.employmentStatus === 'departed' && (
                  <DetailField label="End Date">{formatDate(profile.endDate)}</DetailField>
                )}
                <DetailField label="HR Source">
                  <EnumBadge label={HR_SOURCE_LABELS[profile.hrSource]} softTone="info" />
                </DetailField>
                <DetailField label="Background Check">
                  <EnumBadge label={bgCheckConfig.label} softTone={bgCheckConfig.tone} />
                </DetailField>
              </div>

              <DetailField label="Platform Link">
                {profile.userId ? (
                  <span className="inline-flex items-center gap-1.5 text-[var(--color-success)]">
                    <Shield className="size-4" />
                    Linked to platform user
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <UserX className="size-4" />
                    Not linked to a platform account
                  </span>
                )}
              </DetailField>

              {profile.employmentStatus !== 'departed' && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDepartConfirmOpen(true)}
                >
                  Mark Departed
                </Button>
              )}
            </TabsContent>

            <TabsContent
              value="policies"
              className="mt-4 min-w-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4"
            >
              {policyStatusQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading policy status...</p>
              ) : policyStatusQuery.error ? (
                <p className="text-sm text-destructive">{(policyStatusQuery.error as Error).message}</p>
              ) : policyStatusQuery.data?.unlinked ? (
                <div className="flex gap-3 rounded-md border border-border/80 bg-muted/40 p-4">
                  <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No platform account linked. Policy attestation status is only available for profiles
                    linked to a platform user.
                  </p>
                </div>
              ) : policyStatusQuery.data ? (
                <PolicyStatTiles policyStatus={policyStatusQuery.data} />
              ) : null}
            </TabsContent>

            <TabsContent
              value="controls"
              className="mt-4 min-w-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4"
            >
              <LinkedControlsList
                linkedControlIds={profile.linkedControlIds ?? []}
                onLink={(controlIds) =>
                  linkControls.mutate({ id: profile._id, controlIds })
                }
                onUnlink={(controlId) =>
                  unlinkControl.mutate({ id: profile._id, controlId })
                }
                isLinking={linkControls.isPending}
                isUnlinking={unlinkControl.isPending}
                pickerTitle="Link controls to HR profile"
                pickerDescription="Select controls this employee is responsible for or attests to."
                emptyMessage="No controls linked — link controls so this employee appears as compliance evidence."
              />
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={departConfirmOpen}
        onOpenChange={setDepartConfirmOpen}
        title="Mark employee as departed"
        description={`Are you sure you want to mark ${profile.fullName} as departed? This will update their employment status.`}
        confirmLabel="Mark departed"
        onConfirm={() => {
          departMutation.mutate(
            { id: profile._id },
            {
              onSuccess: () => {
                setDepartConfirmOpen(false);
                onOpenChange(false);
              },
            }
          );
        }}
        loading={departMutation.isPending}
      />
    </>
  );
}
