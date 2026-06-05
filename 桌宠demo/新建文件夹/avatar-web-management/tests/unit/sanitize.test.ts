/**
 * @jest-environment jsdom
 */

import { sanitizeHtml, sanitizeText, stripHtml } from '@/lib/sanitize';

describe('sanitizeHtml', () => {
  it('allows safe tags', () => {
    expect(sanitizeHtml('<b>bold</b>')).toBe('<b>bold</b>');
    expect(sanitizeHtml('<a href="https://example.com">link</a>')).toContain('href="https://example.com"');
  });

  it('strips script tags', () => {
    expect(sanitizeHtml('<script>alert("xss")</script>')).not.toContain('<script>');
  });

  it('strips event handlers', () => {
    expect(sanitizeHtml('<img onerror="alert(1)">')).not.toContain('onerror');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeHtml('')).toBe('');
  });
});

describe('sanitizeText', () => {
  it('strips all HTML tags', () => {
    expect(sanitizeText('<b>hello</b>')).toBe('hello');
    // DOMPurify removes script tags AND their content (security measure)
    expect(sanitizeText('<script>alert("xss")</script>test')).toBe('test');
  });
});

describe('stripHtml', () => {
  it('extracts plain text', () => {
    const result = stripHtml('<p>Hello <b>World</b></p>');
    // In jsdom, DOMParser should work
    expect(result).toContain('Hello');
    expect(result).toContain('World');
  });
});
