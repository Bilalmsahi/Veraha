import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrainingQuizReviewItem } from '@/api/personnelTasks';

export function QuizReviewList({ review }: { review: TrainingQuizReviewItem[] }) {
  return (
    <div className="space-y-6">
      {review.map((item, index) => (
        <div key={item.id} className="rounded-lg border p-4">
          <div className="flex items-start gap-2">
            {item.isCorrect ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
            )}
            <div className="min-w-0 flex-1 space-y-3">
              <p className="font-medium">
                {index + 1}. {item.text}
              </p>
              <ul className="space-y-1.5">
                {item.options.map((option) => {
                  const isSelected = item.selectedOptionId === option.id;
                  const isCorrect = item.correctOptionId === option.id;
                  return (
                    <li
                      key={option.id}
                      className={cn(
                        'rounded-md border px-3 py-2 text-sm',
                        isCorrect && 'border-emerald-500/50 bg-emerald-500/5',
                        isSelected && !isCorrect && 'border-destructive/50 bg-destructive/5',
                        !isSelected && !isCorrect && 'text-muted-foreground'
                      )}
                    >
                      {option.text}
                      {isSelected && !isCorrect && (
                        <span className="ml-2 text-xs text-destructive">Your answer</span>
                      )}
                      {isCorrect && (
                        <span className="ml-2 text-xs text-emerald-700 dark:text-emerald-400">
                          Correct
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              {item.explanation && (
                <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                  {item.explanation}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
