import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useAccessReviewCampaigns,
  useAccessReviewTasks,
  useArchiveAccessReviewCampaign,
  useCreateAccessReviewCampaign,
  useDeleteAccessReviewCampaign,
  type AccessReviewTaskStatus,
} from '@/api/accessReviews';
import { AccessReviewTaskDecision } from '@/components/access-reviews/AccessReviewTaskDecision';
import { ContextualHelpButton, PageHeader, TableSkeleton, FormErrorAlert } from '@/components/shared';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useAuthStore } from '@/store/useAuthStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';

function isCampaignOverdue(dueDate: string, status: string) {
  if (['COMPLETED', 'ARCHIVED'].includes(status)) return false;
  return new Date(dueDate).getTime() < Date.now();
}

function campaignProgress(campaign: { totalTasks: number; completedTasks: number }) {
  if (!campaign.totalTasks) return 0;
  return Math.round((campaign.completedTasks / campaign.totalTasks) * 100);
}

export function AccessReviewsPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const campaigns = useAccessReviewCampaigns();
  const createCampaign = useCreateAccessReviewCampaign();
  const archiveCampaign = useArchiveAccessReviewCampaign();
  const deleteCampaign = useDeleteAccessReviewCampaign();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [reviewerType, setReviewerType] = useState<'ADMIN' | 'MANAGER'>('MANAGER');
  const [resourceType, setResourceType] = useState('Platform');
  const [resourceName, setResourceName] = useState('');

  const [taskStatusFilter, setTaskStatusFilter] = useState<AccessReviewTaskStatus | ''>('');
  const [campaignFilter, setCampaignFilter] = useState('');
  const [deleteCampaignTarget, setDeleteCampaignTarget] = useState<{ _id: string; name: string } | null>(null);

  const taskParams = useMemo(() => {
    const params: { status?: AccessReviewTaskStatus; campaignId?: string } = {};
    if (taskStatusFilter) params.status = taskStatusFilter;
    if (campaignFilter) params.campaignId = campaignFilter;
    return Object.keys(params).length ? params : undefined;
  }, [taskStatusFilter, campaignFilter]);

  const tasks = useAccessReviewTasks(taskParams);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Access reviews"
        description="Run manual access review campaigns and record reviewer decisions."
        actions={<ContextualHelpButton moduleId="accessReviews" label="Status guide" />}
      />

      {(campaigns.error || tasks.error) && (
        <FormErrorAlert
          message={((campaigns.error ?? tasks.error) as Error).message}
          onRetry={() => {
            campaigns.refetch();
            tasks.refetch();
          }}
        />
      )}

      {isAdmin && (
        <section className="space-y-4 rounded-md border p-4">
          <h2 className="text-base font-semibold">Create campaign</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dueDate">Due date</Label>
              <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="reviewerType">Reviewer type</Label>
              <select
                id="reviewerType"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={reviewerType}
                onChange={(e) => setReviewerType(e.target.value as 'ADMIN' | 'MANAGER')}
              >
                <option value="MANAGER">Managers</option>
                <option value="ADMIN">Admins only</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="resourceName">System / resource name</Label>
              <Input
                id="resourceName"
                value={resourceName}
                onChange={(e) => setResourceName(e.target.value)}
                placeholder="e.g. GitHub, AWS Console"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="resourceType">Resource type (optional)</Label>
              <Input
                id="resourceType"
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value)}
                placeholder="e.g. SaaS, Cloud"
              />
            </div>
          </div>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
          <Button
            disabled={!name || !dueDate || createCampaign.isPending}
            onClick={() =>
              createCampaign.mutate(
                { name, description, dueDate, reviewerType, resourceType, resourceName },
                {
                  onSuccess: () => {
                    setName('');
                    setDescription('');
                    setDueDate('');
                    setResourceName('');
                    setResourceType('Platform');
                  },
                }
              )
            }
          >
            Create
          </Button>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Campaigns</h2>
        {campaigns.isLoading ? (
          <TableSkeleton rows={4} columns={5} />
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Progress</th>
                  {isAdmin && <th className="px-4 py-3">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {(campaigns.data ?? []).map((campaign) => {
                  const overdue = isCampaignOverdue(campaign.dueDate, campaign.status);
                  const pct = campaignProgress(campaign);
                  return (
                    <tr key={campaign._id} className="border-t align-top">
                      <td className="px-4 py-3">
                        <Link to={`/access-reviews/${campaign._id}`} className="font-medium text-primary hover:underline">
                          {campaign.name}
                        </Link>
                        {campaign.resourceName && (
                          <p className="text-xs text-muted-foreground mt-1">{campaign.resourceName}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary">{campaign.status}</Badge>
                          {overdue && <Badge variant="destructive">Overdue</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3">{new Date(campaign.dueDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3 min-w-[140px]">
                        <p className="text-xs mb-1">{campaign.completedTasks}/{campaign.totalTasks}</p>
                        <Progress value={pct} />
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {campaign.status === 'COMPLETED' && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={archiveCampaign.isPending}
                                onClick={() => archiveCampaign.mutate(campaign._id)}
                              >
                                Archive
                              </Button>
                            )}
                            {campaign.status === 'DRAFT' && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={deleteCampaign.isPending}
                                onClick={() => setDeleteCampaignTarget(campaign)}
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={!!deleteCampaignTarget}
        onOpenChange={(open) => !open && setDeleteCampaignTarget(null)}
        title="Delete draft campaign"
        description={`Delete "${deleteCampaignTarget?.name ?? 'this draft campaign'}"? Review tasks for this draft will be removed.`}
        confirmLabel="Delete campaign"
        loading={deleteCampaign.isPending}
        onConfirm={async () => {
          if (!deleteCampaignTarget) return;
          await deleteCampaign.mutateAsync(deleteCampaignTarget._id);
          setDeleteCampaignTarget(null);
        }}
      />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">My review tasks</h2>
          <div className="flex flex-wrap gap-2">
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={taskStatusFilter}
              onChange={(e) => setTaskStatusFilter(e.target.value as AccessReviewTaskStatus | '')}
            >
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REVOKE_REQUESTED">Revoke requested</option>
              <option value="ESCALATED">Escalated</option>
              <option value="REVOKED">Revoked</option>
            </select>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
            >
              <option value="">All campaigns</option>
              {(campaigns.data ?? []).map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3">Person</th>
                <th className="px-4 py-3">Access</th>
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Decision</th>
              </tr>
            </thead>
            <tbody>
              {(tasks.data ?? []).map((task) => (
                <tr key={task._id} className="border-t align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{task.subjectUserId?.firstName} {task.subjectUserId?.lastName}</p>
                    <p className="text-xs text-muted-foreground">{task.subjectUserId?.email}</p>
                  </td>
                  <td className="px-4 py-3">{task.resourceName} / {task.accessRole}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {typeof task.campaignId === 'object' && task.campaignId?.name ? task.campaignId.name : '—'}
                  </td>
                  <td className="px-4 py-3"><Badge variant="secondary">{task.status}</Badge></td>
                  <td className="px-4 py-3">
                    <AccessReviewTaskDecision task={task} isAdmin={isAdmin} />
                  </td>
                </tr>
              ))}
              {(tasks.data ?? []).length === 0 && (
                <tr><td className="px-4 py-6 text-muted-foreground" colSpan={5}>No review tasks.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
