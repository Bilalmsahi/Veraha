import { Clock } from 'lucide-react';
import { DetailPageHeader } from '@/components/shared';
import { FrameworkBadge } from './FrameworkBadge';
import { TrainingStatusBadge } from './TrainingStatusBadge';
import type { TrainingAttemptSummary } from '@/api/personnelTasks';

export function TrainingHeader({
  title,
  description,
  frameworkTags,
  estimatedReadMinutes,
  attempt,
  actions,
}: {
  title: string;
  description?: string;
  frameworkTags: string[];
  estimatedReadMinutes?: number | null;
  attempt: TrainingAttemptSummary;
  actions?: React.ReactNode;
}) {
  return (
    <DetailPageHeader
      backTo="/personnel"
      parentLabel="My Tasks"
      title={title}
      description={description}
      actions={actions}
      meta={
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {frameworkTags.map((tag) => (
            <FrameworkBadge key={tag} tag={tag} />
          ))}
          <TrainingStatusBadge attempt={attempt} />
          {estimatedReadMinutes != null && (
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="size-3.5" aria-hidden />
              {estimatedReadMinutes} min read
            </span>
          )}
        </div>
      }
    />
  );
}
