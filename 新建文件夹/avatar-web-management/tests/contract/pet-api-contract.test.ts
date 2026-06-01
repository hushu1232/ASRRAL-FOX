/**
 * Contract tests for pet API endpoints.
 * Mocks withAuth (pass-through) and petService to verify:
 * - Request/response shapes (success wrapper, error codes)
 * - Validation rules (required fields, enum checks)
 * - Status codes (200, 201, 400, 404)
 * - Auth rejection (missing token → 401)
 */

// ── Mocks ────────────────────────────────────────────────────────
const mockPetService = {
  getConfig: jest.fn(),
  getOrCreateConfig: jest.fn(),
  updateConfig: jest.fn(),
  setAvatarAsPet: jest.fn(),
  getAssetMappings: jest.fn(),
  addAssetMapping: jest.fn(),
  removeAssetMapping: jest.fn(),
  getAvailableAssets: jest.fn(),
  findConfigsByAsset: jest.fn(),
  startSession: jest.fn(),
  updateSession: jest.fn(),
  getUserSessions: jest.fn(),
  exportConfig: jest.fn(),
};

jest.mock('@/lib/services/petService', () => ({ petService: mockPetService }));
jest.mock('@/lib/logger', () => ({ createLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }) }));
jest.mock('uuid', () => ({ v4: () => 'mock-uuid-123' }));

const testUser = { sub: 'user-1', email: 'test@example.com', role: 'user', workspaceId: 'ws-1' };

// withAuth pass-through mock — calls handler directly with test user
let capturedHandler: Function | null = null;
jest.mock('@/lib/auth/middleware', () => ({
  withAuth: jest.fn((handler: Function) => {
    capturedHandler = handler;
    return async (req: Request, ctx?: unknown) => {
      // If no auth header, return 401
      if (!req.headers.get('authorization')) {
        return new Response(JSON.stringify({ success: false, error: 'Missing authorization header' }), { status: 401, headers: { 'content-type': 'application/json' } });
      }
      return handler(req, testUser, ctx);
    };
  }),
}));

// ── Helpers ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockRequest(method: string, url: string, body?: unknown, auth = true): any {
  const headers = new Headers();
  headers.set('content-type', 'application/json');
  if (auth) headers.set('authorization', 'Bearer test-token');

  return new Request(`http://localhost${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function parseResponse(res: Response) {
  return { status: res.status, body: await res.json() };
}

// ── Tests ────────────────────────────────────────────────────────

describe('Pet API Contract', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  // ═══════════════════════════════════════════════════════════════
  // GET /api/pet/config
  // ═══════════════════════════════════════════════════════════════
  describe('GET /api/pet/config', () => {
    it('returns success wrapper with config data', async () => {
      mockPetService.getOrCreateConfig.mockResolvedValue({
        id: 'config-1', pet_name: '星尘', personality: '温柔',
        animation_model: 'live2d', idle_timeout: 300, wander_interval: 15.0,
      });

      const { GET } = await import('@/app/api/pet/config/route');
      const res = await GET(mockRequest('GET', '/api/pet/config'));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('config-1');
      expect(body.data.pet_name).toBe('星尘');
      expect(body.data.animation_model).toBe('live2d');
    });

    it('returns 401 without auth header', async () => {
      const { GET } = await import('@/app/api/pet/config/route');
      const res = await GET(mockRequest('GET', '/api/pet/config', undefined, false));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(401);
      expect(body.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // PUT /api/pet/config
  // ═══════════════════════════════════════════════════════════════
  describe('PUT /api/pet/config', () => {
    it('returns updated config in success wrapper', async () => {
      mockPetService.updateConfig.mockResolvedValue({
        id: 'config-1', pet_name: '新星尘', personality: '活泼',
        updated_at: '2026-05-26',
      });

      const { PUT } = await import('@/app/api/pet/config/route');
      const res = await PUT(mockRequest('PUT', '/api/pet/config', {
        petName: '新星尘', personality: '活泼',
      }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.pet_name).toBe('新星尘');
      expect(body.data.personality).toBe('活泼');
    });

    it('returns 400 when no valid fields provided', async () => {
      const { PUT } = await import('@/app/api/pet/config/route');
      const res = await PUT(mockRequest('PUT', '/api/pet/config', {}));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid animationModel', async () => {
      const { PUT } = await import('@/app/api/pet/config/route');
      const res = await PUT(mockRequest('PUT', '/api/pet/config', {
        animationModel: 'invalid_system',
      }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(400);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when config does not exist', async () => {
      const { NotFoundError } = await import('@/lib/errors');
      mockPetService.updateConfig.mockRejectedValue(new NotFoundError('PetConfig', 'nonexistent'));

      const { PUT } = await import('@/app/api/pet/config/route');
      const res = await PUT(mockRequest('PUT', '/api/pet/config', { petName: 'test' }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(404);
      expect(body.code).toBe('NOT_FOUND');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════
  // GET /api/pet/assets
  // ═══════════════════════════════════════════════════════════════
  describe('GET /api/pet/assets', () => {
    it('returns asset list in success wrapper', async () => {
      mockPetService.getAvailableAssets.mockResolvedValue([
        { id: 'asset-1', filename: 'model.glb', asset_type: 'model', status: 'ready' },
        { id: 'asset-2', filename: 'texture.png', asset_type: 'texture', status: 'ready' },
      ]);

      const { GET } = await import('@/app/api/pet/assets/route');
      const res = await GET(mockRequest('GET', '/api/pet/assets?type=model'));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].asset_type).toBe('model');
    });

    it('passes type filter from query params', async () => {
      mockPetService.getAvailableAssets.mockResolvedValue([]);

      const { GET } = await import('@/app/api/pet/assets/route');
      const res = await GET(mockRequest('GET', '/api/pet/assets?type=animation'));
      await parseResponse(res);

      expect(mockPetService.getAvailableAssets).toHaveBeenCalledWith('ws-1', 'animation');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // POST /api/pet/assets
  // ═══════════════════════════════════════════════════════════════
  describe('POST /api/pet/assets', () => {
    it('returns 400 when required fields missing', async () => {
      const { POST } = await import('@/app/api/pet/assets/route');
      const res = await POST(mockRequest('POST', '/api/pet/assets', { assetId: 'a1' }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(400);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 201 with mapping data on success', async () => {
      mockPetService.getConfig.mockResolvedValue({ id: 'config-1' });
      mockPetService.addAssetMapping.mockResolvedValue([
        { id: 'm1', slot_name: 'idle', asset_id: 'a1', asset_type: 'model' },
      ]);

      const { POST } = await import('@/app/api/pet/assets/route');
      const res = await POST(mockRequest('POST', '/api/pet/assets', {
        assetId: 'a1', assetType: 'model', slotName: 'idle',
      }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
    });

    it('returns 404 when pet config not found', async () => {
      mockPetService.getConfig.mockResolvedValue(null);

      const { POST } = await import('@/app/api/pet/assets/route');
      const res = await POST(mockRequest('POST', '/api/pet/assets', {
        assetId: 'a1', assetType: 'model', slotName: 'idle',
      }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(404);
      expect(body.code).toBe('NOT_FOUND');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // POST /api/pet/session
  // ═══════════════════════════════════════════════════════════════
  describe('POST /api/pet/session', () => {
    it('returns 201 when starting a session', async () => {
      mockPetService.getConfig.mockResolvedValue({ id: 'config-1' });
      mockPetService.startSession.mockResolvedValue({ sessionId: 'session-1' });

      const { POST } = await import('@/app/api/pet/session/route');
      const res = await POST(mockRequest('POST', '/api/pet/session', { action: 'start' }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.sessionId).toBe('session-1');
    });

    it('creates config if none exists when starting session', async () => {
      mockPetService.getConfig.mockResolvedValue(null);
      mockPetService.getOrCreateConfig.mockResolvedValue({ id: 'new-config' });
      mockPetService.startSession.mockResolvedValue({ sessionId: 'session-1' });

      const { POST } = await import('@/app/api/pet/session/route');
      const res = await POST(mockRequest('POST', '/api/pet/session', { action: 'start' }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(201);
      expect(body.data.sessionId).toBe('session-1');
      expect(mockPetService.getOrCreateConfig).toHaveBeenCalled();
    });

    it('returns success when updating a session', async () => {
      const { POST } = await import('@/app/api/pet/session/route');
      const res = await POST(mockRequest('POST', '/api/pet/session', {
        action: 'update', sessionId: 'session-1', interactionCount: 5,
      }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.data.updated).toBe(true);
    });

    it('returns success when ending a session', async () => {
      const { POST } = await import('@/app/api/pet/session/route');
      const res = await POST(mockRequest('POST', '/api/pet/session', {
        action: 'end', sessionId: 'session-1',
      }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.data.ended).toBe(true);
    });

    it('returns 400 for invalid action', async () => {
      const { POST } = await import('@/app/api/pet/session/route');
      const res = await POST(mockRequest('POST', '/api/pet/session', { action: 'invalid' }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(400);
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // GET /api/pet/export
  // ═══════════════════════════════════════════════════════════════
  describe('GET /api/pet/export', () => {
    it('returns export shape with all required fields', async () => {
      mockPetService.exportConfig.mockResolvedValue({
        version: 1,
        petName: '星尘',
        personality: '温柔',
        backstory: '',
        animationModel: 'live2d',
        idleTimeout: 300,
        wanderInterval: 15.0,
        params: [],
        bodyParams: [],
        equippedParts: [],
        materialOverrides: {},
        mappedAssets: [],
      });

      const { GET } = await import('@/app/api/pet/export/route');
      const res = await GET(mockRequest('GET', '/api/pet/export'));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.version).toBe(1);
      expect(body.data.petName).toBe('星尘');
      expect(body.data.animationModel).toBe('live2d');
      expect(Array.isArray(body.data.params)).toBe(true);
      expect(Array.isArray(body.data.mappedAssets)).toBe(true);
    });

    it('returns 404 when config not found', async () => {
      const { NotFoundError } = await import('@/lib/errors');
      mockPetService.exportConfig.mockRejectedValue(new NotFoundError('PetConfig', 'user-1'));

      const { GET } = await import('@/app/api/pet/export/route');
      const res = await GET(mockRequest('GET', '/api/pet/export'));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(404);
      expect(body.code).toBe('NOT_FOUND');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // POST /api/pet/set-avatar
  // ═══════════════════════════════════════════════════════════════
  describe('POST /api/pet/set-avatar', () => {
    it('returns 400 when avatarId missing', async () => {
      const { POST } = await import('@/app/api/pet/set-avatar/route');
      const res = await POST(mockRequest('POST', '/api/pet/set-avatar', {}));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('returns config on successful link', async () => {
      mockPetService.setAvatarAsPet.mockResolvedValue({
        id: 'config-1', avatar_id: 'avatar-1', pet_name: '测试形象',
      });

      const { POST } = await import('@/app/api/pet/set-avatar/route');
      const res = await POST(mockRequest('POST', '/api/pet/set-avatar', { avatarId: 'avatar-1' }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.avatar_id).toBe('avatar-1');
      expect(body.data.pet_name).toBe('测试形象');
    });

    it('returns 404 when avatar does not exist', async () => {
      const { NotFoundError } = await import('@/lib/errors');
      mockPetService.setAvatarAsPet.mockRejectedValue(new NotFoundError('Avatar', 'bad-id'));

      const { POST } = await import('@/app/api/pet/set-avatar/route');
      const res = await POST(mockRequest('POST', '/api/pet/set-avatar', { avatarId: 'bad-id' }));
      const { status, body } = await parseResponse(res);

      expect(status).toBe(404);
      expect(body.code).toBe('NOT_FOUND');
    });
  });
});
