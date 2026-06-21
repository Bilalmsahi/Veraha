import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  useEditorDraft,
  usePolicy,
  useSubmitPolicyForApproval,
  useUpdatePolicyVersionContent,
} from '@/api/policies';
import { useUsers } from '@/api/users';
import type { PolicyVersion } from '@/types/models';
import { PolicyEditor } from '@/components/policies';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { FormErrorAlert } from '@/components/shared';
import { getApiErrorMessage } from '@/lib/apiError';

type EditorDraftVersion = PolicyVersion & { contentHtml: string };

export function PolicyEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const policy = usePolicy(id ?? null);
  const editorDraft = useEditorDraft(id ?? null);
  const updateContent = useUpdatePolicyVersionContent();
  const submitForApproval = useSubmitPolicyForApproval();
  const users = useUsers({ limit: 100 });
  const [submitOpen, setSubmitOpen] = useState(false);
  const [selectedApproverId, setSelectedApproverId] = useState('');
  const draftVersion = useMemo<EditorDraftVersion | null>(() => {
    const version = editorDraft.data;
    if (!version) return null;
    return {
      ...version,
      contentHtml: typeof version.contentHtml === 'string' ? version.contentHtml : '',
    };
  }, [editorDraft.data]);

  const approverOptions = useMemo(
    () =>
      (users.data?.users ?? []).filter(
        (u) => (u.role === 'ADMIN' || u.role === 'MANAGER') && u.status === 'ACTIVE'
      ),
    [users.data?.users]
  );

  const handleSave = async (contentHtml: string) => {
    if (!id || !draftVersion) return;
    await updateContent.mutateAsync({
      policyId: id,
      versionId: draftVersion._id,
      contentHtml,
    });
  };

  const handleSubmit = async () => {
    if (!id || !draftVersion || !selectedApproverId) return;
    await submitForApproval.mutateAsync({
      policyId: id,
      policyVersionId: draftVersion._id,
      approverId: selectedApproverId,
    });
    setSubmitOpen(false);
    toast.success('Policy draft submitted for approval');
    navigate(`/policies/${id}`);
  };

  if (policy.error || editorDraft.error) {
    return (
      <div className="p-8">
        <FormErrorAlert
          message={
            policy.error
              ? (policy.error as Error).message
              : getApiErrorMessage(
                  editorDraft.error,
                  'Unable to open policy editor.'
                )
          }
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  if (policy.isLoading || editorDraft.isLoading || !policy.data || !draftVersion) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="w-full max-w-xl space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  const readOnly = draftVersion.status !== 'DRAFT';

  return (
    <>
      <PolicyEditor
        key={draftVersion._id}
        policyId={policy.data._id}
        versionId={draftVersion._id}
        versionNumber={draftVersion.versionNumber}
        policyTitle={policy.data.title}
        initialContent={draftVersion.contentHtml}
        initialLastSavedAt={draftVersion.editorLastSavedAt}
        readOnly={readOnly}
        onSave={handleSave}
        onClose={() => navigate(`/policies/${policy.data._id}`)}
        onSubmitForApproval={readOnly ? undefined : () => setSubmitOpen(true)}
        isSaving={updateContent.isPending}
      />

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit for approval</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Approver</Label>
            <Select value={selectedApproverId} onValueChange={setSelectedApproverId}>
              <SelectTrigger>
                <SelectValue placeholder="Select approver" />
              </SelectTrigger>
              <SelectContent>
                {approverOptions.map((u) => (
                  <SelectItem key={u._id} value={u._id}>
                    {u.firstName} {u.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Only active Admins and Managers can approve policy versions.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setSubmitOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!selectedApproverId || submitForApproval.isPending}
            >
              {submitForApproval.isPending ? 'Submitting...' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
