import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DraftEvidenceState,
  SubmittedEvidenceState,
} from '@/components/evidence';
import {
  useTestEvidenceVersions,
  useStartTestEvidence,
  useAddFileToTestVersion,
  useRemoveFileFromTestVersion,
  useSubmitTestVersion,
  useNewDraftForTest,
} from '@/api/tests';
import type { TestListItem } from '@/api/tests';
import { AlertCircle, FileText } from 'lucide-react';
import { formatDate } from '@/lib/formatters';

type TestEvidenceTabProps = {
  test: TestListItem;
  onViewInstructions?: () => void;
};

export function TestEvidenceTab({ test, onViewInstructions }: TestEvidenceTabProps) {
  const testId = test._id;
  const versionsQ = useTestEvidenceVersions(testId);
  const startDraft = useStartTestEvidence(testId);

  const evidenceIdFromTest =
    typeof test.evidenceId === 'object' && test.evidenceId
      ? test.evidenceId._id
      : test.evidenceId ?? null;

  const listPreview = versionsQ.data ?? [];
  const evidenceIdStr =
    evidenceIdFromTest ||
    (listPreview[0]?.evidenceId ? String(listPreview[0].evidenceId) : null);

  const addFile = useAddFileToTestVersion(testId, evidenceIdStr);
  const removeFile = useRemoveFileFromTestVersion(testId, evidenceIdStr);
  const submitVersion = useSubmitTestVersion(testId, evidenceIdStr);
  const newDraft = useNewDraftForTest(testId, evidenceIdStr);

  const list = listPreview;
  const draftVersion = list.find((v) => v.status === 'draft');
  const nonDraft = list.filter((v) => v.status !== 'draft');
  const activeVersion = nonDraft[0] ?? null;
  const priorVersions = nonDraft.slice(1);

  const showRenewBanner =
    (test.status === 'due_soon' || test.status === 'overdue') &&
    (test.dueDate || activeVersion?.validUntil);

  if (versionsQ.isLoading || versionsQ.isFetching) {
    return <Skeleton className="h-64 w-full rounded-lg" />;
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/80 bg-card dark:bg-[#3A5255]/20">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 size-5 shrink-0 text-[#409BA1]" />
            <div>
              <p className="font-medium text-foreground">Document instructions</p>
              <p className="text-sm text-muted-foreground">
                Review implementation and evidence collection guidance in the Instructions tab.
              </p>
            </div>
          </div>
          {onViewInstructions && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 border-[#409BA1]/50 text-[#409BA1] hover:bg-[#409BA1]/10"
              onClick={onViewInstructions}
            >
              View instructions
            </Button>
          )}
        </CardContent>
      </Card>

      {showRenewBanner && (
        <Card className="border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm">
              <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-500" />
              <span>
                {test.status === 'overdue' ? 'Renewal overdue' : 'Renewal due soon'}
                {test.dueDate && (
                  <span className="text-muted-foreground">
                    {' '}
                    — due {formatDate(test.dueDate)}
                  </span>
                )}
              </span>
            </div>
            {evidenceIdStr && (
              <Button
                type="button"
                size="sm"
                className="bg-[#409BA1] hover:bg-[#358a8f]"
                onClick={() => newDraft.mutate()}
                disabled={newDraft.isPending || !!draftVersion}
              >
                Renew
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!evidenceIdStr && list.length === 0 && (
        <Card className="border-dashed border-border/80">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No evidence draft yet. Start a draft to upload files and submit.
            </p>
            <Button
              type="button"
              className="bg-[#409BA1] hover:bg-[#358a8f]"
              onClick={() => startDraft.mutate()}
              disabled={startDraft.isPending}
            >
              {startDraft.isPending ? 'Starting…' : 'Create draft'}
            </Button>
          </CardContent>
        </Card>
      )}

      {evidenceIdStr && draftVersion && (
        <DraftEvidenceState
          evidenceId={evidenceIdStr}
          version={draftVersion}
          onAddFile={(file) => addFile.mutate({ versionId: draftVersion._id, file })}
          onRemoveFile={(versionId, fileId) => removeFile.mutate({ versionId, fileId })}
          onSubmit={(versionId) => submitVersion.mutate(versionId)}
          isAddingFile={addFile.isPending}
          isSubmitting={submitVersion.isPending}
        />
      )}

      {evidenceIdStr && !draftVersion && activeVersion && (
        <SubmittedEvidenceState
          evidenceId={evidenceIdStr}
          activeVersion={activeVersion}
          priorVersions={priorVersions}
          onNewDraft={() => newDraft.mutate()}
          isCreatingDraft={newDraft.isPending}
        />
      )}

      {evidenceIdStr && !draftVersion && !activeVersion && list.length === 0 && (
        <Card className="border-dashed border-border/80">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Evidence record exists but has no versions. Try creating a draft from the server or contact
            support.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
