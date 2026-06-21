import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { useGroups } from '@/api/groups';
import { useUsers } from '@/api/users';
import { usePublishPolicyWorkflow, type PublishRecipientInput } from '@/api/policies';
import { getApiErrorMessage } from '@/lib/apiError';
import { toast } from 'sonner';

type PolicyPublishModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policyId: string;
  policyVersionId: string;
  defaultTarget?: 'ALL_PERSONNEL' | 'SPECIFIC_GROUPS' | 'SPECIFIC_USERS';
};

export function PolicyPublishModal({
  open,
  onOpenChange,
  policyId,
  policyVersionId,
  defaultTarget = 'ALL_PERSONNEL',
}: PolicyPublishModalProps) {
  const [target, setTarget] = useState<PolicyPublishModalProps['defaultTarget']>(defaultTarget);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const navigate = useNavigate();

  const groups = useGroups(undefined, open);
  const users = useUsers({ limit: 100 });

  const publishWorkflow = usePublishPolicyWorkflow();

  const orgUsers = (users.data?.users ?? []).filter(
    (u) => u.role !== 'AUDITOR' && u.status === 'ACTIVE'
  );

  const groupsById = useMemo(() => {
    const map = new Map<string, { _id: string; name: string; memberUserIds?: string[] }>();
    for (const g of groups.data ?? []) map.set(g._id, g);
    return map;
  }, [groups.data]);

  const previewRecipientIds = useMemo(() => {
    if (target === 'ALL_PERSONNEL') return new Set(orgUsers.map((u) => u._id));
    if (target === 'SPECIFIC_USERS') return new Set(selectedUserIds);
    const ids = new Set<string>();
    for (const gid of selectedGroupIds) {
      const g = groupsById.get(gid);
      for (const uid of g?.memberUserIds ?? []) ids.add(uid);
    }
    return ids;
  }, [target, orgUsers, selectedUserIds, selectedGroupIds, groupsById]);

  const recipientCount = previewRecipientIds.size;

  const filteredGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    if (!q) return groups.data ?? [];
    return (groups.data ?? []).filter((g) =>
      `${g.name} ${g.description ?? ''}`.toLowerCase().includes(q)
    );
  }, [groups.data, groupSearch]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return orgUsers;
    return orgUsers.filter((u) =>
      `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q)
    );
  }, [orgUsers, userSearch]);

  const isPending = publishWorkflow.isPending;

  const handlePublish = async () => {
    try {
      const recipients: PublishRecipientInput =
        target === 'SPECIFIC_USERS'
          ? { recipientType: 'SPECIFIC_USERS', userIds: selectedUserIds }
          : target === 'SPECIFIC_GROUPS'
            ? { recipientType: 'SPECIFIC_GROUPS', groupIds: selectedGroupIds }
            : { recipientType: 'ALL_PERSONNEL' };

      await publishWorkflow.mutateAsync({ policyId, policyVersionId, recipients });
      onOpenChange(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Publish policy</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Recipients</Label>
            <RadioGroup
              value={target}
              onValueChange={(v) => setTarget(v as PolicyPublishModalProps['defaultTarget'])}
              className="grid gap-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="ALL_PERSONNEL" id="all" />
                <Label htmlFor="all">All personnel</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="SPECIFIC_GROUPS" id="groups" />
                <Label htmlFor="groups">Specific groups</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="SPECIFIC_USERS" id="users" />
                <Label htmlFor="users">Specific users</Label>
              </div>
            </RadioGroup>
          </div>

          {target === 'SPECIFIC_GROUPS' && (
            <div className="space-y-2">
              <Label>Groups</Label>
              {(groups.data ?? []).length > 0 && (
                <input
                  value={groupSearch}
                  onChange={(e) => setGroupSearch(e.target.value)}
                  placeholder="Search groups..."
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              )}
              <div className="max-h-48 overflow-auto rounded-md border p-2 space-y-2">
                {filteredGroups.map((g) => {
                  const checked = selectedGroupIds.includes(g._id);
                  const memberCount = g.memberUserIds?.length ?? 0;
                  return (
                    <div key={g._id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            setSelectedGroupIds((prev) =>
                              v ? [...prev, g._id] : prev.filter((x) => x !== g._id)
                            );
                          }}
                        />
                        <span className="text-sm">{g.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{memberCount} members</span>
                    </div>
                  );
                })}
                {!groups.isLoading && (groups.data ?? []).length === 0 && (
                  <div className="space-y-2 p-2 text-sm text-muted-foreground">
                    <p>No groups yet. Go to Settings / People & Groups to create one.</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onOpenChange(false);
                        navigate('/settings/people-groups#groups');
                      }}
                    >
                      Go to Groups
                    </Button>
                  </div>
                )}
                {!groups.isLoading && (groups.data ?? []).length > 0 && filteredGroups.length === 0 && (
                  <p className="p-2 text-sm text-muted-foreground">No groups match your search.</p>
                )}
              </div>
            </div>
          )}

          {target === 'SPECIFIC_USERS' && (
            <div className="space-y-2">
              <Label>Users</Label>
              <input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users..."
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="max-h-48 overflow-auto rounded-md border p-2 space-y-2">
                {filteredUsers.map((u) => {
                  const checked = selectedUserIds.includes(u._id);
                  return (
                    <div key={u._id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            setSelectedUserIds((prev) =>
                              v ? [...prev, u._id] : prev.filter((x) => x !== u._id)
                            );
                          }}
                        />
                        <span className="text-sm">
                          {u.firstName} {u.lastName}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">{u.email}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Recipient preview</Label>
              <span className="text-sm text-muted-foreground">{recipientCount} recipients</span>
            </div>
            <Progress value={recipientCount ? 100 : 0} />
            <p className="text-xs text-muted-foreground">
              On publish, recipients will be notified to acknowledge the policy.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handlePublish} disabled={isPending || (target !== 'ALL_PERSONNEL' && recipientCount === 0)}>
              Publish
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

