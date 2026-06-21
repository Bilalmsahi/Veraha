import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { CalendarDays, Plus, ShieldCheck } from 'lucide-react';
import { computeEvidenceReadiness, useAudits, useAuditStats } from '@/api/audits';
import { ContextualHelpButton, PageHeader, TableSkeleton, FormErrorAlert, EmptyState } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatFrameworkCode } from '@/lib/formatters';
import { CreateAuditModal } from '@/components/audit/CreateAuditModal';
import { usePermissions } from '@/hooks/usePermissions';

export function AuditsPage() {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const [createOpen, setCreateOpen] = useState(false);
  const audits = useAudits();
  const stats = useAuditStats();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audits"
        description="Create audit engagements, assign auditors, and track evidence review."
        actions={
          <div className="flex flex-wrap gap-2">
            <ContextualHelpButton moduleId="audits" label="Status guide" />
            {permissions.canCreateAudits ? (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 size-4" />
                New audit
              </Button>
            ) : null}
          </div>
        }
      />

      {permissions.canCreateAudits && (
        <CreateAuditModal open={createOpen} onOpenChange={setCreateOpen} />
      )}

      {audits.error && (
        <FormErrorAlert
          message={(audits.error as Error).message}
          onRetry={() => audits.refetch()}
        />
      )}

      {stats.data && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-medium">Total audits</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 text-2xl font-semibold">{stats.data.total}</CardContent>
          </Card>
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-medium">In progress</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 text-2xl font-semibold">{stats.data.inProgress}</CardContent>
          </Card>
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-medium">Completed this year</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 text-2xl font-semibold">{stats.data.completedThisYear}</CardContent>
          </Card>
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-medium">Open high/critical findings</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 text-2xl font-semibold">{stats.data.openHighCriticalFindings}</CardContent>
          </Card>
        </div>
      )}

      {audits.isLoading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : (audits.data?.audits ?? []).length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No audits yet"
          description="Create an audit engagement to assign auditors and track evidence review."
          action={
            permissions.canCreateAudits
              ? {
                  label: 'New audit',
                  onClick: () => setCreateOpen(true),
                }
              : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Audit</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Readiness</th>
                <th className="px-4 py-3 font-medium">Framework</th>
                <th className="px-4 py-3 font-medium">Window</th>
                <th className="px-4 py-3 font-medium">Auditor</th>
              </tr>
            </thead>
            <tbody>
              {audits.data?.audits.map((audit) => {
                const readiness = computeEvidenceReadiness(audit.evidenceStatusCounts);
                return (
                  <tr
                    key={audit._id}
                    className="cursor-pointer border-t hover:bg-muted/40 focus-within:bg-muted/40"
                    tabIndex={0}
                    onClick={() => navigate(`/audits/${audit._id}`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        navigate(`/audits/${audit._id}`);
                      }
                    }}
                  >
                    <td className="px-4 py-3">
                      <Link to={`/audits/${audit._id}`} className="font-medium text-primary hover:underline">
                        {audit.name}
                      </Link>
                      {audit.description && <p className="text-xs text-muted-foreground">{audit.description}</p>}
                      {audit.outcome && audit.outcome !== 'PENDING' && (
                        <Badge variant="outline" className="mt-1">
                          {audit.outcome}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{audit.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="min-w-[120px] space-y-1">
                        <Progress value={readiness} className="h-2" />
                        <span className="text-xs text-muted-foreground">{readiness}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {typeof audit.frameworkId === 'object' && audit.frameworkId
                        ? formatFrameworkCode(audit.frameworkId.code ?? audit.frameworkId.name)
                        : 'Any'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="size-3.5" />
                        {new Date(audit.periodStart).toLocaleDateString()} -{' '}
                        {new Date(audit.periodEnd).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <ShieldCheck className="size-3.5" />
                        {audit.auditorEmail || 'Unassigned'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
