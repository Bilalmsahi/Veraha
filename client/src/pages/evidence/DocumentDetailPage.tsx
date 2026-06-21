import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ContextualHelpButton, PageHeader, FormErrorAlert, ConfirmDialog, StatusBadge, DetailPageHeader } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ReviewEvidenceModal,
  EvidenceMapControlsModal,
  EditEvidenceModal,
  EvidenceCommentsPanel,
  EmptyEvidenceState,
  DraftEvidenceState,
  SubmittedEvidenceState,
  DirectEvidenceFileState,
  type DirectEvidenceFileInfo,
} from '@/components/evidence';
import {
  useDeleteEvidence,
  useEvidence,
  useArchiveEvidence,
  useUnarchiveEvidence,
  useEvidenceVersions,
  useCreateDraftVersion,
  useAddFileToVersion,
  useRemoveFileFromVersion,
  useSubmitVersion,
  useCreateNewDraftVersion,
} from '@/api/evidence';
import { formatDate } from '@/lib/formatters';
import { usePermissions } from '@/hooks/usePermissions';
import type { EvidenceStatus } from '@/types/enums';
import { PolicyControlsPanel } from '@/components/policies';
import { InstructionContent } from '@/components/shared/InstructionContent';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  ArrowLeft,
  ClipboardList,
  ClipboardCheck,
  FileText,
  History as HistoryIcon,
  MessageSquare,
  Pencil,
  Shield,
  Trash2,
} from 'lucide-react';

const DOC_TABS = [
  { id: 'evidence', label: 'Evidence', icon: FileText },
  { id: 'instructions', label: 'Instructions', icon: FileText },
  { id: 'tasks', label: 'Tasks', icon: ClipboardList },
  { id: 'controls', label: 'Controls', icon: Shield },
  { id: 'audits', label: 'Audits', icon: HistoryIcon },
  { id: 'comments', label: 'Comments', icon: MessageSquare },
] as const;

type DocumentTabId = (typeof DOC_TABS)[number]['id'];

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const permissions = usePermissions();
  const soonThreshold = useMemo(() => {
    const now = new Date();
    return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }, []);

  const evidence = useEvidence(id ?? null);
  const deleteEvidence = useDeleteEvidence();
  const archiveEvidence = useArchiveEvidence();
  const unarchiveEvidence = useUnarchiveEvidence();

  const [editOpen, setEditOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [linkControlsOpen, setLinkControlsOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [unarchiveConfirm, setUnarchiveConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<DocumentTabId>('evidence');

  if (evidence.error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Document" />
        <FormErrorAlert
          message={(evidence.error as Error).message}
          onRetry={() => evidence.refetch()}
        />
      </div>
    );
  }

  if (evidence.isLoading || !evidence.data) {
    return <Skeleton className="h-96 w-full" />;
  }

  const doc = evidence.data;
  const linkedControls = (doc.linkedControlIds ?? []) as Array<
    { _id: string; identifier?: string; title?: string } | string
  >;
  const controlIds = linkedControls.map((c) =>
    typeof c === 'object' && c && '_id' in c ? c._id : String(c)
  );
  const canReview = permissions.canReviewEvidence && doc.status === 'PENDING';
  const isArchived = Boolean(doc.archivedAt);

  const showRenewBanner =
    doc.validUntil &&
    doc.status === 'APPROVED' &&
    new Date(doc.validUntil) <= soonThreshold;

  const handleDelete = async () => {
    await deleteEvidence.mutateAsync(doc._id);
    setDeleteConfirm(false);
    navigate('/documents');
  };

  return (
    <div className="space-y-6 bg-background">
      <DetailPageHeader
        backTo="/documents"
        parentLabel="Documents"
        title={doc.title}
        description={doc.category}
        actions={
          <>
            <ContextualHelpButton moduleId="documents" current={{ status: doc.status }} />
            <StatusBadge status={doc.status as EvidenceStatus} />
            {canReview && (
              <Button variant="outline" size="sm" onClick={() => setReviewOpen(true)}>
                <ClipboardCheck className="mr-2 size-4" />
                Review
              </Button>
            )}
            {permissions.canEditEvidence && (
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-2 size-4" />
                Edit details
              </Button>
            )}
            {permissions.canArchiveEvidence && (
              !isArchived ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setArchiveConfirm(true)}
                  disabled={archiveEvidence.isPending}
                >
                  Archive
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUnarchiveConfirm(true)}
                  disabled={unarchiveEvidence.isPending}
                >
                  Unarchive
                </Button>
              )
            )}
            {permissions.canDeleteEvidence && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setDeleteConfirm(true)}
                className="text-destructive hover:text-destructive"
                title="Delete"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </>
        }
      />

      {/* Tabs - aligned with PolicyDetailPage / RiskScenarioDetailPage */}
      <div className="border-b">
        <nav className="flex gap-4" aria-label="Document sections">
          {DOC_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors -mb-px',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <tab.icon className="size-4" />
              {tab.id === 'controls'
                ? `${tab.label} ${linkedControls.length}`
                : tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="space-y-6">
        {activeTab === 'evidence' && (
          <>
            {showRenewBanner && doc.validUntil && (
              <Card>
                <CardContent className="flex items-center gap-2 py-3 text-sm">
                  <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-500" />
                  <span>Renew before {formatDate(doc.validUntil)}</span>
                </CardContent>
              </Card>
            )}
            <EvidenceTabVersioned
              evidenceId={doc._id}
              canEdit={permissions.canEditEvidence}
              directFile={
                doc.fileName
                  ? {
                      fileName: doc.fileName,
                      mimeType: doc.mimeType,
                      sizeBytes: doc.sizeBytes,
                      source: doc.source,
                      reviewedAt: doc.reviewedAt,
                      uploadedBy: doc.uploadedBy,
                    }
                  : null
              }
            />
          </>
        )}

        {activeTab === 'instructions' && <InstructionsTab description={doc.description} />}

        {activeTab === 'tasks' && <TasksTab canCreate={permissions.canEditEvidence} />}

        {activeTab === 'controls' && (
          <PolicyControlsPanel
            linkedControls={linkedControls}
            onMapControl={() => setLinkControlsOpen(true)}
            canMapControls={permissions.canLinkEvidenceControls}
            emptyStateEntityLabel="document"
          />
        )}

        {activeTab === 'audits' && <AuditsTab />}

        {activeTab === 'comments' && doc._id && (
          <EvidenceCommentsPanel evidenceId={doc._id} />
        )}
      </div>

      {permissions.canEditEvidence && (
        <EditEvidenceModal
          evidence={doc}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}

      {permissions.canReviewEvidence && (
        <ReviewEvidenceModal
          evidence={doc}
          open={reviewOpen}
          onOpenChange={setReviewOpen}
        />
      )}

      {permissions.canLinkEvidenceControls && (
        <EvidenceMapControlsModal
          evidenceId={doc._id}
          existingControlIds={controlIds}
          open={linkControlsOpen}
          onOpenChange={setLinkControlsOpen}
          onSuccess={() => evidence.refetch()}
        />
      )}

      {permissions.canDeleteEvidence && (
        <ConfirmDialog
          open={deleteConfirm}
          onOpenChange={setDeleteConfirm}
          title="Delete document"
          description={`Delete "${doc.title}"? This cannot be undone.`}
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={handleDelete}
          loading={deleteEvidence.isPending}
        />
      )}

      {permissions.canArchiveEvidence && (
        <>
          <ConfirmDialog
            open={archiveConfirm}
            onOpenChange={setArchiveConfirm}
            title="Archive document"
            description={`Archive "${doc.title}"? Archived evidence counts as satisfied for readiness.`}
            confirmLabel="Archive"
            variant="default"
            onConfirm={async () => {
              await archiveEvidence.mutateAsync(doc._id);
              setArchiveConfirm(false);
              evidence.refetch();
            }}
            loading={archiveEvidence.isPending}
          />

          <ConfirmDialog
            open={unarchiveConfirm}
            onOpenChange={setUnarchiveConfirm}
            title="Unarchive document"
            description={`Unarchive "${doc.title}" and return it to normal readiness evaluation?`}
            confirmLabel="Unarchive"
            variant="default"
            onConfirm={async () => {
              await unarchiveEvidence.mutateAsync(doc._id);
              setUnarchiveConfirm(false);
              evidence.refetch();
            }}
            loading={unarchiveEvidence.isPending}
          />
        </>
      )}
    </div>
  );
}

function EvidenceTabVersioned({
  evidenceId,
  canEdit,
  directFile,
}: {
  evidenceId: string;
  canEdit: boolean;
  directFile?: DirectEvidenceFileInfo | null;
}) {
  const versions = useEvidenceVersions(evidenceId);
  const createDraft = useCreateDraftVersion(evidenceId);
  const addFileToVersion = useAddFileToVersion(evidenceId);
  const removeFileFromVersion = useRemoveFileFromVersion(evidenceId);
  const submitVersion = useSubmitVersion(evidenceId);
  const createNewDraft = useCreateNewDraftVersion(evidenceId);

  const list = versions.data ?? [];
  const draftVersion = list.find((v) => v.status === 'draft');
  const nonDraft = list.filter((v) => v.status !== 'draft');
  const activeVersion = nonDraft[0] ?? null;
  const priorVersions = nonDraft.slice(1);

  const handleEmptyFileSelect = (file: File) => {
    createDraft.mutate(undefined, {
      onSuccess: (data) => {
        addFileToVersion.mutate({ versionId: data._id, file });
      },
    });
  };

  if (versions.isLoading || versions.isFetching) {
    return <Skeleton className="h-64 w-full rounded-lg" />;
  }

  if (draftVersion) {
    return (
      <DraftEvidenceState
        evidenceId={evidenceId}
        version={draftVersion}
        onAddFile={(file) =>
          addFileToVersion.mutate({ versionId: draftVersion._id, file })
        }
        onRemoveFile={(versionId, fileId) =>
          removeFileFromVersion.mutate({ versionId, fileId })
        }
        onSubmit={(versionId) => submitVersion.mutate(versionId)}
        isAddingFile={addFileToVersion.isPending}
        isSubmitting={submitVersion.isPending}
        canEdit={canEdit}
      />
    );
  }

  if (activeVersion) {
    return (
      <SubmittedEvidenceState
        evidenceId={evidenceId}
        activeVersion={activeVersion}
        priorVersions={priorVersions}
        onNewDraft={() => createNewDraft.mutate()}
        isCreatingDraft={createNewDraft.isPending}
        canEdit={canEdit}
      />
    );
  }

  if (directFile?.fileName) {
    return <DirectEvidenceFileState evidenceId={evidenceId} file={directFile} />;
  }

  return (
    <EmptyEvidenceState
      evidenceId={evidenceId}
      onFileSelect={handleEmptyFileSelect}
      isUploading={createDraft.isPending || addFileToVersion.isPending}
      canEdit={canEdit}
    />
  );
}

function InstructionsTab({ description }: { description?: string }) {
  if (description?.trim()) {
    return (
      <div className="rounded-md border bg-muted/40 p-4">
        <h3 className="text-sm font-medium text-foreground">Evidence requirements</h3>
        <InstructionContent
          content={description}
          className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground"
        />
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-muted/40 p-4">
      <h3 className="text-sm font-medium text-foreground">Evidence requirements</h3>
      <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
        <li>Upload a file that demonstrates compliance with the linked controls.</li>
        <li>Supported formats: PDF, Word, Excel, and common image types.</li>
        <li>Ensure documents are current and renewed before expiry.</li>
      </ul>
    </div>
  );
}

function TasksTab({ canCreate }: { canCreate: boolean }) {
  return (
    <div className="flex min-h-[200px] items-center justify-center rounded-md border bg-muted/30 px-6 py-10 text-center">
      <div className="max-w-sm space-y-3">
        <h3 className="text-base font-medium text-foreground">
          Assign work to your team
        </h3>
        <p className="text-sm text-muted-foreground">
          Break this document into actionable tasks, add owners, and track completion
          for upcoming audits.
        </p>
        {canCreate && <Button size="sm">Create task</Button>}
      </div>
    </div>
  );
}

function AuditsTab() {
  return (
    <div className="rounded-md border bg-muted/30 p-4">
      <h3 className="text-sm font-medium text-foreground">Audit history</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        When this document is sampled during an audit, details like auditor comments,
        sampled date, and outcome will appear here.
      </p>
    </div>
  );
}
