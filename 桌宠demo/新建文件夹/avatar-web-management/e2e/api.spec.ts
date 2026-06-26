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

test.describe('API E2E', () => {
  test('GET /api/health returns ok', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('status');
  });

  test('POST /api/auth/login with valid credentials', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: TEST_EMAIL, password: TEST_PASSWORD },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  test('POST /api/auth/login with bad password returns error', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: TEST_EMAIL, password: 'wrong' },
      headers: { 'Content-Type': 'application/json' },
    });
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('GET /api/parts returns 401 without auth', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/parts`);
    expect(res.status()).toBe(401);
  });

  test('GET /api/parts returns parts with auth', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await request.get(`${BASE_URL}/api/parts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('GET /api/avatars returns 401 without auth', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/avatars`);
    expect(res.status()).toBe(401);
  });

  test('GET /api/avatars returns avatars with auth', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await request.get(`${BASE_URL}/api/avatars`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('GET /api/templates returns templates', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await request.get(`${BASE_URL}/api/templates`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('GET /api/assets requires auth', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/assets`);
    expect(res.status()).toBe(401);
  });

  test('GET /api/settings/profile requires auth', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/settings/profile`);
    expect(res.status()).toBe(401);
  });
});
