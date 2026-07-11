import {
  createLiveDesktopConfirmationConfig,
  validateLiveDesktopConfirmationConfig,
  probeAlifeLocalProcess,
  loginToFoxd,
  publishEvidencePetConfig,
  readWebBridgeStatus,
  waitForWebBridgeStatus,
  runLiveDesktopConfirmationEvidence,
} from '../../scripts/check-webbridge-live-desktop-confirmation';

describe('check-webbridge-live-desktop-confirmation config', () => {
  it('creates config with explicit live desktop evidence fields', () => {
    const config = createLiveDesktopConfirmationConfig({
      ALIFE_LIVE_DESKTOP_CONFIRMATION: 'true',
      DOTNET_EXE: 'C:\\Users\\hu shu\\.dotnet\\dotnet.exe',
      ALIFE_ROOT: 'D:\\Alife',
      WEBBRIDGE_BASE_URL: 'http://localhost:3100/',
      ALIFE_LOCAL_HEALTH_BASE_URL: 'http://127.0.0.1:8787/',
      ALIFE_LOCAL_HEALTH_TOKEN: 'local-health-token',
      ALIFE_LIVE_DESKTOP_CONFIRMATION_TIMEOUT_MS: '120000',
      ALIFE_LIVE_DESKTOP_CONFIRMATION_POLL_MS: '100',
    });

    expect(config.evidenceEnabled).toBe(true);
    expect(config.baseUrl).toBe('http://localhost:3100');
    expect(config.dotnetExe).toBe('C:\\Users\\hu shu\\.dotnet\\dotnet.exe');
    expect(config.alifeRoot).toBe('D:\\Alife');
    expect(config.localHealthBaseUrl).toBe('http://127.0.0.1:8787');
    expect(config.localHealthToken).toBe('local-health-token');
    expect(config.timeoutMs).toBe(120000);
    expect(config.pollMs).toBe(100);
  });

  it('refuses to run unless live desktop confirmation is explicitly enabled', () => {
    const config = createLiveDesktopConfirmationConfig({
      DOTNET_EXE: 'C:\\Users\\hu shu\\.dotnet\\dotnet.exe',
      ALIFE_ROOT: 'D:\\Alife',
      ALIFE_LOCAL_HEALTH_TOKEN: 'local-health-token',
    });

    expect(() => validateLiveDesktopConfirmationConfig(config)).toThrow(
      'ALIFE_LIVE_DESKTOP_CONFIRMATION must be set to true before live desktop confirmation evidence can run.',
    );
  });

  it('requires DOTNET_EXE, ALIFE_ROOT, and local health token', () => {
    expect(() =>
      validateLiveDesktopConfirmationConfig(
        createLiveDesktopConfirmationConfig({
          ALIFE_LIVE_DESKTOP_CONFIRMATION: 'true',
          ALIFE_ROOT: 'D:\\Alife',
          ALIFE_LOCAL_HEALTH_TOKEN: 'local-health-token',
        }),
      ),
    ).toThrow('DOTNET_EXE is required for live desktop confirmation evidence.');

    expect(() =>
      validateLiveDesktopConfirmationConfig(
        createLiveDesktopConfirmationConfig({
          ALIFE_LIVE_DESKTOP_CONFIRMATION: 'true',
          DOTNET_EXE: 'C:\\Users\\hu shu\\.dotnet\\dotnet.exe',
          ALIFE_LOCAL_HEALTH_TOKEN: 'local-health-token',
        }),
      ),
    ).toThrow('ALIFE_ROOT is required for live desktop confirmation evidence.');

    expect(() =>
      validateLiveDesktopConfirmationConfig(
        createLiveDesktopConfirmationConfig({
          ALIFE_LIVE_DESKTOP_CONFIRMATION: 'true',
          DOTNET_EXE: 'C:\\Users\\hu shu\\.dotnet\\dotnet.exe',
          ALIFE_ROOT: 'D:\\Alife',
        }),
      ),
    ).toThrow('ALIFE_LOCAL_HEALTH_TOKEN is required for live desktop confirmation evidence.');
  });
});

describe('live desktop local health probe', () => {
  it('checks health and status with bearer auth', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'ok',
          service: 'AlifeManagementApiHost',
          version: 'test',
          timestampUtc: '2026-07-09T00:00:00Z',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'running',
          agent: 'Alife',
          timestampUtc: '2026-07-09T00:00:01Z',
        }),
      } as Response);

    const result = await probeAlifeLocalProcess(
      {
        baseUrl: 'http://127.0.0.1:8787',
        token: 'local-health-token',
        timeoutMs: 1000,
      },
      fetchImpl,
    );

    expect(result.reachable).toBe(true);
    expect(result.healthStatus).toBe('ok');
    expect(result.runtimeStatus).toBe('running');
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:8787/api/alife/health',
      expect.objectContaining({
        method: 'GET',
        headers: { Authorization: 'Bearer local-health-token' },
        cache: 'no-store',
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:8787/api/alife/status',
      expect.objectContaining({
        method: 'GET',
        headers: { Authorization: 'Bearer local-health-token' },
        cache: 'no-store',
      }),
    );
  });

  it('reports unreachable when health request fails', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('connection refused'));

    const result = await probeAlifeLocalProcess(
      {
        baseUrl: 'http://127.0.0.1:8787',
        token: 'local-health-token',
        timeoutMs: 1000,
      },
      fetchImpl,
    );

    expect(result).toEqual({
      reachable: false,
      reason: 'connection refused',
    });
  });

  it('reports non-200 local API responses as unreachable', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    } as Response);

    const result = await probeAlifeLocalProcess(
      {
        baseUrl: 'http://127.0.0.1:8787',
        token: 'local-health-token',
        timeoutMs: 1000,
      },
      fetchImpl,
    );

    expect(result).toEqual({
      reachable: false,
      reason: 'HTTP 401 from http://127.0.0.1:8787/api/alife/health',
    });
  });
});

describe('live desktop FOXD status helpers', () => {
  it('logs in and extracts access token from data.accessToken', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { accessToken: 'access-token' } }),
    } as Response);

    await expect(
      loginToFoxd(
        { baseUrl: 'http://localhost:3000', email: 'demo@example.com', password: 'demo1234', timeoutMs: 1000 },
        fetchImpl,
      ),
    ).resolves.toBe('access-token');

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:3000/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'demo@example.com', password: 'demo1234' }),
      }),
    );
  });

  it('publishes a unique pet config marker without touching local apply', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    } as Response);

    const marker = await publishEvidencePetConfig(
      {
        baseUrl: 'http://localhost:3000',
        accessToken: 'access-token',
        timeoutMs: 1000,
        now: () => new Date('2026-07-09T01:02:03Z'),
      },
      fetchImpl,
    );

    expect(marker).toBe('live-desktop-confirmation-20260709010203');
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:3000/api/pet/config',
      expect.objectContaining({
        method: 'PUT',
        headers: {
          authorization: 'Bearer access-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          petName: 'live-desktop-confirmation-20260709010203',
          characterExtra: 'live-desktop-confirmation-20260709010203-character-extra',
        }),
      }),
    );
  });

  it('reads staged and applied WebBridge status shapes', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          packageState: 'staged',
          summaryKind: 'localConfirmationRequired',
          primaryAction: 'confirmInDesktop',
          requiresLocalConfirmation: true,
        },
      }),
    } as Response);

    await expect(
      readWebBridgeStatus(
        { baseUrl: 'http://localhost:3000', accessToken: 'access-token', timeoutMs: 1000 },
        fetchImpl,
      ),
    ).resolves.toEqual({
      packageState: 'staged',
      summaryKind: 'localConfirmationRequired',
      primaryAction: 'confirmInDesktop',
      requiresLocalConfirmation: true,
    });
  });

  it('waits until a matching status is observed', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { packageState: 'published', summaryKind: 'pendingPull', primaryAction: 'checkAgain' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            packageState: 'staged',
            summaryKind: 'localConfirmationRequired',
            primaryAction: 'confirmInDesktop',
            requiresLocalConfirmation: true,
          },
        }),
      } as Response);

    const status = await waitForWebBridgeStatus(
      {
        baseUrl: 'http://localhost:3000',
        accessToken: 'access-token',
        timeoutMs: 1000,
        pollMs: 1,
        expectedLabel: 'staged/localConfirmationRequired/confirmInDesktop',
        matches: (candidate) =>
          candidate.packageState === 'staged' &&
          candidate.summaryKind === 'localConfirmationRequired' &&
          candidate.primaryAction === 'confirmInDesktop',
      },
      fetchImpl,
      () => Promise.resolve(),
    );

    expect(status.packageState).toBe('staged');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('live desktop confirmation orchestration', () => {
  it('probes Alife, publishes marker, waits for staged status, waits for manual confirmation, and prints evidence', async () => {
    const lines: string[] = [];
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'running' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { accessToken: 'access-token' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            packageState: 'staged',
            summaryKind: 'localConfirmationRequired',
            primaryAction: 'confirmInDesktop',
            requiresLocalConfirmation: true,
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'running' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            packageState: 'applied',
            summaryKind: 'upToDate',
            primaryAction: 'none',
            requiresLocalConfirmation: false,
          },
        }),
      } as Response);

    await runLiveDesktopConfirmationEvidence(
      createLiveDesktopConfirmationConfig({
        ALIFE_LIVE_DESKTOP_CONFIRMATION: 'true',
        DOTNET_EXE: 'C:\\Users\\hu shu\\.dotnet\\dotnet.exe',
        ALIFE_ROOT: 'D:\\Alife',
        ALIFE_LOCAL_HEALTH_TOKEN: 'local-health-token',
        ALIFE_LIVE_DESKTOP_CONFIRMATION_TIMEOUT_MS: '1000',
        ALIFE_LIVE_DESKTOP_CONFIRMATION_POLL_MS: '1',
      }),
      {
        fetch: fetchImpl,
        console: { log: (line: string) => lines.push(line), error: jest.fn() },
        promptForManualConfirmation: jest.fn().mockResolvedValue(undefined),
        delay: () => Promise.resolve(),
        now: () => new Date('2026-07-09T01:02:03Z'),
      },
    );

    expect(lines).toEqual(
      expect.arrayContaining([
        'ManualActionRequired: confirm package inside the already-running Alife desktop process.',
        'Live desktop confirmation evidence passed.',
        'EvidenceMode: live-desktop-manual-confirmation',
        'AlifeRoot: D:\\Alife',
        'AlifeProcessReachable: true',
        'ManualActionRequired: confirmInDesktop',
        'WebStatusBefore: staged/localConfirmationRequired/confirmInDesktop',
        'WebStatusAfter: applied/upToDate/none/requiresLocalConfirmation=false',
        'BrowserControlUsed: false',
        'LocalApiApplyEndpointUsed: false',
        'DefaultRuntimeStorageTouched: false',
        'TouchedPath: FOXD WebBridge package pulled by already-running desktop process',
      ]),
    );
  });
});
