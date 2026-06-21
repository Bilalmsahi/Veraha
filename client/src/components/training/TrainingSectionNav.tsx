import { cn } from '@/lib/utils';
import type { MarkdownHeading } from './trainingMarkdown';

export function TrainingSectionNav({
  headings,
  activeId,
  onNavigate,
  className,
}: {
  headings: MarkdownHeading[];
  activeId?: string;
  onNavigate: (id: string) => void;
  className?: string;
}) {
  if (!headings.length) return null;

  return (
    <nav
      className={cn(
        'flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg border bg-card',
        className
      )}
      aria-label="On this page"
    >
      <p className="shrink-0 border-b px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        On this page
      </p>
      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden p-2">
        {headings.map((heading) => (
          <li key={heading.id} className="min-w-0">
            <button
              type="button"
              onClick={() => onNavigate(heading.id)}
              className={cn(
                'w-full min-w-0 rounded-md px-2 py-1.5 text-left text-sm leading-snug transition-colors hover:bg-muted',
                heading.level === 2 && 'pl-2',
                heading.level === 3 && 'pl-3 text-xs text-muted-foreground',
                activeId === heading.id && 'bg-primary/10 font-medium text-primary'
              )}
            >
              <span className="line-clamp-3 break-words">{heading.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
