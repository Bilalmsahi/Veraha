import * as React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type FilterItem = {
  key: string;
  label: string;
  value: string;
  options?: { value: string; label: string }[];
  /** When value equals defaultValue, filter is not counted as "active" */
  defaultValue?: string;
  /** When provided, renders this instead of the default Select (e.g. custom Popover) */
  customRender?: React.ReactNode;
};

type FilterBarProps = {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  filters?: FilterItem[];
  onFilterChange?: (key: string, value: string) => void;
  onClearAll?: () => void;
  className?: string;
};

export function FilterBar({
  searchPlaceholder = 'Search...',
  searchValue = '',
  onSearchChange,
  filters = [],
  onFilterChange,
  onClearAll,
  className,
}: FilterBarProps) {
  const activeFilterCount =
    (searchValue ? 1 : 0) +
    (filters?.filter((f) => {
      if (!f.value) return false;
      if (f.defaultValue !== undefined && f.value === f.defaultValue) return false;
      return true;
    }).length ?? 0);
  const hasActiveFilters = activeFilterCount > 0;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2',
        className
      )}
    >
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange?.(e.target.value)}
          className="pl-9"
        />
      </div>
      {filters.map((f) =>
        f.customRender != null ? (
          <React.Fragment key={f.key}>{f.customRender}</React.Fragment>
        ) : (
          <Select
            key={f.key}
            value={f.value || '__all__'}
            onValueChange={(v) => onFilterChange?.(f.key, v === '__all__' ? '' : v)}
          >
            <SelectTrigger size="sm" className="w-auto min-w-[100px]">
              {f.value ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">{f.label}:</span>
                  <SelectValue />
                </div>
              ) : (
                <SelectValue placeholder={f.label}>
                  {f.label}
                </SelectValue>
              )}
            </SelectTrigger>
            <SelectContent>
                {f.options?.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
        )
      )}
      {hasActiveFilters && onClearAll && (
        <>
          <Badge variant="secondary" className="text-xs">
            {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
          </Badge>
          <Button variant="ghost" size="sm" onClick={onClearAll}>
            <X className="mr-1 size-3.5" />
            Clear all
          </Button>
        </>
      )}
    </div>
  );
}
