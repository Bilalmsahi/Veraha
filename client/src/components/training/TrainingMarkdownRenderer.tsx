import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import {
  AlertTriangle,
  BookOpen,
  Lightbulb,
  MessageCircleQuestion,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  detectCalloutKind,
  stripCalloutLabel,
  type CalloutKind,
} from './trainingMarkdown';

function calloutStyles(kind: CalloutKind) {
  switch (kind) {
    case 'warning':
      return {
        icon: AlertTriangle,
        className: 'border-amber-500/40 bg-amber-500/5 text-amber-950 dark:text-amber-50',
        iconClass: 'text-amber-600',
      };
    case 'scenario':
      return {
        icon: BookOpen,
        className: 'border-blue-500/40 bg-blue-500/5',
        iconClass: 'text-blue-600',
      };
    case 'tip':
      return {
        icon: Lightbulb,
        className: 'border-emerald-500/40 bg-emerald-500/5',
        iconClass: 'text-emerald-600',
      };
    case 'practice':
      return {
        icon: Sparkles,
        className: 'border-primary/40 bg-primary/5',
        iconClass: 'text-primary',
      };
    case 'think':
      return {
        icon: MessageCircleQuestion,
        className: 'border-violet-500/40 bg-violet-500/5',
        iconClass: 'text-violet-600',
      };
    default:
      return {
        icon: BookOpen,
        className: 'border-border bg-muted/40',
        iconClass: 'text-muted-foreground',
      };
  }
}

function CalloutBlockquote({ children }: { children: React.ReactNode }) {
  const text =
    typeof children === 'string'
      ? children
      : Array.isArray(children)
        ? children.map((c) => (typeof c === 'string' ? c : '')).join('')
        : '';
  const kind = detectCalloutKind(text);
  const styles = calloutStyles(kind);
  const Icon = styles.icon;
  const isCallout = kind !== 'default';

  if (!isCallout) {
    return (
      <blockquote className="my-4 border-l-4 border-primary/30 pl-4 italic text-muted-foreground">
        {children}
      </blockquote>
    );
  }

  return (
    <div
      className={cn(
        'my-6 flex gap-3 rounded-lg border p-4 shadow-sm',
        styles.className
      )}
    >
      <Icon className={cn('mt-0.5 size-5 shrink-0', styles.iconClass)} aria-hidden />
      <div className="min-w-0 flex-1 text-sm leading-relaxed [&>p]:mt-2 [&>p:first-child]:mt-0">
        {children}
      </div>
    </div>
  );
}

export function TrainingMarkdownRenderer({ content }: { content: string }) {
  return (
    <article className="training-prose max-w-none text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        components={{
          h1: ({ children, id }) => (
            <h1
              id={id}
              className="scroll-mt-24 font-heading text-3xl font-semibold tracking-tight"
            >
              {children}
            </h1>
          ),
          h2: ({ children, id }) => (
            <h2
              id={id}
              className="scroll-mt-24 mt-10 border-b pb-2 font-heading text-2xl font-semibold tracking-tight first:mt-0"
            >
              {children}
            </h2>
          ),
          h3: ({ children, id }) => (
            <h3 id={id} className="scroll-mt-24 mt-8 text-lg font-semibold">
              {children}
            </h3>
          ),
          h4: ({ children, id }) => (
            <h4 id={id} className="scroll-mt-24 mt-6 text-base font-semibold">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="my-4 text-base leading-7 text-muted-foreground">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="my-4 list-disc space-y-2 pl-6 text-muted-foreground">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-4 list-decimal space-y-2 pl-6 text-muted-foreground">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-7">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          blockquote: ({ children }) => {
            const raw =
              typeof children === 'string'
                ? children
                : '';
            const kind = detectCalloutKind(raw);
            if (kind !== 'default') {
              const stripped = stripCalloutLabel(raw);
              return (
                <CalloutBlockquote>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{stripped}</ReactMarkdown>
                </CalloutBlockquote>
              );
            }
            return <CalloutBlockquote>{children}</CalloutBlockquote>;
          },
          table: ({ children }) => (
            <div className="my-6 overflow-x-auto rounded-lg border shadow-sm">
              <table className="w-full min-w-[480px] border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/60 text-left text-foreground">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border-b px-4 py-3 font-semibold">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border-b px-4 py-3 text-muted-foreground">{children}</td>
          ),
          tr: ({ children }) => <tr className="even:bg-muted/20">{children}</tr>,
          hr: () => <hr className="my-10 border-border" />,
          a: ({ href, children }) => (
            <a
              href={href}
              className="font-medium text-primary underline-offset-4 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          code: ({ className, children }) => {
            const isBlock = Boolean(className);
            if (isBlock) {
              return (
                <code className="block overflow-x-auto rounded-md bg-muted p-4 text-sm">
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-muted px-1.5 py-0.5 text-sm text-foreground">
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
