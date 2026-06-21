import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ContextualHelpButton, PageHeader, FormErrorAlert, ConfirmDialog, DetailPageHeader } from '@/components/shared';
import {
  TestEvidenceTab,
  TestCommentsPanel,
  TestDetailInstructionsTab,
  TestDetailControlsTab,
  TestDetailTasksTab,
  TestDetailAuditsTab,
} from '@/components/tests';
import {
  useTest,
  useDeactivateTest,
  useReactivateTest,
  useSnoozeTest,
  useUnsnoozeTest,
  useArchiveTest,
  useMarkTestNA,
  useDeleteTest,
} from '@/api/tests';
import { usePermissions } from '@/hooks/usePermissions';
import { formatDate } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  ClipboardList,
  FileText,
  History as HistoryIcon,
  MessageSquare,
  Moon,
  Shield,
  RotateCcw,
  Trash2,
} from 'lucide-react';

const TABS = [
  { id: 'evidence' as const, label: 'Evidence', icon: FileText },
  { id: 'instructions' as const, label: 'Instructions', icon: FileText },
  { id: 'tasks' as const, label: 'Tasks', icon: ClipboardList },
  { id: 'controls' as const, label: 'Controls', icon: Shield },
  { id: 'audits' as const, label: 'Audits', icon: HistoryIcon },
  { id: 'comments' as const, label: 'Comments', icon: MessageSquare },
];

export function TestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const permissions = usePermissions();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['id']>('evidence');
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [snoozeUntil, setSnoozeUntil] = useState('');
  const [deactivateConfirm, setDeactivateConfirm] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const testQuery = useTest(id ?? null);
  const deactivate = useDeactivateTest();
  const reactivate = useReactivateTest();
  const snooze = useSnoozeTest();
  const unsnooze = useUnsnoozeTest();
  const archiveTest = useArchiveTest();
  const markTestNA = useMarkTestNA();
  const removeTest = useDeleteTest();

  const t = testQuery.data;

  if (testQuery.error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Test" />
        <FormErrorAlert
          message={(testQuery.error as Error).message}
          onRetry={() => testQuery.refetch()}
        />
      </div>
    );
  }

  if (testQuery.isLoading || !t) {
    return <Skeleton className="h-96 w-full rounded-lg" />;
  }

  const owner = typeof t.ownerId === 'object' && t.ownerId ? t.ownerId : null;
  const linked =
    (t.linkedControlIds ?? []).filter((c) => typeof c === 'object' && c && '_id' in c) as Array<{
      _id: string;
      identifier?: string;
      title?: string;
      linkedRequirements?: Array<{
        frameworkId?: { _id?: string; code?: string; name?: string };
      }>;
    }>;

  const renewalLabel = t.renewalPeriod
    ? `Renew ${t.renewalPeriod.replace(/_/g, ' ')}`
    : null;
  const hasFutureSnooze = Boolean(t.snoozedUntil && new Date(t.snoozedUntil) > new Date());
  const workflowState = t.workflowState ?? (t.archivedAt ? 'ARCHIVED' : !t.isActive ? 'INACTIVE' : hasFutureSnooze ? 'SNOOZED' : 'ACTIVE');
  const headerDescription =
    t.description &&
    !t.instructions?.trim() &&
    !t.evidenceGuidance?.trim() &&
    t.description.length <= 180
      ? t.description
      : undefined;

  const handleSnoozeSubmit = () => {
    if (!id || !snoozeUntil) return;
    const iso = new Date(snoozeUntil).toISOString();
    snooze.mutate(
      { id, snoozedUntil: iso },
      {
        onSuccess: () => {
          setSnoozeOpen(false);
          setSnoozeUntil('');
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <DetailPageHeader
        backTo="/tests"
        parentLabel="Tests"
        title={t.name}
        description={headerDescription}
        actions={
          <div className="flex flex-wrap gap-2">
                <ContextualHelpButton
                  moduleId="tests"
                  current={{ status: workflowState || t.status, label: t.status }}
                />
                {permissions.canDeactivateTests && (!t.isActive ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => id && reactivate.mutate(id)}
                    disabled={reactivate.isPending}
                  >
                    <RotateCcw className="mr-2 size-4" />
                    Reactivate
                  </Button>
                ) : (
                  <>
                    {permissions.canSnoozeTests && (
                      <Button variant="outline" size="sm" onClick={() => setSnoozeOpen(true)}>
                        <Moon className="mr-2 size-4" />
                        Snooze
                      </Button>
                    )}
                    {hasFutureSnooze && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => id && unsnooze.mutate(id)}
                        disabled={unsnooze.isPending}
                      >
                        Unsnooze (snoozed until {formatDate(t.snoozedUntil)})
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setDeactivateConfirm(true)}>
                      Deactivate
                    </Button>
                    {permissions.canArchiveTests && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => id && markTestNA.mutate(id)}
                          disabled={markTestNA.isPending}
                        >
                          Mark N/A
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setArchiveConfirm(true)}
                          disabled={archiveTest.isPending}
                        >
                          Archive
                        </Button>
                      </>
                    )}
                  </>
                ))}
                {permissions.canDeleteTests && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setDeleteConfirm(true)}
                    disabled={removeTest.isPending}
                  >
                    <Trash2 className="mr-2 size-4" />
                    Delete
                  </Button>
                )}
          </div>
        }
        meta={
          <div className="mt-2 flex flex-wrap gap-2">
            {owner && (
              <Badge variant="secondary" className="font-normal">
                Owner: {owner.firstName} {owner.lastName}
              </Badge>
            )}
            <Badge variant="outline" className="font-normal">
              {t.category}
            </Badge>
            <Badge variant="outline" className="font-normal capitalize">
              {t.type}
            </Badge>
            {renewalLabel && (
              <Badge variant="outline" className="font-normal">
                {renewalLabel}
              </Badge>
            )}
            <Badge variant="outline" className="font-normal capitalize">
              Rollout: {t.rollout.replace(/_/g, ' ')}
            </Badge>
            <Badge variant="outline" className="font-normal capitalize">
              Health: {t.status}
            </Badge>
            <Badge
              variant="outline"
              className="font-normal capitalize"
              title="This test is excluded from readiness scoring while inactive. Reactivate to resume monitoring."
            >
              Workflow: {workflowState.replace(/_/g, ' ').toLowerCase()}
            </Badge>
          </div>
        }
      />

      <div className="border-b border-border/80">
        <nav className="flex flex-wrap gap-1" aria-label="Test sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors -mb-px',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <tab.icon className="size-4" />
              {tab.label}
              {tab.id === 'controls' && linked.length > 0 && (
                <span className="text-xs text-muted-foreground">({linked.length})</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      <div className="space-y-6">
        {activeTab === 'evidence' && (
          <TestEvidenceTab test={t} onViewInstructions={() => setActiveTab('instructions')} />
        )}

        {activeTab === 'instructions' && (
          <TestDetailInstructionsTab
            instructions={t.instructions}
            evidenceGuidance={t.evidenceGuidance}
          />
        )}

        {activeTab === 'tasks' && <TestDetailTasksTab />}

        {activeTab === 'controls' && (
          <TestDetailControlsTab
            linked={linked}
            onControlClick={(controlId) => navigate(`/controls?detail=${controlId}`)}
          />
        )}

        {activeTab === 'audits' && <TestDetailAuditsTab test={test.data} />}

        {activeTab === 'comments' && id && <TestCommentsPanel testId={id} />}
      </div>

      {permissions.canSnoozeTests && (
      <Dialog open={snoozeOpen} onOpenChange={setSnoozeOpen}>
        <DialogContent className="border-border/80 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Snooze test</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="snooze-until">Snooze until</Label>
            <Input
              id="snooze-until"
              type="datetime-local"
              value={snoozeUntil}
              onChange={(e) => setSnoozeUntil(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              This test is excluded from readiness scoring while snoozed. It resumes monitoring after this date.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSnoozeOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#409BA1] hover:bg-[#358a8f]"
              disabled={!snoozeUntil || snooze.isPending}
              onClick={handleSnoozeSubmit}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}

      {permissions.canDeactivateTests && (
        <ConfirmDialog
          open={deactivateConfirm}
          onOpenChange={setDeactivateConfirm}
          title="Deactivate test"
          description="This test is excluded from readiness scoring while inactive. Reactivate to resume monitoring."
          confirmLabel="Deactivate"
          variant="default"
          onConfirm={async () => {
            if (id) await deactivate.mutateAsync(id);
            setDeactivateConfirm(false);
          }}
          loading={deactivate.isPending}
        />
      )}

      {permissions.canArchiveTests && (
        <ConfirmDialog
          open={archiveConfirm}
          onOpenChange={setArchiveConfirm}
          title="Archive test"
          description="Archive this test? It will be treated as satisfied in workflow readiness."
          confirmLabel="Archive"
          variant="default"
          onConfirm={async () => {
            if (id) await archiveTest.mutateAsync(id);
            setArchiveConfirm(false);
          }}
          loading={archiveTest.isPending}
        />
      )}

      {permissions.canDeleteTests && (
        <ConfirmDialog
          open={deleteConfirm}
          onOpenChange={setDeleteConfirm}
          title="Delete test permanently?"
          description="This will soft-delete the test. It can only be restored from the database by an administrator."
          confirmLabel="Delete test"
          variant="destructive"
          onConfirm={async () => {
            if (!id) return;
            await removeTest.mutateAsync(id);
            setDeleteConfirm(false);
            navigate('/tests');
          }}
          loading={removeTest.isPending}
        />
      )}
    </div>
  );
}
