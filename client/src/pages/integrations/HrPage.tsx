import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ContextualHelpButton, PageHeader, EnumBadge, FormErrorAlert, TableSkeleton, ListPageStatGrid, DataTable, type Column } from '@/components/shared';
import { HrImportModal } from '@/components/integrations/hr/HrImportModal';
import { HrProfileDrawer } from '@/components/integrations/hr/HrProfileDrawer';
import {
  getHrStats,
  useCreateHrProfile,
  useHrProfiles,
  type HrProfile,
} from '@/api/integrations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronRight,
  Plus,
  Search,
  Upload,
  UserCheck,
  Users,
  UserX,
} from 'lucide-react';

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'departed', label: 'Departed' },
];

const EMPLOYMENT_STATUS_LABELS: Record<HrProfile['employmentStatus'], { label: string; tone: 'success' | 'warning' | 'error' }> = {
  active: { label: 'Active', tone: 'success' },
  on_leave: { label: 'On Leave', tone: 'warning' },
  departed: { label: 'Departed', tone: 'error' },
};

const HR_SOURCE_LABELS: Record<HrProfile['hrSource'], string> = {
  manual: 'Manual',
  bamboohr_import: 'BambooHR',
  rippling_import: 'Rippling',
};

function EmploymentStatusBadge({ status }: { status: HrProfile['employmentStatus'] }) {
  const config = EMPLOYMENT_STATUS_LABELS[status];
  return <EnumBadge label={config.label} softTone={config.tone} />;
}

export function HrPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<HrProfile | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [fullName, setFullName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [startDate, setStartDate] = useState('');

  const { data, isLoading, error, refetch } = useHrProfiles({ search, status: statusFilter });
  const profiles: HrProfile[] = data?.data ?? [];

  const statsQuery = useQuery({
    queryKey: ['hr-stats'],
    queryFn: getHrStats,
  });

  const createProfile = useCreateHrProfile();

  const openDrawer = (profile: HrProfile) => {
    setSelectedProfile(profile);
    setDrawerOpen(true);
  };

  const resetAddForm = () => {
    setFullName('');
    setWorkEmail('');
    setDepartment('');
    setJobTitle('');
    setStartDate('');
  };

  const handleAddProfile = (e: React.FormEvent) => {
    e.preventDefault();
    createProfile.mutate(
      {
        fullName: fullName.trim(),
        workEmail: workEmail.trim(),
        department: department.trim() || undefined,
        jobTitle: jobTitle.trim() || undefined,
        startDate: startDate || undefined,
        hrSource: 'manual',
        employmentStatus: 'active',
        backgroundCheckStatus: 'not_required',
      },
      {
        onSuccess: () => {
          setAddOpen(false);
          resetAddForm();
          statsQuery.refetch();
        },
      }
    );
  };

  const columns: Column<HrProfile>[] = [
    {
      key: 'fullName',
      header: 'Name',
      cell: (row) => (
        <div>
          <p className="font-medium">{row.fullName}</p>
          <p className="text-xs text-muted-foreground">{row.workEmail}</p>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      cell: (row) => <span className="text-sm">{row.department || '—'}</span>,
    },
    {
      key: 'jobTitle',
      header: 'Job Title',
      cell: (row) => <span className="text-sm">{row.jobTitle || '—'}</span>,
    },
    {
      key: 'employmentStatus',
      header: 'Status',
      cell: (row) => <EmploymentStatusBadge status={row.employmentStatus} />,
    },
    {
      key: 'hrSource',
      header: 'HR Source',
      cell: (row) => (
        <EnumBadge label={HR_SOURCE_LABELS[row.hrSource]} softTone="info" />
      ),
    },
    {
      key: 'userId',
      header: 'Platform Link',
      cell: (row) =>
        row.userId ? (
          <UserCheck className="size-4 text-[var(--color-success)]" aria-label="Linked to platform user" />
        ) : (
          <UserX className="size-4 text-muted-foreground" aria-label="Not linked to platform account" />
        ),
    },
    {
      key: 'actions',
      header: '',
      cell: (row) => (
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={(e) => {
            e.stopPropagation();
            openDrawer(row);
          }}
        >
          <ChevronRight className="size-4" />
        </Button>
      ),
    },
  ];

  const stats = statsQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="HR Profiles"
        description="Track employees and their compliance status"
        actions={
          <div className="flex gap-2">
            <ContextualHelpButton moduleId="hr" current={{ status: selectedProfile?.employmentStatus }} />
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 size-4" />
              Import CSV
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-2 size-4" />
              Add Profile
            </Button>
          </div>
        }
      />

      {error && (
        <FormErrorAlert message={(error as Error).message} onRetry={() => refetch()} />
      )}

      {stats && (
        <ListPageStatGrid
          items={[
            { label: 'Total', value: Number(stats.total ?? 0), icon: Users },
            { label: 'Active', value: Number(stats.active ?? 0), icon: UserCheck },
            { label: 'On Leave', value: Number(stats.onLeave ?? 0), icon: Users },
            { label: 'Departed', value: Number(stats.departed ?? 0), icon: UserX },
          ]}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={statusFilter || '__all__'}
          onValueChange={(v) => setStatusFilter(v === '__all__' ? '' : v)}
        >
          <SelectTrigger size="sm" className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value || '__all__'} value={opt.value || '__all__'}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} columns={7} />
      ) : (
        <DataTable
          data={profiles}
          columns={columns}
          keyExtractor={(row) => row._id}
          onRowClick={openDrawer}
          emptyMessage="No HR profiles found."
          emptyIcon={Users}
        />
      )}

      <HrImportModal open={importOpen} onOpenChange={setImportOpen} />
      <HrProfileDrawer
        profile={selectedProfile}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />

      <Dialog
        open={addOpen}
        onOpenChange={(next) => {
          if (!next) resetAddForm();
          setAddOpen(next);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add HR profile</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddProfile} className="space-y-4">
            {createProfile.error && (
              <FormErrorAlert message={(createProfile.error as Error).message} />
            )}
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workEmail">Work email</Label>
              <Input
                id="workEmail"
                type="email"
                value={workEmail}
                onChange={(e) => setWorkEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobTitle">Job title</Label>
              <Input
                id="jobTitle"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Start date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createProfile.isPending}>
                {createProfile.isPending ? 'Saving...' : 'Add profile'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
