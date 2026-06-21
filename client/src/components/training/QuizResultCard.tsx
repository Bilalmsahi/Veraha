import { Link } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';
import { TrainingCertificateActions } from './TrainingCertificateActions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QuizReviewList } from './QuizReviewList';
import type { TrainingQuizResult } from '@/api/personnelTasks';
import { formatDate } from '@/lib/formatters';

export function QuizResultCard({
  result,
  moduleId,
  onRetake,
  retakePending,
}: {
  result: TrainingQuizResult;
  moduleId: string;
  onRetake?: () => void;
  retakePending?: boolean;
}) {
  const percent = Math.round(result.scorePercent * 100);
  const requiredPercent = Math.round(result.passingScore * 100);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            Quiz results
            <Badge variant={result.passed ? 'default' : 'destructive'}>
              {result.passed ? 'Passed' : 'Failed'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Score</p>
              <p className="text-3xl font-semibold">
                {result.correctCount}/{result.totalQuestions}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Percentage</p>
              <p className="text-3xl font-semibold">{percent}%</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Required</p>
              <p className="text-3xl font-semibold">{requiredPercent}%</p>
            </div>
          </div>
          {result.passed && result.attempt.certificateEvidenceId && (
            <TrainingCertificateActions
              moduleId={moduleId}
              certificateEvidenceId={result.attempt.certificateEvidenceId}
            />
          )}
          {result.passed && !result.attempt.certificateEvidenceId && (
            <p className="text-sm text-muted-foreground">
              Your completion is recorded. Contact an administrator if you need a certificate file.
            </p>
          )}
          {!result.passed && result.nextRetryAt && !result.canRetake && (
            <p className="text-sm text-destructive">
              You can retake after {formatDate(result.nextRetryAt)}.
            </p>
          )}
          {!result.passed && result.attempts >= result.maxAttempts && (
            <p className="text-sm text-destructive">Maximum attempts reached.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/personnel">Back to My Tasks</Link>
            </Button>
            {!result.passed && result.canRetake && onRetake && (
              <Button type="button" onClick={onRetake} disabled={retakePending}>
                <RotateCcw className="mr-2 size-4" aria-hidden />
                Retake quiz
              </Button>
            )}
            {result.passed && (
              <Button asChild variant="secondary">
                <Link to={`/personnel/training/${moduleId}`}>Review material</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      <div>
        <h2 className="mb-4 text-lg font-semibold">Answer review</h2>
        <QuizReviewList review={result.review} />
      </div>
    </div>
  );
}
