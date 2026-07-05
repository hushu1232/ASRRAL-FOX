import type { NextRequest } from 'next/server';

export {};

const mockPetService = {
  exportConfig: jest.fn(),
};

const mockPetSyncStatusService = {
  reportConfigPull: jest.fn(),
};

jest.mock('@/lib/services/petService', () => ({ petService: mockPetService }));
jest.mock('@/lib/services/petSyncStatusService', () => ({
  petSyncStatusService: mockPetSyncStatusService,
}));
jest.mock('@/lib/logger', () => ({ createLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }) }));

const testUser = { sub: 'user-1', email: 'test@example.com', role: 'user', workspaceId: 'ws-1' };

jest.mock('@/lib/auth/middleware', () => ({
  withAuth: jest.fn((handler: Function) => {
    return async (req: Request, ctx?: unknown) => {
      if (!req.headers.get('authorization')) {
        return new Response(JSON.stringify({ success: false, error: 'Missing authorization header' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        });
      }
      return handler(req, testUser, ctx);
    };
  }),
}));

function mockRequest(method: string, url: string, body?: unknown, auth = true): NextRequest {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (auth) headers.set('authorization', 'Bearer test-token');

  return new Request(`http://localhost${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as NextRequest;
}

async function parseResponse(res: Response) {
  return { status: res.status, body: await res.json() };
}

describe('POST /api/pet/sync contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts desktop sync metadata and returns exported config', async () => {
    mockPetService.exportConfig.mockResolvedValue({
      version: 1,
      petName: 'Desktop Pet',
      personality: 'friendly',
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
    mockPetSyncStatusService.reportConfigPull.mockResolvedValue({
      desktopConnection: 'online',
      packageState: 'pulled',
      summaryKind: 'localConfirmationRequired',
      primaryAction: 'confirmInDesktop',
      isUpToDate: false,
      webConfigVersion: 1,
      desktopKnownVersion: 1,
      desktopAppliedVersion: null,
      requiresLocalConfirmation: true,
      lastSyncAt: '2026-06-23T00:00:00.000Z',
      lastAppliedAt: null,
      lastError: null,
      errorMessage: null,
      milestones: [],
    });

    const { POST } = await import('@/app/api/pet/sync/route');
    const syncBody = {
      clientVersion: 'desktop-webbridge',
      lastSyncAt: new Date('2026-06-23T00:00:00.000Z').toISOString(),
      capabilities: ['config', 'assets', 'avatar'],
    };
    const res = await POST(mockRequest('POST', '/api/pet/sync', syncBody));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(expect.objectContaining({
      version: 1,
      petName: 'Desktop Pet',
      animationModel: 'live2d',
      mappedAssets: [],
    }));
    expect(mockPetService.exportConfig).toHaveBeenCalledWith('user-1', 'ws-1');
    expect(mockPetSyncStatusService.reportConfigPull).toHaveBeenCalledWith(
      'user-1',
      'ws-1',
      syncBody,
      1,
    );
  });

  it('rejects explicit null body without exporting or persisting', async () => {
    const { POST } = await import('@/app/api/pet/sync/route');
    const res = await POST(mockRequest('POST', '/api/pet/sync', null));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(mockPetService.exportConfig).not.toHaveBeenCalled();
    expect(mockPetSyncStatusService.reportConfigPull).not.toHaveBeenCalled();
  });

  it('returns 401 without auth header', async () => {
    const { POST } = await import('@/app/api/pet/sync/route');
    const res = await POST(mockRequest('POST', '/api/pet/sync', {
      clientVersion: 'desktop-webbridge',
    }, false));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(401);
    expect(body.success).toBe(false);
    expect(mockPetService.exportConfig).not.toHaveBeenCalled();
    expect(mockPetSyncStatusService.reportConfigPull).not.toHaveBeenCalled();
  });
});
