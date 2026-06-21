import { useState } from 'react';
import type { AccessReviewTask } from '@/api/accessReviews';
import { useDecideAccessReviewTask } from '@/api/accessReviews';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type AccessReviewTaskDecisionProps = {
  task: AccessReviewTask;
  isAdmin?: boolean;
};

export function AccessReviewTaskDecision({ task, isAdmin = false }: AccessReviewTaskDecisionProps) {
  const decideTask = useDecideAccessReviewTask();
  const [notes, setNotes] = useState('');
  const [expanded, setExpanded] = useState(false);

  const canDecide = task.status === 'PENDING' || (task.status === 'ESCALATED' && isAdmin);

  if (!canDecide) {
    return (
      <div className="space-y-1">
        <span className="text-sm">{task.decision || task.status}</span>
        {task.decisionNotes && (
          <p className="text-xs italic text-muted-foreground">{task.decisionNotes}</p>
        )}
      </div>
    );
  }

  const submit = (decision: 'APPROVE' | 'REVOKE' | 'ESCALATE') => {
    decideTask.mutate(
      { taskId: task._id, decision, notes: notes.trim() || undefined },
      { onSuccess: () => { setNotes(''); setExpanded(false); } }
    );
  };

  return (
    <div className="space-y-2">
      {!expanded ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setExpanded(true)}>
            {task.status === 'ESCALATED' ? 'Resolve' : 'Decide'}
          </Button>
        </div>
      ) : (
        <>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={decideTask.isPending} onClick={() => submit('APPROVE')}>
              Approve
            </Button>
            <Button size="sm" variant="outline" disabled={decideTask.isPending} onClick={() => submit('REVOKE')}>
              Revoke
            </Button>
            {task.status === 'PENDING' && (
              <Button size="sm" variant="outline" disabled={decideTask.isPending} onClick={() => submit('ESCALATE')}>
                Escalate
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setExpanded(false)}>
              Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
