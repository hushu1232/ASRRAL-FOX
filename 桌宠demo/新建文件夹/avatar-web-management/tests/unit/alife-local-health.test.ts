import {
  getAlifeLocalHealth,
  isLoopbackBaseUrl,
  type AlifeLocalHealthView,
} from '@/lib/alife/local-health';

const enabledEnv = {
  FOXD_ALIFE_LOCAL_HEALTH_ENABLED: 'true',
  FOXD_ALIFE_LOCAL_HEALTH_BASE_URL: 'http://127.0.0.1:8787',
  FOXD_ALIFE_LOCAL_HEALTH_TOKEN: 'local-health-token',
  FOXD_ALIFE_LOCAL_HEALTH_TIMEOUT_MS: '1500',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function healthResponse(overrides?: Record<string, unknown>) {
  return {
    status: 'healthy',
    service: 'Alife',
    version: 'local',
    timestampUtc: '2026-07-05T00:00:00.000Z',
    ...overrides,
  };
}

function statusResponse(overrides?: Record<string, unknown>) {
  return {
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
    timestampUtc: '2026-07-05T00:00:01.000Z',
    ...overrides,
  };
}

describe('Alife local health adapter', () => {
  it('is disabled by default and does not fetch', async () => {
    const fetchImpl = jest.fn();

    const view = await getAlifeLocalHealth({ env: {}, fetch: fetchImpl });

    expect(view).toEqual({
      state: 'notConfigured',
      configured: false,
      checkedAt: expect.any(String),
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('requires an explicit loopback HTTP base URL before fetching', async () => {
    const fetchImpl = jest.fn();

    expect(isLoopbackBaseUrl('http://127.0.0.1:8787')).toBe(true);
    expect(isLoopbackBaseUrl('http://localhost:8787')).toBe(true);
    expect(isLoopbackBaseUrl('http://[::1]:8787')).toBe(true);
    expect(isLoopbackBaseUrl('http://::1:8787')).toBe(true);
    expect(isLoopbackBaseUrl('https://localhost:8787')).toBe(false);
    expect(isLoopbackBaseUrl('http://192.168.1.50:8787')).toBe(false);

    const view = await getAlifeLocalHealth({
      env: {
        ...enabledEnv,
        FOXD_ALIFE_LOCAL_HEALTH_BASE_URL: 'https://alife.example.com',
      },
      fetch: fetchImpl,
    });

    expect(view).toEqual({
      state: 'error',
      configured: true,
      checkedAt: expect.any(String),
      reason: 'baseUrlMustBeLoopback',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('requires a token when enabled before fetching', async () => {
    const fetchImpl = jest.fn();

    const view = await getAlifeLocalHealth({
      env: {
        FOXD_ALIFE_LOCAL_HEALTH_ENABLED: 'true',
        FOXD_ALIFE_LOCAL_HEALTH_BASE_URL: 'http://127.0.0.1:8787',
      },
      fetch: fetchImpl,
    });

    expect(view).toEqual({
      state: 'authRequired',
      configured: true,
      checkedAt: expect.any(String),
      reason: 'tokenMissing',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('normalizes configured loopback base URLs to the local endpoint origin', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(healthResponse()))
      .mockResolvedValueOnce(jsonResponse(statusResponse()));

    const view = await getAlifeLocalHealth({
      env: {
        ...enabledEnv,
        FOXD_ALIFE_LOCAL_HEALTH_BASE_URL: 'http://localhost:8787/alife?debug=true#health',
      },
      fetch: fetchImpl,
    });

    expect(view.state).toBe('reachable');
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'http://localhost:8787/api/alife/health',
      expect.any(Object),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'http://localhost:8787/api/alife/status',
      expect.any(Object),
    );
  });

  it('returns a reachable sanitized model without owner, bot, token, or base URL details', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          healthResponse({
            token: 'health-token-leak',
            baseUrl: 'http://127.0.0.1:8787',
          }),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          statusResponse({
            ownerId: 'owner-1',
            botId: 'bot-1',
            token: 'status-token-leak',
            baseUrl: 'http://127.0.0.1:8787',
          }),
        ),
      );

    const view = await getAlifeLocalHealth({ env: enabledEnv, fetch: fetchImpl });

    expect(view).toEqual<AlifeLocalHealthView>({
      state: 'reachable',
      configured: true,
      checkedAt: expect.any(String),
      health: {
        status: 'healthy',
        service: 'Alife',
        version: 'local',
        timestampUtc: '2026-07-05T00:00:00.000Z',
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
        timestampUtc: '2026-07-05T00:00:01.000Z',
      },
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:8787/api/alife/health',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        headers: { Authorization: 'Bearer local-health-token' },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:8787/api/alife/status',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        headers: { Authorization: 'Bearer local-health-token' },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(JSON.stringify(view)).not.toContain('owner-1');
    expect(JSON.stringify(view)).not.toContain('bot-1');
    expect(JSON.stringify(view)).not.toContain('health-token-leak');
    expect(JSON.stringify(view)).not.toContain('status-token-leak');
    expect(JSON.stringify(view)).not.toContain('local-health-token');
    expect(JSON.stringify(view)).not.toContain('127.0.0.1');
  });

  it.each([401, 403])('maps HTTP %s to authRequired without leaking the token', async (status) => {
    const fetchImpl = jest.fn().mockResolvedValueOnce(jsonResponse({ error: 'nope' }, status));

    const view = await getAlifeLocalHealth({ env: enabledEnv, fetch: fetchImpl });

    expect(view).toEqual({
      state: 'authRequired',
      configured: true,
      checkedAt: expect.any(String),
      reason: `http_${status}`,
    });
    expect(JSON.stringify(view)).not.toContain('local-health-token');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('maps thrown fetch errors to unreachable requestFailed', async () => {
    const fetchImpl = jest.fn().mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const view = await getAlifeLocalHealth({ env: enabledEnv, fetch: fetchImpl });

    expect(view).toEqual({
      state: 'unreachable',
      configured: true,
      checkedAt: expect.any(String),
      reason: 'requestFailed',
    });
  });

  it('maps invalid JSON to invalidResponse', async () => {
    const fetchImpl = jest.fn().mockResolvedValueOnce(new Response('{not-json', { status: 200 }));

    const view = await getAlifeLocalHealth({ env: enabledEnv, fetch: fetchImpl });

    expect(view).toEqual({
      state: 'invalidResponse',
      configured: true,
      checkedAt: expect.any(String),
      reason: 'invalidJson',
    });
  });

  it('keeps the timeout active while parsing the response body', async () => {
    jest.useFakeTimers();

    try {
      let bodyReadStarted = false;
      const fetchImpl = jest.fn(
        async (_url: string, init?: RequestInit) =>
          ({
            ok: true,
            status: 200,
            json: () => {
              bodyReadStarted = true;
              return new Promise((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => {
                  reject(new DOMException('Aborted', 'AbortError'));
                });
              });
            },
          }) as Response,
      );

      const viewPromise = getAlifeLocalHealth({
        env: {
          ...enabledEnv,
          FOXD_ALIFE_LOCAL_HEALTH_TIMEOUT_MS: '5',
        },
        fetch: fetchImpl,
      });

      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(bodyReadStarted).toBe(true);
      jest.advanceTimersByTime(5);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      const result = await Promise.race([viewPromise, Promise.resolve({ state: 'stillPending' })]);

      expect(result).toEqual({
        state: 'unreachable',
        configured: true,
        checkedAt: expect.any(String),
        reason: 'requestFailed',
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('maps missing required fields to invalidResponse', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(healthResponse()))
      .mockResolvedValueOnce(jsonResponse(statusResponse({ agent: undefined })));

    const view = await getAlifeLocalHealth({ env: enabledEnv, fetch: fetchImpl });

    expect(view).toEqual({
      state: 'invalidResponse',
      configured: true,
      checkedAt: expect.any(String),
      reason: 'missingRequiredFields',
    });
  });

  it('maps non-auth HTTP failures to error with an http status reason', async () => {
    const fetchImpl = jest.fn().mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 503));

    const view = await getAlifeLocalHealth({ env: enabledEnv, fetch: fetchImpl });

    expect(view).toEqual({
      state: 'error',
      configured: true,
      checkedAt: expect.any(String),
      reason: 'http_503',
    });
  });
});
