export type MarkdownHeading = {
  id: string;
  text: string;
  level: number;
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function extractMarkdownHeadings(markdown: string): MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  const lines = markdown.split('\n');
  for (const line of lines) {
    const match = /^(#{1,3})\s+(.+)$/.exec(line.trim());
    if (!match) continue;
    const level = match[1].length;
    const text = match[2].replace(/\*\*/g, '').trim();
    headings.push({ id: slugify(text), text, level });
  }
  return headings;
}

export type CalloutKind =
  | 'warning'
  | 'scenario'
  | 'tip'
  | 'practice'
  | 'think'
  | 'default';

const CALLOUT_PATTERNS: Array<{ kind: CalloutKind; pattern: RegExp }> = [
  { kind: 'warning', pattern: /^\*\*warning:\*\*/i },
  { kind: 'scenario', pattern: /^\*\*scenario:\*\*/i },
  { kind: 'tip', pattern: /^\*\*quick tip:\*\*/i },
  { kind: 'practice', pattern: /^\*\*best practice:\*\*/i },
  { kind: 'think', pattern: /^\*\*think about it:\*\*/i },
];

export function detectCalloutKind(children: string): CalloutKind {
  const firstLine = children.split('\n')[0]?.trim() || '';
  for (const { kind, pattern } of CALLOUT_PATTERNS) {
    if (pattern.test(firstLine)) return kind;
  }
  return 'default';
}

export function stripCalloutLabel(children: string): string {
  return children.replace(
    /^\*\*(Warning|Scenario|Quick Tip|Best Practice|Think About It):\*\*\s*/i,
    ''
  );
}
