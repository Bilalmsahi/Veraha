import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ContextualHelpButton, PageHeader, ConfirmDialog } from '@/components/shared';
import {
  RiskScoreBadge,
  EditRiskModal,
  CloseRiskModal,
  RiskLinkControlsModal,
} from '@/components/risks';
import {
  useRisk,
  useReopenRisk,
  useDeleteRisk,
  useUpdateRisk,
} from '@/api/risks';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FormErrorAlert } from '@/components/shared';
import { useAuthStore } from '@/store/useAuthStore';
import { usePermissions } from '@/hooks/usePermissions';
import { formatDate } from '@/lib/formatters';
import { ArrowLeft, Pencil, RotateCcw, Trash2, Link2 } from 'lucide-react';
import type { RiskTier } from '@/types/enums';

export function RiskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [linkControlsOpen, setLinkControlsOpen] = useState(false);

  const risk = useRisk(id ?? null);
  const reopenRisk = useReopenRisk();
  const deleteRisk = useDeleteRisk();
  const updateRisk = useUpdateRisk();
  const currentUser = useAuthStore((s) => s.user);
  const permissions = usePermissions();

  if (risk.error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Risk" />
        <FormErrorAlert
          message={(risk.error as Error).message}
          onRetry={() => risk.refetch()}
        />
      </div>
    );
  }

  if (risk.isLoading || !risk.data) {
    return <Skeleton className="h-96 w-full" />;
  }

  const r = risk.data;
  const owner = typeof r.ownerId === 'object' ? r.ownerId : null;
  const controls = r.mitigatingControlIds ?? [];
  const controlIds = controls.map((c) => c._id);
  const isOpen = r.status === 'OPEN';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/risks')}>
          <ArrowLeft className="size-4" />
        </Button>
        <PageHeader
          title={r.title}
          description={r.identifier ?? r.category ?? undefined}
          actions={
            <div className="flex items-center gap-2">
              <ContextualHelpButton moduleId="risks" current={{ status: r.status }} />
              {permissions.canEditRisks && (
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="mr-2 size-4" />
                  Edit
                </Button>
              )}
              {permissions.canEditRisks && (
                isOpen ? (
                  <Button variant="outline" size="sm" onClick={() => setCloseOpen(true)}>
                    Close
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => id && reopenRisk.mutate({ id })}
                    disabled={reopenRisk.isPending}
                  >
                    <RotateCcw className="mr-2 size-4" />
                    Reopen
                  </Button>
                )
              )}
              {permissions.canDeleteRisks && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteConfirm(true)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete
                </Button>
              )}
            </div>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {r.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{r.description}</p>
              </CardContent>
            </Card>
          )}

          {r.treatmentPlan && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Treatment plan</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{r.treatmentPlan}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Mitigating controls ({controls.length})</CardTitle>
              {permissions.canLinkRiskControls && (
                <Button size="sm" variant="outline" onClick={() => setLinkControlsOpen(true)}>
                  <Link2 className="mr-2 size-4" />
                  Link controls
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {controls.length === 0 ? (
                <p className="text-sm text-muted-foreground">No controls linked yet.</p>
              ) : (
                <ul className="space-y-2">
                  {controls.map((c) => (
                    <li
                      key={c._id}
                      className="text-sm cursor-pointer hover:text-primary"
                      onClick={() => navigate(`/controls?highlight=${c._id}`)}
                    >
                      {c.identifier}: {c.title}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Risk level:</span>{' '}
                <RiskScoreBadge
                  score={r.residualScore}
                  riskLevel={r.riskLevel as RiskTier}
                />
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span> {r.status}
              </div>
              <div>
                <span className="text-muted-foreground">Treatment:</span>{' '}
                {r.treatment ?? '—'}
              </div>
              <div>
                <span className="text-muted-foreground">Likelihood:</span>{' '}
                {r.likelihood ?? '—'}
              </div>
              <div>
                <span className="text-muted-foreground">Impact:</span>{' '}
                {r.impact ?? '—'}
              </div>
              <div>
                <span className="text-muted-foreground">Owner:</span>{' '}
                <Select
                  value={owner?._id ?? '__none__'}
                  onValueChange={(v) => {
                    if (id) {
                      updateRisk.mutate({
                        id,
                        input: { ownerId: v === '__none__' ? null : v },
                      });
                    }
                  }}
                  disabled={updateRisk.isPending || !currentUser || !permissions.canEditRisks}
                >
                  <SelectTrigger className="mt-1 h-9 w-[180px]">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {currentUser && (
                      <SelectItem value={currentUser._id}>
                        {currentUser.firstName} {currentUser.lastName} (me)
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <span className="text-muted-foreground">Identified:</span>{' '}
                {formatDate(r.identifiedAt)}
              </div>
              <div>
                <span className="text-muted-foreground">Next review:</span>{' '}
                {formatDate(r.nextReviewDue)}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {permissions.canEditRisks && (
        <>
          <EditRiskModal
            risk={r}
            open={editOpen}
            onOpenChange={setEditOpen}
          />

          <CloseRiskModal
            risk={r}
            open={closeOpen}
            onOpenChange={setCloseOpen}
          />
        </>
      )}

      {permissions.canLinkRiskControls && (
        <RiskLinkControlsModal
          riskId={id ?? null}
          existingControlIds={controlIds}
          open={linkControlsOpen}
          onOpenChange={setLinkControlsOpen}
        />
      )}

      {permissions.canDeleteRisks && (
        <ConfirmDialog
          open={deleteConfirm}
          onOpenChange={setDeleteConfirm}
          title="Delete risk"
          description={`Delete "${r.title}"? This cannot be undone.`}
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={async () => {
            if (id) {
              await deleteRisk.mutateAsync(id);
              setDeleteConfirm(false);
              navigate('/risks');
            }
          }}
          loading={deleteRisk.isPending}
        />
      )}
    </div>
  );
}
