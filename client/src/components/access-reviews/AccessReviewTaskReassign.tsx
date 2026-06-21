import { useState } from 'react';
import { useReassignAccessReviewTask } from '@/api/accessReviews';
import { useUsers } from '@/api/users';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

type AccessReviewTaskReassignProps = {
  taskId: string;
  currentReviewerId?: string;
};

export function AccessReviewTaskReassign({ taskId, currentReviewerId }: AccessReviewTaskReassignProps) {
  const users = useUsers({ limit: 100 });
  const reassign = useReassignAccessReviewTask();
  const [open, setOpen] = useState(false);
  const [reviewerId, setReviewerId] = useState(currentReviewerId ?? '');

  const internalUsers = (users.data?.users ?? []).filter((u) => u.role !== 'AUDITOR');

  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Reassign
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label className="text-xs">Reviewer</Label>
        <select
          className="flex h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={reviewerId}
          onChange={(e) => setReviewerId(e.target.value)}
        >
          <option value="">Select reviewer</option>
          {internalUsers.map((user) => (
            <option key={user._id} value={user._id}>
              {[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email}
            </option>
          ))}
        </select>
      </div>
      <Button
        size="sm"
        disabled={!reviewerId || reassign.isPending}
        onClick={() =>
          reassign.mutate(
            { taskId, reviewerId },
            { onSuccess: () => setOpen(false) }
          )
        }
      >
        Save
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}
