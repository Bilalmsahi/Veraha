import { Badge } from '@/components/ui/badge';
import { formatFrameworkCode } from '@/lib/formatters';
import { cn } from '@/lib/utils';

export type LinkedControlRow = {
  _id: string;
  identifier?: string;
  title?: string;
  linkedRequirements?: Array<{
    frameworkId?: { _id?: string; code?: string; name?: string };
  }>;
};

type TestDetailControlsTabProps = {
  linked: LinkedControlRow[];
  onControlClick: (controlId: string) => void;
};

function frameworkPills(control: LinkedControlRow): { key: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const m of control.linkedRequirements ?? []) {
    const fw = m.frameworkId;
    if (fw && typeof fw === 'object' && fw._id) {
      const id = String(fw._id);
      const label = formatFrameworkCode(fw.name ?? fw.code ?? id);
      if (!seen.has(id)) seen.set(id, label);
    }
  }
  return [...seen.entries()].map(([key, label]) => ({ key, label }));
}

export function TestDetailControlsTab({ linked, onControlClick }: TestDetailControlsTabProps) {
  if (linked.length === 0) {
    return <p className="text-sm text-muted-foreground">No controls linked to this test.</p>;
  }

  return (
    <div className="space-y-2">
      {linked.map((c) => {
        const pills = frameworkPills(c);
        return (
          <button
            key={c._id}
            type="button"
            onClick={() => onControlClick(c._id)}
            className="flex w-full flex-col gap-2 rounded-md border border-border/80 bg-card px-4 py-3 text-left transition-colors hover:border-[#409BA1]/50 dark:bg-[#3A5255]/20 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-medium text-foreground">
                {c.identifier ? `${c.identifier}: ` : ''}
                {c.title}
              </p>
              {pills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {pills.map((p) => (
                    <Badge
                      key={p.key}
                      variant="outline"
                      className={cn(
                        'font-normal',
                        'border-[#409BA1]/40 bg-[#409BA1]/10 text-[#409BA1]',
                        'dark:border-[#409BA1]/50 dark:bg-[#409BA1]/20 dark:text-[#7ecbcd]'
                      )}
                    >
                      {p.label}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <span className="shrink-0 text-muted-foreground">→</span>
          </button>
        );
      })}
    </div>
  );
}
