import {
  generateCsrfToken,
  requiresCsrfCheck,
  validateOrigin,
} from '@/lib/csrf';

describe('generateCsrfToken', () => {
  it('generates a non-empty UUID string', () => {
    const token = generateCsrfToken();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(10);
  });

  it('generates unique tokens each call', () => {
    const t1 = generateCsrfToken();
    const t2 = generateCsrfToken();
    expect(t1).not.toBe(t2);
  });
});

describe('requiresCsrfCheck', () => {
  it('requires check for POST', () => {
    expect(requiresCsrfCheck('POST')).toBe(true);
  });

  it('requires check for PUT', () => {
    expect(requiresCsrfCheck('PUT')).toBe(true);
  });

  it('requires check for DELETE', () => {
    expect(requiresCsrfCheck('DELETE')).toBe(true);
  });

  it('requires check for PATCH', () => {
    expect(requiresCsrfCheck('PATCH')).toBe(true);
  });

  it('skips check for GET', () => {
    expect(requiresCsrfCheck('GET')).toBe(false);
  });

  it('skips check for HEAD', () => {
    expect(requiresCsrfCheck('HEAD')).toBe(false);
  });

  it('skips check for OPTIONS', () => {
    expect(requiresCsrfCheck('OPTIONS')).toBe(false);
  });

  it('is case-insensitive for lowercase', () => {
    expect(requiresCsrfCheck('get')).toBe(false);
    expect(requiresCsrfCheck('post')).toBe(true);
  });
});

describe('validateOrigin', () => {
  function mockReq(headers: Record<string, string>) {
    return {
      headers: new Map(Object.entries(headers)),
    } as unknown as Parameters<typeof validateOrigin>[0];
  }

  it('passes when origin matches host', () => {
    const req = mockReq({
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
    });
    expect(validateOrigin(req)).toBe(true);
  });

  it('passes when referer matches host', () => {
    const req = mockReq({
      referer: 'http://localhost:3000/dashboard',
      host: 'localhost:3000',
    });
    expect(validateOrigin(req)).toBe(true);
  });

  it('passes when no origin or referer', () => {
    const req = mockReq({ host: 'localhost:3000' });
    expect(validateOrigin(req)).toBe(true);
  });

  it('rejects mismatched origin', () => {
    const req = mockReq({
      origin: 'https://evil.com',
      host: 'localhost:3000',
    });
    expect(validateOrigin(req)).toBe(false);
  });

  it('passes localhost origin', () => {
    const reqOrigin = mockReq({
      origin: 'http://localhost:3000',
      host: 'example.com',
    });
    // localhost always passes
    expect(validateOrigin(reqOrigin)).toBe(true);
  });

  it('handles invalid origin gracefully', () => {
    const req = mockReq({
      origin: 'not-a-valid-url',
      host: 'localhost:3000',
    });
    expect(validateOrigin(req)).toBe(false);
  });
});
