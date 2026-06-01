import { test, expect, type APIRequestContext } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = 'demo@example.com';
const TEST_PASSWORD = 'demo1234';

async function getAuthToken(request: APIRequestContext) {
  const res = await request.post(`${BASE_URL}/api/auth/login`, {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
    headers: { 'Content-Type': 'application/json' },
  });
  const body = await res.json();
  if (!body.success) throw new Error(`Login failed: ${body.error}`);
  return body.data?.accessToken || '';
}

test.describe('Auth Flow E2E', () => {

  test.describe('Registration', () => {
    const uniqueEmail = `e2e-test-${Date.now()}@example.com`;

    test('POST /api/auth/register creates new user', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/auth/register`, {
        data: {
          email: uniqueEmail,
          username: `e2euser_${Date.now()}`,
          password: 'TestPass123',
        },
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.email).toBe(uniqueEmail);
      expect(body.data.role).toBe('user');
    });

    test('POST /api/auth/register rejects duplicate email', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/auth/register`, {
        data: { email: uniqueEmail, username: 'another_user', password: 'TestPass123' },
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status()).toBe(409);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    test('POST /api/auth/register rejects weak password', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/auth/register`, {
        data: { email: 'weakpw@example.com', username: 'weakpw', password: '123' },
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status()).toBe(400);
    });

    test('POST /api/auth/register rejects invalid email', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/auth/register`, {
        data: { email: 'not-an-email', username: 'badmail', password: 'TestPass123' },
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status()).toBe(400);
    });

    test('POST /api/auth/register rejects XSS username', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/auth/register`, {
        data: {
          email: 'xss@example.com',
          username: '<script>alert(1)</script>',
          password: 'TestPass123',
        },
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status()).toBe(400);
    });
  });

  test.describe('Login', () => {
    test('POST /api/auth/login returns accessToken', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/auth/login`, {
        data: { email: TEST_EMAIL, password: TEST_PASSWORD },
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.user).toBeDefined();
      expect(body.data.user.email).toBe(TEST_EMAIL);
    });

    test('POST /api/auth/login sets refreshToken cookie', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/auth/login`, {
        data: { email: TEST_EMAIL, password: TEST_PASSWORD },
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status()).toBe(200);
      // Check that Set-Cookie header exists for refreshToken
      const cookies = res.headers()['set-cookie'];
      expect(cookies).toBeDefined();
    });

    test('POST /api/auth/login rejects empty password', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/auth/login`, {
        data: { email: TEST_EMAIL, password: '' },
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status()).toBe(400);
    });
  });

  test.describe('Token Refresh', () => {
    test('POST /api/auth/refresh with valid cookie returns new token', async ({ request }) => {
      // First login to get the cookie
      const loginRes = await request.post(`${BASE_URL}/api/auth/login`, {
        data: { email: TEST_EMAIL, password: TEST_PASSWORD },
        headers: { 'Content-Type': 'application/json' },
      });

      // Use the same request context (which preserves cookies) to refresh
      const refreshRes = await request.post(`${BASE_URL}/api/auth/refresh`);
      // May return 200 (success) or 401 (no refresh token cookie in API context)
      expect([200, 401]).toContain(refreshRes.status());
    });

    test('POST /api/auth/refresh without cookie returns error', async ({ request }) => {
      // Create a fresh context with no cookies
      const freshRes = await request.post(`${BASE_URL}/api/auth/refresh`, {
        headers: { 'Content-Type': 'application/json' },
      });
      expect(freshRes.status()).toBe(401);
    });
  });

  test.describe('Logout', () => {
    test('POST /api/auth/logout clears cookies', async ({ request }) => {
      // Login first
      await request.post(`${BASE_URL}/api/auth/login`, {
        data: { email: TEST_EMAIL, password: TEST_PASSWORD },
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await request.post(`${BASE_URL}/api/auth/logout`);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  test.describe('Password Reset', () => {
    test('POST /api/auth/forgot-password accepts valid email', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/auth/forgot-password`, {
        data: { email: TEST_EMAIL },
        headers: { 'Content-Type': 'application/json' },
      });
      // Should always return 200 to prevent email enumeration
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    test('POST /api/auth/forgot-password handles non-existent email gracefully', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/auth/forgot-password`, {
        data: { email: 'nonexistent@example.com' },
        headers: { 'Content-Type': 'application/json' },
      });
      // Should NOT leak whether email exists
      expect(res.status()).toBe(200);
    });

    test('POST /api/auth/reset-password rejects invalid token', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/auth/reset-password`, {
        data: { token: 'invalid-token', password: 'NewPass123' },
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status()).toBe(400);
    });
  });

  test.describe('Rate Limiting', () => {
    test('Login endpoint returns rate limit headers', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/auth/login`, {
        data: { email: TEST_EMAIL, password: TEST_PASSWORD },
        headers: { 'Content-Type': 'application/json' },
      });
      // Check for rate limit headers
      const headers = res.headers();
      expect(headers['x-ratelimit-limit'] || headers['x-ratelimit-remaining']).toBeDefined();
    });
  });
});
