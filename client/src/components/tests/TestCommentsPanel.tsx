import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTestComments, useCreateTestComment } from '@/api/tests';
import { formatDateTime } from '@/lib/formatters';
import { MessageSquare, Send } from 'lucide-react';

type TestCommentsPanelProps = {
  testId: string;
};

export function TestCommentsPanel({ testId }: TestCommentsPanelProps) {
  const [content, setContent] = useState('');
  const commentsQuery = useTestComments(testId);
  const createComment = useCreateTestComment(testId);

  const comments =
    commentsQuery.data?.pages.flatMap((p) => p.comments) ?? [];
  const hasNextPage = commentsQuery.hasNextPage;
  const isFetchingNextPage = commentsQuery.isFetchingNextPage;
  const isLoading = commentsQuery.isLoading;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    createComment.mutate(content.trim(), {
      onSuccess: () => setContent(''),
    });
  };

  if (isLoading) {
    return (
      <Card className="border-border/80">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Loading comments…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/80">
      <CardContent className="pt-6">
        {comments.length === 0 && !content ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="mb-4 size-12 text-muted-foreground/50" />
            <p className="font-medium text-muted-foreground">No comments yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a note for your team about this test.
            </p>
          </div>
        ) : (
          <ul className="mb-6 space-y-4">
            {comments.map((c) => (
              <li key={c._id} className="flex gap-3 rounded-lg border border-border/80 p-4 dark:border-border/60">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#409BA1]/15 text-sm font-medium text-[#409BA1]">
                  {c.userId?.firstName?.[0]}
                  {c.userId?.lastName?.[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">
                      {c.userId?.firstName} {c.userId?.lastName}
                    </span>
                    <span className="text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{c.content}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {hasNextPage && (
          <div className="mb-6 flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isFetchingNextPage}
              onClick={() => commentsQuery.fetchNextPage()}
            >
              {isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add a comment…"
            rows={2}
            className="min-h-[72px] flex-1 resize-none border-border/80"
          />
          <Button
            type="submit"
            size="icon"
            className="shrink-0 bg-[#409BA1] hover:bg-[#358a8f]"
            disabled={!content.trim() || createComment.isPending}
            aria-label="Post comment"
          >
            <Send className="size-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
