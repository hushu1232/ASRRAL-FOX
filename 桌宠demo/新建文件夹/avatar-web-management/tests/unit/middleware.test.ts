jest.mock('@/lib/prisma');
jest.mock('better-sqlite3', () => {
  const stmt = { run: jest.fn(), get: jest.fn(), all: jest.fn(() => []) };
  return jest.fn(() => ({
    prepare: jest.fn(() => stmt),
    exec: jest.fn(),
    pragma: jest.fn(),
    close: jest.fn(),
  }));
});
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));
jest.mock('@/lib/request-context', () => ({
  runWithRequestContext: (_id: string, fn: () => unknown) => fn(),
  getRequestId: () => null,
}));

import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import type { AuthContext } from '@/lib/auth/middleware';

const TEST_SECRET = 'test-middleware-secret';

function createRequest(token?: string): NextRequest {
  const headers = new Map<string, string>();
  if (token) headers.set('authorization', `Bearer ${token}`);

  return {
    headers: {
      get: (key: string) => headers.get(key.toLowerCase()) || null,
    },
    cookies: {
      get: () => undefined,
    },
    method: 'GET',
    nextUrl: { pathname: '/api/test' },
  } as unknown as NextRequest;
}

function loadMiddleware() {
  jest.resetModules();
  // The JWT module needs JWT_SECRET at module load time
  if (process.env.JWT_SECRET !== TEST_SECRET) {
    process.env.JWT_SECRET = TEST_SECRET;
    delete process.env.JWT_PRIVATE_KEY;
    delete process.env.JWT_PUBLIC_KEY;
  }
  process.env.JWT_DISABLE_FILE_KEYS = '1';
  return require('@/lib/auth/middleware');
}

describe('withAuth middleware', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = TEST_SECRET;
    delete process.env.JWT_PRIVATE_KEY;
    delete process.env.JWT_PUBLIC_KEY;
    process.env.JWT_DISABLE_FILE_KEYS = '1';
  });

  it('returns 401 when no auth header present', async () => {
    const { withAuth } = loadMiddleware();
    const handler = jest.fn();
    const wrapped = withAuth(handler);
    const res = await wrapped(createRequest());
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.error).toContain('Missing');
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 401 for invalid token', async () => {
    const { withAuth } = loadMiddleware();
    const handler = jest.fn();
    const wrapped = withAuth(handler);
    const res = await wrapped(createRequest('invalid-token'));
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.error).toContain('Invalid');
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 401 when token has no ws claim', async () => {
    const { withAuth } = loadMiddleware();
    const handler = jest.fn();
    const token = jwt.sign({ sub: 'user-1', email: 'a@b.com', role: 'user' }, TEST_SECRET, { algorithm: 'HS256' });
    const wrapped = withAuth(handler);
    const res = await wrapped(createRequest(token));
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.error).toContain('workspace');
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 401 when ws claim is empty string', async () => {
    const { withAuth } = loadMiddleware();
    const handler = jest.fn();
    const token = jwt.sign({ sub: 'user-1', email: 'a@b.com', role: 'user', ws: '' }, TEST_SECRET, { algorithm: 'HS256' });
    const wrapped = withAuth(handler);
    const res = await wrapped(createRequest(token));
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.error).toContain('workspace');
    expect(handler).not.toHaveBeenCalled();
  });

  it('passes valid AuthContext to handler when token has ws claim', async () => {
    const { withAuth } = loadMiddleware();
    const handler = jest.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const token = jwt.sign(
      { sub: 'user-1', email: 'a@b.com', role: 'user', ws: 'ws-test-123' },
      TEST_SECRET,
      { algorithm: 'HS256' },
    );
    const wrapped = withAuth(handler);
    await wrapped(createRequest(token));
    expect(handler).toHaveBeenCalledTimes(1);
    const authCtx = handler.mock.calls[0][1] as AuthContext;
    expect(authCtx.sub).toBe('user-1');
    expect(authCtx.workspaceId).toBe('ws-test-123');
    expect(authCtx.role).toBe('user');
  });

  it('does not expose authenticated handler errors', async () => {
    const { withAuth } = loadMiddleware();
    const handler = jest.fn().mockRejectedValue(new Error('database password leaked'));
    const token = jwt.sign(
      { sub: 'user-1', email: 'a@b.com', role: 'user', ws: 'ws-test-123' },
      TEST_SECRET,
      { algorithm: 'HS256' },
    );

    const res = await withAuth(handler)(createRequest(token));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ success: false, error: 'Internal server error' });
  });

  it('denies tokens with an unknown role', async () => {
    const { requireRole } = loadMiddleware();
    const handler = jest.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const token = jwt.sign(
      { sub: 'user-1', email: 'a@b.com', role: 'unknown', ws: 'ws-test-123' },
      TEST_SECRET,
      { algorithm: 'HS256' },
    );

    const res = await requireRole('user')(handler)(createRequest(token));

    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
});
