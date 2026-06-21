import { useParams, useNavigate } from 'react-router-dom';
import {
  useAccessReviewCampaign,
  useActivateAccessReviewCampaign,
  useArchiveAccessReviewCampaign,
  useConfirmAccessRevocation,
  useDeleteAccessReviewCampaign,
} from '@/api/accessReviews';
import { AccessReviewTaskDecision } from '@/components/access-reviews/AccessReviewTaskDecision';
import { AccessReviewTaskReassign } from '@/components/access-reviews/AccessReviewTaskReassign';
import { ContextualHelpButton, PageHeader, TableSkeleton } from '@/components/shared';
import { useAuthStore } from '@/store/useAuthStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useState } from 'react';

function campaignProgress(total: number, completed: number) {
  if (!total) return 0;
  return Math.round((completed / total) * 100);
}

export function AccessReviewDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const campaign = useAccessReviewCampaign(id ?? null);
  const activate = useActivateAccessReviewCampaign();
  const archive = useArchiveAccessReviewCampaign();
  const deleteCampaign = useDeleteAccessReviewCampaign();
  const confirmRevocation = useConfirmAccessRevocation();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const data = campaign.data;
  const summary = data?.taskSummary;
  const pct = campaignProgress(data?.totalTasks ?? 0, data?.completedTasks ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={data?.name ?? 'Access review'}
        description={
          data?.resourceName
            ? `${data.resourceName}${data.resourceType ? ` (${data.resourceType})` : ''}`
            : data?.description || 'Campaign detail'
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <ContextualHelpButton moduleId="accessReviews" current={{ status: data?.status }} />
            {isAdmin && data?.status === 'DRAFT' && (
              <Button size="sm" onClick={() => id && activate.mutate(id)} disabled={activate.isPending}>
                Activate
              </Button>
            )}
            {isAdmin && data?.status === 'COMPLETED' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => id && archive.mutate(id, { onSuccess: () => navigate('/access-reviews') })}
                disabled={archive.isPending}
              >
                Archive
              </Button>
            )}
            {isAdmin && data?.status === 'DRAFT' && (
              <Button size="sm" variant="outline" onClick={() => setDeleteOpen(true)}>
                Delete
              </Button>
            )}
          </div>
        }
      />

      {campaign.isLoading ? (
        <TableSkeleton rows={4} columns={5} />
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant="secondary" className="mt-2">{data.status}</Badge>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Due</p>
              <p className="mt-2 text-sm">{new Date(data.dueDate).toLocaleDateString()}</p>
            </div>
            <div className="rounded-md border p-3 space-y-2">
              <p className="text-xs text-muted-foreground">Progress</p>
              <p className="text-sm">{data.completedTasks}/{data.totalTasks}</p>
              <Progress value={pct} />
            </div>
          </div>

          {summary && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Pending: {summary.PENDING}</Badge>
              <Badge variant="outline">Approved: {summary.APPROVED}</Badge>
              <Badge variant="outline">Revoke requested: {summary.REVOKE_REQUESTED}</Badge>
              <Badge variant="outline">Escalated: {summary.ESCALATED}</Badge>
              <Badge variant="outline">Revoked: {summary.REVOKED}</Badge>
            </div>
          )}

          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3">Person</th>
                  <th className="px-4 py-3">Reviewer</th>
                  <th className="px-4 py-3">Access</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Decision</th>
                  <th className="px-4 py-3">Revocation</th>
                  {isAdmin && <th className="px-4 py-3">Assign</th>}
                </tr>
              </thead>
              <tbody>
                {(data.tasks ?? []).map((task) => (
                  <tr key={task._id} className="border-t align-top">
                    <td className="px-4 py-3">
                      {task.subjectUserId?.firstName} {task.subjectUserId?.lastName}
                    </td>
                    <td className="px-4 py-3">
                      {task.reviewerId?.firstName} {task.reviewerId?.lastName}
                    </td>
                    <td className="px-4 py-3">{task.resourceName} / {task.accessRole}</td>
                    <td className="px-4 py-3"><Badge variant="secondary">{task.status}</Badge></td>
                    <td className="px-4 py-3">
                      <AccessReviewTaskDecision task={task} isAdmin={isAdmin} />
                    </td>
                    <td className="px-4 py-3">
                      {task.status === 'REVOKE_REQUESTED' && !task.revocationConfirmedAt ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!isAdmin || confirmRevocation.isPending}
                          onClick={() => confirmRevocation.mutate(task._id)}
                        >
                          Confirm revoked
                        </Button>
                      ) : (
                        task.revocationConfirmedAt ? 'Confirmed' : '—'
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <AccessReviewTaskReassign
                          taskId={task._id}
                          currentReviewerId={task.reviewerId?._id}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete campaign?</DialogTitle>
            <DialogDescription>This permanently removes the draft campaign.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteCampaign.isPending}
              onClick={() => {
                if (id) {
                  deleteCampaign.mutate(id, {
                    onSuccess: () => navigate('/access-reviews'),
                  });
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
