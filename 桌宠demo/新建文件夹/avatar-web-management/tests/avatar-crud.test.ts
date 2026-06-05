// 虚拟形象 CRUD 集成测试 — GET/POST/PUT/DELETE + 版本管理
import { get, post, put, del, loginAs } from './helpers';

describe('Avatar lifecycle CRUD', () => {
  let token: string;
  let createdId: string;

  beforeAll(async () => {
    const t = await loginAs('demo@example.com', 'demo1234');
    expect(t).toBeDefined();
    token = t!;
  });

  afterAll(async () => {
    if (createdId) {
      await del(`/api/avatars/${createdId}`, token);
    }
  });

  it('full lifecycle: create → read → update → read → delete', async () => {
    // 1. Create
    const createRes = await post('/api/avatars', {
      name: 'Lifecycle Test Avatar',
      style: 'anime',
      base_model: 'female',
    }, token);
    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    createdId = (createRes.body.data as Record<string, string>).id;
    expect(createdId).toBeDefined();

    // 2. Read by ID
    const readRes = await get(`/api/avatars/${createdId}`, token);
    expect(readRes.status).toBe(200);
    expect(readRes.body.success).toBe(true);
    const data = readRes.body.data as Record<string, unknown>;
    expect(data.id).toBe(createdId);
    expect(data.name).toBe('Lifecycle Test Avatar');
    expect(data.versions).toBeDefined();
    expect(Array.isArray(data.versions)).toBe(true);

    // 3. Update
    const updateRes = await put(`/api/avatars/${createdId}`, {
      name: 'Lifecycle Test Avatar — Updated',
    }, token);
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);

    // 4. Verify update
    const read2Res = await get(`/api/avatars/${createdId}`, token);
    expect(read2Res.status).toBe(200);
    const data2 = read2Res.body.data as Record<string, unknown>;
    expect(data2.name).toBe('Lifecycle Test Avatar — Updated');

    // 5. Delete
    const deleteRes = await del(`/api/avatars/${createdId}`, token);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    // 6. Verify deleted (should 404)
    const read3Res = await get(`/api/avatars/${createdId}`, token);
    expect(read3Res.status).toBe(404);
  });

  it('DELETE rejects without auth', async () => {
    const res = await del('/api/avatars/nonexistent-id');
    expect(res.status).toBe(401);
  });

  it('DELETE returns 404 for non-existent id', async () => {
    const res = await del('/api/avatars/00000000-0000-0000-0000-000000000000', token);
    expect(res.status).toBe(404);
  });

  it('GET by id returns 404 for non-existent avatar', async () => {
    const res = await get('/api/avatars/00000000-0000-0000-0000-000000000000', token);
    expect(res.status).toBe(404);
  });
});

describe('Avatar versions', () => {
  let token: string;
  let avatarId: string;

  beforeAll(async () => {
    const t = await loginAs('demo@example.com', 'demo1234');
    expect(t).toBeDefined();
    token = t!;

    const createRes = await post('/api/avatars', {
      name: `VersionTest-${Date.now()}`,
      style: 'anime',
      base_model: 'female',
    }, token);
    expect(createRes.status).toBe(201);
    avatarId = (createRes.body.data as Record<string, string>).id;
  });

  afterAll(async () => {
    if (avatarId) {
      await del(`/api/avatars/${avatarId}`, token);
    }
  });

  it('GET versions list — returns array', async () => {
    const res = await get(`/api/avatars/${avatarId}/versions`, token);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST create version — adds a new version', async () => {
    const res = await post(`/api/avatars/${avatarId}/versions`, {
      blendshape_snapshot: { eye_open: 1.0, mouth_smile: 0.5 },
      body_params: { height: 1.0, weight: 0.5 },
      equipped_parts: [],
      material_overrides: {},
    }, token);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const data = res.body.data as Record<string, unknown>;
    expect(data.id).toBeDefined();
    expect(data.version_number).toBeDefined();

    // Verify version shows up in list
    const listRes = await get(`/api/avatars/${avatarId}/versions`, token);
    const versions = listRes.body.data as Array<Record<string, unknown>>;
    expect(versions.some((v) => v.id === data.id)).toBe(true);
  });

  it('POST create version — validates equipped_parts structure', async () => {
    const res = await post(`/api/avatars/${avatarId}/versions`, {
      blendshape_snapshot: { eye_open: 1.0 },
      body_params: { height: 1.0 },
      equipped_parts: [{ bad_field: 'invalid' }],
      material_overrides: {},
    }, token);
    // Invalid equipped_parts items fail validation
    expect(res.status).toBe(400);
  });
});
