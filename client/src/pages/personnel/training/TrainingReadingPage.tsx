import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BookOpenCheck } from 'lucide-react';
import { ContextualHelpButton, FormErrorAlert, TableSkeleton } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  TrainingCertificateActions,
  TrainingCompletionModal,
  TrainingHeader,
  TrainingMarkdownRenderer,
  TrainingSectionNav,
  extractMarkdownHeadings,
} from '@/components/training';
import {
  useTrainingModule,
  useUpdateTrainingProgress,
} from '@/api/personnelTasks';

export function TrainingReadingPage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const training = useTrainingModule(moduleId ?? null);
  const progress = useUpdateTrainingProgress();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [readProgress, setReadProgress] = useState(0);
  const [activeHeadingId, setActiveHeadingId] = useState<string>();
  const [completionModalOpen, setCompletionModalOpen] = useState(false);

  const data = training.data;
  const headings = useMemo(
    () => (data?.contentMarkdown ? extractMarkdownHeadings(data.contentMarkdown) : []),
    [data?.contentMarkdown]
  );

  const readComplete = Boolean(
    data?.attempt.passedAt ||
      data?.attempt.readCompletedAt ||
      (data?.attempt.readProgressPercent ?? 0) >= 100
  );
  const quizPending = readComplete && !data?.attempt.passedAt;
  const trainingPassed = Boolean(data?.attempt.passedAt);
  const certificateId = data?.attempt.certificateEvidenceId;

  useEffect(() => {
    if (data?.attempt.readProgressPercent != null) {
      setReadProgress(Math.max(readProgress, data.attempt.readProgressPercent));
    }
  }, [data?.attempt.readProgressPercent]);

  const handleScroll = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const scrollPercent = Math.round(
      ((el.scrollTop + el.clientHeight) / Math.max(el.scrollHeight, 1)) * 100
    );
    setReadProgress((prev) => Math.max(prev, Math.min(100, scrollPercent)));

    const offset = 120;
    let current = headings[0]?.id;
    for (const heading of headings) {
      const node = document.getElementById(heading.id);
      if (node && node.getBoundingClientRect().top <= offset) {
        current = heading.id;
      }
    }
    if (current) setActiveHeadingId(current);
  }, [headings]);

  const markRead = async () => {
    if (!moduleId) return;
    await progress.mutateAsync({ moduleId, readProgressPercent: 100 });
    setReadProgress(100);
    setCompletionModalOpen(true);
  };

  const scrollToHeading = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveHeadingId(id);
  };

  if (!moduleId) {
    return <FormErrorAlert message="Training module not found." />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 pb-16 md:p-6">
      {training.isLoading ? (
        <TableSkeleton rows={8} columns={1} />
      ) : training.error ? (
        <FormErrorAlert
          message={(training.error as Error).message}
          onRetry={() => training.refetch()}
        />
      ) : data ? (
        <>
          <TrainingHeader
            title={data.title}
            description={data.description}
            frameworkTags={data.frameworkTags}
            estimatedReadMinutes={data.estimatedReadMinutes}
            attempt={data.attempt}
            actions={
              <div className="flex gap-2">
                <ContextualHelpButton
                  moduleId="training"
                  current={{ status: trainingPassed ? 'passed' : quizPending ? 'submitted' : readProgress > 0 ? 'in_progress' : 'not_started' }}
                />
                <Button asChild variant="outline" size="sm">
                  <Link to="/personnel">Back to My Tasks</Link>
                </Button>
              </div>
            }
          />

          {!readComplete && (
            <Card>
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Reading progress</p>
                  <p className="text-xs text-muted-foreground">
                    Scroll through the material or mark as read when finished.
                  </p>
                  <Progress value={readProgress} className="mt-2 h-2" />
                </div>
                <Button
                  type="button"
                  onClick={markRead}
                  disabled={progress.isPending}
                  className="shrink-0"
                >
                  <BookOpenCheck className="mr-2 size-4" aria-hidden />
                  Mark as Read
                </Button>
              </CardContent>
            </Card>
          )}

          {trainingPassed && certificateId && moduleId && (
            <TrainingCertificateActions
              moduleId={moduleId}
              certificateEvidenceId={certificateId}
            />
          )}

          {quizPending && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">Ready for the quiz</p>
                  <p className="text-sm text-muted-foreground">
                    {data.attempt.quizMeta.questionsPerAttempt} questions ·{' '}
                    {Math.round(data.attempt.quizMeta.passingScore * 100)}% required to pass
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => navigate(`/personnel/training/${moduleId}/quiz`)}
                >
                  Continue to Quiz
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
            <aside className="hidden min-w-0 lg:block">
              <div className="sticky top-6 z-10 h-[calc(100dvh-6.5rem)] max-h-[calc(100dvh-6.5rem)]">
                <TrainingSectionNav
                  headings={headings}
                  activeId={activeHeadingId}
                  onNavigate={scrollToHeading}
                />
              </div>
            </aside>
            <div
              ref={contentRef}
              onScroll={handleScroll}
              className="min-w-0 max-h-[calc(100vh-12rem)] overflow-y-auto rounded-xl border bg-card p-6 shadow-sm md:p-10 lg:max-h-none lg:overflow-visible"
            >
              <TrainingMarkdownRenderer content={data.contentMarkdown} />
              {!readComplete && (
                <div className="mt-10 flex justify-center border-t pt-8">
                  <Button type="button" size="lg" onClick={markRead} disabled={progress.isPending}>
                    Mark as Read
                  </Button>
                </div>
              )}
            </div>
          </div>

          <TrainingCompletionModal
            open={completionModalOpen}
            onOpenChange={setCompletionModalOpen}
            onStartQuiz={() => {
              setCompletionModalOpen(false);
              navigate(`/personnel/training/${moduleId}/quiz`);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
