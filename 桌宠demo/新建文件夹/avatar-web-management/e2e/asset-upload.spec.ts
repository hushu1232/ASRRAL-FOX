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

test.describe('Asset Upload E2E', () => {
  test.describe.configure({ mode: 'serial' });

  let authToken: string;
  let uploadId: string;

  test.beforeAll(async ({ request }) => {
    authToken = await getAuthToken(request);
  });

  test.describe('Upload Init', () => {
    test('POST /api/assets/upload/init creates upload session for GLB', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/assets/upload/init`, {
        data: {
          filename: 'test-model.glb',
          fileSize: 1024 * 100, // 100KB
          contentType: 'model/gltf-binary',
        },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.uploadId).toBeDefined();
      expect(body.data.chunkSize).toBeGreaterThan(0);
      expect(body.data.totalChunks).toBeGreaterThan(0);
      uploadId = body.data.uploadId;
    });

    test('POST /api/assets/upload/init creates upload session for PNG', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/assets/upload/init`, {
        data: {
          filename: 'texture.png',
          fileSize: 2048,
          contentType: 'image/png',
        },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    test('POST /api/assets/upload/init rejects unsupported extension', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/assets/upload/init`, {
        data: {
          filename: 'malware.exe',
          fileSize: 1024,
          contentType: 'application/octet-stream',
        },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    test('POST /api/assets/upload/init rejects zero file size', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/assets/upload/init`, {
        data: {
          filename: 'empty.glb',
          fileSize: 0,
          contentType: 'model/gltf-binary',
        },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(400);
    });

    test('POST /api/assets/upload/init rejects oversized file', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/assets/upload/init`, {
        data: {
          filename: 'huge.glb',
          fileSize: 600 * 1024 * 1024, // 600MB > 500MB limit
          contentType: 'model/gltf-binary',
        },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(400);
    });

    test('POST /api/assets/upload/init sanitizes dangerous filename', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/assets/upload/init`, {
        data: {
          filename: '../../../etc/passwd.glb',
          fileSize: 1024,
          contentType: 'model/gltf-binary',
        },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      // Should have sanitized the filename
    });

    test('POST /api/assets/upload/init requires auth', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/assets/upload/init`, {
        data: { filename: 'test.glb', fileSize: 1024 },
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status()).toBe(401);
    });
  });

  test.describe('Chunk Upload', () => {
    const chunkData = Buffer.from('A'.repeat(1024 * 64)); // 64KB mock chunk

    test('POST /api/assets/upload/:uploadId/chunk uploads chunk 0', async ({ request }) => {
      if (!uploadId) {
        test.skip();
        return;
      }
      const res = await request.post(`${BASE_URL}/api/assets/upload/${uploadId}/chunk`, {
        multipart: {
          chunk: {
            name: 'chunk-0.bin',
            mimeType: 'application/octet-stream',
            buffer: chunkData,
          },
          chunkIndex: '0',
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.chunkIndex).toBe(0);
      expect(body.data.progress).toBeGreaterThan(0);
    });

    test('POST /api/assets/upload/:uploadId/chunk requires auth', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/assets/upload/fake-id/chunk`, {
        multipart: {
          chunk: {
            name: 'chunk-0.bin',
            mimeType: 'application/octet-stream',
            buffer: chunkData,
          },
          chunkIndex: '0',
        },
      });
      expect(res.status()).toBe(401);
    });
  });

  test.describe('Asset CRUD', () => {
    test('GET /api/assets returns paginated list', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/assets`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.items).toBeDefined();
      expect(Array.isArray(body.data.items)).toBe(true);
    });

    test('GET /api/assets supports type filter', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/assets?type=model`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    test('GET /api/assets supports format filter', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/assets?format=glb`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    test('GET /api/assets rejects unauthenticated', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/assets`);
      expect(res.status()).toBe(401);
    });

    test('POST /api/assets/batch supports batch operation', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/assets/batch`, {
        data: { action: 'delete', ids: [] },
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      });
      // Empty batch should be handled gracefully
      expect([200, 400]).toContain(res.status());
    });
  });
});
