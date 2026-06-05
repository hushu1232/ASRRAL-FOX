import { NextRequest } from 'next/server';

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

import {
  generateCsrfToken,
  getCsrfTokenFromRequest,
  getCsrfTokenFromCookie,
  validateCsrfToken,
  requiresCsrfCheck,
  csrfCookieString,
  validateOrigin,
  CSRF_COOKIE,
  CSRF_HEADER,
} from '@/lib/csrf';

function createMockRequest(overrides: {
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  method?: string;
} = {}): NextRequest {
  const headers = new Map<string, string>();
  if (overrides.headers) {
    Object.entries(overrides.headers).forEach(([k, v]) => headers.set(k.toLowerCase(), v));
  }

  const cookies = new Map<string, string>();
  if (overrides.cookies) {
    Object.entries(overrides.cookies).forEach(([k, v]) => cookies.set(k, v));
  }

  return {
    headers: {
      get: (key: string) => headers.get(key.toLowerCase()) || null,
    },
    cookies: {
      get: (key: string) => {
        const val = cookies.get(key);
        return val ? { value: val } : undefined;
      },
    },
    method: overrides.method || 'GET',
  } as unknown as NextRequest;
}

describe('csrf extended', () => {
  describe('generateCsrfToken', () => {
    it('generates a UUID', () => {
      const token = generateCsrfToken();
      expect(token).toBeDefined();
      expect(token).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('generates unique tokens', () => {
      const tokens = new Set(Array.from({ length: 10 }, () => generateCsrfToken()));
      expect(tokens.size).toBe(10);
    });
  });

  describe('getCsrfTokenFromRequest', () => {
    it('returns header token when present', () => {
      const req = createMockRequest({ headers: { 'x-csrf-token': 'header-token' } });
      expect(getCsrfTokenFromRequest(req)).toBe('header-token');
    });

    it('falls back to cookie when header is absent', () => {
      const req = createMockRequest({ cookies: { 'XSRF-TOKEN': 'cookie-token' } });
      expect(getCsrfTokenFromRequest(req)).toBe('cookie-token');
    });

    it('returns null when neither header nor cookie present', () => {
      const req = createMockRequest();
      expect(getCsrfTokenFromRequest(req)).toBeNull();
    });
  });

  describe('getCsrfTokenFromCookie', () => {
    it('returns cookie value when present', () => {
      const req = createMockRequest({ cookies: { 'XSRF-TOKEN': 'cookie-val' } });
      expect(getCsrfTokenFromCookie(req)).toBe('cookie-val');
    });

    it('returns null when cookie absent', () => {
      const req = createMockRequest();
      expect(getCsrfTokenFromCookie(req)).toBeNull();
    });
  });

  describe('validateCsrfToken', () => {
    it('returns true when header and cookie match', () => {
      const req = createMockRequest({
        headers: { 'x-csrf-token': 'my-token' },
        cookies: { 'XSRF-TOKEN': 'my-token' },
      });
      expect(validateCsrfToken(req)).toBe(true);
    });

    it('returns false when header and cookie mismatch', () => {
      const req = createMockRequest({
        headers: { 'x-csrf-token': 'token-a' },
        cookies: { 'XSRF-TOKEN': 'token-b' },
      });
      expect(validateCsrfToken(req)).toBe(false);
    });

    it('returns false when header is missing', () => {
      const req = createMockRequest({ cookies: { 'XSRF-TOKEN': 'cookie-only' } });
      expect(validateCsrfToken(req)).toBe(false);
    });

    it('returns false when cookie is missing', () => {
      const req = createMockRequest({ headers: { 'x-csrf-token': 'header-only' } });
      expect(validateCsrfToken(req)).toBe(false);
    });
  });

  describe('requiresCsrfCheck', () => {
    it('returns false for GET', () => {
      expect(requiresCsrfCheck('GET')).toBe(false);
    });

    it('returns false for HEAD', () => {
      expect(requiresCsrfCheck('HEAD')).toBe(false);
    });

    it('returns false for OPTIONS', () => {
      expect(requiresCsrfCheck('OPTIONS')).toBe(false);
    });

    it('returns true for POST', () => {
      expect(requiresCsrfCheck('POST')).toBe(true);
    });

    it('returns true for PUT', () => {
      expect(requiresCsrfCheck('PUT')).toBe(true);
    });

    it('returns true for DELETE', () => {
      expect(requiresCsrfCheck('DELETE')).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(requiresCsrfCheck('post')).toBe(true);
      expect(requiresCsrfCheck('get')).toBe(false);
    });
  });

  describe('csrfCookieString', () => {
    it('generates Set-Cookie string with token', () => {
      const cookie = csrfCookieString('test-token');
      expect(cookie).toContain('XSRF-TOKEN=test-token');
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Max-Age=86400');
    });
  });

  describe('validateOrigin', () => {
    it('returns true when origin matches host', () => {
      const req = createMockRequest({
        headers: { origin: 'https://example.com', host: 'example.com' },
      });
      expect(validateOrigin(req)).toBe(true);
    });

    it('returns true when no origin or referer present', () => {
      const req = createMockRequest();
      expect(validateOrigin(req)).toBe(true);
    });

    it('returns true for localhost', () => {
      const req = createMockRequest({
        headers: { origin: 'http://localhost:3000', host: 'localhost:3000' },
      });
      expect(validateOrigin(req)).toBe(true);
    });

    it('falls back to referer when origin missing', () => {
      const req = createMockRequest({
        headers: { referer: 'https://example.com/page', host: 'example.com' },
      });
      expect(validateOrigin(req)).toBe(true);
    });

    it('returns true when referer URL is unparseable', () => {
      const req = createMockRequest({
        headers: { referer: 'not-a-valid-url', host: 'example.com' },
      });
      // Falls through to extractOriginFromReferer catch → null → true (pass-through)
      expect(validateOrigin(req)).toBe(true);
    });

    it('returns false for invalid URL in origin', () => {
      const req = createMockRequest({
        headers: { origin: 'not-a-valid-url', host: 'example.com' },
      });
      expect(validateOrigin(req)).toBe(false);
    });
  });
});
