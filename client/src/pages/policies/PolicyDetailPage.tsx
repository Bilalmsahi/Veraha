import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ContextualHelpButton, PageHeader, DetailPageHeader } from '@/components/shared';
import {
  usePolicy,
  useAttestations,
  useAcknowledgePolicyWorkflow,
  usePolicyTargetUsers,
} from '@/api/policies';
import {
  PolicyVersionPanel,
  PolicyCommentsPanel,
  PolicyControlsPanel,
  EditPolicyModal,
  EditRecurrenceModal,
  FrameworksPopover,
  PolicyLinkControlsModal,
} from '@/components/policies';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FormErrorAlert } from '@/components/shared';
import { useAuthStore } from '@/store/useAuthStore';
import { usePermissions } from '@/hooks/usePermissions';
import { formatDate, formatFrameworkCode } from '@/lib/formatters';
import { ArrowLeft, CheckCircle, Pencil, FileText, Shield, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AcknowledgementProgress } from '@/components/policies/AcknowledgementProgress';

const TABS = [
  { id: 'versions', label: 'Policy versions', icon: FileText },
  { id: 'controls', label: 'Controls', icon: Shield },
  { id: 'audits', label: 'Audits', icon: Shield },
  { id: 'comments', label: 'Comments', icon: MessageSquare },
] as const;

export function PolicyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['id']>('versions');
  const [editOpen, setEditOpen] = useState(false);
  const [recurrenceOpen, setRecurrenceOpen] = useState(false);
  const [linkControlsOpen, setLinkControlsOpen] = useState(false);

  const policy = usePolicy(id ?? null);
  const attestations = useAttestations(id ?? null, { page: 1 });
  const targetUsers = usePolicyTargetUsers(id ?? null);
  const acknowledgePolicy = useAcknowledgePolicyWorkflow();
  const currentUser = useAuthStore((s) => s.user);
  const permissions = usePermissions();

  const handleAttest = () => {
    if (!id) return;
    acknowledgePolicy.mutate(id, { onSuccess: () => {} });
  };

  if (policy.error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Policy" />
        <FormErrorAlert
          message={(policy.error as Error).message}
          onRetry={() => policy.refetch()}
        />
      </div>
    );
  }

  if (policy.isLoading || !policy.data) {
    return <Skeleton className="h-96 w-full" />;
  }

  const p = policy.data;
  const linkedControls = (p.linkedControlIds ?? []) as Array<
    { _id: string; identifier?: string; title?: string } | string
  >;
  const controlIds = linkedControls.map((c) =>
    typeof c === 'object' && c && '_id' in c ? c._id : String(c)
  );
  const frameworks = (p.frameworkIds ?? []) as Array<{ _id?: string; code?: string; name?: string }>;
  const acknowledgementRate = Number(p.acknowledgementRate ?? 0);
  const hasPendingAttestation = p.status === 'ACTIVE' && p.requiresAttestation && acknowledgementRate < 100;
  const effectiveStatus = p.status;
  // Vanta-style status: OK for ACTIVE, Needs remediation for DRAFT/other
  const statusLabel =
    hasPendingAttestation
      ? 'Pending attestation'
      : effectiveStatus === 'ACTIVE'
      ? 'OK'
      : effectiveStatus === 'ARCHIVED'
        ? 'Archived'
        : 'Needs remediation';

  const scopedTargetUsers = (targetUsers.data ?? []).map((u) => ({
    _id: String(u._id),
    firstName: u.firstName ?? '',
    lastName: u.lastName ?? '',
    email: u.email ?? '',
    role: u.role ?? '',
  }));
  const requiredUserIds = scopedTargetUsers.map((u) => u._id);
  const attestedUserIds = (attestations.data?.attestations ?? [])
    .map((a) => {
      const u = a.userId as unknown;
      if (u && typeof u === 'object' && '_id' in u) return String((u as { _id: string })._id);
      return a.userId ? String(a.userId) : '';
    })
    .filter(Boolean);
  const currentUserId = currentUser?._id ? String(currentUser._id) : '';
  const currentUserHasAcknowledged = currentUserId ? attestedUserIds.includes(currentUserId) : false;
  const currentUserAttestation = currentUserId
    ? (attestations.data?.attestations ?? []).find((a) => {
        const u = a.userId as unknown;
        const uid =
          u && typeof u === 'object' && '_id' in u
            ? String((u as { _id: string })._id)
            : a.userId
              ? String(a.userId)
              : '';
        return uid === currentUserId;
      })
    : undefined;
  return (
    <div className="space-y-6 bg-background">
      <DetailPageHeader
        backTo="/policies"
        parentLabel="Policies"
        title={p.title}
        description={p.description}
        actions={
          <div className="flex gap-2">
            <ContextualHelpButton moduleId="policies" current={{ status: p.status }} />
            {permissions.canEditPolicies ? (
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-2 size-4" />
                Edit details
              </Button>
            ) : null}
          </div>
        }
        meta={
          <>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  hasPendingAttestation
                    ? 'secondary'
                    : effectiveStatus === 'ACTIVE'
                    ? 'default'
                    : effectiveStatus === 'ARCHIVED'
                      ? 'secondary'
                      : 'destructive'
                }
                className="gap-1"
              >
                {statusLabel}
              </Badge>
              <button
                type="button"
                onClick={() => {
                  if (permissions.canEditPolicies) setRecurrenceOpen(true);
                }}
                className={cn(
                  'text-sm text-muted-foreground underline-offset-2',
                  permissions.canEditPolicies && 'cursor-pointer hover:text-foreground hover:underline'
                )}
              >
                {p.reviewFrequency === 'NEVER'
                  ? 'Never'
                  : p.reviewFrequency === 'BIENNIALLY'
                    ? 'Renew every 2 years'
                    : p.reviewFrequency === 'SEMI_ANNUALLY'
                      ? 'Renew bi-annually'
                      : p.reviewFrequency === 'QUARTERLY'
                        ? 'Renew quarterly'
                        : p.reviewFrequency === 'MONTHLY'
                          ? 'Renew monthly'
                          : p.reviewFrequency === 'WEEKLY'
                            ? 'Renew weekly'
                            : 'Renew annually'}
              </button>
              {frameworks.length > 0 && <FrameworksPopover frameworks={frameworks} />}
            </div>
            {frameworks.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {frameworks.map((f) => (
                  <Badge key={f._id ?? f.code ?? ''} variant="outline" className="text-xs">
                    {formatFrameworkCode(f.code ?? f.name)}
                  </Badge>
                ))}
              </div>
            )}
          </>
        }
      />

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4" aria-label="Policy sections">
          {TABS.map((tab) => (
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
              {tab.id === 'controls' ? `${tab.label} ${linkedControls.length}` : tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="space-y-6">
        {activeTab === 'versions' && (
          <>
            <PolicyVersionPanel policy={p} />
            {p.requiresAttestation && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CheckCircle className="size-4" />
                    Attestation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="mb-4 text-sm text-muted-foreground">
                    Acknowledge that you have read and understood this policy.
                  </p>
                  <AcknowledgementProgress
                    requiredUserIds={requiredUserIds}
                    attestedUserIds={attestedUserIds}
                    users={scopedTargetUsers}
                  />
                  {permissions.canAcknowledgePolicies && !currentUserHasAcknowledged && (
                    <Button
                      onClick={handleAttest}
                      disabled={acknowledgePolicy.isPending}
                    >
                      {acknowledgePolicy.isPending ? 'Submitting...' : 'Sign attestation'}
                    </Button>
                  )}
                  {currentUserHasAcknowledged && currentUserAttestation?.attestedAt && (
                    <p className="text-sm text-muted-foreground">
                      You acknowledged this on {formatDate(currentUserAttestation.attestedAt)}.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
            {attestations.data && attestations.data.attestations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Attestations</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {attestations.data.attestations.map((a) => (
                      <li key={a._id} className="flex flex-wrap items-center gap-2">
                        {a.source === 'SYSTEM_ARCHIVE' ? <Badge variant="secondary">Auto-completed on archive</Badge> : a.userId
                          ? `${a.userId.firstName} ${a.userId.lastName}`
                          : 'User'}{' '}
                        — {formatDate(a.attestedAt)}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {activeTab === 'controls' && (
          <PolicyControlsPanel
            linkedControls={linkedControls}
            onMapControl={() => setLinkControlsOpen(true)}
            canMapControls={permissions.canMapControls}
          />
        )}

        {activeTab === 'audits' && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="font-medium">No related audits</p>
              <p className="mt-2 text-sm text-muted-foreground">
                No upcoming or ongoing audits related to this policy.
              </p>
            </CardContent>
          </Card>
        )}

        {activeTab === 'comments' && id && <PolicyCommentsPanel policyId={id} />}
      </div>

      {permissions.canEditPolicies && (
        <EditPolicyModal
          policy={p}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}

      {permissions.canEditPolicies && (
        <EditRecurrenceModal
          policy={p}
          open={recurrenceOpen}
          onOpenChange={setRecurrenceOpen}
          onSuccess={() => policy.refetch()}
        />
      )}

      {permissions.canMapControls && (
        <PolicyLinkControlsModal
          policyId={id ?? null}
          existingControlIds={controlIds}
          open={linkControlsOpen}
          onOpenChange={setLinkControlsOpen}
          onSuccess={() => policy.refetch()}
        />
      )}
    </div>
  );
}
