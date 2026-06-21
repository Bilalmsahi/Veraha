/**
 * Vanta-style Renew by filter: Popover with presets list (left) + two-month range calendar (right).
 */
import { useMemo, useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';

const RENEW_BY_PRESETS: { value: string; label: string }[] = [
  { value: 'custom', label: 'Custom' },
  { value: 'next_7_days', label: 'Next 7 days' },
  { value: 'next_30_days', label: 'Next 30 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'previous_month', label: 'Previous month' },
  { value: 'previous_3_months', label: 'Previous 3 months' },
  { value: 'previous_6_months', label: 'Previous 6 months' },
  { value: 'previous_12_months', label: 'Previous 12 months' },
];

type RenewByFilterPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  validUntilFrom: string;
  validUntilTo: string;
  onApply: (
    renewBy: string,
    validUntilFrom?: string,
    validUntilTo?: string
  ) => void;
};

function getDisplayLabel(
  value: string,
  validUntilFrom: string,
  validUntilTo: string
): string {
  if (value === 'custom' && validUntilFrom && validUntilTo) {
    return `${validUntilFrom} – ${validUntilTo}`;
  }
  const preset = RENEW_BY_PRESETS.find((p) => p.value === value);
  return preset?.label ?? 'Renew by';
}

export function RenewByFilterPopover({
  open,
  onOpenChange,
  value,
  validUntilFrom,
  validUntilTo,
  onApply,
}: RenewByFilterPopoverProps) {
  const dateRange = useMemo((): DateRange | undefined => {
    if (validUntilFrom && validUntilTo) {
      const from = new Date(validUntilFrom);
      const to = new Date(validUntilTo);
      if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
        return { from, to };
      }
    }
    return undefined;
  }, [validUntilFrom, validUntilTo]);

  const [calendarRange, setCalendarRange] = useState<DateRange | undefined>(dateRange);

  const selectedRange = calendarRange ?? dateRange;

  const handlePresetClick = (presetValue: string) => {
    if (presetValue === 'custom') {
      onApply('', undefined, undefined);
      onOpenChange(false);
      return;
    }
    onApply(presetValue);
    onOpenChange(false);
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    setCalendarRange(range);
    if (range?.from && range?.to) {
      const fromStr = range.from.toISOString().slice(0, 10);
      const toStr = range.to.toISOString().slice(0, 10);
      onApply('custom', fromStr, toStr);
      onOpenChange(false);
    }
  };

  const isCustomSelected =
    value === 'custom' && !!validUntilFrom && !!validUntilTo;

  const displayLabel = getDisplayLabel(value, validUntilFrom, validUntilTo);
  const hasValue = !!value || !!(validUntilFrom && validUntilTo);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          // Reset calendar range from current filter on open (avoid setState-in-effect lint)
          setCalendarRange(dateRange);
        }
        onOpenChange(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'w-[140px] justify-between font-normal',
            !hasValue && 'text-muted-foreground'
          )}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="start"
        sideOffset={4}
      >
        <div className="flex">
          {/* Left column: presets */}
          <div className="flex flex-col border-r border-border bg-muted/20">
            {RENEW_BY_PRESETS.map((preset) => {
              const isSelected =
                preset.value === 'custom'
                  ? isCustomSelected
                  : value === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => handlePresetClick(preset.value)}
                  className={cn(
                    'px-4 py-2.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                    isSelected &&
                      'bg-accent font-medium text-accent-foreground'
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          {/* Right column: two-month calendar */}
          <div className="p-3">
            <Calendar
              mode="range"
              numberOfMonths={2}
              selected={selectedRange}
              onSelect={handleCalendarSelect}
              defaultMonth={dateRange?.from ?? new Date()}
              className="rounded-md border-0 bg-transparent"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
