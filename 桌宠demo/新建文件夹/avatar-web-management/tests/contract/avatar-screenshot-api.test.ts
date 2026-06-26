import type { NextRequest } from 'next/server';

export {};

const mockAvatarService = {
  getById: jest.fn(),
};

jest.mock('@/lib/services/avatar.service', () => ({ avatarService: mockAvatarService }));

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

  const req = new Request(`http://localhost${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as NextRequest;

  Object.defineProperty(req, 'nextUrl', {
    value: new URL(`http://localhost${url}`),
  });

  return req;
}

function params(id = 'avatar-1') {
  return { params: Promise.resolve({ id }) };
}

async function parseJsonResponse(res: Response) {
  return { status: res.status, body: await res.json() };
}

describe('Avatar screenshot API contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAvatarService.getById.mockResolvedValue({ id: 'avatar-1' });
  });

  it('queues a screenshot job for an owned avatar', async () => {
    const { POST } = await import('@/app/api/avatars/[id]/screenshot/route');

    const res = await POST(
      mockRequest('POST', '/api/avatars/avatar-1/screenshot', {
        width: 1280,
        height: 720,
        cameraPreset: 'angle',
      }),
      params()
    );
    const { status, body } = await parseJsonResponse(res);

    expect(status).toBe(202);
    expect(body.success).toBe(true);
    expect(body.data.jobId).toEqual(expect.any(String));
    expect(body.data.status).toBe('queued');
    expect(mockAvatarService.getById).toHaveBeenCalledWith('avatar-1', 'ws-1');
  });

  it('returns queued screenshot job status', async () => {
    const route = await import('@/app/api/avatars/[id]/screenshot/route');
    const queued = await route.POST(
      mockRequest('POST', '/api/avatars/avatar-1/screenshot', {
        width: 800,
        height: 600,
        cameraPreset: 'front',
      }),
      params()
    );
    const queuedBody = await queued.json();

    const res = await route.GET(
      mockRequest('GET', `/api/avatars/avatar-1/screenshot?jobId=${queuedBody.data.jobId}`),
      params()
    );
    const { status, body } = await parseJsonResponse(res);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.jobId).toBe(queuedBody.data.jobId);
    expect(body.data.status).toBe('completed');
    expect(body.data.width).toBe(800);
    expect(body.data.height).toBe(600);
  });

  it('rejects non-positive screenshot dimensions', async () => {
    const { POST } = await import('@/app/api/avatars/[id]/screenshot/route');

    const res = await POST(
      mockRequest('POST', '/api/avatars/avatar-1/screenshot', {
        width: 0,
        height: 720,
      }),
      params()
    );
    const { status, body } = await parseJsonResponse(res);

    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('requires a job id to query screenshot status', async () => {
    const { GET } = await import('@/app/api/avatars/[id]/screenshot/route');

    const res = await GET(
      mockRequest('GET', '/api/avatars/avatar-1/screenshot'),
      params()
    );
    const { status, body } = await parseJsonResponse(res);

    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });
});
