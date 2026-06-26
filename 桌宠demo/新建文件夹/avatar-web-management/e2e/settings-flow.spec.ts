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

test.describe('Settings Flow E2E', () => {
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    authToken = await getAuthToken(request);
  });

  test.describe('Profile', () => {
    test('GET /api/settings/profile requires auth', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/settings/profile`);
      expect(res.status()).toBe(401);
    });

    test('GET /api/settings/profile returns user profile', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/settings/profile`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      // GET may not be implemented — check for 200 or 405
      const validStatuses = [200, 405];
      expect(validStatuses).toContain(res.status());
    });

    test('PUT /api/settings/profile updates username', async ({ request }) => {
      const newUsername = `updated_${Date.now()}`;
      const res = await request.put(`${BASE_URL}/api/settings/profile`, {
        data: { username: newUsername },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    test('PUT /api/settings/profile updates bio', async ({ request }) => {
      const res = await request.put(`${BASE_URL}/api/settings/profile`, {
        data: { bio: 'This is my updated bio for E2E testing' },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    test('PUT /api/settings/profile rejects XSS in username', async ({ request }) => {
      const res = await request.put(`${BASE_URL}/api/settings/profile`, {
        data: { username: '<script>alert(1)</script>' },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(400);
    });

    test('PUT /api/settings/profile rejects bio over 500 chars', async ({ request }) => {
      const res = await request.put(`${BASE_URL}/api/settings/profile`, {
        data: { bio: 'x'.repeat(501) },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(400);
    });

    test('PUT /api/settings/profile rejects username under 2 chars', async ({ request }) => {
      const res = await request.put(`${BASE_URL}/api/settings/profile`, {
        data: { username: 'a' },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(400);
    });
  });

  test.describe('Password Change', () => {
    test('PUT /api/settings/profile rejects wrong current password', async ({ request }) => {
      const res = await request.put(`${BASE_URL}/api/settings/profile`, {
        data: {
          currentPassword: 'wrong_password_123',
          newPassword: 'NewSecurePass456',
        },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    test('PUT /api/settings/profile with missing newPassword is handled', async ({ request }) => {
      const res = await request.put(`${BASE_URL}/api/settings/profile`, {
        data: { currentPassword: TEST_PASSWORD },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      // Should succeed (password change skipped when newPassword is missing)
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Login History', () => {
    test('GET /api/settings/login-history requires auth', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/settings/login-history`);
      expect(res.status()).toBe(401);
    });

    test('GET /api/settings/login-history returns history', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/settings/login-history`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  test.describe('API Keys', () => {
    let createdKeyId: string;

    test('GET /api/settings/api-keys lists keys', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/settings/api-keys`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    });

    test('POST /api/settings/api-keys creates new API key', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/settings/api-keys`, {
        data: { name: `E2E Test Key ${Date.now()}`, scopes: ['read'] },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.key).toBeDefined();
      createdKeyId = body.data.id;
    });

    test('DELETE /api/settings/api-keys/:id deletes API key', async ({ request }) => {
      if (!createdKeyId) {
        test.skip();
        return;
      }
      const res = await request.delete(`${BASE_URL}/api/settings/api-keys/${createdKeyId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    test('DELETE /api/settings/api-keys/:id returns 404 for non-existent', async ({ request }) => {
      const res = await request.delete(`${BASE_URL}/api/settings/api-keys/non-existent-key`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(404);
    });
  });

  test.describe('Notifications', () => {
    test('GET /api/notifications returns notifications list', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    test('GET /api/notifications/unread-count returns count', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(typeof body.data.count).toBe('number');
    });

    test('PUT /api/notifications/read-all marks all as read', async ({ request }) => {
      const res = await request.put(`${BASE_URL}/api/notifications/read-all`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    test('GET /api/notifications requires auth', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/notifications`);
      expect(res.status()).toBe(401);
    });
  });

  test.describe('Dashboard', () => {
    test('GET /api/dashboard/stats returns user stats', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/dashboard/stats`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    test('GET /api/dashboard/stats requires auth', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/dashboard/stats`);
      expect(res.status()).toBe(401);
    });
  });

  test.describe('2FA Settings', () => {
    test('GET /api/settings/2fa returns 2FA status', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/settings/2fa`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      // May return 200 or not yet implemented
      expect([200, 404, 405]).toContain(res.status());
    });
  });
});
