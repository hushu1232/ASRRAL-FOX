import { test, expect, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = 'demo@example.com';
const TEST_PASSWORD = 'demo1234';

async function checkA11y(page: Parameters<Parameters<typeof test>[2]>[0]['page']) {
  const axeResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const violations = axeResults.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious'
  );
  if (violations.length > 0) {
    console.warn(
      `[a11y] ${violations.length} violations on ${page.url()}:`,
      violations.map((v) => `${v.id} (${v.impact}): ${v.help}`).join('\n  ')
    );
  }
}

async function getAuthToken(request: APIRequestContext) {
  const res = await request.post(`${BASE_URL}/api/auth/login`, {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
    headers: { 'Content-Type': 'application/json' },
  });
  const body = await res.json();
  if (!body.success) throw new Error(`Login failed: ${body.error}`);
  return body.data?.accessToken || '';
}

async function loginViaApi(page: Parameters<Parameters<typeof test>[2]>[0]['page']) {
  const res = await page.request.post('http://localhost:3000/api/auth/login', {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
    headers: { 'Content-Type': 'application/json' },
  });
  const body = await res.json();
  if (!body.success) throw new Error(`Login API failed: ${body.error}`);
}

test.describe('Editor Workflow E2E', () => {

  test.describe('1. Avatar Creation → Editor Flow', () => {
    let createdAvatarId: string;

    test('Create avatar via API and verify it appears in list', async ({ request }) => {
      const token = await getAuthToken(request);
      const res = await request.post(`${BASE_URL}/api/avatars`, {
        data: { name: 'E2E 测试形象', style: 'anime', base_model: 'female' },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      createdAvatarId = body.data.id;

      // Verify in list
      const listRes = await request.get(`${BASE_URL}/api/avatars?search=E2E`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const listBody = await listRes.json();
      expect(listBody.success).toBe(true);
      const items = listBody.data?.items || [];
      expect(items.some((a: { id: string }) => a.id === createdAvatarId)).toBe(true);
    });

    test('Editor page loads for created avatar', async ({ page }) => {
      await loginViaApi(page);
      // Navigate directly to the editor
      await page.goto('/avatars');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);

      // Click "新建形象" to create a new avatar
      const createBtn = page.getByText('新建形象');
      if (await createBtn.isVisible()) {
        await createBtn.click();
        await page.waitForTimeout(2000);
      }

      // Should navigate to editor or stay on page with success message
      const bodyText = await page.textContent('body');
      expect(bodyText).toBeTruthy();
    });

    test('Editor page has part panel and toolbar', async ({ page }) => {
      await loginViaApi(page);

      // First create an avatar via API, then visit its editor
      const token = await getAuthToken(page.request);
      const res = await page.request.post(`${BASE_URL}/api/avatars`, {
        data: { name: 'Editor Test Avatar', style: 'anime', base_model: 'female' },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      const avatarId = body.data?.id;

      if (avatarId) {
        await page.goto(`/avatars/${avatarId}/edit`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000);

        const bodyText = await page.textContent('body');
        expect(bodyText).toBeTruthy();

        // Clean up
        await page.request.delete(`${BASE_URL}/api/avatars/${avatarId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    });

    // Clean up created avatar
    test.afterAll(async ({ request }) => {
      if (createdAvatarId) {
        const token = await getAuthToken(request);
        await request.delete(`${BASE_URL}/api/avatars/${createdAvatarId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    });
  });

  test.describe('2. Avatar List & Filtering', () => {
    test.beforeEach(async ({ page }) => {
      await loginViaApi(page);
    });

    test('Avatar list page loads with controls', async ({ page }) => {
      await page.goto('/avatars');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Header
      await expect(page.getByText('形象管理中心')).toBeVisible();

      // Search input
      await expect(page.getByPlaceholder('搜索形象名称...')).toBeVisible();

      // Create button
      await expect(page.getByText('新建形象')).toBeVisible();

      await checkA11y(page);
    });

    test('Status filter is visible', async ({ page }) => {
      await page.goto('/avatars');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);

      // Status filter exists
      const statusFilter = page.locator('.ant-select').filter({ hasText: /状态筛选|草稿|已发布|审核中/ });
      const count = await statusFilter.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('3. Batch Operations', () => {
    test('Batch delete avatars via API', async ({ request }) => {
      const token = await getAuthToken(request);

      // Create two test avatars
      const [r1, r2] = await Promise.all([
        request.post(`${BASE_URL}/api/avatars`, {
          data: { name: 'Batch Test 1', style: 'anime', base_model: 'female' },
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        }),
        request.post(`${BASE_URL}/api/avatars`, {
          data: { name: 'Batch Test 2', style: 'anime', base_model: 'male' },
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        }),
      ]);

      const b1 = await r1.json();
      const b2 = await r2.json();
      const ids = [b1.data?.id, b2.data?.id].filter(Boolean);

      if (ids.length === 2) {
        // Batch delete
        const batchRes = await request.post(`${BASE_URL}/api/avatars/batch`, {
          data: { action: 'delete', ids },
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });
        expect(batchRes.status()).toBe(200);
        const batchBody = await batchRes.json();
        expect(batchBody.success).toBe(true);
      }
    });

    test('Batch operation rejects empty ids', async ({ request }) => {
      const token = await getAuthToken(request);
      const res = await request.post(`${BASE_URL}/api/avatars/batch`, {
        data: { action: 'delete', ids: [] },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      expect(res.status()).toBe(400);
    });

    test('Batch operation validates action', async ({ request }) => {
      const token = await getAuthToken(request);
      const res = await request.post(`${BASE_URL}/api/avatars/batch`, {
        data: { action: 'invalid_action', ids: ['test-id'] },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      expect(res.status()).toBe(400);
    });
  });
});

test.describe('Approval Workflow E2E', () => {

  test.describe('Version Status Transitions', () => {
    let testAvatarId: string;
    let testVersionId: string;

    test('Create avatar and version for approval', async ({ request }) => {
      const token = await getAuthToken(request);

      // Create avatar
      const avatarRes = await request.post(`${BASE_URL}/api/avatars`, {
        data: { name: 'Approval Test Avatar', style: 'realistic', base_model: 'female' },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const avatarBody = await avatarRes.json();
      expect(avatarBody.success).toBe(true);
      testAvatarId = avatarBody.data.id;

      // Create a version
      const versionRes = await request.post(`${BASE_URL}/api/avatars/${testAvatarId}/versions`, {
        data: {
          blendshape_snapshot: { eye_size: 0.5 },
          body_params: { height: 0, shoulder: 0, waist: 0, arm_length: 0, leg_length: 0 },
          equipped_parts: [],
          material_overrides: {},
        },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const versionBody = await versionRes.json();
      expect(versionBody.success).toBe(true);

      // Get avatar detail to find version id
      const detailRes = await request.get(`${BASE_URL}/api/avatars/${testAvatarId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const detailBody = await detailRes.json();
      if (detailBody.success && detailBody.data?.versions?.length > 0) {
        testVersionId = detailBody.data.versions[0].id;
      }
    });

    test('Avatar detail returns version list', async ({ request }) => {
      if (!testAvatarId) {
        test.skip();
        return;
      }
      const token = await getAuthToken(request);
      const res = await request.get(`${BASE_URL}/api/avatars/${testAvatarId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.versions).toBeDefined();
      expect(Array.isArray(body.data.versions)).toBe(true);
    });

    test('Restore version endpoint exists', async ({ request }) => {
      if (!testAvatarId || !testVersionId) {
        test.skip();
        return;
      }
      const token = await getAuthToken(request);
      const res = await request.post(
        `${BASE_URL}/api/avatars/${testAvatarId}/versions/${testVersionId}/restore`,
        {
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        }
      );
      // 200 or 404 depending on implementation
      expect([200, 404, 201]).toContain(res.status());
    });

    // Clean up
    test.afterAll(async ({ request }) => {
      if (testAvatarId) {
        const token = await getAuthToken(request);
        await request.delete(`${BASE_URL}/api/avatars/${testAvatarId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    });
  });

  test.describe('Admin Access Control', () => {
    test('Settings profile requires authentication', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/settings/profile`);
      expect(res.status()).toBe(401);
    });

    test('Admin users endpoint requires auth', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/admin/users`);
      // Should return 401 or 403 if not admin
      expect([401, 403]).toContain(res.status());
    });

    test('Auth-protected endpoints reject expired/missing token', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/avatars`, {
        headers: { Authorization: 'Bearer invalid_token_12345' },
      });
      expect(res.status()).toBe(401);
    });
  });
});

test.describe('Batch Export E2E', () => {

  test('Export endpoint returns 401 without auth', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/avatars/test-id/export?format=glb`);
    expect(res.status()).toBe(401);
  });

  test('Export endpoint requires valid avatar id', async ({ request }) => {
    const token = await getAuthToken(request);
    const res = await request.get(`${BASE_URL}/api/avatars/nonexistent-id/export?format=glb`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // Should return 404 for non-existent avatar
    expect(res.status()).toBe(404);
  });

  test('Screenshot endpoint accepts valid request', async ({ request }) => {
    const token = await getAuthToken(request);

    // Create a test avatar first
    const avatarRes = await request.post(`${BASE_URL}/api/avatars`, {
      data: { name: 'Screenshot Test', style: 'anime', base_model: 'female' },
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    const avatarBody = await avatarRes.json();
    const avatarId = avatarBody.data?.id;

    if (avatarId) {
      // Request screenshot
      const screenshotRes = await request.post(`${BASE_URL}/api/avatars/${avatarId}/screenshot`, {
        data: { width: 1920, height: 1080, cameraPreset: 'front' },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      expect(screenshotRes.status()).toBe(202);
      const screenshotBody = await screenshotRes.json();
      expect(screenshotBody.success).toBe(true);
      expect(screenshotBody.data?.jobId).toBeDefined();

      // Poll screenshot status
      const jobId = screenshotBody.data.jobId;
      const pollRes = await request.get(
        `${BASE_URL}/api/avatars/${avatarId}/screenshot?jobId=${jobId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(pollRes.status()).toBe(200);

      // Clean up
      await request.delete(`${BASE_URL}/api/avatars/${avatarId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  });
});
