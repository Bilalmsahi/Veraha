import { SlideOutPanel } from '@/components/shared';
import { formatFrameworkCode } from '@/lib/formatters';
import { useTemplate } from '@/api/templates';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

type TemplateDetailPanelProps = {
  templateId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TemplateDetailPanel({
  templateId,
  open,
  onOpenChange,
}: TemplateDetailPanelProps) {
  const { data: template, isLoading } = useTemplate(templateId, open && !!templateId);

  return (
    <SlideOutPanel
      open={open}
      onOpenChange={onOpenChange}
      title={template ? `${template.identifier}: ${template.title}` : 'Template'}
      description={template?.controlGroup}
    >
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : template ? (
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground">Description</h4>
            <p className="mt-1 text-sm">{template.description ?? '—'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {template.controlGroup && (
              <Badge variant="secondary">{template.controlGroup}</Badge>
            )}
            {template.frequency && (
              <Badge variant="outline">{template.frequency}</Badge>
            )}
          </div>
          {template.implementationGuidance && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Implementation guidance</h4>
              <p className="mt-1 text-sm">{template.implementationGuidance}</p>
            </div>
          )}
          {template.suggestedRequirements && template.suggestedRequirements.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">
                Mapped requirements ({template.suggestedRequirements.length})
              </h4>
              <ul className="mt-2 space-y-2">
                {template.suggestedRequirements.map((sr: { requirement?: { identifier?: string; title?: string }; framework?: { code?: string; name?: string } }, i: number) => (
                  <li key={i} className="rounded-md border p-2 text-sm">
                    <span className="font-mono font-medium">
                      {sr.requirement?.identifier ?? '—'}
                    </span>
                    <span className="text-muted-foreground">
                      {' '}
                      {sr.requirement?.title ?? ''}
                    </span>
                    {sr.framework && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        {formatFrameworkCode(sr.framework.code ?? sr.framework.name)}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No template selected.</p>
      )}
    </SlideOutPanel>
  );
}
