import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

export function renderMarkdown(text: string): string {
  if (!text) return '';
  const html = marked.parse(text) as string;
  return sanitizeHtml(html, {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li',
      'strong', 'em', 'code', 'pre', 'blockquote', 'a', 'br', 'hr',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'del', 'ins',
    ],
    allowedAttributes: { a: ['href', 'target', 'rel'], '*': ['class'] },
    transformTags: {
      a: (_tagName: string, attribs: Record<string, string>) => ({
        tagName: 'a',
        attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' },
      }),
    },
  });
}
