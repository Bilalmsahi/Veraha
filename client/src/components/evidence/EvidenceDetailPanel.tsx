import { useMemo, useState } from 'react';
import { SlideOutPanel, ConfirmDialog } from '@/components/shared';
import { StatusBadge } from '@/components/shared';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ReviewEvidenceModal,
  EvidenceLinkControlsModal,
  EditEvidenceModal,
} from '@/components/evidence';
import { toast } from 'sonner';
import { useDeleteEvidence, useUpdateEvidence, useCreateEvidence } from '@/api/evidence';
import { formatDate, formatFileSize } from '@/lib/formatters';
import type { EvidenceDetail } from '@/api/evidence';
import type { EvidenceStatus } from '@/types/enums';
import { Button } from '@/components/ui/button';
import { ExternalLink, ClipboardCheck, Trash2, Link2, Pencil, RotateCcw, Copy, AlertCircle } from 'lucide-react';
import { InstructionContent } from '@/components/shared/InstructionContent';
import { usePermissions } from '@/hooks/usePermissions';

type EvidenceDetailPanelProps = {
  evidence: EvidenceDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function EvidenceDetailPanel({
  evidence,
  open,
  onOpenChange,
  onSuccess,
}: EvidenceDetailPanelProps) {
  const soonThreshold = useMemo(() => {
    const now = new Date();
    return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }, []);

  const [reviewOpen, setReviewOpen] = useState(false);
  const [linkControlsOpen, setLinkControlsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const deleteEvidence = useDeleteEvidence();
  const updateEvidence = useUpdateEvidence();
  const createEvidence = useCreateEvidence();
  const permissions = usePermissions();

  if (!evidence) return null;

  const linkedControls = evidence.linkedControlIds ?? [];
  const controlIds = linkedControls.map((c) => c._id);
  const canReview = permissions.canReviewEvidence && evidence.status === 'PENDING';
  const showRenewBanner =
    evidence.validUntil &&
    evidence.status === 'APPROVED' &&
    new Date(evidence.validUntil) <= soonThreshold;

  const handleDeleteSuccess = () => {
    onOpenChange(false);
    onSuccess?.();
  };

  const handleRenew = () => {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    updateEvidence.mutate(
      { id: evidence._id, input: { validUntil: nextYear } },
      { onSuccess: () => onSuccess?.() }
    );
  };

  return (
    <>
    <SlideOutPanel
      open={open}
      onOpenChange={onOpenChange}
      title={evidence.title}
      description={evidence.category ?? undefined}
      side="right"
      actions={
        <div className="flex items-center gap-2">
          {permissions.canEditEvidence && (
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 size-4" />
              Edit
            </Button>
          )}
          {canReview && (
            <Button size="sm" variant="outline" onClick={() => setReviewOpen(true)}>
              <ClipboardCheck className="mr-2 size-4" />
              Review
            </Button>
          )}
          {permissions.canLinkEvidenceControls && (
            <Button size="sm" variant="outline" onClick={() => setLinkControlsOpen(true)}>
              <Link2 className="mr-2 size-4" />
              Link controls
            </Button>
          )}
          {permissions.canDeleteEvidence && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDeleteConfirm(true)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-2 size-4" />
              Delete
            </Button>
          )}
        </div>
      }
    >
      {showRenewBanner && evidence.validUntil && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm">
          <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-500" />
          <span>Renew before {formatDate(evidence.validUntil)}</span>
        </div>
      )}
      <Tabs defaultValue="evidence" className="w-full">
        <TabsList variant="line" className="w-full justify-start border-b flex-wrap h-auto gap-1">
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="controls">Controls</TabsTrigger>
          <TabsTrigger value="instructions">Instructions</TabsTrigger>
          <TabsTrigger value="tasks">Tasks (0)</TabsTrigger>
          <TabsTrigger value="audits">Audits (0)</TabsTrigger>
          <TabsTrigger value="comments">Comments (0)</TabsTrigger>
        </TabsList>
        <TabsContent value="evidence" className="mt-4 space-y-4">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
            <div className="mt-2">
              <StatusBadge status={evidence.status as EvidenceStatus} />
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-muted-foreground">File</h4>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm">{evidence.fileName ?? '—'}</span>
              {evidence.sizeBytes != null && (
                <span className="text-xs text-muted-foreground">
                  ({formatFileSize(evidence.sizeBytes)})
                </span>
              )}
              {evidence.fileUrl && (
                <a
                  href={evidence.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink className="size-4" />
                  Open file
                </a>
              )}
            </div>
            {permissions.canEditEvidence && evidence.fileUrl && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                disabled={createEvidence.isPending}
                onClick={async () => {
                  try {
                    const res = await fetch(evidence.fileUrl!);
                    const blob = await res.blob();
                    const file = new File([blob], evidence.fileName || 'copy.pdf', { type: blob.type });
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('title', `${evidence.title} (copy)`);
                    if (evidence.description) formData.append('description', evidence.description);
                    if (evidence.category) formData.append('category', evidence.category);
                    if (controlIds.length) formData.append('linkedControlIds', controlIds.join(','));
                    createEvidence.mutate(formData, {
                      onSuccess: () => {
                        toast.success('Document copied to new draft');
                        onSuccess?.();
                      },
                    });
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Failed to copy document');
                  }
                }}
              >
                <Copy className="mr-2 size-4" />
                Copy files to new draft
              </Button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Valid from</h4>
              <p className="mt-1 text-sm">{formatDate(evidence.validFrom)}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Renew by</h4>
              <div className="mt-1 flex items-center gap-2">
                <p className="text-sm">{formatDate(evidence.validUntil)}</p>
                {permissions.canEditEvidence && evidence.validUntil && evidence.status === 'APPROVED' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleRenew}
                    disabled={updateEvidence.isPending}
                  >
                    <RotateCcw className="mr-1 size-3" />
                    Renew
                  </Button>
                )}
              </div>
            </div>
          </div>

          {evidence.description && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Description</h4>
              <p className="mt-1 text-sm">{evidence.description}</p>
            </div>
          )}
        </TabsContent>
        <TabsContent value="controls" className="mt-4">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground">
              Linked controls ({linkedControls.length})
            </h4>
            {linkedControls.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No controls linked yet. Click &quot;Link controls&quot; to add.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {linkedControls.map((c) => (
                  <li key={c._id} className="text-sm flex items-start gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{c.identifier}</span>
                    <span>{c.title}</span>
                  </li>
                ))}
              </ul>
            )}
            {permissions.canLinkEvidenceControls && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => setLinkControlsOpen(true)}
              >
                <Link2 className="mr-2 size-4" />
                Add control
              </Button>
            )}
          </div>
        </TabsContent>
        <TabsContent value="instructions" className="mt-4">
          <div className="rounded-md border p-4 bg-muted/30">
            <h4 className="text-sm font-medium">Evidence requirements</h4>
            {evidence.description?.trim() ? (
              <InstructionContent
                content={evidence.description}
                className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground"
              />
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc list-inside">
                <li>Upload a file that demonstrates compliance with the linked controls</li>
                <li>Supported formats: PDF, Word, Excel, images</li>
                <li>Ensure documents are current and renewed before expiry</li>
              </ul>
            )}
          </div>
        </TabsContent>
        <TabsContent value="tasks" className="mt-4">
          <p className="text-sm text-muted-foreground">No tasks for this document.</p>
        </TabsContent>
        <TabsContent value="audits" className="mt-4">
          <p className="text-sm text-muted-foreground">No audits linked to this document.</p>
        </TabsContent>
        <TabsContent value="comments" className="mt-4">
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        </TabsContent>
      </Tabs>
    </SlideOutPanel>

    {permissions.canEditEvidence && (
      <EditEvidenceModal
        evidence={evidence}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={onSuccess}
      />
    )}

    {permissions.canReviewEvidence && (
      <ReviewEvidenceModal
        evidence={evidence}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
      />
    )}

    {permissions.canLinkEvidenceControls && (
      <EvidenceLinkControlsModal
        evidenceId={evidence._id}
        existingControlIds={controlIds}
        open={linkControlsOpen}
        onOpenChange={setLinkControlsOpen}
      />
    )}

    {permissions.canDeleteEvidence && (
      <ConfirmDialog
        open={deleteConfirm}
        onOpenChange={setDeleteConfirm}
        title="Delete evidence"
        description={`Delete "${evidence.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          await deleteEvidence.mutateAsync(evidence._id);
          setDeleteConfirm(false);
          handleDeleteSuccess();
        }}
        loading={deleteEvidence.isPending}
      />
    )}
    </>
  );
}
