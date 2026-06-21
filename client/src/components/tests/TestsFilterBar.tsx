import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatFrameworkCode } from '@/lib/formatters';
import type { FrameworkWithCount } from '@/api/frameworks';
import type { ControlListItem } from '@/api/controls';
import type { OrgUser } from '@/api/users';
import type { TestsFilterState } from '@/types/models';

export type { TestsFilterState };

type TestsFilterBarProps = {
  value: TestsFilterState;
  onChange: (next: Partial<TestsFilterState>) => void;
  onClear: () => void;
  frameworks: FrameworkWithCount[];
  controls: ControlListItem[];
  users: OrgUser[];
};

const CATEGORIES = [
  'Engineering',
  'Human resources',
  'Policy',
  'Risks',
  'Legal',
  'Finance',
  'Management',
  'Other',
];

const STATUSES = ['ok', 'overdue', 'due_soon', 'needs_remediation', 'na'] as const;
const TYPES = ['document', 'automated'] as const;
const ROLLOUTS = ['enabled', 'disabled', 'monitor_only'] as const;

const filterFieldClass = 'w-full sm:w-auto sm:min-w-[120px]';

export function TestsFilterBar({
  value,
  onChange,
  onClear,
  frameworks,
  controls,
  users,
}: TestsFilterBarProps) {
  const hasActive =
    value.search ||
    value.category ||
    value.frameworkId ||
    value.controlId ||
    value.integration ||
    value.ownerId ||
    value.type ||
    value.status ||
    value.rollout;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[200px] flex-1 max-w-sm">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Search</label>
        <Input
          placeholder="Search tests…"
          value={value.search}
          onChange={(e) => onChange({ search: e.target.value })}
          className="h-9"
        />
      </div>
      <div className={cn(filterFieldClass, 'sm:min-w-[140px]')}>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Category</label>
        <Select
          value={value.category || '__all__'}
          onValueChange={(v) => onChange({ category: v === '__all__' ? '' : v })}
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className={cn(filterFieldClass, 'sm:min-w-[160px]')}>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Framework</label>
        <Select
          value={value.frameworkId || '__all__'}
          onValueChange={(v) => onChange({ frameworkId: v === '__all__' ? '' : v })}
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue placeholder="Framework" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All frameworks</SelectItem>
            {frameworks.map((f) => (
              <SelectItem key={f._id} value={f._id}>
                {formatFrameworkCode(f.name ?? f.code ?? '')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className={cn(filterFieldClass, 'sm:min-w-[180px] lg:min-w-[200px]')}>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Control</label>
        <Select
          value={value.controlId || '__all__'}
          onValueChange={(v) => onChange({ controlId: v === '__all__' ? '' : v })}
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue placeholder="Control" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All controls</SelectItem>
            {controls.map((c) => (
              <SelectItem key={c._id} value={c._id}>
                {c.identifier} — {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className={filterFieldClass}>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Integration</label>
        <Input
          placeholder="Provider"
          value={value.integration}
          onChange={(e) => onChange({ integration: e.target.value })}
          className="h-9"
        />
      </div>
      <div className={filterFieldClass}>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Owner</label>
        <Select
          value={value.ownerId || '__all__'}
          onValueChange={(v) => onChange({ ownerId: v === '__all__' ? '' : v })}
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue placeholder="Owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All owners</SelectItem>
            {users.map((u) => (
              <SelectItem key={u._id} value={u._id}>
                {u.firstName} {u.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className={filterFieldClass}>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Type</label>
        <Select
          value={value.type || '__all__'}
          onValueChange={(v) => onChange({ type: v === '__all__' ? '' : v })}
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All types</SelectItem>
            {TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className={filterFieldClass}>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
        <Select
          value={value.status || '__all__'}
          onValueChange={(v) => onChange({ status: v === '__all__' ? '' : v })}
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className={filterFieldClass}>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Rollout</label>
        <Select
          value={value.rollout || '__all__'}
          onValueChange={(v) => onChange({ rollout: v === '__all__' ? '' : v })}
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue placeholder="Rollout" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All</SelectItem>
            {ROLLOUTS.map((r) => (
              <SelectItem key={r} value={r}>
                {r.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {hasActive && (
        <Button type="button" variant="ghost" size="sm" className="h-9 text-primary" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
