import type { NextRequest } from 'next/server';
import type { AlifeLocalHealthView } from '@/lib/alife/local-health';

export {};

const mockGetAlifeLocalHealth = jest.fn();

jest.mock('@/lib/alife/local-health', () => ({
  getAlifeLocalHealth: mockGetAlifeLocalHealth,
}));
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

const testUser = { sub: 'user-1', email: 'test@example.com', role: 'user', workspaceId: 'ws-1' };

jest.mock('@/lib/auth/middleware', () => ({
  withAuth: jest.fn((handler: Function) => {
    return async (req: Request, ctx?: unknown) => {
      if (!req.headers.get('authorization')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing authorization header' }),
          {
            status: 401,
            headers: { 'content-type': 'application/json' },
          },
        );
      }
      return handler(req, testUser, ctx);
    };
  }),
}));

function mockRequest(method: string, url: string, auth = true): NextRequest {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (auth) headers.set('authorization', 'Bearer test-token');

  return new Request(`http://localhost${url}`, {
    method,
    headers,
  }) as unknown as NextRequest;
}

async function parseResponse(res: Response) {
  return { status: res.status, body: await res.json() };
}

describe('/api/pet/alife/local-health contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('GET returns the sanitized local health envelope', async () => {
    const localHealth: AlifeLocalHealthView = {
      state: 'reachable',
      configured: true,
      checkedAt: '2026-07-05T00:00:00.000Z',
      health: {
        status: 'healthy',
        service: 'Alife',
        version: 'local',
        timestampUtc: '2026-07-05T00:00:01.000Z',
      },
      runtime: {
        status: 'ready',
        agent: 'local',
        qchatEnabled: true,
        visionEnabled: true,
        visionStatus: 'ready',
        visionReason: 'camera ready',
        ttsEnabled: false,
        ttsStatus: 'disabled',
        ttsReason: 'not configured',
        outboxEnabled: true,
        timestampUtc: '2026-07-05T00:00:02.000Z',
      },
    };
    mockGetAlifeLocalHealth.mockResolvedValue(localHealth);

    const { GET } = await import('@/app/api/pet/alife/local-health/route');
    const res = await GET(mockRequest('GET', '/api/pet/alife/local-health'));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(body).toEqual({ success: true, data: localHealth });
    expect(JSON.stringify(body)).not.toContain('secret-token');
    expect(JSON.stringify(body)).not.toContain('127.0.0.1:8787');
    expect(mockGetAlifeLocalHealth).toHaveBeenCalledTimes(1);
  });

  it('GET returns 401 without auth and does not probe Alife', async () => {
    const { GET } = await import('@/app/api/pet/alife/local-health/route');
    const res = await GET(mockRequest('GET', '/api/pet/alife/local-health', false));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(401);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(body.success).toBe(false);
    expect(mockGetAlifeLocalHealth).not.toHaveBeenCalled();
  });

  it('GET returns no-store on adapter failures', async () => {
    mockGetAlifeLocalHealth.mockRejectedValue(new Error('local probe failed'));

    const { GET } = await import('@/app/api/pet/alife/local-health/route');
    const res = await GET(mockRequest('GET', '/api/pet/alife/local-health'));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(500);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(body.success).toBe(false);
    expect(mockGetAlifeLocalHealth).toHaveBeenCalledTimes(1);
  });
});
