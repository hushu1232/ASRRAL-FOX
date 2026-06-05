// 认证流程集成测试 — 登录→刷新令牌→保护路由
import { post, get, request, loginAndGetCookies } from './helpers';

describe('Token refresh flow', () => {
  it('login sets refreshToken cookie', async () => {
    const { token, refreshToken } = await loginAndGetCookies('demo@example.com', 'demo1234');

    expect(token).toBeDefined();
    expect(token!.split('.')).toHaveLength(3);
    expect(refreshToken).toBeDefined();
    expect(refreshToken!.length).toBeGreaterThan(20);
  });

  it('POST /api/auth/refresh — returns new access token with valid refresh cookie', async () => {
    const { refreshToken } = await loginAndGetCookies('demo@example.com', 'demo1234');
    expect(refreshToken).toBeDefined();

    const res = await request('POST', '/api/auth/refresh', {
      cookies: { refreshToken: refreshToken! },
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data as Record<string, unknown>;
    expect(typeof data.accessToken).toBe('string');
    expect(data.accessToken.split('.')).toHaveLength(3);
    expect(data.user).toBeDefined();
  });

  it('POST /api/auth/refresh — rejects without cookie', async () => {
    const res = await post('/api/auth/refresh');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/auth/refresh — rejects with malformed cookie', async () => {
    const res = await request('POST', '/api/auth/refresh', {
      cookies: { refreshToken: 'not.a.valid.token' },
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('Auth session lifecycle', () => {
  it('login → use token → refresh → use new token', async () => {
    // 1. Login
    const { token, refreshToken } = await loginAndGetCookies('demo@example.com', 'demo1234');
    expect(token).toBeDefined();
    expect(refreshToken).toBeDefined();

    // 2. Access protected route with original token
    const listRes = await get('/api/avatars', token);
    expect(listRes.status).toBe(200);

    // 3. Refresh
    const refreshRes = await request('POST', '/api/auth/refresh', {
      cookies: { refreshToken: refreshToken! },
    });
    expect(refreshRes.status).toBe(200);
    const newToken = (refreshRes.body.data as Record<string, unknown>).accessToken as string;
    expect(newToken).toBeDefined();
    // Note: JWT iat is second-precision; immediate refresh may produce identical token

    // 4. Access protected route with new token
    const listRes2 = await get('/api/avatars', newToken);
    expect(listRes2.status).toBe(200);
  });

  it('refresh rotates the refresh token', async () => {
    const { refreshToken: oldRt } = await loginAndGetCookies('demo@example.com', 'demo1234');
    expect(oldRt).toBeDefined();

    // Refresh — response should set a new refreshToken cookie
    const refreshRes = await request('POST', '/api/auth/refresh', {
      cookies: { refreshToken: oldRt! },
    });
    expect(refreshRes.status).toBe(200);

    // The new Set-Cookie should contain a new refreshToken
    const setCookie = refreshRes.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const match = setCookie.match(/refreshToken=([^;]+)/);
    const newRt = match ? match[1] : undefined;
    expect(newRt).toBeDefined();
    expect(newRt).not.toBe(oldRt);

    // Old token should no longer work (or might — depends on revocation implementation)
    // At minimum, verify new token works
    const res2 = await request('POST', '/api/auth/refresh', {
      cookies: { refreshToken: newRt! },
    });
    expect(res2.status).toBe(200);
  });
});

describe('Auth edge cases', () => {
  it('repeated logins both produce valid tokens', async () => {
    const r1 = await loginAndGetCookies('demo@example.com', 'demo1234');
    const r2 = await loginAndGetCookies('demo@example.com', 'demo1234');

    expect(r1.token).toBeDefined();
    expect(r2.token).toBeDefined();
    // Both tokens should work (JWT iat is second-precision, may be identical)
    const res1 = await get('/api/avatars', r1.token);
    const res2 = await get('/api/avatars', r2.token);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    // Refresh tokens should both be valid
    expect(r1.refreshToken).toBeDefined();
    expect(r2.refreshToken).toBeDefined();
  });

  it('login with wrong-case email returns 401', async () => {
    const res = await post('/api/auth/login', {
      email: 'Demo@Example.COM',
      password: 'demo1234',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
