import { SlideOutPanel } from '@/components/shared';
import { formatFrameworkCode } from '@/lib/formatters';
import { useRequirement } from '@/api/frameworks';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

type RequirementDetailPanelProps = {
  requirementId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function RequirementDetailPanel({
  requirementId,
  open,
  onOpenChange,
}: RequirementDetailPanelProps) {
  const { data: requirement, isLoading } = useRequirement(requirementId, open && !!requirementId);

  const framework = requirement && 'frameworkId' in requirement
    ? (requirement.frameworkId as { _id?: string; code?: string; name?: string } | string)
    : null;
  const frameworkName =
    typeof framework === 'object' && framework
      ? formatFrameworkCode(framework.name ?? framework.code)
      : '—';

  return (
    <SlideOutPanel
      open={open}
      onOpenChange={onOpenChange}
      title={requirement ? `${requirement.identifier}: ${requirement.title}` : 'Requirement'}
      description={frameworkName}
    >
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : requirement ? (
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground">Description</h4>
            <p className="mt-1 text-sm">{requirement.description ?? '—'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(() => {
              const c = requirement.categoryId;
              if (c && typeof c === 'object' && 'code' in c) {
                return (
                  <Badge variant="secondary">
                    {c.code}: {c.title}
                  </Badge>
                );
              }
              return null;
            })()}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No requirement selected.</p>
      )}
    </SlideOutPanel>
  );
}
