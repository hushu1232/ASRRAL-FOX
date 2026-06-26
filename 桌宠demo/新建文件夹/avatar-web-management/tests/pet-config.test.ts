import { get, put, post, loginAs } from './helpers';

describe('GET /api/pet/config', () => {
  let token: string;

  beforeAll(async () => {
    const t = await loginAs('demo@example.com', 'demo1234');
    expect(t).toBeDefined();
    token = t!;
  });

  it('returns pet config with expected fields (or creates default)', async () => {
    const res = await get('/api/pet/config', token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data as Record<string, unknown>;

    // Core fields from PetConfig model (snake_case from DB)
    expect(typeof data.id).toBe('string');
    expect(typeof data.pet_name).toBe('string');
    expect(typeof data.animation_model).toBe('string');
    expect(['live2d', 'dragonbones', 'vrm']).toContain(data.animation_model);
    expect(typeof data.idle_timeout).toBe('number');
    expect(typeof data.wander_interval).toBe('number');
  });

  it('rejects unauthenticated access', async () => {
    const res = await get('/api/pet/config');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/pet/config', () => {
  let token: string;

  beforeAll(async () => {
    const t = await loginAs('demo@example.com', 'demo1234');
    expect(t).toBeDefined();
    token = t!;
  });

  it('updates pet config with valid fields', async () => {
    const res = await put('/api/pet/config', {
      petName: '测试星尘',
      personality: '测试性格',
    }, token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data as Record<string, unknown>;
    expect(data.pet_name).toBe('测试星尘');
    expect(data.personality).toBe('测试性格');
  });

  it('rejects invalid animationModel value', async () => {
    const res = await put('/api/pet/config', {
      animationModel: 'invalid_model_type',
    }, token);

    expect(res.status).toBe(400);
  });
});

describe('GET /api/pet/export', () => {
  let token: string;

  beforeAll(async () => {
    const t = await loginAs('demo@example.com', 'demo1234');
    expect(t).toBeDefined();
    token = t!;
  });

  it('returns export JSON with expected shape', async () => {
    const res = await get('/api/pet/export', token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data as Record<string, unknown>;

    // Export format fields (export endpoint uses camelCase)
    expect(typeof data.version).toBe('number');
    expect(typeof data.petName).toBe('string');
    expect(typeof data.animationModel).toBe('string');
    expect(Array.isArray(data.params)).toBe(true);
    expect(Array.isArray(data.bodyParams)).toBe(true);
    expect(Array.isArray(data.equippedParts)).toBe(true);
    expect(Array.isArray(data.mappedAssets)).toBe(true);
  });
});

describe('POST /api/pet/sync', () => {
  let token: string;

  beforeAll(async () => {
    const t = await loginAs('demo@example.com', 'demo1234');
    expect(t).toBeDefined();
    token = t!;
  });

  it('accepts desktop WebBridge sync payload and returns exported config', async () => {
    const res = await post('/api/pet/sync', {
      clientVersion: 'desktop-webbridge',
      lastSyncAt: new Date('2026-06-23T00:00:00.000Z').toISOString(),
      capabilities: ['config', 'assets', 'avatar'],
    }, token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(expect.objectContaining({
      version: expect.any(Number),
      petName: expect.any(String),
      animationModel: expect.any(String),
      mappedAssets: expect.any(Array),
    }));
  });
});
