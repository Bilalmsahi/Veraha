import crypto from 'crypto';
import sanitizeHtml from 'sanitize-html';

const POLICY_ALLOWED_TAGS = [
  'a',
  'blockquote',
  'br',
  'code',
  'col',
  'colgroup',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'span',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
];

const POLICY_ALLOWED_ATTRIBUTES = {
  a: ['href', 'name', 'target', 'rel', 'title'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  table: ['border', 'cellpadding', 'cellspacing', 'style'],
  td: ['colspan', 'rowspan', 'style'],
  th: ['colspan', 'rowspan', 'scope', 'style'],
  tr: ['style'],
  p: ['style'],
  div: ['style'],
  span: ['class', 'style'],
  h1: ['style'],
  h2: ['style'],
  h3: ['style'],
  h4: ['style'],
  h5: ['style'],
  h6: ['style'],
  col: ['span', 'style'],
  colgroup: ['span', 'style'],
};

const POLICY_ALLOWED_STYLES = {
  '*': {
    'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
    'vertical-align': [/^top$/, /^middle$/, /^bottom$/],
    width: [/^\d+(\.\d+)?%$/, /^\d+(\.\d+)?px$/],
    height: [/^\d+(\.\d+)?px$/],
    'border-collapse': [/^collapse$/, /^separate$/],
  },
};

export function sanitizePolicyHtml(html = '') {
  if (typeof html !== 'string') return '';

  return sanitizeHtml(html, {
    allowedTags: POLICY_ALLOWED_TAGS,
    allowedAttributes: POLICY_ALLOWED_ATTRIBUTES,
    allowedStyles: POLICY_ALLOWED_STYLES,
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesAppliedToAttributes: ['href', 'src'],
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', {
        target: '_blank',
        rel: 'noopener noreferrer',
      }),
    },
  });
}

export function hashPolicyHtml(html = '') {
  return crypto.createHash('sha256').update(String(html)).digest('hex');
}
