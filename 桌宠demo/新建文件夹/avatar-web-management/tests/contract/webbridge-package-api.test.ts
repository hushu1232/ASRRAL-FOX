import type { NextRequest } from 'next/server';
import {
  CHARACTER_CARD_FILE_ID,
  CURRENT_PET_PACKAGE_ID,
} from '@/lib/webbridge/package-service';

export {};

const mockPetService = {
  exportConfig: jest.fn(),
};

jest.mock('@/lib/services/petService', () => ({ petService: mockPetService }));
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

const petExport = {
  version: 1,
  petName: 'XiaYu',
  personality: 'calm',
  backstory: 'from WebBridge API tests',
  characterExtra: '',
  animationModel: 'live2d',
  idleTimeout: 300,
  wanderInterval: 15,
  params: [],
  bodyParams: [],
  equippedParts: [],
  materialOverrides: {},
  mappedAssets: [],
};

function mockRequest(method: string, url: string, auth = true): NextRequest {
  const headers = new Headers();
  if (auth) headers.set('authorization', 'Bearer test-token');

  return new Request(`http://localhost${url}`, {
    method,
    headers,
  }) as unknown as NextRequest;
}

function params(value: Record<string, string>) {
  return { params: Promise.resolve(value) };
}

async function parseJsonResponse(res: Response) {
  return { status: res.status, body: await res.json() };
}

describe('WebBridge package API contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPetService.exportConfig.mockResolvedValue(petExport);
  });

  it('returns the current pet package manifest in a success envelope', async () => {
    const { GET } = await import('@/app/api/webbridge/packages/[id]/manifest/route');
    const res = await GET(
      mockRequest('GET', `/api/webbridge/packages/${CURRENT_PET_PACKAGE_ID}/manifest`),
      params({ id: CURRENT_PET_PACKAGE_ID })
    );
    const { status, body } = await parseJsonResponse(res);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.packageId).toBe(CURRENT_PET_PACKAGE_ID);
    expect(body.data.files).toHaveLength(1);
    expect(body.data.files[0].url).toBe(
      `http://localhost/api/webbridge/packages/${CURRENT_PET_PACKAGE_ID}/files/${CHARACTER_CARD_FILE_ID}`
    );
    expect(body.data.activationPolicy.autoApply).toBe(false);
    expect(mockPetService.exportConfig).toHaveBeenCalledWith('user-1', 'ws-1');
  });

  it('returns downloadable character-card bytes', async () => {
    const { GET } = await import('@/app/api/webbridge/packages/[id]/files/[fileId]/route');
    const res = await GET(
      mockRequest('GET', `/api/webbridge/packages/${CURRENT_PET_PACKAGE_ID}/files/${CHARACTER_CARD_FILE_ID}`),
      params({ id: CURRENT_PET_PACKAGE_ID, fileId: CHARACTER_CARD_FILE_ID })
    );
    const body = JSON.parse(Buffer.from(await res.arrayBuffer()).toString('utf8'));

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(body.name).toBe('XiaYu');
  });

  it('returns 404 for unknown package ids', async () => {
    const { GET } = await import('@/app/api/webbridge/packages/[id]/manifest/route');
    const res = await GET(
      mockRequest('GET', '/api/webbridge/packages/unknown-package/manifest'),
      params({ id: 'unknown-package' })
    );
    const { status, body } = await parseJsonResponse(res);

    expect(status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.code).toBe('NOT_FOUND');
  });

  it('returns 404 for unknown file ids', async () => {
    const { GET } = await import('@/app/api/webbridge/packages/[id]/files/[fileId]/route');
    const res = await GET(
      mockRequest('GET', `/api/webbridge/packages/${CURRENT_PET_PACKAGE_ID}/files/unknown-file`),
      params({ id: CURRENT_PET_PACKAGE_ID, fileId: 'unknown-file' })
    );
    const { status, body } = await parseJsonResponse(res);

    expect(status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.code).toBe('NOT_FOUND');
  });
});
