import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ContextualHelpButton, FormErrorAlert, TableSkeleton } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup } from '@/components/ui/radio-group';
import {
  QuizOptionCard,
  QuizProgressBar,
  QuizResultCard,
  TrainingHeader,
} from '@/components/training';
import {
  useStartTrainingQuiz,
  useSubmitTrainingQuiz,
  useTrainingModule,
  useTrainingQuizResult,
  type TrainingQuestion,
  type TrainingQuizResult,
} from '@/api/personnelTasks';
import { formatDate } from '@/lib/formatters';

export function TrainingQuizPage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const training = useTrainingModule(moduleId ?? null);
  const startQuiz = useStartTrainingQuiz();
  const submitQuiz = useSubmitTrainingQuiz();

  const data = training.data;
  const passed = Boolean(data?.attempt.passedAt);
  const readComplete = Boolean(
    data?.attempt.readCompletedAt || (data?.attempt.readProgressPercent ?? 0) >= 100
  );
  const sessionSubmitted = data?.attempt.quizSession?.status === 'submitted';

  const resultQuery = useTrainingQuizResult(
    moduleId ?? null,
    Boolean(moduleId && (passed || sessionSubmitted))
  );

  const [questions, setQuestions] = useState<TrainingQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitResult, setSubmitResult] = useState<TrainingQuizResult | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const quizStartRequested = useRef(false);

  const retryLocked = useMemo(() => {
    const next = data?.attempt.nextRetryAt ? new Date(data.attempt.nextRetryAt) : null;
    return Boolean(next && next > new Date() && !passed);
  }, [data?.attempt.nextRetryAt, passed]);

  const maxAttemptsReached = useMemo(() => {
    if (!data) return false;
    return (
      !passed &&
      data.attempt.attempts >= data.attempt.quizMeta.maxAttempts &&
      data.attempt.quizSession?.status === 'submitted'
    );
  }, [data, passed]);

  const displayResult = submitResult || resultQuery.data || null;
  const showResults = Boolean(displayResult && (passed || sessionSubmitted || submitResult));
  const currentHelpStatus = passed
    ? 'passed'
    : sessionSubmitted
      ? 'submitted'
      : questions.length > 0
        ? 'in_progress'
        : 'not_started';

  useEffect(() => {
    if (!moduleId || !data || showResults || passed) return;
    if (!readComplete) {
      navigate(`/personnel/training/${moduleId}`, { replace: true });
      return;
    }
    if (questions.length || quizStartRequested.current || startQuiz.isPending) return;

    quizStartRequested.current = true;
    startQuiz
      .mutateAsync({ moduleId })
      .then((session) => {
        setQuestions(session.questions);
        setStartError(null);
      })
      .catch((err) => {
        quizStartRequested.current = false;
        setStartError((err as Error).message);
      });
  }, [moduleId, data, readComplete, passed, showResults, questions.length, navigate, startQuiz]);

  const handleRetake = async () => {
    if (!moduleId) return;
    setSubmitResult(null);
    setAnswers({});
    setCurrentIndex(0);
    quizStartRequested.current = false;
    const session = await startQuiz.mutateAsync({ moduleId, forceNew: true });
    quizStartRequested.current = true;
    setQuestions(session.questions);
    await training.refetch();
  };

  const currentQuestion = questions[currentIndex];
  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id]);
  const isLast = currentIndex === questions.length - 1;

  const handleSubmit = async () => {
    if (!moduleId || !allAnswered) return;
    const result = await submitQuiz.mutateAsync({ moduleId, answers });
    setSubmitResult(result);
    await training.refetch();
  };

  if (!moduleId) {
    return <FormErrorAlert message="Training module not found." />;
  }

  if (training.isLoading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <TableSkeleton rows={6} columns={1} />
      </div>
    );
  }

  if (training.error) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <FormErrorAlert
          message={(training.error as Error).message}
          onRetry={() => training.refetch()}
        />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-16 md:p-6">
      <TrainingHeader
        title={data.title}
        frameworkTags={data.frameworkTags}
        estimatedReadMinutes={data.estimatedReadMinutes}
        attempt={data.attempt}
        actions={
          <div className="flex flex-wrap gap-2">
            <ContextualHelpButton moduleId="training" current={{ status: currentHelpStatus }} />
            <Button asChild variant="outline" size="sm">
              <Link to={`/personnel/training/${moduleId}`}>Back to reading</Link>
            </Button>
          </div>
        }
      />

      {showResults && displayResult ? (
        <QuizResultCard
          result={displayResult}
          moduleId={moduleId}
          onRetake={displayResult.canRetake ? handleRetake : undefined}
          retakePending={startQuiz.isPending}
        />
      ) : (
        <>
          {retryLocked && data.attempt.nextRetryAt && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm">
              <p className="font-medium text-destructive">Retry locked</p>
              <p className="mt-1 text-muted-foreground">
                You can retake this quiz after {formatDate(data.attempt.nextRetryAt)}.
              </p>
            </div>
          )}

          {maxAttemptsReached && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm">
              <p className="font-medium text-destructive">Maximum attempts reached</p>
              <p className="mt-1 text-muted-foreground">
                Contact your administrator if you need another attempt.
              </p>
            </div>
          )}

          {(startError || startQuiz.isError) && (
            <FormErrorAlert
              message={startError || (startQuiz.error as Error)?.message || 'Unable to start quiz.'}
              onRetry={() => startQuiz.mutate({ moduleId })}
            />
          )}

          {!retryLocked && !maxAttemptsReached && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Knowledge check</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Answer {data.attempt.quizMeta.questionsPerAttempt} questions drawn from the
                  training material. You need at least{' '}
                  {Math.ceil(data.attempt.quizMeta.passingScore * data.attempt.quizMeta.questionsPerAttempt)}{' '}
                  correct answers ({Math.round(data.attempt.quizMeta.passingScore * 100)}%) to pass.
                  Attempt {data.attempt.attempts + 1} of {data.attempt.quizMeta.maxAttempts}.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {startQuiz.isPending && !questions.length ? (
                  <TableSkeleton rows={4} columns={1} />
                ) : currentQuestion ? (
                  <>
                    <QuizProgressBar current={currentIndex + 1} total={questions.length} />
                    <div className="space-y-4">
                      <p className="text-base font-medium leading-relaxed">{currentQuestion.text}</p>
                      <RadioGroup
                        value={answers[currentQuestion.id] || ''}
                        onValueChange={(value) =>
                          setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }))
                        }
                      >
                        <div className="space-y-3">
                          {currentQuestion.options.map((option) => (
                            <QuizOptionCard
                              key={option.id}
                              optionId={option.id}
                              text={option.text}
                              selected={answers[currentQuestion.id] === option.id}
                            />
                          ))}
                        </div>
                      </RadioGroup>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={currentIndex === 0}
                        onClick={() => setCurrentIndex((i) => i - 1)}
                      >
                        <ChevronLeft className="mr-1 size-4" aria-hidden />
                        Previous
                      </Button>
                      {isLast ? (
                        <Button
                          type="button"
                          onClick={handleSubmit}
                          disabled={!allAnswered || submitQuiz.isPending}
                        >
                          {submitQuiz.isPending ? 'Submitting…' : 'Submit quiz'}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          onClick={() => setCurrentIndex((i) => i + 1)}
                          disabled={!answers[currentQuestion.id]}
                        >
                          Next
                          <ChevronRight className="ml-1 size-4" aria-hidden />
                        </Button>
                      )}
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
