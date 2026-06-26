import {
  createWebBridgePreflightConfig,
  runWebBridgePreflight,
  type WebBridgePreflightFetch,
} from '../../scripts/check-webbridge-ready';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('webbridge preflight', () => {
  it('uses local defaults that match the seeded demo account', () => {
    const config = createWebBridgePreflightConfig({});

    expect(config.baseUrl).toBe('http://localhost:3000');
    expect(config.email).toBe('demo@example.com');
    expect(config.password).toBe('demo1234');
    expect(config.syncPayload).toEqual({
      clientVersion: 'desktop-webbridge-preflight',
      capabilities: ['config', 'assets', 'avatar'],
    });
  });

  it('checks health, auth, refresh, and pet WebBridge endpoints with bearer auth', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: WebBridgePreflightFetch = async (url, init) => {
      requests.push({ url: String(url), init });

      if (String(url).endsWith('/api/health')) {
        return jsonResponse({ status: 'ok' });
      }
      if (String(url).endsWith('/api/auth/login')) {
        return new Response(JSON.stringify({ success: true, data: { accessToken: 'access-token' } }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'set-cookie': 'refreshToken=refresh-token; Path=/; HttpOnly',
          },
        });
      }
      if (String(url).endsWith('/api/auth/refresh')) {
        expect(init?.headers).toEqual(expect.objectContaining({
          cookie: 'refreshToken=refresh-token',
        }));
        return jsonResponse({ success: true, data: { accessToken: 'refreshed-token' } });
      }
      if (String(url).endsWith('/api/pet/config')) {
        return jsonResponse({ success: true, data: { id: 'pet-config-1', pet_name: 'Pet' } });
      }
      if (String(url).endsWith('/api/pet/sync')) {
        return jsonResponse({
          success: true,
          data: {
            version: 1,
            petName: 'Pet',
            animationModel: 'live2d',
            mappedAssets: [],
          },
        });
      }
      if (String(url).endsWith('/api/pet/export')) {
        return jsonResponse({
          success: true,
          data: {
            version: 1,
            petName: 'Pet',
            animationModel: 'live2d',
            params: [],
            bodyParams: [],
            equippedParts: [],
            mappedAssets: [],
          },
        });
      }
      if (String(url).endsWith('/api/webbridge/packages/current-pet-character-bundle/manifest')) {
        expect(init?.headers).toEqual(expect.objectContaining({
          authorization: 'Bearer refreshed-token',
        }));
        return jsonResponse({
          success: true,
          data: {
            packageId: 'current-pet-character-bundle',
            packageType: 'characterBundle',
            files: [{ id: 'character-card', sha256: 'hash' }],
            activationPolicy: {
              autoApply: false,
              requiresLocalConfirmation: true,
            },
          },
        });
      }

      return jsonResponse({ success: false }, 404);
    };

    const result = await runWebBridgePreflight(createWebBridgePreflightConfig({}), fetchImpl);

    expect(result.ok).toBe(true);
    expect(result.checks.map((check) => check.name)).toEqual([
      'health',
      'login',
      'refresh',
      'pet config',
      'pet sync',
      'pet export',
      'package manifest',
    ]);
    expect(requests.map((request) => request.url)).toEqual([
      'http://localhost:3000/api/health',
      'http://localhost:3000/api/auth/login',
      'http://localhost:3000/api/auth/refresh',
      'http://localhost:3000/api/pet/config',
      'http://localhost:3000/api/pet/sync',
      'http://localhost:3000/api/pet/export',
      'http://localhost:3000/api/webbridge/packages/current-pet-character-bundle/manifest',
    ]);
    expect(requests[3].init?.headers).toEqual(expect.objectContaining({
      authorization: 'Bearer refreshed-token',
    }));
    expect(requests[4].init?.method).toBe('POST');
    expect(JSON.parse(String(requests[4].init?.body))).toEqual({
      clientVersion: 'desktop-webbridge-preflight',
      capabilities: ['config', 'assets', 'avatar'],
    });
  });
});
