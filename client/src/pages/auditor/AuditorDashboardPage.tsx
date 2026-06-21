import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuditorEngagements } from '@/api/auditor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader, TableSkeleton, FormErrorAlert, EmptyState } from '@/components/shared';

export function AuditorDashboardPage() {
  const engagements = useAuditorEngagements();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assigned audits"
        description="Review evidence for engagements assigned to you."
      />

      {engagements.error && (
        <FormErrorAlert
          message={(engagements.error as Error).message}
          onRetry={() => engagements.refetch()}
        />
      )}

      {engagements.isLoading ? (
        <TableSkeleton rows={5} columns={4} />
      ) : (engagements.data ?? []).length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No active audit assignments"
          description="When an organization assigns you to an audit, it will appear here."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {engagements.data?.map((assignment) => (
            <div key={assignment._id} className="rounded-md border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{assignment.auditId.name}</h2>
                  <p className="text-sm text-muted-foreground">{assignment.organizationId?.name}</p>
                </div>
                <Badge variant="secondary">{assignment.auditId.status}</Badge>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {new Date(assignment.auditId.periodStart).toLocaleDateString()} -{' '}
                {new Date(assignment.auditId.periodEnd).toLocaleDateString()}
              </p>
              <Button asChild size="sm" className="mt-4">
                <Link to={`/auditor/audits/${assignment.auditId._id}`}>Open</Link>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
