import { useState } from 'react';
import {
  SlideOutPanel,
  StatusBadge,
  EvidencePickerModal,
} from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useControlEvidence,
  useUpdateControl,
  useControlHistory,
  useControlComments,
  useCreateControlComment,
} from '@/api/controls';
import { useLinkControls } from '@/api/evidence';
import { useUsers } from '@/api/users';
import { useAuthStore } from '@/store/useAuthStore';
import { usePermissions } from '@/hooks/usePermissions';
import { formatDateTime, formatFrameworkCode } from '@/lib/formatters';
import type { ControlDetail } from '@/api/controls';
import type { OverallStatus } from '@/types/enums';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  ClipboardList,
  MessageSquare,
  Plus,
  Send,
} from 'lucide-react';
import { useTests } from '@/api/tests';
import { TestPickerModal } from '@/components/tests';
import { AddDocumentsToControlModal } from './AddDocumentsToControlModal';
import { MapControlRequirementsModal } from './MapControlRequirementsModal';
import { MapRiskScenarioModal } from './MapRiskScenarioModal';
import { IntegrationEvidencePanel } from '@/components/integrations/IntegrationEvidencePanel';

type ControlDetailPanelProps = {
  control: ControlDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssess?: (control: ControlDetail) => void;
};

const COVERAGE_LABELS_MAP: Record<string, string> = {
  FULL: 'Full',
  PARTIAL: 'Partial',
  GAP: 'Gap',
};

export function ControlDetailPanel({
  control,
  open,
  onOpenChange,
  onAssess,
}: ControlDetailPanelProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('mapped');
  const [linkEvidenceOpen, setLinkEvidenceOpen] = useState(false);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [frameworkModalOpen, setFrameworkModalOpen] = useState(false);
  const [riskModalOpen, setRiskModalOpen] = useState(false);
  const [testPickerOpen, setTestPickerOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const permissions = usePermissions();

  const evidenceQuery = useControlEvidence(control?._id ?? null, open);
  const linkedTestsQuery = useTests(
    control?._id ? { controlId: control._id, limit: 100 } : undefined,
    open && !!control?._id
  );
  const linkControls = useLinkControls();
  const updateControl = useUpdateControl();
  const historyQuery = useControlHistory(control?._id ?? null, open && activeTab === 'history');
  const commentsQuery = useControlComments(control?._id ?? null, open && activeTab === 'comments');
  const createComment = useCreateControlComment(control?._id ?? null);
  const currentUser = useAuthStore((s) => s.user);
  const users = useUsers({ page: 1, limit: 100 });

  if (!control) return null;

  const owner = control.owner;
  const ownerOptions = users.data?.users ?? [];
  const requirements = control.linkedRequirements ?? [];
  const evidence = evidenceQuery.data?.evidence ?? [];
  const history = historyQuery.data?.history ?? [];
  const comments = commentsQuery.data?.comments ?? [];
  const linkedPolicies = (control.linkedPolicyIds ?? []).filter(
    (p): p is { _id: string; title: string; status?: string } => typeof p === 'object' && !!p
  );
  const linkedRisks = (control.linkedRiskIds ?? []).filter(
    (r): r is { _id: string; title: string; status?: string; riskLevel?: string } =>
      typeof r === 'object' && !!r
  );

  const linkedTestsList = linkedTestsQuery.data?.tests ?? [];

  const sourceLabel = control.sourceTemplateId ? 'Veraha' : 'Custom';

  return (
    <>
      <SlideOutPanel
        open={open}
        onOpenChange={onOpenChange}
        title={`${control.identifier}: ${control.title}`}
        description={control.controlGroup ?? undefined}
        side="right"
        footer={
          activeTab === 'mapped' && onAssess ? (
            <Button variant="default" className="w-full" onClick={() => onAssess(control)}>
              Record assessment
            </Button>
          ) : undefined
        }
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="mapped">Mapped elements</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
          </TabsList>

          <TabsContent value="mapped" className="mt-4">
            <div className="space-y-6">
              <div className="space-y-4 rounded-lg border p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">ID</p>
                    <p className="mt-1 font-medium">{control.identifier}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Source</p>
                    <p className="mt-1">{sourceLabel}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Control group</p>
                    <p className="mt-1">{control.controlGroup ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Readiness</p>
                    <div className="mt-1">
                      <StatusBadge
                        status={(control.readiness?.status ?? control.overallStatus) as OverallStatus}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Owner</h4>
                  <Select
                    value={owner?._id ?? '__none__'}
                    onValueChange={(v) => {
                      updateControl.mutate({
                        id: control._id,
                        input: { ownerId: v === '__none__' ? null : v },
                      });
                    }}
                    disabled={updateControl.isPending || !currentUser || !permissions.canEditControls}
                  >
                    <SelectTrigger className="mt-1 h-9 w-full">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Unassigned</SelectItem>
                      {ownerOptions.map((user) => (
                        <SelectItem key={user._id} value={user._id}>
                          {user.firstName} {user.lastName}
                          {currentUser?._id === user._id ? ' (me)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Note</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {control.implementationNotes || 'Add a note...'}
                  </p>
                </div>
              </div>

              {control.description && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Description</h4>
                  <p className="mt-1 text-sm">{control.description}</p>
                </div>
              )}

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Documents ({evidence.length})
                  </h4>
                  {permissions.canLinkEvidenceControls && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setActiveTab('mapped');
                          setLinkEvidenceOpen(true);
                        }}
                      >
                        Link existing
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-8"
                        onClick={() => setDocumentModalOpen(true)}
                        title="Add documents"
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>
                {evidenceQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading linked documents...</p>
                ) : evidence.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No documents linked.</p>
                ) : (
                  <ul className="space-y-2">
                    {evidence.slice(0, 5).map((item) => (
                      <li
                        key={item._id}
                        className="cursor-pointer rounded-md border p-2 text-sm hover:bg-muted/30"
                        onClick={() => navigate(`/documents?open=${item._id}`)}
                      >
                        <div className="font-medium">{item.title}</div>
                        {item.category && (
                          <div className="text-xs text-muted-foreground">{item.category}</div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <ClipboardCheck className="size-4" />
                    Tests ({linkedTestsList.length})
                  </h4>
                  {permissions.canMapControls && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setTestPickerOpen(true)}
                      >
                        Link existing
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-8"
                        onClick={() => setTestPickerOpen(true)}
                        title="Link tests"
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>
                {linkedTestsQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading linked tests…</p>
                ) : linkedTestsList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tests linked.</p>
                ) : (
                  <ul className="space-y-2">
                    {linkedTestsList.map((test) => (
                      <li
                        key={test._id}
                        className="cursor-pointer rounded-md border p-2 text-sm hover:bg-muted/30"
                        onClick={() => navigate(`/tests/${test._id}`)}
                      >
                        <div className="font-medium">{test.name}</div>
                        <div className="mt-1 text-xs capitalize text-muted-foreground">
                          {test.type}{test.status ? ` · ${test.status.replace(/_/g, ' ')}` : ''}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <ClipboardList className="size-4" />
                    Framework mappings ({requirements.length})
                  </h4>
                  {permissions.canMapControls && (
                    <Button
                      size="icon"
                      variant="outline"
                      className="size-8"
                      onClick={() => setFrameworkModalOpen(true)}
                      title="Map requirement"
                    >
                      <Plus className="size-4" />
                    </Button>
                  )}
                </div>
                {requirements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No framework mappings linked.</p>
                ) : (
                  <ul className="space-y-2">
                    {requirements.map((lr, i) => (
                      <li key={i} className="rounded-md border p-2 text-sm">
                        <div className="font-medium">
                          {lr.requirement?.identifier}: {lr.requirement?.title}
                        </div>
                        <div className="mt-1 text-muted-foreground">
                          {formatFrameworkCode(lr.framework?.name ?? lr.framework?.code)} —{' '}
                          {COVERAGE_LABELS_MAP[lr.coverage] ?? lr.coverage}
                        </div>
                        {lr.justification && (
                          <p className="mt-1 text-xs text-muted-foreground">{lr.justification}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Policies ({linkedPolicies.length})
                  </h4>
                  {permissions.canMapControls && (
                    <Button size="sm" variant="outline" onClick={() => navigate('/policies')}>
                      + Add
                    </Button>
                  )}
                </div>
                {linkedPolicies.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No policies linked.</p>
                ) : (
                  <ul className="space-y-2">
                    {linkedPolicies.map((p) => (
                      <li
                        key={p._id}
                        className="cursor-pointer rounded-md border p-2 text-sm hover:bg-muted/30"
                        onClick={() => navigate(`/policies/${p._id}`)}
                      >
                        <div className="font-medium">{p.title}</div>
                        {p.status && <div className="text-xs text-muted-foreground">{p.status}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Risk scenarios ({linkedRisks.length})
                  </h4>
                  {permissions.canLinkRiskControls && (
                    <Button
                      size="icon"
                      variant="outline"
                      className="size-8"
                      onClick={() => setRiskModalOpen(true)}
                      title="Map risk scenario"
                    >
                      <Plus className="size-4" />
                    </Button>
                  )}
                </div>
                {linkedRisks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No risk scenarios linked.</p>
                ) : (
                  <ul className="space-y-2">
                    {linkedRisks.map((r) => (
                      <li
                        key={r._id}
                        className="cursor-pointer rounded-md border p-2 text-sm hover:bg-muted/30"
                        onClick={() => navigate(`/risks/${r._id}`)}
                      >
                        <div className="font-medium">{r.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.riskLevel ?? 'UNKNOWN'} {r.status ? `· ${r.status}` : ''}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="integrations" className="mt-4">
            <IntegrationEvidencePanel controlId={control._id} />
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <div className="space-y-3">
              {historyQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading activity...</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                history.map((item) => (
                  <div key={item._id} className="rounded-md border p-3">
                    <p className="text-sm font-medium">
                      {item.actorSnapshot?.name || 'A user'} {item.notes || item.action.toLowerCase()}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(item.timestamp)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="comments" className="mt-4">
            <div className="space-y-4">
              {commentsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading comments...</p>
              ) : comments.length === 0 ? (
                <div className="py-8 text-center">
                  <MessageSquare className="mx-auto mb-2 size-6 text-muted-foreground/70" />
                  <p className="text-sm text-muted-foreground">No comments yet</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {comments.map((c) => (
                    <li key={c._id} className="rounded-md border p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {c.userId?.firstName} {c.userId?.lastName}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{c.content}</p>
                    </li>
                  ))}
                </ul>
              )}

              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const nextComment = commentDraft.trim();
                  if (!nextComment) return;
                  createComment.mutate(nextComment, {
                    onSuccess: () => {
                      setCommentDraft('');
                    },
                  });
                }}
              >
                <Textarea
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  placeholder="Comment or add others with @..."
                  rows={2}
                  className="min-h-[78px] resize-none"
                  maxLength={5000}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="shrink-0"
                  disabled={!commentDraft.trim() || createComment.isPending}
                >
                  <Send className="size-4" />
                </Button>
              </form>
            </div>
          </TabsContent>
        </Tabs>
      </SlideOutPanel>

      {permissions.canLinkEvidenceControls && (
        <>
          <EvidencePickerModal
            open={linkEvidenceOpen}
            onOpenChange={setLinkEvidenceOpen}
            existingEvidenceIds={[]}
            onConfirm={(evidenceIds) => {
              if (evidenceIds.length === 0) return;
              Promise.all(
                evidenceIds.map((id) =>
                  linkControls.mutateAsync({ id, controlIds: [control._id] })
                )
              )
                .then(() => {
                  setLinkEvidenceOpen(false);
                  evidenceQuery.refetch();
                })
                .catch(() => {
                  // Error handled by mutation
                });
            }}
            title="Link documents to control"
            description="Select documents to link to this control."
          />

          <AddDocumentsToControlModal
            open={documentModalOpen}
            onOpenChange={(nextOpen) => {
              setDocumentModalOpen(nextOpen);
              if (!nextOpen) {
                evidenceQuery.refetch();
              }
            }}
            controlId={control._id}
          />
        </>
      )}
      {permissions.canMapControls && (
        <>
          <MapControlRequirementsModal
            open={frameworkModalOpen}
            onOpenChange={(nextOpen) => {
              setFrameworkModalOpen(nextOpen);
            }}
            controlId={control._id}
          />
          <TestPickerModal
            open={testPickerOpen}
            onOpenChange={setTestPickerOpen}
            controlId={control._id}
            onSuccess={() => {
              linkedTestsQuery.refetch();
            }}
          />
        </>
      )}
      {permissions.canLinkRiskControls && (
        <MapRiskScenarioModal
          open={riskModalOpen}
          onOpenChange={(nextOpen) => {
            setRiskModalOpen(nextOpen);
          }}
          controlId={control._id}
        />
      )}
    </>
  );
}
