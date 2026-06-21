import { cn } from '@/lib/utils';
import { RadioGroupItem } from '@/components/ui/radio-group';

export function QuizOptionCard({
  optionId,
  text,
  selected,
  disabled,
}: {
  optionId: string;
  text: string;
  selected: boolean;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-lg border p-4 text-sm transition-colors',
        selected && 'border-primary bg-primary/5 ring-1 ring-primary/20',
        !selected && 'hover:border-primary/40 hover:bg-muted/40',
        disabled && 'cursor-not-allowed opacity-60'
      )}
    >
      <RadioGroupItem value={optionId} className="mt-0.5" disabled={disabled} />
      <span className="leading-relaxed">{text}</span>
    </label>
  );
}
