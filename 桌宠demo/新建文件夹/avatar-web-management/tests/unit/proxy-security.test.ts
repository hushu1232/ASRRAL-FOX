import { NextRequest } from 'next/server';

const checkRateLimit = jest.fn().mockResolvedValue({ allowed: true, remaining: 99, reset: 0, limit: 100 });

jest.mock('@/i18n/routing', () => ({
  routing: { locales: ['zh-CN', 'en'], defaultLocale: 'zh-CN' },
}));
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit,
  RATE_LIMITS: {
    api: { limit: 100, windowMs: 60_000 },
    login: { limit: 5, windowMs: 60_000 },
    register: { limit: 3, windowMs: 60_000 },
    forgotPassword: { limit: 3, windowMs: 60_000 },
    upload: { limit: 20, windowMs: 600_000 },
    export: { limit: 3, windowMs: 300_000 },
  },
}));
jest.mock('@/lib/csrf', () => ({
  requiresCsrfCheck: (method: string) => !['GET', 'HEAD', 'OPTIONS'].includes(method),
  validateCsrfToken: () => false,
  validateOrigin: () => false,
}));
jest.mock('@/lib/cors', () => ({ handleCors: () => null, setCorsHeaders: jest.fn() }));
jest.mock('@/lib/metrics', () => ({
  httpRequestsInFlight: { inc: jest.fn(), dec: jest.fn() },
  observeHttpRequest: jest.fn(),
  rateLimitHits: { inc: jest.fn() },
}));

import { proxy } from '@/proxy';

describe('proxy trust boundary', () => {
  beforeEach(() => {
    checkRateLimit.mockClear();
    delete process.env.TRUST_PROXY_HEADERS;
    delete process.env.TRUST_PROXY_SECRET;
    (process.env as unknown as Record<string, string>).NODE_ENV = 'test';
  });

  it('does not trust spoofed localhost headers or skip CSRF', async () => {
    const req = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      headers: {
        'x-forwarded-for': '127.0.0.1',
        'x-real-ip': '127.0.0.1',
        origin: 'https://attacker.example',
      },
    });

    const res = await proxy(req);
    const body = await res.json();

    expect(checkRateLimit).toHaveBeenCalledWith('rl:_api_test:local-dev', 100, 60_000);
    expect(checkRateLimit.mock.calls[0][0]).not.toContain('127.0.0.1');
    expect(res.status).toBe(403);
    expect(body.error).toBe('Invalid CSRF token');
  });

  it('fails closed in production when no trusted client address is available', async () => {
    (process.env as unknown as Record<string, string>).NODE_ENV = 'production';
    const req = new NextRequest('http://localhost/api/auth/login', { method: 'POST' });

    const res = await proxy(req);
    const body = await res.json();

    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(res.status).toBe(503);
    expect(body.error).toContain('Rate limiting');
  });

  it('uses a trusted proxy IP as the rate limit identity', async () => {
    process.env.TRUST_PROXY_HEADERS = 'true';
    process.env.TRUST_PROXY_SECRET = 'proxy-test-secret';
    const req = new NextRequest('http://localhost/api/test', {
      headers: {
        'x-forwarded-for': '203.0.113.10',
        'x-foxd-proxy-token': 'proxy-test-secret',
      },
    });

    await proxy(req);

    expect(checkRateLimit).toHaveBeenCalledWith('rl:_api_test:203.0.113.10', 100, 60_000);
  });

  it('does not trust forwarded IP headers without proxy authentication', async () => {
    process.env.TRUST_PROXY_HEADERS = 'true';
    (process.env as unknown as Record<string, string>).NODE_ENV = 'production';
    const req = new NextRequest('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '203.0.113.10' },
    });

    const res = await proxy(req);

    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(res.status).toBe(503);
  });

  it('fails closed when a proxy appends an untrusted forwarded chain', async () => {
    process.env.TRUST_PROXY_HEADERS = 'true';
    process.env.TRUST_PROXY_SECRET = 'proxy-test-secret';
    (process.env as unknown as Record<string, string>).NODE_ENV = 'production';
    const req = new NextRequest('http://localhost/api/test', {
      headers: {
        'x-forwarded-for': '198.51.100.20, 203.0.113.20',
        'x-foxd-proxy-token': 'proxy-test-secret',
      },
    });

    const res = await proxy(req);

    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(res.status).toBe(503);
  });

  it('rejects production bodies without Content-Length before buffering', async () => {
    process.env.TRUST_PROXY_HEADERS = 'true';
    process.env.TRUST_PROXY_SECRET = 'proxy-test-secret';
    (process.env as unknown as Record<string, string>).NODE_ENV = 'production';
    const req = new NextRequest('http://localhost/api/assets/upload', {
      method: 'POST',
      headers: {
        'content-type': 'multipart/form-data; boundary=test',
        'x-forwarded-for': '203.0.113.21',
        'x-foxd-proxy-token': 'proxy-test-secret',
      },
    });

    const res = await proxy(req);
    const body = await res.json();

    expect(res.status).toBe(411);
    expect(body.error).toContain('Content-Length');
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it('rejects ambiguous Content-Length and Transfer-Encoding combinations', async () => {
    process.env.TRUST_PROXY_HEADERS = 'true';
    process.env.TRUST_PROXY_SECRET = 'proxy-test-secret';
    (process.env as unknown as Record<string, string>).NODE_ENV = 'production';
    const req = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      headers: {
        'content-length': '12',
        'transfer-encoding': 'chunked',
        'x-forwarded-for': '203.0.113.22',
        'x-foxd-proxy-token': 'proxy-test-secret',
      },
    });

    const res = await proxy(req);

    expect(res.status).toBe(400);
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it('does not use an unverified JWT subject as the upload limit identity', async () => {
    process.env.TRUST_PROXY_HEADERS = 'true';
    process.env.TRUST_PROXY_SECRET = 'proxy-test-secret';
    const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'forged-user' })).toString('base64url');
    const req = new NextRequest('http://localhost/api/assets/upload', {
      headers: {
        authorization: `Bearer ${header}.${payload}.fake-sig`,
        'x-forwarded-for': '203.0.113.11',
        'x-foxd-proxy-token': 'proxy-test-secret',
      },
    });

    await proxy(req);

    expect(checkRateLimit).toHaveBeenCalledWith(
      'rl:_api_assets_upload:203.0.113.11',
      20,
      600_000,
    );
  });

  it('runs versioned API rewrites through rate limit and CSRF checks', async () => {
    process.env.TRUST_PROXY_HEADERS = 'true';
    process.env.TRUST_PROXY_SECRET = 'proxy-test-secret';
    const req = new NextRequest('http://localhost/api/v1/test', {
      method: 'POST',
      headers: {
        origin: 'https://attacker.example',
        'x-forwarded-for': '203.0.113.12',
        'x-foxd-proxy-token': 'proxy-test-secret',
      },
    });

    const res = await proxy(req);
    const body = await res.json();

    expect(checkRateLimit).toHaveBeenCalledWith('rl:_api_test:203.0.113.12', 100, 60_000);
    expect(res.status).toBe(403);
    expect(body.error).toBe('Invalid CSRF token');
  });
});
