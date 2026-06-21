import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/formatters';
import {
  useApprovePolicyVersion,
  useCancelPolicyApproval,
  openPolicyContentDocument,
  useImportPolicyContentDocument,
  useRejectPolicyVersion,
  useSubmitPolicyForApproval,
} from '@/api/policies';
import type { PolicyDetail } from '@/api/policies';
import { FileText, Plus, Send, CheckCircle, XCircle, Undo2, Eye, Pencil } from 'lucide-react';
import { CreateVersionModal } from './CreateVersionModal';
import { PolicyPublishModal } from './PolicyPublishModal';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useUsers } from '@/api/users';
import { useAuthStore } from '@/store/useAuthStore';
import { usePermissions } from '@/hooks/usePermissions';
import { getApiErrorMessage } from '@/lib/apiError';
import { toast } from 'sonner';

type PolicyVersionPanelProps = {
  policy: PolicyDetail;
};

export function PolicyVersionPanel({ policy }: PolicyVersionPanelProps) {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishVersionId, setPublishVersionId] = useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitVersionId, setSubmitVersionId] = useState<string | null>(null);
  const [selectedApproverId, setSelectedApproverId] = useState<string>('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectVersionId, setRejectVersionId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const navigate = useNavigate();
  const versions = policy.versions ?? [];
  const submitForApproval = useSubmitPolicyForApproval();
  const approveVersion = useApprovePolicyVersion();
  const rejectVersion = useRejectPolicyVersion();
  const cancelApproval = useCancelPolicyApproval();
  const importPolicyContent = useImportPolicyContentDocument();
  const currentUser = useAuthStore((s) => s.user);
  const permissions = usePermissions();
  const policyApproverIds = ((policy.approverIds ?? []) as Array<string | { _id: string }>).map((approver) =>
    typeof approver === 'object' && approver ? String(approver._id) : String(approver)
  );
  const isPolicyApprover = !!currentUser?._id && policyApproverIds.some((id) => id === String(currentUser._id));
  const canApproveOrReject = permissions.canApprovePolicies && isPolicyApprover;
  const usersData = useUsers({ limit: 100 });
  const approverOptions = useMemo(
    () =>
      (usersData.data?.users ?? []).filter(
        (u) =>
          (u.role === 'ADMIN' || u.role === 'MANAGER') &&
          u.status === 'ACTIVE'
      ),
    [usersData.data?.users]
  );

  const handlePublish = (versionId: string) => {
    setPublishVersionId(versionId);
    setPublishModalOpen(true);
  };

  const handleOpenSubmit = (versionId: string) => {
    setSubmitVersionId(versionId);
    setSelectedApproverId('');
    setSubmitOpen(true);
  };

  const handleViewContent = async (versionId: string) => {
    try {
      await openPolicyContentDocument(policy._id, versionId);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const handleEditContent = async (versionId: string) => {
    try {
      await importPolicyContent.mutateAsync({ policyId: policy._id, input: { versionId } });
      navigate(`/policies/${policy._id}/edit`);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const handleSubmitForApproval = async () => {
    if (!submitVersionId || !selectedApproverId) return;
    await submitForApproval.mutateAsync({
      policyId: policy._id,
      policyVersionId: submitVersionId,
      approverId: selectedApproverId,
    });
    setSubmitOpen(false);
  };

  const handleApprove = async (versionId: string) => {
    await approveVersion.mutateAsync({ policyId: policy._id, versionId });
  };

  const handleOpenReject = (versionId: string) => {
    setRejectVersionId(versionId);
    setRejectReason('');
    setRejectOpen(true);
  };

  const handleReject = async () => {
    if (!rejectVersionId) return;
    await rejectVersion.mutateAsync({ policyId: policy._id, versionId: rejectVersionId, reason: rejectReason });
    setRejectOpen(false);
  };

  const canCancelSubmission = (submittedBy?: string | null) => {
    const currentId = currentUser?._id ? String(currentUser._id) : null;
    if (!currentId) return false;
    const ownerId =
      typeof policy.ownerId === 'object' && policy.ownerId && '_id' in policy.ownerId
        ? String(policy.ownerId._id)
        : policy.ownerId
          ? String(policy.ownerId)
          : null;
    return currentId === ownerId || currentId === String(submittedBy || '');
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" />
            Versions
          </CardTitle>
          {permissions.canEditPolicyVersions && (
            <Button size="sm" variant="outline" onClick={() => setCreateModalOpen(true)}>
              <Plus className="mr-2 size-4" />
              Add version
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No versions yet.</p>
          ) : (
            <ul className="space-y-2">
              {versions.map((v) => (
                <li
                  key={v._id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <span className="font-medium">v{v.versionNumber}</span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      {v.status} · {formatDate(v.effectiveDate)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {(v.contentHtml || v.fileKey || policy.templateId) && (
                      <Button size="sm" variant="outline" onClick={() => handleViewContent(v._id)}>
                        <Eye className="mr-1 size-3" />
                        View content
                      </Button>
                    )}
                    {v.status === 'DRAFT' && permissions.canEditPolicyVersions && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditContent(v._id)}
                        disabled={importPolicyContent.isPending}
                      >
                        <Pencil className="mr-1 size-3" />
                        {importPolicyContent.isPending ? 'Opening...' : 'Edit content'}
                      </Button>
                    )}
                    {v.status === 'DRAFT' && permissions.canSubmitPoliciesForApproval && (
                      <Button
                        size="sm"
                        onClick={() => handleOpenSubmit(v._id)}
                        disabled={submitForApproval.isPending}
                      >
                        Submit for approval
                      </Button>
                    )}
                    {v.status === 'PENDING_APPROVAL' && canApproveOrReject && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApprove(v._id)}
                          disabled={approveVersion.isPending}
                        >
                          <CheckCircle className="mr-1 size-3" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenReject(v._id)}
                          disabled={rejectVersion.isPending}
                        >
                          <XCircle className="mr-1 size-3" />
                          Reject
                        </Button>
                      </>
                    )}
                    {v.status === 'PENDING_APPROVAL' && permissions.canSubmitPoliciesForApproval && canCancelSubmission(v.submittedBy) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => cancelApproval.mutate({ policyId: policy._id, versionId: v._id })}
                        disabled={cancelApproval.isPending}
                      >
                        <Undo2 className="mr-1 size-3" />
                        Cancel submission
                      </Button>
                    )}
                    {v.status === 'APPROVED' && permissions.canPublishPolicies && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePublish(v._id)}
                      >
                        <Send className="mr-1 size-3" />
                        Publish
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {permissions.canEditPolicyVersions && (
        <CreateVersionModal
          policyId={policy._id}
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          onSuccess={() => setCreateModalOpen(false)}
        />
      )}

      {permissions.canPublishPolicies && publishVersionId && (
        <PolicyPublishModal
          open={publishModalOpen}
          onOpenChange={setPublishModalOpen}
          policyId={policy._id}
          policyVersionId={publishVersionId}
          defaultTarget="ALL_PERSONNEL"
        />
      )}

      {permissions.canSubmitPoliciesForApproval && (
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit for approval</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
                      {policyApproverIds.includes(String(u._id)) ? ' (assigned)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Only Admins and Managers can be approvers.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setSubmitOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmitForApproval} disabled={!selectedApproverId || submitForApproval.isPending}>
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}

      {canApproveOrReject && (
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reject version</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleReject} disabled={rejectVersion.isPending}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}
    </>
  );
}
