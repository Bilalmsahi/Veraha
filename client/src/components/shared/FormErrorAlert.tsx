import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

type FormErrorAlertProps = {
  message: string;
  onRetry?: () => void;
};

export function FormErrorAlert({ message, onRetry }: FormErrorAlertProps) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <span>{message}</span>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="w-fit">
          <RotateCcw className="mr-1.5 size-3.5" />
          Try again
        </Button>
      )}
    </div>
  );
}
