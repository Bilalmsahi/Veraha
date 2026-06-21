import { useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AUDIT_STATUS_TRANSITIONS,
  useAuditReadiness,
  useCompleteAudit,
  useTransitionAudit,
  useUploadAuditReport,
  type AuditStatus,
  type AuditSummary,
} from '@/api/audits';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const PIPELINE_STEPS: { status: AuditStatus; label: string }[] = [
  { status: 'DRAFT', label: 'Draft' },
  { status: 'SCHEDULED', label: 'Scheduled' },
  { status: 'READINESS_CHECK', label: 'Readiness check' },
  { status: 'IN_PROGRESS', label: 'In progress' },
  { status: 'COMPLETING', label: 'Completing' },
  { status: 'COMPLETED', label: 'Completed' },
];

const STATUS_GUIDANCE: Record<string, { description: string; action: string }> = {
  DRAFT: {
    description: 'The audit is being configured. No auditor has been formally assigned yet.',
    action: 'Assign an auditor using the Assign auditor field above, confirm the audit period window, then advance to Scheduled.',
  },
  SCHEDULED: {
    description: 'The auditor is assigned and the audit window is set.',
    action: 'Run "Snapshot evidence" (top-right button) to capture the current state of all controls, then move to Readiness Check.',
  },
  READINESS_CHECK: {
    description: 'Your team is reviewing evidence and ensuring all controls are documented before the auditor begins.',
    action: 'Check the Readiness tab for gaps, upload missing evidence, then move to In Progress to open the audit to the auditor.',
  },
  IN_PROGRESS: {
    description: 'The auditor is actively reviewing evidence and may raise requests or flag items.',
    action: 'Respond to flagged evidence items on the Evidence tab and answer any auditor requests. Once all evidence is reviewed, complete the audit.',
  },
  COMPLETING: {
    description: 'Evidence review is done. The audit is awaiting final sign-off.',
    action: 'Upload the final audit report on the Overview tab, then move to Completed.',
  },
  COMPLETED: {
    description: 'The audit is fully complete and all evidence has been reviewed.',
    action: 'Archive this audit to close the record permanently.',
  },
  ARCHIVED: {
    description: 'This audit is closed and archived.',
    action: 'No further actions are available.',
  },
};

const STATUS_STEP_INDEX: Partial<Record<string, number>> = {
  DRAFT: 0,
  PREP: 0,
  SCHEDULED: 1,
  READINESS_CHECK: 2,
  FIELDWORK: 3,
  IN_PROGRESS: 3,
  COMPLETING: 4,
  COMPLETED: 5,
  ARCHIVED: 5,
};

const FORWARD_TRANSITION: Partial<Record<string, AuditStatus>> = {
  DRAFT: 'SCHEDULED',
  SCHEDULED: 'READINESS_CHECK',
  READINESS_CHECK: 'IN_PROGRESS',
  COMPLETING: 'COMPLETED',
  COMPLETED: 'ARCHIVED',
};

function AuditStatusPipeline({
  status,
  nextStatuses,
  blockers,
  transition,
  completeAudit,
  onCompleteClick,
}: {
  status: string;
  nextStatuses: string[];
  blockers: string[];
  transition: { isPending: boolean; mutate: (s: AuditStatus) => void };
  completeAudit: { isPending: boolean };
  onCompleteClick: () => void;
}) {
  const currentIdx = STATUS_STEP_INDEX[status] ?? -1;
  const guidance = STATUS_GUIDANCE[status];
  const forwardStatus = FORWARD_TRANSITION[status];
  const backStatuses = nextStatuses.filter((s) => s !== forwardStatus);
  const hasBlockers = blockers.length > 0;

  if (['ARCHIVED'].includes(status)) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Audit progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Pipeline stepper */}
        <div className="flex items-center gap-0">
          {PIPELINE_STEPS.map((step, idx) => {
            const isDone = idx < currentIdx;
            const isCurrent = idx === currentIdx;
            const isFuture = idx > currentIdx;
            return (
              <div key={step.status} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={cn(
                      'flex size-7 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors',
                      isDone && 'border-primary bg-primary text-primary-foreground',
                      isCurrent && 'border-primary bg-background text-primary ring-2 ring-primary/30',
                      isFuture && 'border-muted bg-background text-muted-foreground',
                    )}
                  >
                    {isDone ? <Check className="size-3.5" /> : idx + 1}
                  </div>
                  <span
                    className={cn(
                      'hidden text-center text-[10px] leading-tight sm:block',
                      isCurrent && 'font-semibold text-primary',
                      isDone && 'text-muted-foreground',
                      isFuture && 'text-muted-foreground/60',
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < PIPELINE_STEPS.length - 1 && (
                  <div className={cn('h-0.5 flex-1', idx < currentIdx ? 'bg-primary' : 'bg-muted')} />
                )}
              </div>
            );
          })}
        </div>

        {/* Contextual guidance */}
        {guidance && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <p className="text-muted-foreground">{guidance.description}</p>
            <p className="mt-1.5 font-medium">{guidance.action}</p>
          </div>
        )}

        {/* Transition buttons */}
        {!['COMPLETED', 'ARCHIVED'].includes(status) && (
          <div className="flex flex-wrap items-center gap-2">
            {status === 'IN_PROGRESS' ? (
              <Button size="sm" disabled={completeAudit.isPending || hasBlockers} onClick={onCompleteClick}>
                Complete audit
              </Button>
            ) : forwardStatus ? (
              <Button
                size="sm"
                disabled={transition.isPending || hasBlockers}
                onClick={() => transition.mutate(forwardStatus)}
              >
                Move to {PIPELINE_STEPS.find((s) => s.status === forwardStatus)?.label ?? forwardStatus.replace(/_/g, ' ')}
              </Button>
            ) : null}
            {backStatuses.map((s) => (
              <Button
                key={s}
                size="sm"
                variant="outline"
                disabled={transition.isPending}
                onClick={() => transition.mutate(s as AuditStatus)}
              >
                Move to {PIPELINE_STEPS.find((p) => p.status === s)?.label ?? s.replace(/_/g, ' ')}
              </Button>
            ))}
            {hasBlockers && (
              <p className="text-xs text-muted-foreground">
                Resolve the blockers listed above before advancing.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type AuditOverviewPanelProps = {
  auditId: string;
  audit?: AuditSummary;
};

function formatDate(value?: string) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString();
}

const EVIDENCE_CHART_COLORS: Record<string, string> = {
  APPROVED: 'var(--color-success)',
  FLAGGED: 'var(--color-error)',
  NOT_STARTED: 'var(--muted-foreground)',
  READY_FOR_AUDIT: 'var(--chart-1)',
  NOT_APPLICABLE: 'var(--chart-3)',
};

const FINDING_CHART_COLORS: Record<string, string> = {
  CRITICAL: 'var(--color-error)',
  HIGH: 'var(--color-warning)',
  MEDIUM: 'var(--chart-5)',
  LOW: 'var(--muted-foreground)',
};

export function AuditOverviewPanel({ auditId, audit }: AuditOverviewPanelProps) {
  const readiness = useAuditReadiness(auditId);
  const transition = useTransitionAudit(auditId);
  const completeAudit = useCompleteAudit(auditId);
  const uploadReport = useUploadAuditReport(auditId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [completeOpen, setCompleteOpen] = useState(false);

  const status = audit?.status ?? readiness.data?.status ?? 'DRAFT';
  const nextStatuses = AUDIT_STATUS_TRANSITIONS[status] ?? [];
  const data = readiness.data;

  const evidenceChartData = useMemo(() => {
    if (!data?.evidence.byStatus) return [];
    return Object.entries(data.evidence.byStatus)
      .filter(([, count]) => count > 0)
      .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value, key: name }));
  }, [data?.evidence.byStatus]);

  const findingsChartData = useMemo(() => {
    if (!data?.findings.openBySeverity) return [];
    return (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const)
      .map((severity) => ({
        severity,
        count: data.findings.openBySeverity[severity] || 0,
      }))
      .filter((entry) => entry.count > 0);
  }, [data?.findings.openBySeverity]);

  return (
    <div className="space-y-6">
      {readiness.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading readiness...</p>
      ) : data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-medium">Overall readiness</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pb-4">
                <p className="text-3xl font-semibold">{data.overallReadinessScore}%</p>
                <Progress value={data.overallReadinessScore} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-medium">Evidence reviewed</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pb-4">
                <p className="text-2xl font-semibold">
                  {data.evidence.reviewed}/{data.evidence.total}
                </p>
                <Progress value={data.evidence.readinessPercent} />
                <p className="text-xs text-muted-foreground">{data.evidence.readinessPercent}% complete</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-medium">Requests completed</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pb-4">
                <p className="text-2xl font-semibold">
                  {data.requests.completed}/{data.requests.total}
                </p>
                <Progress value={data.requests.readinessPercent} />
                <p className="text-xs text-muted-foreground">
                  {data.requests.total === 0 ? 'No requests yet' : `${data.requests.readinessPercent}% complete`}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-medium">Open findings</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <p className="text-2xl font-semibold">{data.findings.open}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((severity) => {
                    const count = data.findings.openBySeverity[severity] || 0;
                    if (!count) return null;
                    return (
                      <Badge
                        key={severity}
                        variant={severity === 'CRITICAL' || severity === 'HIGH' ? 'destructive' : 'secondary'}
                      >
                        {severity}: {count}
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {(evidenceChartData.length > 0 || findingsChartData.length > 0) && (
            <div className="grid gap-4 lg:grid-cols-2">
              {evidenceChartData.length > 0 && (
                <Card>
                  <CardHeader className="py-4">
                    <CardTitle className="text-sm font-medium">Evidence by status</CardTitle>
                  </CardHeader>
                  <CardContent className="h-64 pb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={evidenceChartData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                          {evidenceChartData.map((entry) => (
                            <Cell key={entry.key} fill={EVIDENCE_CHART_COLORS[entry.key] ?? 'var(--muted-foreground)'} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
              {findingsChartData.length > 0 && (
                <Card>
                  <CardHeader className="py-4">
                    <CardTitle className="text-sm font-medium">Open findings by severity</CardTitle>
                  </CardHeader>
                  <CardContent className="h-64 pb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={findingsChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <XAxis dataKey="severity" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {findingsChartData.map((entry) => (
                            <Cell key={entry.severity} fill={FINDING_CHART_COLORS[entry.severity]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {data.blockers.length > 0 && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader className="py-3">
                <CardTitle className="text-sm text-destructive">Completion blockers</CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <ul className="list-inside list-disc text-sm text-destructive">
                  {data.blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Milestones</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Kickoff</p>
            <p className="font-medium">{formatDate(data?.milestones.kickoffDate ?? audit?.kickoffDate)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Fieldwork start</p>
            <p className="font-medium">{formatDate(data?.milestones.fieldworkStartDate ?? audit?.fieldworkStartDate)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Fieldwork end</p>
            <p className="font-medium">{formatDate(data?.milestones.fieldworkEndDate ?? audit?.fieldworkEndDate)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Report received</p>
            <p className="font-medium">{formatDate(data?.milestones.reportReceivedDate ?? audit?.reportReceivedDate)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Reports</CardTitle>
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
        </CardHeader>
        <CardContent className="space-y-2">
          {(audit?.reports ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports uploaded yet.</p>
          ) : (
            (audit?.reports ?? []).map((report) => (
              <div key={report._id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <span className="font-medium">{report.fileName}</span>
                {report.fileUrl ? (
                  <a href={report.fileUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    Download
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <AuditStatusPipeline
        status={status}
        nextStatuses={nextStatuses}
        blockers={data?.blockers ?? []}
        transition={transition}
        completeAudit={completeAudit}
        onCompleteClick={() => setCompleteOpen(true)}
      />

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete audit?</DialogTitle>
            <DialogDescription>
              This moves the audit to COMPLETING. Open high or critical findings will block completion.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={completeAudit.isPending}
              onClick={() => completeAudit.mutate(undefined, { onSuccess: () => setCompleteOpen(false) })}
            >
              {completeAudit.isPending ? 'Processing...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
