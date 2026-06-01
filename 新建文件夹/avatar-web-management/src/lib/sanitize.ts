import DOMPurify from 'dompurify';

// Allow only safe tags and attributes for user-generated content
const ALLOWED_TAGS = ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre'];
const ALLOWED_ATTR = ['href', 'target', 'rel'];

/**
 * Sanitize HTML string from user input. Strips all XSS vectors.
 * Use for: comments, messages, profile bios, marketplace descriptions.
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target'],
  });
}

/**
 * Sanitize plain text string. Strips ALL HTML tags.
 * Use for: search queries, usernames, filenames, any non-rich-text input.
 */
export function sanitizeText(dirty: string): string {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

/**
 * Strips HTML tags entirely, returning plain text only.
 * Use for: extracting plain text from user rich text for indexing/truncation.
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  if (typeof window === 'undefined') {
    // SSR fallback: basic regex strip
    return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}
