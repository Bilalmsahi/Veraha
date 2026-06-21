/**
 * Framework code combobox - Vanta-style dropdown with search and scrollable list.
 * Shows "Framework Name · identifier" format (e.g., "SOC 2 · CC 6.5", "HIPAA · 164.308(a)(1)(i)").
 */
import { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Check, ChevronDown } from 'lucide-react';
import { formatFrameworkCode } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { RequirementCodeItem } from '@/api/controls';
import type { Framework } from '@/types/models';

type FrameworkCodeComboboxProps = {
  value: string;
  onValueChange: (value: string) => void;
  requirementCodes: RequirementCodeItem[];
  requirements?: { identifier: string }[];
  frameworks: Framework[];
  frameworkCode: string;
  disabled?: boolean;
};

function formatLabel(
  frameworkName: string,
  identifier: string
): string {
  return `${frameworkName} · ${identifier}`;
}

export function FrameworkCodeCombobox({
  value,
  onValueChange,
  requirementCodes,
  requirements,
  frameworks,
  frameworkCode,
  disabled,
}: FrameworkCodeComboboxProps) {
  const [open, setOpen] = useState(false);

  const frameworkName = formatFrameworkCode(
    frameworks.find((f) => f.code === frameworkCode)?.name ?? frameworkCode
  );

  const options: { identifier: string; label: string }[] = frameworkCode
    ? (requirements ?? []).map((r) => ({
        identifier: r.identifier,
        label: formatLabel(frameworkName, r.identifier),
      }))
    : requirementCodes.map((rc) => ({
        identifier: rc.identifier,
        label: rc.frameworkName
          ? formatLabel(formatFrameworkCode(rc.frameworkName), rc.identifier)
          : `${formatFrameworkCode(rc.frameworkCode)} ${rc.identifier}`.trim(),
      }));

  const selectedLabel = value
    ? options.find((o) => o.identifier === value)?.label ?? value
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-[180px] justify-between font-normal"
        >
          <span className="truncate">
            {selectedLabel || 'Framework code'}
          </span>
          <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search" />
          <CommandList className="max-h-[200px]">
            <CommandEmpty>No framework code found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__all__"
                onSelect={() => {
                  onValueChange('');
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    'mr-2 size-4',
                    !value ? 'opacity-100' : 'opacity-0'
                  )}
                />
                Framework code
              </CommandItem>
              {options.map((opt) => (
                <CommandItem
                  key={opt.identifier}
                  value={opt.label}
                  onSelect={() => {
                    onValueChange(opt.identifier);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 size-4',
                      value === opt.identifier ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="truncate">{opt.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
