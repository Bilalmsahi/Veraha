import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  useAudit,
  useAuditEvidence,
  useAuditRequests,
  useInviteAuditor,
  useLookupAuditor,
  useRespondAuditEvidence,
  useSnapshotAudit,
  useUpdateAuditRequest,
  type AuditRequest,
  type AuditorLookupResult,
} from '@/api/audits';
import { useUsers } from '@/api/users';
import { ContextualHelpButton, PageHeader, TableSkeleton } from '@/components/shared';
import { AuditHistoryPanel } from '@/components/audit/AuditHistoryPanel';
import { AuditOverviewPanel } from '@/components/audit/AuditOverviewPanel';
import { AuditReadinessTab } from '@/components/audit/AuditReadinessTab';
import FindingsLog from '@/components/audit/FindingsLog';
import EvidenceRequestThread from '@/components/auditor/EvidenceRequestThread';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function RequestEditForm({
  request,
  updateRequest,
}: {
  request: AuditRequest;
  updateRequest: ReturnType<typeof useUpdateAuditRequest>;
}) {
  const users = useUsers({ limit: 100 });
  const [assignedTo, setAssignedTo] = useState(request.assignedTo?._id ?? '');
  const [dueDate, setDueDate] = useState(
    request.dueDate ? new Date(request.dueDate).toISOString().slice(0, 10) : ''
  );

  useEffect(() => {
    setAssignedTo(request.assignedTo?._id ?? '');
    setDueDate(request.dueDate ? new Date(request.dueDate).toISOString().slice(0, 10) : '');
  }, [request._id, request.assignedTo?._id, request.dueDate]);

  const internalUsers = (users.data?.users ?? []).filter((user) => user.role !== 'AUDITOR');

  return (
    <div className="rounded-md border bg-muted/20 p-4 space-y-3">
      <p className="text-sm font-medium">Edit request</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`assignee-${request._id}`}>Assigned to</Label>
          <select
            id={`assignee-${request._id}`}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
          >
            <option value="">Unassigned</option>
            {internalUsers.map((user) => (
              <option key={user._id} value={user._id}>
                {[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`due-${request._id}`}>Due date</Label>
          <Input
            id={`due-${request._id}`}
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={updateRequest.isPending}
          onClick={() =>
            updateRequest.mutate({
              requestId: request._id,
              assignedTo: assignedTo || null,
              dueDate: dueDate ? new Date(dueDate).toISOString() : null,
            })
          }
        >
          Save
        </Button>
        {!['COMPLETED', 'CLOSED'].includes(request.status) && (
          <Button
            size="sm"
            variant="outline"
            disabled={updateRequest.isPending}
            onClick={() => updateRequest.mutate({ requestId: request._id, status: 'CLOSED' })}
          >
            Close request
          </Button>
        )}
      </div>
    </div>
  );
}

const ADMIN_EVIDENCE_STATUSES = ['NOT_STARTED', 'READY_FOR_AUDIT', 'APPROVED', 'FLAGGED', 'NOT_APPLICABLE'] as const;
const ADMIN_EVIDENCE_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Not started',
  READY_FOR_AUDIT: 'Ready for audit',
  APPROVED: 'Approved',
  FLAGGED: 'Flagged',
  NOT_APPLICABLE: 'N/A',
};

function AdminEvidenceBadge({ status }: { status: string }) {
  const cls =
    status === 'APPROVED'
      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
      : status === 'FLAGGED'
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
        : status === 'READY_FOR_AUDIT'
          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
          : status === 'NOT_APPLICABLE'
            ? 'bg-muted text-muted-foreground'
            : 'border border-border text-muted-foreground';
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', cls)}>
      {ADMIN_EVIDENCE_STATUS_LABELS[status] ?? status.replace(/_/g, ' ')}
    </span>
  );
}

function AdminEvidenceTab({
  evidence,
  responseByItem,
  setResponseByItem,
  respondEvidence,
}: {
  evidence: ReturnType<typeof useAuditEvidence>;
  responseByItem: Record<string, string>;
  setResponseByItem: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  respondEvidence: ReturnType<typeof useRespondAuditEvidence>;
}) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const item of evidence.data ?? []) result[item.status] = (result[item.status] || 0) + 1;
    return result;
  }, [evidence.data]);

  const filtered = useMemo(() => {
    let list = evidence.data ?? [];
    if (statusFilter !== 'ALL') list = list.filter((i) => i.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (i) => i.title?.toLowerCase().includes(q) || i.controlId?.identifier?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [evidence.data, statusFilter, search]);

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">Evidence review</h2>

      {evidence.isLoading ? (
        <TableSkeleton rows={6} columns={4} />
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              placeholder="Search evidence or control ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sm:max-w-xs"
            />
            <div className="flex flex-wrap gap-1">
              {(['ALL', ...ADMIN_EVIDENCE_STATUSES] as const).map((s) => {
                const label = s === 'ALL' ? 'All' : (ADMIN_EVIDENCE_STATUS_LABELS[s] ?? s);
                const cnt = s === 'ALL' ? (evidence.data?.length ?? 0) : (counts[s] ?? 0);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                      statusFilter === s
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {label} <span className="ml-0.5 opacity-70">{cnt}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center">
              <p className="text-sm font-medium">
                {(evidence.data?.length ?? 0) === 0 ? 'No evidence snapshotted yet' : 'No evidence matches your filter'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {(evidence.data?.length ?? 0) === 0
                  ? 'Run "Snapshot evidence" from the top of this page.'
                  : 'Try changing the status filter or clearing the search.'}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-4 py-3">Evidence</th>
                    <th className="px-4 py-3">Control</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Response</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr
                      key={item._id}
                      className={cn(
                        'border-t align-top',
                        item.status === 'FLAGGED' && 'border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20',
                        item.status === 'APPROVED' && 'bg-green-50 dark:bg-green-950/20',
                      )}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">{item.title}</p>
                        {item.flagReason && (
                          <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">{item.flagReason}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.controlId?.identifier ?? '—'}</td>
                      <td className="px-4 py-3">
                        <AdminEvidenceBadge status={item.status} />
                      </td>
                      <td className="px-4 py-3">
                        {item.status === 'FLAGGED' ? (
                          <div className="space-y-2">
                            <Textarea
                              value={responseByItem[item._id] ?? ''}
                              onChange={(e) =>
                                setResponseByItem((prev) => ({ ...prev, [item._id]: e.target.value }))
                              }
                              placeholder="Write your response for the auditor…"
                              className="min-h-[56px] text-xs"
                            />
                            <Button
                              size="sm"
                              onClick={() =>
                                respondEvidence.mutate({
                                  itemId: item._id,
                                  response: responseByItem[item._id] ?? '',
                                })
                              }
                              disabled={respondEvidence.isPending || !responseByItem[item._id]?.trim()}
                            >
                              Request review
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">
                            {item.customerResponse || '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function AuditDetailPage() {
  const { id } = useParams();
  const audit = useAudit(id ?? null);
  const evidence = useAuditEvidence(id ?? null);
  const requests = useAuditRequests(id ?? null);
  const snapshot = useSnapshotAudit();
  const inviteAuditor = useInviteAuditor(id ?? null);
  const lookupAuditor = useLookupAuditor(id ?? null);
  const respondEvidence = useRespondAuditEvidence(id ?? null);
  const updateRequest = useUpdateAuditRequest(id ?? null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [auditorEmail, setAuditorEmail] = useState('');
  const [lookupResult, setLookupResult] = useState<AuditorLookupResult | null>(null);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [onboardingModalOpen, setOnboardingModalOpen] = useState(false);
  const [onboardingMethod, setOnboardingMethod] = useState<'invite' | 'provision'>('invite');
  const [onboardingFirstName, setOnboardingFirstName] = useState('');
  const [onboardingLastName, setOnboardingLastName] = useState('');
  const [provisionPassword, setProvisionPassword] = useState('');
  const [responseByItem, setResponseByItem] = useState<Record<string, string>>({});

  const resetAuditorFlow = () => {
    setLookupResult(null);
    setRoleModalOpen(false);
    setOnboardingModalOpen(false);
    setOnboardingMethod('invite');
    setOnboardingFirstName('');
    setOnboardingLastName('');
    setProvisionPassword('');
    setAuditorEmail('');
  };

  const handleAuditorLookup = () => {
    lookupAuditor.mutate(auditorEmail, {
      onSuccess: (result) => {
        setLookupResult(result);
        if (result.state === 'AUDITOR_EXISTS') {
          inviteAuditor.mutate({ email: result.email, mode: 'assign' }, { onSuccess: resetAuditorFlow });
          return;
        }
        if (result.state === 'ROLE_CONFLICT') {
          setRoleModalOpen(true);
          return;
        }
        setOnboardingModalOpen(true);
      },
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={audit.data?.name ?? 'Audit'}
        description={audit.data?.description || 'Audit engagement workspace'}
        actions={
          <div className="flex flex-wrap gap-2">
            <ContextualHelpButton moduleId="audits" current={{ status: audit.data?.status }} />
            <Button size="sm" variant="outline" onClick={() => id && snapshot.mutate(id)} disabled={snapshot.isPending}>
              Snapshot evidence
            </Button>
          </div>
        }
      />

      {audit.isLoading ? (
        <TableSkeleton rows={2} columns={3} />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-md border p-4">
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant="secondary" className="mt-2">{audit.data?.status}</Badge>
          </div>
          <div className="rounded-md border p-4">
            <p className="text-xs text-muted-foreground">Window</p>
            <p className="mt-2 text-sm">
              {audit.data?.periodStart && new Date(audit.data.periodStart).toLocaleDateString()} -{' '}
              {audit.data?.periodEnd && new Date(audit.data.periodEnd).toLocaleDateString()}
            </p>
          </div>
          <div className="rounded-md border p-4">
            <p className="text-xs text-muted-foreground">Auditor</p>
            <p className="mt-2 text-sm">{audit.data?.auditorEmail || 'Unassigned'}</p>
          </div>
          {audit.data?.outcome && audit.data.outcome !== 'PENDING' && (
            <div className="rounded-md border p-4">
              <p className="text-xs text-muted-foreground">Outcome</p>
              <Badge variant="secondary" className="mt-2">{audit.data.outcome}</Badge>
            </div>
          )}
        </div>
      )}

      <section className="space-y-3 rounded-md border p-4">
        <h2 className="text-base font-semibold">Assign auditor</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1 space-y-1">
            <Label htmlFor="auditorEmail">Auditor email</Label>
            <Input id="auditorEmail" value={auditorEmail} onChange={(e) => setAuditorEmail(e.target.value)} />
          </div>
          <Button
            className="sm:self-end"
            disabled={!auditorEmail || inviteAuditor.isPending || lookupAuditor.isPending}
            onClick={handleAuditorLookup}
          >
            {lookupAuditor.isPending ? 'Checking...' : 'Assign'}
          </Button>
        </div>
      </section>

      <Dialog open={roleModalOpen} onOpenChange={setRoleModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change user role?</DialogTitle>
            <DialogDescription>
              {lookupResult?.state === 'ROLE_CONFLICT'
                ? `${lookupResult.user.firstName || ''} ${lookupResult.user.lastName || ''} (${lookupResult.user.email}) currently has the role ${lookupResult.user.role}. Do you want to change/add this user's role to Auditor?`
                : 'This user is not currently an auditor.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleModalOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={inviteAuditor.isPending || lookupResult?.state !== 'ROLE_CONFLICT'}
              onClick={() => {
                if (lookupResult?.state !== 'ROLE_CONFLICT') return;
                inviteAuditor.mutate(
                  { email: lookupResult.email, mode: 'assign', confirmRoleChange: true },
                  { onSuccess: resetAuditorFlow }
                );
              }}
            >
              {inviteAuditor.isPending ? 'Updating...' : 'Change role & assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={onboardingModalOpen} onOpenChange={setOnboardingModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Onboard auditor</DialogTitle>
            <DialogDescription>
              No user exists for {lookupResult?.email || auditorEmail}. Choose an onboarding method:
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 overflow-hidden rounded-md border bg-muted/30 p-1">
            <button
              type="button"
              className={`rounded-sm px-3 py-2 text-sm font-medium transition-colors ${
                onboardingMethod === 'invite'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setOnboardingMethod('invite')}
            >
              Option A: Send Invite Link
            </button>
            <button
              type="button"
              className={`rounded-sm px-3 py-2 text-sm font-medium transition-colors ${
                onboardingMethod === 'provision'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setOnboardingMethod('provision')}
            >
              Option B: Provision Now
            </button>
          </div>

          <p className="text-sm leading-6 text-muted-foreground">
            {onboardingMethod === 'invite'
              ? 'The auditor will receive a secure email link to create their account, set their password, and configure their profile details.'
              : 'The auditor account will be provisioned immediately in this organization. You can provide a temporary password or let the system generate one.'}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="auditorFirstName">First Name (Optional)</Label>
              <Input
                id="auditorFirstName"
                value={onboardingFirstName}
                onChange={(e) => setOnboardingFirstName(e.target.value)}
                placeholder="Enter first name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auditorLastName">Last Name (Optional)</Label>
              <Input
                id="auditorLastName"
                value={onboardingLastName}
                onChange={(e) => setOnboardingLastName(e.target.value)}
                placeholder="Enter last name"
              />
            </div>
          </div>

          {onboardingMethod === 'provision' && (
            <div className="space-y-2">
              <Label htmlFor="provisionPassword">Temporary Password (Optional)</Label>
              <Input
                id="provisionPassword"
                type="password"
                value={provisionPassword}
                onChange={(e) => setProvisionPassword(e.target.value)}
                placeholder="Leave blank to auto-generate"
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOnboardingModalOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={inviteAuditor.isPending}
              onClick={() => {
                const email = lookupResult?.email || auditorEmail;
                inviteAuditor.mutate(
                  {
                    email,
                    mode: onboardingMethod,
                    firstName: onboardingFirstName || 'External',
                    lastName: onboardingLastName || 'Auditor',
                    password: onboardingMethod === 'provision' ? provisionPassword || undefined : undefined,
                  },
                  { onSuccess: resetAuditorFlow }
                );
              }}
            >
              {onboardingMethod === 'invite' ? 'Send Invite' : 'Provision Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="readiness">Readiness</TabsTrigger>
          <TabsTrigger value="findings">Findings</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {id && <AuditOverviewPanel auditId={id} audit={audit.data} />}
        </TabsContent>

        <TabsContent value="evidence">
          <AdminEvidenceTab
            evidence={evidence}
            responseByItem={responseByItem}
            setResponseByItem={setResponseByItem}
            respondEvidence={respondEvidence}
          />
        </TabsContent>

        <TabsContent value="requests">
          <section className="space-y-4">
            <h2 className="text-base font-semibold">Auditor requests</h2>
            {(requests.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No requests yet.</p>
            ) : (
              (requests.data ?? []).map((request) => {
                const isOverdue =
                  request.dueDate &&
                  !['COMPLETED', 'CLOSED'].includes(request.status) &&
                  new Date(request.dueDate).getTime() < Date.now();
                const expanded = selectedRequestId === request._id;
                return (
                  <div key={request._id} className="rounded-md border">
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-3 p-4 text-left hover:bg-muted/40"
                      onClick={() => setSelectedRequestId(expanded ? null : request._id)}
                    >
                      <div>
                        <p className="font-medium">{request.title}</p>
                        {request.description && (
                          <p className="mt-1 text-xs text-muted-foreground">{request.description}</p>
                        )}
                        {request.dueDate && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Due {new Date(request.dueDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {isOverdue && <Badge variant="destructive">Overdue</Badge>}
                        <Badge variant="secondary">{request.status}</Badge>
                      </div>
                    </button>
                    {expanded && id && (
                      <div className="space-y-3 border-t p-4">
                        <RequestEditForm request={request} updateRequest={updateRequest} />
                        {request.status === 'OPEN' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={updateRequest.isPending}
                            onClick={() =>
                              updateRequest.mutate({ requestId: request._id, status: 'IN_REVIEW' })
                            }
                          >
                            Mark in review
                          </Button>
                        )}
                        <EvidenceRequestThread
                          requestId={request._id}
                          auditId={id}
                          currentUserRole="INTERNAL"
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </section>
        </TabsContent>

        <TabsContent value="readiness">
          {id && <AuditReadinessTab auditId={id} />}
        </TabsContent>

        <TabsContent value="findings">
          {id && <FindingsLog auditId={id} audit={audit.data} />}
        </TabsContent>

        <TabsContent value="history">
          {id && <AuditHistoryPanel auditId={id} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
