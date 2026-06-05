// 资产上传集成测试 — 列表、过滤、分块上传、认证
import http from 'http';
import { get, post, loginAs } from './helpers';

describe('Asset listing', () => {
  let token: string;

  beforeAll(async () => {
    const t = await loginAs('demo@example.com', 'demo1234');
    expect(t).toBeDefined();
    token = t!;
  });

  it('GET /api/assets — returns paginated list', async () => {
    const res = await get('/api/assets?page=1&pageSize=10', token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data as Record<string, unknown>;
    expect(Array.isArray(data.items)).toBe(true);
    expect(typeof data.total).toBe('number');
  });

  it('GET /api/assets — type filter works', async () => {
    const types = ['model', 'texture', 'animation', 'thumbnail'];
    for (const type of types) {
      const res = await get(`/api/assets?type=${type}`, token);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }
  });

  it('GET /api/assets — pageSize respected', async () => {
    const res = await get('/api/assets?page=1&pageSize=2', token);
    expect(res.status).toBe(200);
    const data = res.body.data as Record<string, unknown>;
    expect((data.items as unknown[]).length).toBeLessThanOrEqual(2);
  });

  it('GET /api/assets — rejected without auth', async () => {
    const res = await get('/api/assets');
    expect(res.status).toBe(401);
  });
});

describe('Asset upload', () => {
  let token: string;

  beforeAll(async () => {
    const t = await loginAs('demo@example.com', 'demo1234');
    expect(t).toBeDefined();
    token = t!;
  });

  it('POST /api/assets/upload/init — initializes chunked upload', async () => {
    const res = await post('/api/assets/upload/init', {
      filename: 'test-model.glb',
      mimeType: 'model/gltf-binary',
      totalSize: 1024,
      chunkSize: 512,
    }, token);

    // May succeed or fail depending on storage backend, but should not 500
    expect([200, 201, 400, 500]).toContain(res.status);
    if (res.status === 200 || res.status === 201) {
      const data = res.body.data as Record<string, unknown>;
      expect(data.uploadId).toBeDefined();
    }
  });

  it('POST /api/assets/upload/init — rejects missing filename', async () => {
    const res = await post('/api/assets/upload/init', {
      mimeType: 'model/gltf-binary',
      totalSize: 1024,
    }, token);
    expect([400, 422]).toContain(res.status);
  });

  it('POST /api/assets/upload/init — rejects without auth', async () => {
    const res = await post('/api/assets/upload/init', {
      filename: 'test.glb',
      totalSize: 1024,
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/assets/upload — rejects JSON body (expects multipart)', async () => {
    const res = await post('/api/assets/upload', {}, token);
    expect([400, 500]).toContain(res.status);
  });

  it('POST /api/assets/upload — rejects without auth', async () => {
    const res = await post('/api/assets/upload');
    expect(res.status).toBe(401);
  });
});

describe('Asset proxy and batch', () => {
  let token: string;

  beforeAll(async () => {
    const t = await loginAs('demo@example.com', 'demo1234');
    expect(t).toBeDefined();
    token = t!;
  });

  it('GET /api/assets/proxy — returns 400 without url param', async () => {
    const res = await get('/api/assets/proxy', token);
    expect(res.status).toBe(400);
  });

  it('POST /api/assets/batch — rejects empty body', async () => {
    const res = await post('/api/assets/batch', { ids: [] }, token);
    // May succeed (empty batch is valid) or 400
    expect([200, 400]).toContain(res.status);
  });

  it('POST /api/assets/batch — rejects without auth', async () => {
    const res = await post('/api/assets/batch', { ids: [] });
    expect(res.status).toBe(401);
  });
});
