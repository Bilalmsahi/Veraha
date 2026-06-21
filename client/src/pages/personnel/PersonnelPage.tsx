import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ContextualHelpButton, PageHeader, FilterBar, ConfirmDialog, EnumBadge } from '@/components/shared';
import {
  ROLE_LABELS,
  ROLE_SOFT_TONE,
  EXTENDED_USER_STATUS_LABELS,
  EXTENDED_USER_STATUS_SOFT,
  INVITATION_STATUS_LABELS,
  INVITATION_STATUS_SOFT,
} from '@/lib/constants';
import { DataTable, type Column } from '@/components/shared';
import { FormErrorAlert, TableSkeleton, Pagination } from '@/components/shared';
import { InviteUserModal } from '@/components/personnel';
import {
  useUsers,
  useUpdateUserRole,
  useDeactivateUser,
  useReactivateUser,
  useResendInvitation,
  useRevokeInvitation,
} from '@/api/users';
import type { OrgUser } from '@/api/users';
import {
  useCreateGroup,
  useDeleteGroup,
  useGroups,
  useUpdateGroup,
  type Group,
} from '@/api/groups';
import { useAuthStore } from '@/store/useAuthStore';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserPlus, MoreHorizontal, ShieldCheck, ShieldOff, RefreshCw, Plus, Pencil, Trash2, Send, Ban } from 'lucide-react';

const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'AUDITOR', label: 'Auditor' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INVITED', label: 'Invited' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

const INVITATION_STATUS_OPTIONS = [
  { value: '', label: 'All invitations' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'ACCESSED', label: 'Accessed' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'REVOKED', label: 'Revoked' },
  { value: 'COMPLETED', label: 'Completed' },
];

const SORT_OPTIONS = [
  { value: 'firstName_asc', label: 'Name (A-Z)' },
  { value: 'firstName_desc', label: 'Name (Z-A)' },
  { value: 'createdAt_desc', label: 'Newest first' },
  { value: 'lastLoginAt_desc', label: 'Last login' },
];

function RoleBadge({ role }: { role: string }) {
  const softTone = ROLE_SOFT_TONE[role as keyof typeof ROLE_SOFT_TONE];
  return (
    <EnumBadge
      label={ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role}
      softTone={softTone}
    />
  );
}

function UserStatusBadge({ status }: { status: string }) {
  return (
    <EnumBadge
      label={EXTENDED_USER_STATUS_LABELS[status] ?? status}
      softTone={EXTENDED_USER_STATUS_SOFT[status]}
    />
  );
}

function InvitationBadge({ status }: { status?: string | null }) {
  if (!status) return <EnumBadge label="None" softTone="muted" />;
  return (
    <EnumBadge
      label={INVITATION_STATUS_LABELS[status] ?? status}
      softTone={INVITATION_STATUS_SOFT[status]}
    />
  );
}

function ActivityBadge({ state }: { state?: string }) {
  const active = state === 'ACTIVE';
  return (
    <EnumBadge
      label={active ? 'Signed in recently' : 'Idle'}
      softTone={active ? 'success' : 'muted'}
    />
  );
}

function formatDate(value?: string | null, withTime = false) {
  if (!value) return 'Never';
  const date = new Date(value);
  return withTime ? date.toLocaleString() : date.toLocaleDateString();
}

export function PeopleGroupsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUser = useAuthStore((s) => s.user);
  const permissions = usePermissions();

  const page = Number(searchParams.get('page')) || 1;
  const limit = Number(searchParams.get('limit')) || 20;
  const search = searchParams.get('search') ?? '';
  const role = searchParams.get('role') ?? '';
  const status = searchParams.get('status') ?? '';
  const invitationStatus = searchParams.get('invitationStatus') ?? '';
  const sort = searchParams.get('sort') ?? 'firstName_asc';

  const [sortBy, sortOrder] = useMemo(() => {
    const [by, order] = sort.split('_');
    return [by || 'firstName', (order as 'asc' | 'desc') || 'asc'];
  }, [sort]);

  const params = useMemo(
    () => ({
      page,
      limit: [10, 20, 50, 100].includes(limit) ? limit : 20,
      search: search || undefined,
      role: role || undefined,
      status: status || undefined,
      sortBy,
      sortOrder: sortOrder as 'asc' | 'desc',
    }),
    [page, limit, search, role, status, sortBy, sortOrder]
  );

  const users = useUsers(params);
  const allUsers = useUsers({ limit: 100, status: 'ACTIVE' });
  const groups = useGroups();
  const updateRoleMutation = useUpdateUserRole();
  const deactivateMutation = useDeactivateUser();
  const reactivateMutation = useReactivateUser();
  const resendInvitation = useResendInvitation();
  const revokeInvitation = useRevokeInvitation();
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<OrgUser | null>(null);
  const [roleEditTarget, setRoleEditTarget] = useState<OrgUser | null>(null);
  const [groupEditTarget, setGroupEditTarget] = useState<Group | null>(null);
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<Group | null>(null);
  const [newRole, setNewRole] = useState('');

  const userList = users.data?.users ?? [];
  const visibleUserList = invitationStatus
    ? userList.filter((user) => user.invitationStatus === invitationStatus)
    : userList;
  const activePersonnel = (allUsers.data?.users ?? []).filter((u) => u.role !== 'AUDITOR');
  const pagination = users.data?.pagination;

  useEffect(() => {
    if (window.location.hash === '#groups') {
      window.setTimeout(() => document.getElementById('groups')?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set('search', value);
      else next.delete('search');
      next.set('page', '1');
      return next;
    });
  };

  const handleFilterChange = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      next.set('page', '1');
      return next;
    });
  };

  const handleClearAll = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('search');
      next.delete('role');
      next.delete('status');
      next.delete('invitationStatus');
      next.delete('sort');
      next.set('page', '1');
      return next;
    });
  };

  const filterItems = [
    {
      key: 'role',
      label: 'Role',
      value: role,
      options: ROLE_OPTIONS.slice(1),
    },
    {
      key: 'status',
      label: 'Status',
      value: status,
      options: STATUS_OPTIONS.slice(1),
    },
    {
      key: 'invitationStatus',
      label: 'Invitation',
      value: invitationStatus,
      options: INVITATION_STATUS_OPTIONS.slice(1),
    },
    { key: 'sort', label: 'Sort', value: sort, options: SORT_OPTIONS, defaultValue: 'firstName_asc' },
  ];

  const columns: Column<OrgUser>[] = [
    {
      key: 'firstName',
      header: 'Member',
      width: '20%',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium" title={`${row.firstName} ${row.lastName}`}>
            {row.firstName} {row.lastName}
          </p>
          <p className="truncate text-xs text-muted-foreground" title={row.email}>
            {row.email}
          </p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      width: '9%',
      cell: (row) => <RoleBadge role={row.role} />,
    },
    {
      key: 'status',
      header: 'Account Status',
      width: '12%',
      cell: (row) => <UserStatusBadge status={row.memberState || row.status} />,
    },
    ...(permissions.canManageUsers
      ? [
          ...(permissions.canViewPersonnelAdminTabs
            ? [
                {
                  key: 'activeState' as keyof OrgUser,
                  header: 'Login Activity',
                  width: '10%',
                  cell: (row: OrgUser) => <ActivityBadge state={row.activeState} />,
                },
                {
                  key: 'invitationStatus' as keyof OrgUser,
                  header: 'Invite Status',
                  width: '10%',
                  cell: (row: OrgUser) => <InvitationBadge status={row.invitationStatus} />,
                },
                {
                  key: 'lastActivityAt' as keyof OrgUser,
                  header: 'Last Active',
                  width: '13%',
                  cell: (row: OrgUser) =>
                    row.lastActivityAt || row.lastLoginAt || row.invitationLastActivityAt ? (
                      <span className="whitespace-nowrap text-sm">
                        {formatDate(row.lastActivityAt || row.lastLoginAt || row.invitationLastActivityAt, true)}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Never</span>
                    ),
                },
                {
                  key: 'invitedAt' as keyof OrgUser,
                  header: 'Invite Sent',
                  width: '10%',
                  cell: (row: OrgUser) => (
                    <span className="whitespace-nowrap text-sm">
                      {formatDate(row.invitationSentAt || row.invitedAt)}
                    </span>
                  ),
                },
                {
                  key: 'createdAt' as keyof OrgUser,
                  header: 'Invite Expires',
                  width: '12%',
                  cell: (row: OrgUser) => (
                    <span className="whitespace-nowrap text-sm">
                      {formatDate(row.invitationExpiresAt, true)}
                    </span>
                  ),
                },
              ]
            : []),
          ...(permissions.canChangeUserRoles || permissions.canInviteUsers || permissions.canDeactivateUsers
            ? [
          {
            key: 'actions' as keyof OrgUser,
            header: '',
            width: '4%',
            className: 'text-right',
            cell: (row: OrgUser) => {
              const isSelf = row._id === currentUser?._id;
              if (isSelf) return null;
              return (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {permissions.canChangeUserRoles && (
                      <>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setRoleEditTarget(row);
                            setNewRole(row.role);
                          }}
                        >
                          <ShieldCheck className="mr-2 size-4" />
                          Change role
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    {permissions.canInviteUsers && ['PENDING', 'ACCESSED', 'EXPIRED'].includes(row.invitationStatus || '') && (
                      <>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            resendInvitation.mutate(row._id);
                          }}
                        >
                          <Send className="mr-2 size-4" />
                          Resend invite
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            revokeInvitation.mutate(row._id);
                          }}
                        >
                          <Ban className="mr-2 size-4" />
                          Revoke invite
                        </DropdownMenuItem>
                        {permissions.canDeactivateUsers && <DropdownMenuSeparator />}
                      </>
                    )}
                    {permissions.canDeactivateUsers && (
                      row.status !== 'SUSPENDED' ? (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeactivateTarget(row);
                          }}
                        >
                          <ShieldOff className="mr-2 size-4" />
                          Deactivate
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            reactivateMutation.mutate(row._id);
                          }}
                        >
                          <RefreshCw className="mr-2 size-4" />
                          Reactivate
                        </DropdownMenuItem>
                      )
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            },
          },
              ]
            : []),
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="People & Groups"
        description="Manage team members, roles, invitations, and personnel groups"
        actions={
          <div className="flex flex-wrap gap-2">
            <ContextualHelpButton moduleId="personnel" label="Status guide" />
            {permissions.canInviteUsers ? (
              <Button size="sm" onClick={() => setInviteOpen(true)}>
                <UserPlus className="mr-2 size-4" />
                Invite team member
              </Button>
            ) : null}
          </div>
        }
      />

      {users.error && (
        <FormErrorAlert
          message={(users.error as Error).message}
          onRetry={() => users.refetch()}
        />
      )}

      <div className="space-y-4">
        <FilterBar
          searchPlaceholder="Search by name or email..."
          searchValue={search}
          onSearchChange={handleSearchChange}
          filters={filterItems}
          onFilterChange={handleFilterChange}
          onClearAll={handleClearAll}
        />

        {users.isLoading ? (
          <TableSkeleton rows={8} columns={5} />
        ) : (
          <>
            <DataTable
              data={visibleUserList}
              columns={columns}
              keyExtractor={(row) => row._id}
              emptyMessage="No team members found."
            />

            {pagination && (
              <Pagination
                page={pagination.page}
                limit={params.limit ?? 20}
                total={pagination.total}
                pages={pagination.pages}
                hasPrevPage={pagination.hasPrevPage}
                hasNextPage={pagination.hasNextPage}
                onPageChange={(p) =>
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.set('page', String(p));
                    return next;
                  })
                }
                onLimitChange={(l) =>
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.set('limit', String(l));
                    next.set('page', '1');
                    return next;
                  })
                }
                entityLabel="members"
              />
            )}
          </>
        )}
      </div>

      {permissions.canManageGroups && (
      <section id="groups" className="space-y-4 rounded-lg border border-border/80 bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Groups</h2>
            <p className="text-sm text-muted-foreground">Create personnel groups for policy acknowledgement recipients.</p>
          </div>
          {permissions.canManageGroups && (
            <Button
              size="sm"
              onClick={() => {
                setGroupEditTarget(null);
                setGroupFormOpen(true);
              }}
            >
              <Plus className="mr-2 size-4" />
              Create group
            </Button>
          )}
        </div>

        {groups.error && (
          <FormErrorAlert
            message={(groups.error as Error).message}
            onRetry={() => groups.refetch()}
          />
        )}

        {groups.isLoading ? (
          <TableSkeleton rows={3} columns={3} />
        ) : (groups.data ?? []).length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            No groups yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <DataTable
              data={groups.data ?? []}
              columns={[
                {
                  key: 'name',
                  header: 'Group',
                  width: '50%',
                  cell: (row) => (
                    <div className="min-w-0">
                      <p className="truncate font-medium" title={row.name}>
                        {row.name}
                      </p>
                      {row.description && (
                        <p className="truncate text-xs text-muted-foreground" title={row.description}>
                          {row.description}
                        </p>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'memberUserIds',
                  header: 'Members',
                  width: '18%',
                  cell: (row) => (
                    <span className="whitespace-nowrap text-sm text-muted-foreground">
                      {row.memberUserIds?.length ?? 0} members
                    </span>
                  ),
                },
                {
                  key: 'activePolicyCount',
                  header: 'Active Policies',
                  width: '20%',
                  cell: (row) => (
                    <span className="whitespace-nowrap text-sm text-muted-foreground">
                      {row.activePolicyCount ?? 0} active
                    </span>
                  ),
                },
                ...(permissions.canManageGroups
                  ? [
                      {
                        key: 'actions' as keyof Group,
                        header: '',
                        width: '12%',
                        className: 'text-right',
                        cell: (row: Group) => (
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                setGroupEditTarget(row);
                                setGroupFormOpen(true);
                              }}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteGroupTarget(row);
                              }}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        ),
                      },
                    ]
                  : []),
              ]}
              keyExtractor={(row) => row._id}
              emptyMessage="No groups yet."
            />
          </div>
        )}
      </section>
      )}

      {permissions.canInviteUsers && (
        <InviteUserModal
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          onSuccess={() => {
            setInviteOpen(false);
            users.refetch();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deactivateTarget}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title="Deactivate user"
        description={`Are you sure you want to deactivate ${deactivateTarget?.firstName} ${deactivateTarget?.lastName} (${deactivateTarget?.email})? They will lose access to the platform.`}
        confirmLabel="Deactivate"
        variant="destructive"
        onConfirm={() => {
          if (deactivateTarget) {
            deactivateMutation.mutate(deactivateTarget._id, {
              onSuccess: () => setDeactivateTarget(null),
            });
          }
        }}
        loading={deactivateMutation.isPending}
      />

      {/* Role edit dialog */}
      {roleEditTarget && (
        <ChangeRoleDialog
          user={roleEditTarget}
          newRole={newRole}
          setNewRole={setNewRole}
          onClose={() => setRoleEditTarget(null)}
          onConfirm={() => {
            updateRoleMutation.mutate(
              { userId: roleEditTarget._id, role: newRole },
              { onSuccess: () => setRoleEditTarget(null) }
            );
          }}
          isPending={updateRoleMutation.isPending}
        />
      )}

      {groupFormOpen && (
        <GroupFormDialog
          group={groupEditTarget}
          users={activePersonnel}
          onClose={() => setGroupFormOpen(false)}
          onSubmit={(input) => {
            if (groupEditTarget) {
              updateGroup.mutate(
                { id: groupEditTarget._id, input },
                { onSuccess: () => setGroupFormOpen(false) }
              );
            } else {
              createGroup.mutate(input, { onSuccess: () => setGroupFormOpen(false) });
            }
          }}
          isPending={createGroup.isPending || updateGroup.isPending}
        />
      )}

      <ConfirmDialog
        open={!!deleteGroupTarget}
        onOpenChange={(open) => !open && setDeleteGroupTarget(null)}
        title="Delete group"
        description={
          deleteGroupTarget?.activePolicyCount
            ? `"${deleteGroupTarget.name}" is assigned to ${deleteGroupTarget.activePolicyCount} active policy/policies. Deleting it will not change already published recipient snapshots, but future group-based publishing cannot use this group.`
            : `Delete "${deleteGroupTarget?.name}"?`
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (deleteGroupTarget) {
            deleteGroup.mutate(deleteGroupTarget._id, {
              onSuccess: () => setDeleteGroupTarget(null),
            });
          }
        }}
        loading={deleteGroup.isPending}
      />
    </div>
  );
}

export const PersonnelPage = PeopleGroupsPage;

function GroupFormDialog({
  group,
  users,
  onClose,
  onSubmit,
  isPending,
}: {
  group: Group | null;
  users: OrgUser[];
  onClose: () => void;
  onSubmit: (input: { name: string; description?: string; memberUserIds: string[] }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [selectedIds, setSelectedIds] = useState<string[]>(group?.memberUserIds?.map(String) ?? []);
  const [search, setSearch] = useState('');
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q)
    );
  }, [users, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 max-h-[90vh] w-full max-w-lg overflow-auto rounded-lg border bg-background p-6 shadow-lg">
        <h3 className="text-lg font-semibold">{group ? 'Edit group' : 'Create group'}</h3>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Group name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Members</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search personnel..."
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="max-h-56 overflow-auto rounded-md border p-2">
              {filteredUsers.map((u) => {
                const checked = selectedIds.includes(u._id);
                return (
                  <label key={u._id} className="flex cursor-pointer items-center justify-between gap-3 rounded px-2 py-1.5 text-sm hover:bg-muted">
                    <span>
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={checked}
                        onChange={(e) => {
                          setSelectedIds((prev) =>
                            e.target.checked ? [...prev, u._id] : prev.filter((id) => id !== u._id)
                          );
                        }}
                      />
                      {u.firstName} {u.lastName}
                    </span>
                    <span className="text-xs text-muted-foreground">{u.email}</span>
                  </label>
                );
              })}
              {filteredUsers.length === 0 && (
                <p className="p-2 text-sm text-muted-foreground">No personnel match your search.</p>
              )}
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit({ name: name.trim(), description: description.trim(), memberUserIds: selectedIds })}
            disabled={isPending || !name.trim()}
          >
            {isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ChangeRoleDialog({
  user,
  newRole,
  setNewRole,
  onClose,
  onConfirm,
  isPending,
}: {
  user: OrgUser;
  newRole: string;
  setNewRole: (role: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg">
        <h3 className="text-lg font-semibold">Change role</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Update role for {user.firstName} {user.lastName}
        </p>
        <div className="mt-4">
          <Select value={newRole} onValueChange={setNewRole}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ADMIN">Admin</SelectItem>
              <SelectItem value="MANAGER">Manager</SelectItem>
              <SelectItem value="EMPLOYEE">Employee</SelectItem>
              <SelectItem value="AUDITOR">Auditor</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isPending || newRole === user.role}>
            {isPending ? 'Saving...' : 'Update role'}
          </Button>
        </div>
      </div>
    </div>
  );
}
