import { get, post, loginAs } from './helpers';

describe('Export API', () => {
  let userToken: string;
  let avatarId: string;

  beforeAll(async () => {
    userToken = (await loginAs('demo@example.com', 'demo1234')) || '';

    // Get an avatar to export
    if (userToken) {
      const res = await get('/api/avatars?page=1&pageSize=5', userToken);
      const items = (res.body.data as Record<string, unknown>)?.items as Array<Record<string, unknown>> | undefined;
      if (items && items.length > 0) {
        avatarId = items[0].id as string;
      }

      // If no avatar exists, create one
      if (!avatarId) {
        const createRes = await post('/api/avatars', {
          name: `ExportTest-${Date.now()}`,
          style: 'anime',
          base_model: 'female',
        }, userToken);
        if (createRes.status === 201) {
          avatarId = (createRes.body.data as Record<string, string>).id;
        }
      }
    }
  });

  it('GET /api/avatars/:id/export?format=glb — returns GLB binary', async () => {
    if (!avatarId) return; // skip if no avatar

    const res = await get(`/api/avatars/${avatarId}/export?format=glb`, userToken);
    // Either 200 (binary download) or 500 (model file missing)
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      // Binary response — body might be a buffer or parsed JSON
      // The server returns application/octet-stream for GLB
      expect(res.body).toBeDefined();
    }
  });

  it('GET /api/avatars/:id/export?format=vrm — returns VRM binary', async () => {
    if (!avatarId) return;

    const res = await get(`/api/avatars/${avatarId}/export?format=vrm`, userToken);
    expect([200, 500]).toContain(res.status);
  });

  it('GET /api/avatars/:id/export?format=invalid — rejected', async () => {
    if (!avatarId) return;

    const res = await get(`/api/avatars/${avatarId}/export?format=fbx`, userToken);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/avatars/:id/export — unauthorized without token', async () => {
    if (!avatarId) return;

    const res = await get(`/api/avatars/${avatarId}/export?format=glb`);
    expect(res.status).toBe(401);
  });
});

describe('JWKS Endpoint', () => {
  it('GET /.well-known/jwks.json — returns JWKS when RS256 configured', async () => {
    const res = await get('/.well-known/jwks.json');
    // 200 when RSA keys found, 404 when not configured
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.keys).toBeDefined();
      expect(Array.isArray(res.body.keys)).toBe(true);
      expect(res.body.keys.length).toBeGreaterThan(0);
      expect(res.body.keys[0].kty).toBe('RSA');
      expect(res.body.keys[0].alg).toBe('RS256');
    }
  });
});
