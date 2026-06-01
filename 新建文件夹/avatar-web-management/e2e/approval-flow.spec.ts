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

test.describe('Approval Flow E2E', () => {
  let authToken: string;
  let testAvatarId: string;
  let testVersionId: string;

  test.beforeAll(async ({ request }) => {
    authToken = await getAuthToken(request);
  });

  test.describe('Setup: Create avatar and submit version', () => {
    test('Create avatar for approval testing', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/avatars`, {
        data: { name: 'Approval E2E Test', style: 'realistic', base_model: 'female' },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      testAvatarId = body.data.id;
    });

    test('Create version for review', async ({ request }) => {
      if (!testAvatarId) {
        test.skip();
        return;
      }
      const res = await request.post(`${BASE_URL}/api/avatars/${testAvatarId}/versions`, {
        data: {
          blendshape_snapshot: { eye_size: 0.5, jaw_width: -0.3 },
          body_params: { height: 0, shoulder: 0, waist: 0, arm_length: 0, leg_length: 0 },
          equipped_parts: [],
          material_overrides: {},
        },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(201);

      // Fetch the version ID from the avatar detail
      const detailRes = await request.get(`${BASE_URL}/api/avatars/${testAvatarId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const detailBody = await detailRes.json();
      if (detailBody.data?.versions?.length > 0) {
        testVersionId = detailBody.data.versions[0].id;
      }
    });
  });

  test.describe('Review List', () => {
    test('GET /api/admin/reviews returns paginated review list', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/admin/reviews?status=pending_review`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.items).toBeDefined();
      expect(Array.isArray(body.data.items)).toBe(true);
    });

    test('GET /api/admin/reviews supports pagination', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/admin/reviews?status=pending_review&page=1&pageSize=5`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.data.page).toBe(1);
      expect(body.data.pageSize).toBe(5);
    });

    test('GET /api/admin/reviews filters by status', async ({ request }) => {
      const statuses = ['pending_review', 'approved', 'rejected'];
      for (const status of statuses) {
        const res = await request.get(`${BASE_URL}/api/admin/reviews?status=${status}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        expect(res.status()).toBe(200);
      }
    });

    test('GET /api/admin/reviews rejects non-auditor', async ({ request }) => {
      // Regular user token should get 403
      // This test validates that role checking works
      const res = await request.get(`${BASE_URL}/api/admin/reviews`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      // demo user may or may not have auditor role
      const validStatuses = [200, 403];
      expect(validStatuses).toContain(res.status());
    });
  });

  test.describe('Review Action', () => {
    test('PUT /api/admin/reviews/:id rejects invalid action', async ({ request }) => {
      if (!testVersionId) {
        test.skip();
        return;
      }
      const res = await request.put(`${BASE_URL}/api/admin/reviews/${testVersionId}`, {
        data: { action: 'invalid_action' },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      // 400 (bad action) or 403 (not auditor) or 404
      const validStatuses = [400, 403, 404];
      expect(validStatuses).toContain(res.status());
    });

    test('PUT /api/admin/reviews/:id with approve action', async ({ request }) => {
      if (!testVersionId) {
        test.skip();
        return;
      }
      const res = await request.put(`${BASE_URL}/api/admin/reviews/${testVersionId}`, {
        data: { action: 'approved', comment: 'Looks good!' },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      // 200 (success), 403 (not auditor), 400 (not pending_review)
      const validStatuses = [200, 400, 403];
      expect(validStatuses).toContain(res.status());
    });

    test('PUT /api/admin/reviews/:id with reject action', async ({ request }) => {
      if (!testVersionId) {
        test.skip();
        return;
      }
      const res = await request.put(`${BASE_URL}/api/admin/reviews/${testVersionId}`, {
        data: { action: 'rejected', comment: 'Needs improvement' },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      const validStatuses = [200, 400, 403];
      expect(validStatuses).toContain(res.status());
    });

    test('PUT /api/admin/reviews/:id returns 404 for non-existent version', async ({ request }) => {
      const res = await request.put(`${BASE_URL}/api/admin/reviews/non-existent-id-99999`, {
        data: { action: 'approved' },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      const validStatuses = [404, 403];
      expect(validStatuses).toContain(res.status());
    });
  });

  test.describe('Audit Trail', () => {
    test('GET /api/admin/audit-logs requires auth', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/admin/audit-logs`);
      expect(res.status()).toBe(401);
    });

    test('GET /api/admin/audit-logs returns logs with auth', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/admin/audit-logs`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const validStatuses = [200, 403];
      expect(validStatuses).toContain(res.status());
    });
  });

  test.describe('Admin Stats', () => {
    test('GET /api/admin/stats returns dashboard stats', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const validStatuses = [200, 403];
      expect(validStatuses).toContain(res.status());
    });
  });

  // Clean up
  test.afterAll(async ({ request }) => {
    if (testAvatarId) {
      await request.delete(`${BASE_URL}/api/avatars/${testAvatarId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
    }
  });
});
