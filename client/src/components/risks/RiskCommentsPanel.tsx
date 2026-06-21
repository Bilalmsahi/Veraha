import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useRiskComments, useCreateRiskComment } from '@/api/risks';
import { formatDateTime } from '@/lib/formatters';
import { MessageSquare, Send } from 'lucide-react';

type RiskCommentsPanelProps = {
  riskId: string;
};

export function RiskCommentsPanel({ riskId }: RiskCommentsPanelProps) {
  const [content, setContent] = useState('');
  const { data, isLoading } = useRiskComments(riskId);
  const createComment = useCreateRiskComment(riskId);
  const comments = data?.comments ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    createComment.mutate(content.trim(), {
      onSuccess: () => setContent(''),
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Loading comments...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {comments.length === 0 && !content ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="mb-4 size-12 text-muted-foreground/50" />
            <p className="font-medium text-muted-foreground">No comments yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Share your thoughts to start a discussion.
            </p>
          </div>
        ) : (
          <ul className="mb-6 space-y-4">
            {comments.map((c) => (
              <li
                key={c._id}
                className="flex gap-3 rounded-lg border p-4"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
                  {c.userId?.firstName?.[0]}
                  {c.userId?.lastName?.[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">
                      {c.userId?.firstName} {c.userId?.lastName}
                    </span>
                    <span className="text-muted-foreground">
                      {formatDateTime(c.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{c.content}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Comment or add others with @..."
            rows={2}
            className="min-h-[80px] resize-none"
            maxLength={5000}
          />
          <Button
            type="submit"
            size="icon"
            className="shrink-0"
            disabled={!content.trim() || createComment.isPending}
          >
            <Send className="size-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
