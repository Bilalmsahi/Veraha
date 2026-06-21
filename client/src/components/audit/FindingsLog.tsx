import { useMemo, useState } from 'react';
import {
  type AuditFinding,
  type AuditSummary,
  useAuditFindings,
  useCreateAuditFinding,
  useDeleteAuditFinding,
  useUpdateAuditFinding,
} from '@/api/audits';
import { useControls } from '@/api/controls';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EnumBadge } from '@/components/shared/EnumBadge';
import { FINDING_SEVERITY_LABELS, FINDING_SEVERITY_SOFT } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';

function personName(user?: { firstName?: string; lastName?: string; email?: string }) {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return name || user?.email || '-';
}

type Props = {
  auditId: string;
  audit?: AuditSummary;
};

export default function FindingsLog({ auditId, audit }: Props) {
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AuditFinding | null>(null);
  const [controlFilter, setControlFilter] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    severity: 'MEDIUM' as AuditFinding['severity'],
    linkedControl: '',
  });

  const findingsQuery = useAuditFindings(auditId);
  const createFinding = useCreateAuditFinding(auditId);
  const updateFinding = useUpdateAuditFinding(auditId);
  const deleteFinding = useDeleteAuditFinding(auditId);
  const permissions = usePermissions();

  const scopedIds = useMemo(
    () =>
      (audit?.scopedControlIds ?? [])
        .map((c) => (typeof c === 'string' ? c : c?._id))
        .filter(Boolean) as string[],
    [audit?.scopedControlIds]
  );
  const controlsQuery = useControls({ limit: 100, ids: scopedIds.length ? scopedIds : undefined });

  const filteredControls = useMemo(() => {
    const controls = controlsQuery.data?.controls ?? [];
    const q = controlFilter.trim().toLowerCase();
    if (!q) return controls;
    return controls.filter((c) =>
      `${c.identifier ?? ''} ${c.title ?? ''}`.toLowerCase().includes(q)
    );
  }, [controlFilter, controlsQuery.data]);

  const displayedFindings = useMemo(() => {
    const all = findingsQuery.data ?? [];
    return all.filter((f) => {
      if (severityFilter && f.severity !== severityFilter) return false;
      if (statusFilter && f.status !== statusFilter) return false;
      return true;
    });
  }, [findingsQuery.data, severityFilter, statusFilter]);

  function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim()) return;
    createFinding.mutate(
      {
        title: form.title.trim(),
        description: form.description.trim(),
        severity: form.severity,
        linkedControl: form.linkedControl || null,
      },
      {
        onSuccess: () => {
          setForm({ title: '', description: '', severity: 'MEDIUM', linkedControl: '' });
          setFormOpen(false);
        },
      }
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold">Findings</h2>
        {permissions.canEditAudits && (
          <button
            type="button"
            className="w-fit rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            onClick={() => setFormOpen((v) => !v)}
          >
            Add finding
          </button>
        )}
      </div>

      {findingsQuery.isError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          Failed to load findings. Please refresh.
        </div>
      )}

      <div className="mb-2 flex flex-wrap gap-2">
        <select
          className="rounded-md border bg-background px-2 py-1 text-sm"
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
        >
          <option value="">All severities</option>
          <option value="LOW">LOW</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HIGH">HIGH</option>
          <option value="CRITICAL">CRITICAL</option>
        </select>
        <select
          className="rounded-md border bg-background px-2 py-1 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="OPEN">OPEN</option>
          <option value="REMEDIATED">REMEDIATED</option>
          <option value="ACCEPTED_RISK">ACCEPTED_RISK</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Linked Control</th>
              <th className="px-4 py-3">Remediation</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created by</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {findingsQuery.isLoading ? (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={7}>
                  Loading findings...
                </td>
              </tr>
            ) : displayedFindings.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={7}>
                  No findings match filters.
                </td>
              </tr>
            ) : (
              displayedFindings.map((finding) => (
                <tr
                  key={finding._id}
                  className={cn('border-t align-top', finding.severity === 'CRITICAL' && 'border-l-4 border-l-destructive')}
                >
                  <td className="px-4 py-3">
                    <EnumBadge
                      label={FINDING_SEVERITY_LABELS[finding.severity] ?? finding.severity}
                      softTone={FINDING_SEVERITY_SOFT[finding.severity]}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{finding.title}</p>
                    {finding.description && (
                      <p className="mt-1 text-xs text-muted-foreground">{finding.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {finding.linkedControl
                      ? `${finding.linkedControl.identifier ?? ''} ${finding.linkedControl.title ?? ''}`.trim()
                      : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {permissions.canEditAudits ? (
                      <textarea
                        className="min-h-16 w-full rounded-md border bg-background px-2 py-1 text-xs"
                        defaultValue={finding.remediationNote ?? ''}
                        placeholder="Remediation notes"
                        onBlur={(e) => {
                          if ((finding.remediationNote ?? '') !== e.target.value) {
                            updateFinding.mutate({ findingId: finding._id, remediationNote: e.target.value });
                          }
                        }}
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground">{finding.remediationNote ?? '-'}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {permissions.canEditAudits ? (
                      <select
                        className="rounded-md border bg-background px-2 py-1 text-sm"
                        value={finding.status}
                        onChange={(e) =>
                          updateFinding.mutate({
                            findingId: finding._id,
                            status: e.target.value as AuditFinding['status'],
                          })
                        }
                      >
                        <option value="OPEN">OPEN</option>
                        <option value="REMEDIATED">REMEDIATED</option>
                        <option value="ACCEPTED_RISK">ACCEPTED_RISK</option>
                      </select>
                    ) : (
                      finding.status
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{personName(finding.createdBy)}</td>
                  <td className="px-4 py-3">
                    {permissions.canEditAudits && (
                      <button
                        type="button"
                        className="text-xs text-destructive hover:underline disabled:opacity-50"
                        disabled={deleteFinding.isPending}
                        onClick={() => setDeleteTarget(finding)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {permissions.canEditAudits && formOpen && (
        <form className="space-y-3 rounded-md border bg-muted/20 p-4" onSubmit={handleCreate}>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="fl-title">
                Title
              </label>
              <input
                id="fl-title"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="fl-severity">
                Severity
              </label>
              <select
                id="fl-severity"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.severity}
                onChange={(e) =>
                  setForm((p) => ({ ...p, severity: e.target.value as AuditFinding['severity'] }))
                }
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="fl-description">
              Description
            </label>
            <textarea
              id="fl-description"
              className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
            <input
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={controlFilter}
              onChange={(e) => setControlFilter(e.target.value)}
              placeholder="Search scoped controls"
            />
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={form.linkedControl}
              onChange={(e) => setForm((p) => ({ ...p, linkedControl: e.target.value }))}
              disabled={controlsQuery.isLoading}
            >
              <option value="">
                {controlsQuery.isLoading ? 'Loading controls...' : 'No linked control'}
              </option>
              {filteredControls.map((control) => (
                <option key={control._id} value={control._id}>
                  {control.identifier ? `${control.identifier}: ${control.title}` : control.title}
                </option>
              ))}
            </select>
          </div>
          {createFinding.isError && (
            <p className="text-sm text-destructive">{String(createFinding.error)}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              disabled={createFinding.isPending}
            >
              {createFinding.isPending ? 'Saving...' : 'Save finding'}
            </button>
            <button
              type="button"
              className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
              onClick={() => setFormOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete finding"
        description={`Delete "${deleteTarget?.title ?? 'this finding'}"? This cannot be undone.`}
        confirmLabel="Delete finding"
        loading={deleteFinding.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteFinding.mutateAsync(deleteTarget._id);
          setDeleteTarget(null);
        }}
      />
    </section>
  );
}
