import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type SlideOutPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  side?: 'left' | 'right';
  className?: string;
  contentClassName?: string;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
};

export function SlideOutPanel({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = 'right',
  className,
  contentClassName,
  actions,
  footer,
}: SlideOutPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn('flex w-full flex-col overflow-hidden p-0 sm:max-w-md lg:max-w-lg', className)}
      >
        <SheetHeader className="shrink-0 border-b px-6 py-4">
          <div className="flex items-start justify-between gap-4 pr-6">
            <div className="min-w-0">
              <SheetTitle className="break-words">{title}</SheetTitle>
              {description && <SheetDescription className="mt-1">{description}</SheetDescription>}
            </div>
            {actions && <div className="flex shrink-0">{actions}</div>}
          </div>
        </SheetHeader>
        <ScrollArea className={cn('min-h-0 flex-1', contentClassName)}>
          <div className="px-6 py-4">
            {children}
          </div>
        </ScrollArea>
        {footer && (
          <div className="shrink-0 border-t bg-background px-6 py-4">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
