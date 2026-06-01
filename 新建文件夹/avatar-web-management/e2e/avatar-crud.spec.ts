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

test.describe('Avatar CRUD E2E', () => {
  let createdAvatarId: string;
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    authToken = await getAuthToken(request);
  });

  test.describe('Create', () => {
    test('POST /api/avatars creates avatar with minimal fields', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/avatars`, {
        data: { name: 'CRUD Create Test', style: 'anime', base_model: 'female' },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.name).toBe('CRUD Create Test');
      createdAvatarId = body.data.id;
    });

    test('POST /api/avatars strips HTML from name', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/avatars`, {
        data: { name: '<b>HTML</b> Name', style: 'realistic', base_model: 'male' },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      // Name should be sanitized (no HTML tags)
      expect(body.data.name).not.toContain('<');
      expect(body.data.name).not.toContain('>');

      // Clean up
      await request.delete(`${BASE_URL}/api/avatars/${body.data.id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
    });

    test('POST /api/avatars defaults style to anime', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/avatars`, {
        data: { name: 'Default Style Test' },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.data.style).toBe('anime');
      expect(body.data.base_model).toBe('female');

      // Clean up
      await request.delete(`${BASE_URL}/api/avatars/${body.data.id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
    });

    test('POST /api/avatars rejects empty name', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/avatars`, {
        data: { name: '' },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(400);
    });

    test('POST /api/avatars rejects name over 64 chars', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/avatars`, {
        data: { name: 'x'.repeat(65) },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(400);
    });

    test('POST /api/avatars accepts all valid styles', async ({ request }) => {
      const styles = ['anime', 'realistic', 'lowpoly', 'korean', 'western', 'chibi'];
      for (const style of styles) {
        const res = await request.post(`${BASE_URL}/api/avatars`, {
          data: { name: `Style ${style}`, style },
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        });
        expect(res.status()).toBe(201);
        const body = await res.json();
        expect(body.data.style).toBe(style);

        // Clean up
        await request.delete(`${BASE_URL}/api/avatars/${body.data.id}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
      }
    });
  });

  test.describe('Read', () => {
    test('GET /api/avatars returns paginated list', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/avatars`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.items).toBeDefined();
      expect(Array.isArray(body.data.items)).toBe(true);
      expect(typeof body.data.total).toBe('number');
      expect(typeof body.data.page).toBe('number');
      expect(typeof body.data.pageSize).toBe('number');
      expect(typeof body.data.totalPages).toBe('number');
    });

    test('GET /api/avatars supports search param', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/avatars?search=CRUD`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    test('GET /api/avatars supports status filter', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/avatars?status=draft`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    test('GET /api/avatars/:id returns single avatar', async ({ request }) => {
      if (!createdAvatarId) {
        test.skip();
        return;
      }
      const res = await request.get(`${BASE_URL}/api/avatars/${createdAvatarId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(createdAvatarId);
      expect(body.data.versions).toBeDefined();
    });

    test('GET /api/avatars/:id returns 404 for non-existent id', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/avatars/non-existent-id-12345`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(404);
    });
  });

  test.describe('Update', () => {
    test('PUT /api/avatars/:id updates name', async ({ request }) => {
      if (!createdAvatarId) {
        test.skip();
        return;
      }
      const res = await request.put(`${BASE_URL}/api/avatars/${createdAvatarId}`, {
        data: { name: 'CRUD Updated Name' },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);

      // Verify the update persisted
      const getRes = await request.get(`${BASE_URL}/api/avatars/${createdAvatarId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const getBody = await getRes.json();
      expect(getBody.data.name).toBe('CRUD Updated Name');
    });

    test('PUT /api/avatars/:id updates status', async ({ request }) => {
      if (!createdAvatarId) {
        test.skip();
        return;
      }
      const res = await request.put(`${BASE_URL}/api/avatars/${createdAvatarId}`, {
        data: { status: 'published' },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    test('PUT /api/avatars/:id rejects invalid status', async ({ request }) => {
      if (!createdAvatarId) {
        test.skip();
        return;
      }
      const res = await request.put(`${BASE_URL}/api/avatars/${createdAvatarId}`, {
        data: { status: 'invalid_status' },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(400);
    });
  });

  test.describe('Version Management', () => {
    let versionId: string;

    test('POST /api/avatars/:id/versions creates new version', async ({ request }) => {
      if (!createdAvatarId) {
        test.skip();
        return;
      }
      const res = await request.post(`${BASE_URL}/api/avatars/${createdAvatarId}/versions`, {
        data: {
          blendshape_snapshot: { eye_size: 0.5, mouth_width: -0.2 },
          body_params: { height: 0.3, shoulder: 0, waist: 0, arm_length: 0, leg_length: 0 },
          equipped_parts: [],
          material_overrides: {},
        },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.version).toBeDefined();
    });

    test('GET /api/avatars/:id returns version list with history', async ({ request }) => {
      if (!createdAvatarId) {
        test.skip();
        return;
      }
      const res = await request.get(`${BASE_URL}/api/avatars/${createdAvatarId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const body = await res.json();
      expect(body.data.versions.length).toBeGreaterThan(0);
      versionId = body.data.versions[0].id;
    });

    test('POST /api/avatars/:id/versions/:vid/restore restores version', async ({ request }) => {
      if (!createdAvatarId || !versionId) {
        test.skip();
        return;
      }
      const res = await request.post(
        `${BASE_URL}/api/avatars/${createdAvatarId}/versions/${versionId}/restore`,
        { headers: { Authorization: `Bearer ${authToken}` } },
      );
      expect([200, 201]).toContain(res.status());
    });
  });

  test.describe('Delete', () => {
    test('DELETE /api/avatars/:id deletes avatar', async ({ request }) => {
      if (!createdAvatarId) {
        test.skip();
        return;
      }
      const res = await request.delete(`${BASE_URL}/api/avatars/${createdAvatarId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);

      // Verify deleted
      const getRes = await request.get(`${BASE_URL}/api/avatars/${createdAvatarId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(getRes.status()).toBe(404);
    });

    test('DELETE /api/avatars/:id returns 404 for already deleted', async ({ request }) => {
      const res = await request.delete(`${BASE_URL}/api/avatars/non-existent-12345`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(404);
    });
  });
});
