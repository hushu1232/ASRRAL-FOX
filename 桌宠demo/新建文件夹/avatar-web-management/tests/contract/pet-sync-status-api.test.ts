import type { NextRequest } from 'next/server';

export {};

const mockPetSyncStatusService = {
  getStatus: jest.fn(),
  reportMilestone: jest.fn(),
};

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

const syncStatus = {
  webConfigVersion: 1771641600000,
  packageState: 'staged',
  desktopKnownVersion: 1771641600000,
  desktopAppliedVersion: null,
  requiresLocalConfirmation: true,
  lastSyncAt: '2026-06-23T00:00:00.000Z',
  lastAppliedAt: null,
  lastError: null,
  updatedAt: '2026-06-23T00:00:00.000Z',
};

function mockRequest(method: string, url: string, body?: unknown, auth = true): NextRequest {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (auth) headers.set('authorization', 'Bearer test-token');

  return new Request(`http://localhost${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as NextRequest;
}

async function parseResponse(res: Response) {
  return { status: res.status, body: await res.json() };
}

describe('/api/pet/sync/status contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET returns current desktop sync status envelope and calls getStatus with user/workspace', async () => {
    mockPetSyncStatusService.getStatus.mockResolvedValue(syncStatus);

    const { GET } = await import('@/app/api/pet/sync/status/route');
    const res = await GET(mockRequest('GET', '/api/pet/sync/status'));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual({ success: true, data: syncStatus });
    expect(mockPetSyncStatusService.getStatus).toHaveBeenCalledWith('user-1', 'ws-1');
  });

  it('POST accepts desktop milestone report envelope and calls reportMilestone with user/workspace/body', async () => {
    const milestone = {
      milestone: 'packageApplied',
      packageVersion: 1771641600000,
      reportedAt: '2026-06-23T00:00:00.000Z',
    };
    mockPetSyncStatusService.reportMilestone.mockResolvedValue({
      ...syncStatus,
      packageState: 'applied',
      desktopAppliedVersion: 1771641600000,
      requiresLocalConfirmation: false,
      lastAppliedAt: '2026-06-23T00:00:00.000Z',
    });

    const { POST } = await import('@/app/api/pet/sync/status/route');
    const res = await POST(mockRequest('POST', '/api/pet/sync/status', milestone));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(expect.objectContaining({
      packageState: 'applied',
      desktopAppliedVersion: 1771641600000,
      requiresLocalConfirmation: false,
    }));
    expect(mockPetSyncStatusService.reportMilestone).toHaveBeenCalledWith('user-1', 'ws-1', milestone);
  });

  it('GET returns 401 without auth', async () => {
    const { GET } = await import('@/app/api/pet/sync/status/route');
    const res = await GET(mockRequest('GET', '/api/pet/sync/status', undefined, false));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(401);
    expect(body.success).toBe(false);
    expect(mockPetSyncStatusService.getStatus).not.toHaveBeenCalled();
  });
});
