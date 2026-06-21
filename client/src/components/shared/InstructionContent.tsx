import React from 'react';

type InstructionContentProps = {
  content: string;
  className?: string;
};

const MARKDOWN_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const URL_RE = /(https?:\/\/[^\s<>"')]+)/g;
const BULLET_RE = /^(?:[-*•]\s+|\d+\.\s+|[ivxlcdm]+\.\s+)/i;

function normalizeInstructionText(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\s+(?=(?:[ivxlcdm]+)\.\s)/gi, '\n')
    .replace(/\s+(?=(?:\d+\.)\s)/g, '\n')
    .trim();
}

function renderInlineLinks(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  let markdownMatch: RegExpExecArray | null;

  while ((markdownMatch = MARKDOWN_LINK_RE.exec(text)) !== null) {
    const [full, label, href] = markdownMatch;
    const start = markdownMatch.index;
    const before = text.slice(cursor, start);
    if (before) {
      nodes.push(...renderPlainUrls(before, key));
      key += 1;
    }
    nodes.push(
      <a
        key={`md-${key}`}
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="text-primary underline underline-offset-2 hover:opacity-90"
      >
        {label}
      </a>
    );
    key += 1;
    cursor = start + full.length;
  }

  const tail = text.slice(cursor);
  if (tail) nodes.push(...renderPlainUrls(tail, key));
  return nodes;
}

function renderPlainUrls(text: string, baseKey: number): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let key = baseKey;

  while ((match = URL_RE.exec(text)) !== null) {
    const href = match[1];
    const start = match.index;
    const before = text.slice(cursor, start);
    if (before) nodes.push(<React.Fragment key={`txt-${key++}`}>{before}</React.Fragment>);
    nodes.push(
      <a
        key={`url-${key++}`}
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="text-primary underline underline-offset-2 hover:opacity-90 break-all"
      >
        {href}
      </a>
    );
    cursor = start + href.length;
  }

  const tail = text.slice(cursor);
  if (tail) nodes.push(<React.Fragment key={`txt-${key++}`}>{tail}</React.Fragment>);
  return nodes;
}

export function InstructionContent({ content, className }: InstructionContentProps) {
  const normalized = normalizeInstructionText(content);
  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const bulletLike = lines.length >= 2 && lines.every((line) => BULLET_RE.test(line));

  if (bulletLike) {
    return (
      <ul className={className ?? 'list-disc list-inside space-y-1 text-sm text-muted-foreground'}>
        {lines.map((line, index) => {
          const cleaned = line.replace(BULLET_RE, '').trim();
          return <li key={index}>{renderInlineLinks(cleaned)}</li>;
        })}
      </ul>
    );
  }

  return (
    <div className={className ?? 'space-y-2 text-sm leading-relaxed text-muted-foreground'}>
      {lines.map((line, index) => (
        <p key={index} className="whitespace-pre-wrap break-words">
          {renderInlineLinks(line)}
        </p>
      ))}
    </div>
  );
}

