import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from './PageHeader';
import { cn } from '@/lib/utils';

type DetailPageHeaderProps = {
  backTo: string;
  parentLabel?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
};

export function DetailPageHeader({
  backTo,
  parentLabel,
  title,
  description,
  actions,
  meta,
  className,
}: DetailPageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className={cn('flex items-start gap-4', className)}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => navigate(backTo)}
        aria-label={parentLabel ? `Back to ${parentLabel}` : 'Go back'}
      >
        <ArrowLeft className="size-4" />
      </Button>
      <div className="min-w-0 flex-1">
        {parentLabel && (
          <p className="text-sm text-muted-foreground">{parentLabel}</p>
        )}
        <PageHeader
          title={title}
          description={description}
          actions={actions}
          className={parentLabel ? 'mt-1' : undefined}
        />
        {meta}
      </div>
    </div>
  );
}
