/**
 * Frameworks popover - shows "Frameworks (N)" and on hover displays all matching framework names.
 * Vanta-style: hover over frameworks to see the full list.
 */
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatFrameworkCode } from '@/lib/formatters';

type FrameworkRef = { _id?: string; code?: string; name?: string };

type FrameworksPopoverProps = {
  frameworks: FrameworkRef[];
};

export function FrameworksPopover({ frameworks }: FrameworksPopoverProps) {
  if (frameworks.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-sm text-muted-foreground hover:text-foreground cursor-help">
            Frameworks ({frameworks.length})
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="max-w-[240px] p-3 bg-popover text-popover-foreground border shadow-md"
        >
          <p className="text-xs font-medium mb-2">Matching frameworks</p>
          <ul className="space-y-1">
            {frameworks.map((f) => {
              const codeLabel = formatFrameworkCode(f.code);
              const nameLabel = f.name ? formatFrameworkCode(f.name) : '';
              return (
                <li key={f._id ?? f.code ?? ''} className="text-sm">
                  {codeLabel}
                  {nameLabel && nameLabel !== codeLabel && (
                    <span className="text-muted-foreground opacity-90"> — {nameLabel}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
