import DOMPurify from 'dompurify';
import { cn } from '@/lib/utils';

type PolicyViewerProps = {
  contentHtml?: string | null;
  className?: string;
};

export const policyContentClassName =
  'policy-content mx-auto max-w-[860px] text-sm leading-6 text-foreground [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_ul]:list-disc [&_ul]:pl-6';

export function PolicyViewer({ contentHtml, className }: PolicyViewerProps) {
  const cleanHtml = DOMPurify.sanitize(contentHtml || '');

  if (!cleanHtml.trim()) {
    return (
      <div className={cn(policyContentClassName, className)}>
        <p className="text-muted-foreground">No policy content has been added yet.</p>
      </div>
    );
  }

  return (
    <div
      className={cn(policyContentClassName, className)}
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
    />
  );
}
