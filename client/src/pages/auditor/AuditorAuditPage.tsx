import { useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import {
  useAuditorEngagement,
  useAuditorEvidence,
  useAuditorFindings,
  useAuditorRequests,
  useAuditorReviewEvidence,
  useCompleteAuditorAudit,
  useCreateAuditorFinding,
  useCreateAuditorRequest,
  useUploadAuditorReport,
} from '@/api/auditor';
import type { AuditFinding } from '@/api/audits';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TableSkeleton, PageHeader } from '@/components/shared';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EvidenceRequestThread from '@/components/auditor/EvidenceRequestThread';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const EVIDENCE_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Not started',
  READY_FOR_AUDIT: 'Ready for audit',
  APPROVED: 'Approved',
  FLAGGED: 'Flagged',
  NOT_APPLICABLE: 'N/A',
};

const EVIDENCE_STATUS_ORDER = ['NOT_STARTED', 'READY_FOR_AUDIT', 'APPROVED', 'FLAGGED', 'NOT_APPLICABLE'];

function EvidenceStatusBadge({ status }: { status: string }) {
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
      {EVIDENCE_STATUS_LABELS[status] ?? status.replace(/_/g, ' ')}
    </span>
  );
}

const STAT_CARD_META: Record<string, { label: string; borderColor: string }> = {
  READY_FOR_AUDIT: { label: 'Ready for audit', borderColor: 'border-l-blue-500' },
  APPROVED: { label: 'Approved', borderColor: 'border-l-green-500' },
  FLAGGED: { label: 'Flagged', borderColor: 'border-l-amber-500' },
  NOT_APPLICABLE: { label: 'Not applicable', borderColor: 'border-l-muted-foreground' },
};

export function AuditorAuditPage() {
  const { id } = useParams();
  const engagement = useAuditorEngagement(id ?? null);
  const evidence = useAuditorEvidence(id ?? null);
  const requests = useAuditorRequests(id ?? null);
  const findings = useAuditorFindings(id ?? null);
  const review = useAuditorReviewEvidence(id ?? null);
  const createRequest = useCreateAuditorRequest(id ?? null);
  const createFinding = useCreateAuditorFinding(id ?? null);
  const completeAudit = useCompleteAuditorAudit(id ?? null);
  const uploadReport = useUploadAuditorReport(id ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [commentByItem, setCommentByItem] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [requestTitle, setRequestTitle] = useState('');
  const [requestDescription, setRequestDescription] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [findingForm, setFindingForm] = useState({
    title: '',
    description: '',
    severity: 'MEDIUM' as AuditFinding['severity'],
    linkedControl: '',
  });

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const item of evidence.data ?? []) result[item.status] = (result[item.status] || 0) + 1;
    return result;
  }, [evidence.data]);

  const filteredEvidence = useMemo(() => {
    let list = evidence.data ?? [];
    if (statusFilter !== 'ALL') list = list.filter((i) => i.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (i) =>
          i.title?.toLowerCase().includes(q) ||
          i.controlId?.identifier?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [evidence.data, statusFilter, search]);

  const accessError = engagement.isError
    ? (engagement.error as Error)?.message ?? 'You do not have access to this audit.'
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={engagement.data?.name ?? 'Audit'}
        description={engagement.data?.description}
        actions={
          <Button variant="outline" disabled={completeAudit.isPending} onClick={() => setCompleteOpen(true)}>
            Complete review
          </Button>
        }
      />

      {/* Stat cards */}
      <div className="grid gap-3 sm:grid-cols-4">
        {(['READY_FOR_AUDIT', 'APPROVED', 'FLAGGED', 'NOT_APPLICABLE'] as const).map((status) => {
          const meta = STAT_CARD_META[status];
          return (
            <div
              key={status}
              className={cn('rounded-md border border-l-4 p-3 cursor-pointer transition-colors hover:bg-muted/40', meta.borderColor, statusFilter === status && 'bg-muted/50')}
              onClick={() => setStatusFilter(statusFilter === status ? 'ALL' : status)}
            >
              <p className="text-xs text-muted-foreground">{meta.label}</p>
              <p className="mt-1 text-xl font-semibold">{counts[status] ?? 0}</p>
            </div>
          );
        })}
      </div>

      <Tabs defaultValue="evidence">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="evidence">
            Evidence
            {(evidence.data?.length ?? 0) > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                {evidence.data?.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="requests">
            Requests
            {(requests.data?.length ?? 0) > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                {requests.data?.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="findings">
            Findings
            {(findings.data?.length ?? 0) > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                {findings.data?.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="report">Report</TabsTrigger>
        </TabsList>

        {/* ── Evidence tab ── */}
        <TabsContent value="evidence" className="mt-4 space-y-3">
          {accessError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-8 text-center">
              <p className="text-sm font-medium text-destructive">Access denied</p>
              <p className="mt-1 text-xs text-muted-foreground">{accessError}</p>
            </div>
          ) : evidence.isLoading ? (
            <TableSkeleton rows={6} columns={5} />
          ) : (
            <>
              {/* Search + filter bar */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  placeholder="Search evidence or control ID…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="sm:max-w-xs"
                />
                <div className="flex flex-wrap gap-1">
                  {(['ALL', ...EVIDENCE_STATUS_ORDER] as const).map((s) => {
                    const label = s === 'ALL' ? 'All' : (EVIDENCE_STATUS_LABELS[s] ?? s);
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

              {filteredEvidence.length === 0 ? (
                <div className="rounded-md border border-dashed p-8 text-center">
                  <p className="text-sm font-medium">
                    {(evidence.data?.length ?? 0) === 0
                      ? 'No evidence items yet'
                      : 'No evidence matches your filter'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(evidence.data?.length ?? 0) === 0
                      ? 'The audit administrator must run "Snapshot evidence" before review can begin.'
                      : 'Try changing the status filter or clearing the search.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="px-4 py-3">Evidence</th>
                        <th className="px-4 py-3">Control</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="min-w-[180px] px-4 py-3">Comment</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEvidence.map((item) => {
                        const isReviewed = item.status === 'APPROVED' || item.status === 'NOT_APPLICABLE';
                        const comment = commentByItem[item._id] ?? '';
                        const hasComment = comment.trim().length > 0;
                        return (
                          <tr
                            key={item._id}
                            className={cn(
                              'border-t align-top',
                              item.status === 'APPROVED' && 'bg-green-50 dark:bg-green-950/20',
                              item.status === 'FLAGGED' && 'bg-amber-50 dark:bg-amber-950/20',
                            )}
                          >
                            <td className="px-4 py-3">
                              <p className="font-medium">{item.title}</p>
                              {item.fileUrl && (
                                <a
                                  className="text-xs text-primary hover:underline"
                                  href={item.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {item.fileName || 'Open file'}
                                </a>
                              )}
                              {item.customerResponse && (
                                <p className="mt-1 text-xs text-muted-foreground">{item.customerResponse}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{item.controlId?.identifier ?? '—'}</td>
                            <td className="px-4 py-3">
                              <EvidenceStatusBadge status={item.status} />
                            </td>
                            <td className="px-4 py-3">
                              {isReviewed ? (
                                <span className="text-xs text-muted-foreground">{item.auditorComment || '—'}</span>
                              ) : (
                                <Textarea
                                  value={comment}
                                  onChange={(e) =>
                                    setCommentByItem((prev) => ({ ...prev, [item._id]: e.target.value }))
                                  }
                                  placeholder="Required when flagging"
                                  className="min-h-[56px] text-xs"
                                />
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {isReviewed ? (
                                <div className="flex items-center gap-1.5">
                                  {item.status === 'APPROVED' ? (
                                    <CheckCircle2 className="size-4 text-green-600" />
                                  ) : (
                                    <XCircle className="size-4 text-muted-foreground" />
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    {item.status === 'APPROVED' ? 'Approved' : 'N/A'}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  <Button
                                    size="sm"
                                    className="bg-green-600 text-white hover:bg-green-700"
                                    disabled={review.isPending}
                                    onClick={() =>
                                      review.mutate({ itemId: item._id, action: 'approve', comment })
                                    }
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="bg-amber-500 text-white hover:bg-amber-600"
                                    disabled={review.isPending || !hasComment}
                                    title={!hasComment ? 'Add a comment to enable flagging' : undefined}
                                    onClick={() =>
                                      review.mutate({ itemId: item._id, action: 'flag', comment })
                                    }
                                  >
                                    Flag
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={review.isPending}
                                    onClick={() =>
                                      review.mutate({ itemId: item._id, action: 'not-applicable', comment })
                                    }
                                  >
                                    N/A
                                  </Button>
                                </div>
                              )}
                              {!isReviewed && !hasComment && (
                                <p className="mt-1 text-xs text-muted-foreground">Add comment to flag</p>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ── Requests tab ── */}
        <TabsContent value="requests" className="mt-4">
          {accessError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-8 text-center">
              <p className="text-sm font-medium text-destructive">Access denied</p>
              <p className="mt-1 text-xs text-muted-foreground">{accessError}</p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-md border p-4">
                <h2 className="text-base font-semibold">Create evidence request</h2>
                <Input
                  value={requestTitle}
                  onChange={(e) => setRequestTitle(e.target.value)}
                  placeholder="Request title"
                />
                <Textarea
                  value={requestDescription}
                  onChange={(e) => setRequestDescription(e.target.value)}
                  placeholder="Description"
                />
                <Button
                  size="sm"
                  disabled={!requestTitle || createRequest.isPending}
                  onClick={() =>
                    createRequest.mutate(
                      { title: requestTitle, description: requestDescription },
                      {
                        onSuccess: () => {
                          setRequestTitle('');
                          setRequestDescription('');
                        },
                      }
                    )
                  }
                >
                  Create request
                </Button>
              </div>

              <div className="space-y-3 rounded-md border p-4">
                <h2 className="text-base font-semibold">Requests</h2>
                {requests.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : (requests.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No requests yet.</p>
                ) : (
                  (requests.data ?? []).map((request) => {
                    const expanded = selectedRequestId === request._id;
                    return (
                      <div key={request._id} className="rounded border text-sm">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 p-3 text-left hover:bg-muted/40"
                          onClick={() => setSelectedRequestId(expanded ? null : request._id)}
                        >
                          <span className="font-medium">{request.title}</span>
                          <Badge variant="secondary">{request.status}</Badge>
                        </button>
                        {expanded && id && (
                          <div className="border-t p-3">
                            <EvidenceRequestThread
                              requestId={request._id}
                              auditId={id}
                              currentUserRole="AUDITOR"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Findings tab ── */}
        <TabsContent value="findings" className="mt-4 space-y-4">
          {accessError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-8 text-center">
              <p className="text-sm font-medium text-destructive">Access denied</p>
              <p className="mt-1 text-xs text-muted-foreground">{accessError}</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border p-4">
                <h2 className="mb-3 text-base font-semibold">Add finding</h2>
                <form
                  className="grid gap-3 md:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!findingForm.title.trim()) return;
                    createFinding.mutate(
                      {
                        title: findingForm.title.trim(),
                        description: findingForm.description.trim(),
                        severity: findingForm.severity,
                        linkedControl: findingForm.linkedControl || undefined,
                      },
                      {
                        onSuccess: () =>
                          setFindingForm({ title: '', description: '', severity: 'MEDIUM', linkedControl: '' }),
                      }
                    );
                  }}
                >
                  <div className="space-y-1">
                    <Label htmlFor="finding-title">Title</Label>
                    <Input
                      id="finding-title"
                      value={findingForm.title}
                      onChange={(e) => setFindingForm((p) => ({ ...p, title: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="finding-severity">Severity</Label>
                    <select
                      id="finding-severity"
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={findingForm.severity}
                      onChange={(e) =>
                        setFindingForm((p) => ({ ...p, severity: e.target.value as AuditFinding['severity'] }))
                      }
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="finding-description">Description</Label>
                    <Textarea
                      id="finding-description"
                      value={findingForm.description}
                      onChange={(e) => setFindingForm((p) => ({ ...p, description: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="finding-control">Linked control (optional)</Label>
                    <select
                      id="finding-control"
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={findingForm.linkedControl}
                      onChange={(e) => setFindingForm((p) => ({ ...p, linkedControl: e.target.value }))}
                    >
                      <option value="">No linked control</option>
                      {(evidence.data ?? []).map((item) =>
                        item.controlId?._id ? (
                          <option key={item.controlId._id} value={item.controlId._id}>
                            {item.controlId.identifier || item.controlId._id} — {item.title}
                          </option>
                        ) : null
                      )}
                    </select>
                  </div>
                  <Button type="submit" size="sm" disabled={createFinding.isPending}>
                    {createFinding.isPending ? 'Saving...' : 'Add finding'}
                  </Button>
                </form>
              </div>

              {findings.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading findings...</p>
              ) : (findings.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No findings recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {(findings.data ?? []).map((finding) => (
                    <div
                      key={finding._id}
                      className="flex items-start justify-between rounded border p-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">{finding.title}</p>
                        {finding.description && (
                          <p className="text-muted-foreground">{finding.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Badge
                          variant={
                            finding.severity === 'CRITICAL' || finding.severity === 'HIGH'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {finding.severity}
                        </Badge>
                        <Badge variant="outline">{finding.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ── Report tab ── */}
        <TabsContent value="report" className="mt-4 space-y-3 rounded-md border p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Audit report</h2>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadReport.mutate(file);
                  e.target.value = '';
                }}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={uploadReport.isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadReport.isPending ? 'Uploading...' : 'Upload report'}
              </Button>
            </div>
          </div>
          {(engagement.data?.reports ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports uploaded yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(engagement.data?.reports ?? []).map((report) => (
                <li key={report._id} className="flex justify-between rounded border p-2">
                  <span>{report.fileName}</span>
                  {report.fileUrl && (
                    <a
                      href={report.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      Download
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete audit review?</DialogTitle>
            <DialogDescription>
              This moves the engagement to COMPLETING. The organization will be notified to finalize the
              audit.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={completeAudit.isPending}
              onClick={() =>
                completeAudit.mutate(undefined, { onSuccess: () => setCompleteOpen(false) })
              }
            >
              {completeAudit.isPending ? 'Processing...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
