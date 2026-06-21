import { Link, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  ShieldCheck,
  UserCog,
} from 'lucide-react';
import { ContextualHelpButton, PageHeader, FormErrorAlert, TableSkeleton, EmptyState } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  useAdminPersonnelPeople,
  useAdminPersonnelTasks,
  useMyPersonnelTasks,
  usePersonnelReviewQueue,
  type PersonnelTask,
  type PersonnelTaskStatus,
  type PersonnelTaskType,
  type ReviewQueueItem,
} from '@/api/personnelTasks';
import {
  ChecklistStatusCell,
  DeviceSettingsForm,
  DeviceSettingsReviewDrawer,
} from '@/components/devices';
import { useAcknowledgePolicyWorkflow } from '@/api/policies';
import { DEVICE_SETTINGS_CHECKLIST } from '@/constants/deviceSettingsChecklist';
import { usePermissions } from '@/hooks/usePermissions';
import { formatDate } from '@/lib/formatters';

const STATUS_LABELS: Record<PersonnelTaskStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In progress',
  AWAITING_REVIEW: 'Awaiting review',
  COMPLETE: 'Complete',
  OVERDUE: 'Overdue',
  REJECTED: 'Rejected',
};

const TYPE_LABELS: Record<PersonnelTaskType, string> = {
  DEVICE_SETTINGS: 'Device settings',
  POLICY_ACK: 'Policy acknowledgement',
  BACKGROUND_CHECK: 'Background check',
  TRAINING: 'Training',
};

function statusVariant(status: PersonnelTaskStatus) {
  if (status === 'COMPLETE') return 'default';
  if (status === 'OVERDUE' || status === 'REJECTED') return 'destructive';
  return 'secondary';
}

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="size-4 text-primary" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function PolicyAcknowledgeDialog({
  task,
  open,
  onOpenChange,
}: {
  task: PersonnelTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const acknowledge = useAcknowledgePolicyWorkflow();

  const handleAcknowledge = async () => {
    if (!task?.policyId) return;
    await acknowledge.mutateAsync(task.policyId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Acknowledge policy</DialogTitle>
          <DialogDescription>
            Confirm you have read and understood this policy.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border p-3 text-sm">
          <p className="font-medium">{task?.title}</p>
          {task?.description && <p className="mt-1 text-muted-foreground">{task.description}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleAcknowledge} disabled={!task?.policyId || acknowledge.isPending}>
            {acknowledge.isPending ? 'Acknowledging...' : 'Acknowledge'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskAction({
  task,
  onOpenDeviceSettings,
  onAcknowledgePolicy,
}: {
  task: PersonnelTask;
  onOpenDeviceSettings: (deviceId: string) => void;
  onAcknowledgePolicy: (task: PersonnelTask) => void;
}) {
  if (task.type === 'POLICY_ACK' && task.policyId) {
    return (
      <div className="flex flex-wrap gap-2">
        {task.status === 'PENDING' && (
          <Button size="sm" onClick={() => onAcknowledgePolicy(task)}>
            Acknowledge
          </Button>
        )}
        <Button asChild size="sm" variant="outline">
          <Link to={`/policies/${task.policyId}`}>Open policy</Link>
        </Button>
      </div>
    );
  }
  if (task.type === 'DEVICE_SETTINGS' && task.deviceId) {
    return (
      <Button size="sm" variant="outline" onClick={() => onOpenDeviceSettings(task.deviceId!)}>
        Submit settings
      </Button>
    );
  }
  if (task.type === 'TRAINING' && task.trainingModuleId) {
    return (
      <Button asChild size="sm" variant="outline">
        <Link to={`/personnel/training/${task.trainingModuleId}`}>Open training</Link>
      </Button>
    );
  }
  return (
    <Button size="sm" variant="outline" disabled>
      Coming next
    </Button>
  );
}

function TaskRow({
  task,
  onOpenDeviceSettings,
  onAcknowledgePolicy,
}: {
  task: PersonnelTask;
  onOpenDeviceSettings: (deviceId: string) => void;
  onAcknowledgePolicy: (task: PersonnelTask) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-b px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{task.title}</p>
          <Badge variant={statusVariant(task.status)}>{STATUS_LABELS[task.status]}</Badge>
          <Badge variant="outline">{TYPE_LABELS[task.type]}</Badge>
        </div>
        {task.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{task.description}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {task.dueDate ? `Due ${formatDate(task.dueDate)}` : 'No due date'} · {task.cycleKey}
        </p>
      </div>
      <TaskAction
        task={task}
        onOpenDeviceSettings={onOpenDeviceSettings}
        onAcknowledgePolicy={onAcknowledgePolicy}
      />
    </div>
  );
}

function MyTasksPanel() {
  const myTasks = useMyPersonnelTasks();
  const [deviceSettingsId, setDeviceSettingsId] = useState<string | null>(null);
  const [acknowledgeTask, setAcknowledgeTask] = useState<PersonnelTask | null>(null);

  if (myTasks.isLoading) return <TableSkeleton rows={6} columns={4} />;
  if (myTasks.error) {
    return (
      <FormErrorAlert
        message={(myTasks.error as Error).message}
        onRetry={() => myTasks.refetch()}
      />
    );
  }

  const data = myTasks.data;
  const tasks = data?.tasks ?? [];
  const completion = data?.summary.total
    ? Math.round((data.summary.complete / data.summary.total) * 100)
    : 100;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Total tasks" value={data?.summary.total ?? 0} icon={ClipboardCheck} />
        <StatCard title="Complete" value={data?.summary.complete ?? 0} icon={CheckCircle2} />
        <StatCard title="Overdue" value={data?.summary.overdue ?? 0} icon={AlertCircle} />
        <StatCard title="Awaiting review" value={data?.summary.awaitingReview ?? 0} icon={FileSearch} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">My security tasks</CardTitle>
            <div className="min-w-48">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>Completion</span>
                <span>{completion}%</span>
              </div>
              <Progress value={completion} className="h-2" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {tasks.length ? (
            tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onOpenDeviceSettings={setDeviceSettingsId}
                onAcknowledgePolicy={setAcknowledgeTask}
              />
            ))
          ) : (
            <EmptyState
              icon={ShieldCheck}
              title="No personnel tasks yet"
              description="Assigned policy acknowledgements, device checks, training, and background checks will appear here."
              className="py-12"
            />
          )}
        </CardContent>
      </Card>
      <Sheet open={Boolean(deviceSettingsId)} onOpenChange={(open) => !open && setDeviceSettingsId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Device settings</SheetTitle>
            <SheetDescription>
              Submit endpoint settings without leaving Personnel.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {deviceSettingsId && (
              <DeviceSettingsForm
                deviceId={deviceSettingsId}
                onSuccess={() => {
                  setDeviceSettingsId(null);
                  myTasks.refetch();
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
      <PolicyAcknowledgeDialog
        task={acknowledgeTask}
        open={Boolean(acknowledgeTask)}
        onOpenChange={(open) => !open && setAcknowledgeTask(null)}
      />
    </div>
  );
}

function ReviewQueueTable({
  items,
  onSelect,
}: {
  items: ReviewQueueItem[];
  onSelect: (item: ReviewQueueItem) => void;
}) {
  const checklistByKey = (item: ReviewQueueItem, key: string) =>
    item.evidence?.checklistItems?.find((entry) => entry.key === key);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-3 font-medium">Employee</th>
            <th className="px-3 py-3 font-medium">Device</th>
            <th className="px-3 py-3 font-medium">Submitted</th>
            {DEVICE_SETTINGS_CHECKLIST.map((item) => (
              <th key={item.key} className="px-3 py-3 font-medium">
                {item.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="cursor-pointer border-b last:border-b-0 hover:bg-muted/30"
              onClick={() => onSelect(item)}
            >
              <td className="px-3 py-3">
                <p className="font-medium">
                  {item.user ? `${item.user.firstName} ${item.user.lastName}` : 'Unknown user'}
                </p>
                <p className="text-xs text-muted-foreground">{item.user?.email}</p>
              </td>
              <td className="px-3 py-3">
                <p className="font-medium">{(item.metadata?.deviceName as string) || item.title}</p>
                <p className="text-xs text-muted-foreground">{item.metadata?.os as string}</p>
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {item.submittedAt ? formatDate(item.submittedAt) : '—'}
              </td>
              {DEVICE_SETTINGS_CHECKLIST.map((definition) => {
                const entry = checklistByKey(item, definition.key);
                return (
                  <td key={definition.key} className="px-3 py-3">
                    {entry ? (
                      <ChecklistStatusCell status={entry.status} />
                    ) : (
                      <ChecklistStatusCell status="unchecked" />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PeopleTabPanel() {
  const people = useAdminPersonnelPeople();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">People</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {people.isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={5} columns={4} />
          </div>
        ) : people.error ? (
          <div className="p-4">
            <FormErrorAlert message={(people.error as Error).message} onRetry={() => people.refetch()} />
          </div>
        ) : (people.data ?? []).length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Person</th>
                  <th className="px-4 py-3 font-medium">Complete</th>
                  <th className="px-4 py-3 font-medium">Overdue</th>
                  <th className="px-4 py-3 font-medium">Review</th>
                </tr>
              </thead>
              <tbody>
                {(people.data ?? []).map((row) => (
                  <tr key={row.user._id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {row.user.firstName} {row.user.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">{row.user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {row.summary.complete}/{row.summary.total} ({row.percentComplete}%)
                    </td>
                    <td className="px-4 py-3">{row.summary.overdue}</td>
                    <td className="px-4 py-3">{row.summary.awaitingReview}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 text-sm text-muted-foreground">No personnel found.</div>
        )}
      </CardContent>
    </Card>
  );
}

function TasksTabPanel() {
  const tasks = useAdminPersonnelTasks();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tasks</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {tasks.isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={5} columns={4} />
          </div>
        ) : tasks.error ? (
          <div className="p-4">
            <FormErrorAlert message={(tasks.error as Error).message} onRetry={() => tasks.refetch()} />
          </div>
        ) : (tasks.data ?? []).length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Task</th>
                  <th className="px-4 py-3 font-medium">Assigned</th>
                  <th className="px-4 py-3 font-medium">Complete</th>
                  <th className="px-4 py-3 font-medium">Overdue</th>
                </tr>
              </thead>
              <tbody>
                {(tasks.data ?? []).map((row) => (
                  <tr key={row.key} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.title}</p>
                      <p className="text-xs text-muted-foreground">{TYPE_LABELS[row.type]}</p>
                    </td>
                    <td className="px-4 py-3">{row.assigned}</td>
                    <td className="px-4 py-3">{row.complete}</td>
                    <td className="px-4 py-3">{row.overdue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 text-sm text-muted-foreground">No assigned tasks yet.</div>
        )}
      </CardContent>
    </Card>
  );
}

function ReviewQueueTabPanel() {
  const queue = usePersonnelReviewQueue();
  const [selectedReview, setSelectedReview] = useState<ReviewQueueItem | null>(null);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Review queue</CardTitle>
        </CardHeader>
        <CardContent>
          {queue.isLoading ? (
            <TableSkeleton rows={4} columns={7} />
          ) : queue.error ? (
            <FormErrorAlert message={(queue.error as Error).message} onRetry={() => queue.refetch()} />
          ) : (queue.data ?? []).length ? (
            <ReviewQueueTable items={queue.data ?? []} onSelect={setSelectedReview} />
          ) : (
            <EmptyState
              icon={FileSearch}
              title="Nothing to review"
              description="Device settings submissions awaiting approval will appear here."
              className="py-10"
            />
          )}
        </CardContent>
      </Card>

      <DeviceSettingsReviewDrawer
        item={selectedReview}
        open={Boolean(selectedReview)}
        onOpenChange={(open) => !open && setSelectedReview(null)}
      />
    </>
  );
}

const ADMIN_TABS = ['my-tasks', 'people', 'tasks', 'review'] as const;
type AdminTab = (typeof ADMIN_TABS)[number];

function isAdminTab(value: string | null): value is AdminTab {
  return ADMIN_TABS.includes(value as AdminTab);
}

export function PersonnelTasksPage() {
  const permissions = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: AdminTab = permissions.canViewPersonnelAdminTabs && isAdminTab(tabParam) ? tabParam : 'my-tasks';

  const handleTabChange = (value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === 'my-tasks') next.delete('tab');
      else next.set('tab', value);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personnel"
        description="Track personnel security tasks across policies, devices, training, and manual reviews."
        actions={
          <div className="flex gap-2">
            <ContextualHelpButton moduleId="personnel" label="Status guide" />
            {permissions.canViewPeopleGroups ? (
              <Button asChild variant="outline" size="sm">
                <Link to="/settings/people-groups">
                  <UserCog className="mr-2 size-4" />
                  People & Groups
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      {permissions.canViewPersonnelAdminTabs ? (
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="h-auto w-full flex-wrap justify-start">
            <TabsTrigger value="my-tasks">My tasks</TabsTrigger>
            <TabsTrigger value="people">People</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="review">Review queue</TabsTrigger>
          </TabsList>

          <TabsContent value="my-tasks" className="mt-4">
            <MyTasksPanel />
          </TabsContent>
          <TabsContent value="people" className="mt-4">
            <PeopleTabPanel />
          </TabsContent>
          <TabsContent value="tasks" className="mt-4">
            <TasksTabPanel />
          </TabsContent>
          <TabsContent value="review" className="mt-4">
            <ReviewQueueTabPanel />
          </TabsContent>
        </Tabs>
      ) : (
        <MyTasksPanel />
      )}
    </div>
  );
}

export default PersonnelTasksPage;
