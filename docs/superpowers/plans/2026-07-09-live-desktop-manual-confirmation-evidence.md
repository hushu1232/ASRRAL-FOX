# Live Desktop Manual Confirmation Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in FOXD evidence command that waits for an already-running Alife desktop process to stage a WebBridge package, asks the user to confirm inside Alife desktop, and observes the applied Web status without calling any local apply path itself.

**Architecture:** Keep this as a Node/TypeScript evidence runner under the existing local standalone server harness. The runner logs in to FOXD, writes a unique pet config marker to publish a package revision, probes the already-running Alife local management API for reachability, waits for FOXD sync status to reach `staged/localConfirmationRequired/confirmInDesktop`, blocks for manual desktop confirmation, then waits for `applied/upToDate/none/requiresLocalConfirmation=false`. It must not add browser UI, Web apply routes, shell execution from frontend code, or C# `ApplyPackage(...)` calls.

**Tech Stack:** Next.js app test harness, TypeScript scripts with `tsx`, Jest unit/static tests, existing FOXD WebBridge and local server conventions.

---

## Scope Check

This plan implements one subsystem: FOXD-side live desktop manual confirmation evidence. It does not modify `D:\Alife`, add Alife UI, or implement asset sync. If the current Alife desktop cannot stage or confirm the package, the manual run should fail truthfully with a timeout instead of simulating confirmation.

## File Structure

- Create `桌宠demo/新建文件夹/avatar-web-management/scripts/check-webbridge-live-desktop-confirmation.ts`
  - Owns config parsing, opt-in validation, FOXD auth/config update, Alife health probe, WebBridge status polling, manual prompt, and stable evidence output.
- Modify `桌宠demo/新建文件夹/avatar-web-management/scripts/test-integration-local.ts`
  - Adds `webbridge-live-desktop-confirmation` as a local server mode and enforces `ALIFE_LIVE_DESKTOP_CONFIRMATION=true` before the local server starts.
- Modify `桌宠demo/新建文件夹/avatar-web-management/package.json`
  - Adds `check:webbridge:live-desktop-confirmation`.
- Create `桌宠demo/新建文件夹/avatar-web-management/tests/unit/check-webbridge-live-desktop-confirmation.test.ts`
  - Unit tests runner config, opt-in guardrails, local health behavior, status polling behavior, evidence output, and no-apply invariants.
- Modify `桌宠demo/新建文件夹/avatar-web-management/tests/unit/test-integration-local.test.ts`
  - Tests local server mode routing and precondition rejection.
- Modify `桌宠demo/新建文件夹/avatar-web-management/tests/unit/package-scripts.test.ts`
  - Tests package script exposure.
- Create `桌宠demo/新建文件夹/avatar-web-management/tests/unit/live-desktop-confirmation-guardrails.test.ts`
  - Static guardrails proving no frontend direct loopback calls, no frontend shell execution, no Web apply route, and no C# active-apply project reuse.
- Modify `docs/webbridge-alife-local-integration.md`
  - Documents the new opt-in manual run and its honest failure modes.
- Modify `docs/2026-07-03-alife-webbridge-protocol-status.md`
  - Updates protocol matrix and open gaps after implementation.
- Modify `docs/project-status-2026-07-03.md`
  - Records the new command as planned/implemented evidence depending on verification result.

---

### Task 1: Package Script And Local Server Mode

**Files:**
- Modify: `桌宠demo/新建文件夹/avatar-web-management/package.json`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/scripts/test-integration-local.ts`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/tests/unit/package-scripts.test.ts`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/tests/unit/test-integration-local.test.ts`

- [ ] **Step 1: Write the failing package script test**

Add this test to `tests/unit/package-scripts.test.ts` after the active-apply script test:

```ts
  it('exposes an opt-in live desktop manual confirmation evidence check', () => {
    const pkg = readPackageJson();

    expect(pkg.scripts['check:webbridge:live-desktop-confirmation']).toBe(
      'tsx scripts/test-integration-local.ts webbridge-live-desktop-confirmation',
    );
  });
```

- [ ] **Step 2: Write the failing local runner tests**

Add these tests to `tests/unit/test-integration-local.test.ts` after the active-apply mode tests:

```ts
  it('supports opt-in live desktop manual confirmation checks against the local standalone server', () => {
    const config = createLocalServerRunConfig('webbridge-live-desktop-confirmation');

    expect(config.test.command).toContain('tsx');
    expect(config.test.args).toEqual(['scripts/check-webbridge-live-desktop-confirmation.ts']);
  });

  it('requires live desktop confirmation opt-in before starting the local server', () => {
    expect(getLocalServerModePreconditionError('webbridge-live-desktop-confirmation', {})).toBe(
      'ALIFE_LIVE_DESKTOP_CONFIRMATION must be set to true before live desktop confirmation evidence can run.',
    );
    expect(
      getLocalServerModePreconditionError('webbridge-live-desktop-confirmation', {
        ALIFE_LIVE_DESKTOP_CONFIRMATION: 'true',
      }),
    ).toBeNull();
  });

  it('rejects direct live desktop confirmation local runs without spawning the server', async () => {
    const previousOptIn = process.env.ALIFE_LIVE_DESKTOP_CONFIRMATION;

    delete process.env.ALIFE_LIVE_DESKTOP_CONFIRMATION;

    try {
      const config = createLocalServerRunConfig('webbridge-live-desktop-confirmation');

      await expect(runWithLocalServer(config)).rejects.toThrow(
        'ALIFE_LIVE_DESKTOP_CONFIRMATION must be set to true before live desktop confirmation evidence can run.',
      );
      expect(spawnMock).not.toHaveBeenCalled();
    } finally {
      if (previousOptIn === undefined) {
        delete process.env.ALIFE_LIVE_DESKTOP_CONFIRMATION;
      } else {
        process.env.ALIFE_LIVE_DESKTOP_CONFIRMATION = previousOptIn;
      }
    }
  });
```

- [ ] **Step 3: Run focused tests and verify failure**

Run from `桌宠demo/新建文件夹/avatar-web-management`:

```powershell
npm run test -- --runInBand tests/unit/package-scripts.test.ts tests/unit/test-integration-local.test.ts
```

Expected: FAIL. Jest should report the missing package script and the unsupported `webbridge-live-desktop-confirmation` mode.

- [ ] **Step 4: Add the package script**

In `package.json`, add this script next to the other WebBridge checks:

```json
"check:webbridge:live-desktop-confirmation": "tsx scripts/test-integration-local.ts webbridge-live-desktop-confirmation"
```

- [ ] **Step 5: Add local server mode support**

In `scripts/test-integration-local.ts`, update `LocalServerMode`:

```ts
export type LocalServerMode =
  | 'integration'
  | 'contracts-live'
  | 'e2e'
  | 'e2e-api'
  | 'webbridge'
  | 'webbridge-smoke'
  | 'webbridge-active-apply'
  | 'webbridge-live-desktop-confirmation';
```

Add the precondition constant near `ACTIVE_APPLY_EVIDENCE_OPT_IN_ERROR`:

```ts
const LIVE_DESKTOP_CONFIRMATION_OPT_IN_ERROR =
  'ALIFE_LIVE_DESKTOP_CONFIRMATION must be set to true before live desktop confirmation evidence can run.';
```

Add the switch case to `createTestCommand`:

```ts
    case 'webbridge-live-desktop-confirmation':
      return {
        command: resolvePackageFile('tsx', 'dist/cli.mjs'),
        args: ['scripts/check-webbridge-live-desktop-confirmation.ts', ...extraArgs],
        cwd: rootDir,
        env: process.env,
      };
```

Update `getLocalServerModePreconditionError`:

```ts
  if (
    mode === 'webbridge-live-desktop-confirmation' &&
    env.ALIFE_LIVE_DESKTOP_CONFIRMATION !== 'true'
  ) {
    return LIVE_DESKTOP_CONFIRMATION_OPT_IN_ERROR;
  }
```

Update `parseMode` so the raw mode is accepted:

```ts
    raw === 'webbridge-active-apply' ||
    raw === 'webbridge-live-desktop-confirmation'
```

- [ ] **Step 6: Run focused tests and verify pass**

Run:

```powershell
npm run test -- --runInBand tests/unit/package-scripts.test.ts tests/unit/test-integration-local.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit task 1**

```powershell
git add package.json scripts/test-integration-local.ts tests/unit/package-scripts.test.ts tests/unit/test-integration-local.test.ts
git commit -m "test: route live desktop confirmation evidence"
```

---

### Task 2: Runner Config And Opt-In Validation

**Files:**
- Create: `桌宠demo/新建文件夹/avatar-web-management/scripts/check-webbridge-live-desktop-confirmation.ts`
- Create: `桌宠demo/新建文件夹/avatar-web-management/tests/unit/check-webbridge-live-desktop-confirmation.test.ts`

- [ ] **Step 1: Write failing config tests**

Create `tests/unit/check-webbridge-live-desktop-confirmation.test.ts` with:

```ts
import {
  createLiveDesktopConfirmationConfig,
  validateLiveDesktopConfirmationConfig,
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
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npm run test -- --runInBand tests/unit/check-webbridge-live-desktop-confirmation.test.ts
```

Expected: FAIL with module not found for `scripts/check-webbridge-live-desktop-confirmation`.

- [ ] **Step 3: Create the runner config module**

Create `scripts/check-webbridge-live-desktop-confirmation.ts` with the config and validation exports first:

```ts
export type LiveDesktopConfirmationConfig = {
  baseUrl: string;
  email: string;
  password: string;
  dotnetExe: string | null;
  alifeRoot: string | null;
  localHealthBaseUrl: string;
  localHealthToken: string | null;
  evidenceEnabled: boolean;
  timeoutMs: number;
  pollMs: number;
};

type ValidLiveDesktopConfirmationConfig = LiveDesktopConfirmationConfig & {
  dotnetExe: string;
  alifeRoot: string;
  localHealthToken: string;
};

export type LiveDesktopConfirmationFetch = (
  url: string,
  init?: RequestInit,
) => Promise<Response>;

export type ConsoleLike = Pick<typeof console, 'log' | 'error'>;

const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_LOCAL_HEALTH_BASE_URL = 'http://127.0.0.1:8787';
const DEFAULT_TIMEOUT_MS = 300_000;
const DEFAULT_POLL_MS = 2_000;

function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  return (value || fallback).replace(/\/+$/, '');
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function createLiveDesktopConfirmationConfig(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): LiveDesktopConfirmationConfig {
  return {
    baseUrl: normalizeBaseUrl(
      env.WEBBRIDGE_BASE_URL || env.TEST_BASE_URL || `http://localhost:${env.PORT || '3000'}`,
      DEFAULT_BASE_URL,
    ),
    email: env.WEBBRIDGE_EMAIL || 'demo@example.com',
    password: env.WEBBRIDGE_PASSWORD || 'demo1234',
    dotnetExe: env.DOTNET_EXE || null,
    alifeRoot: env.ALIFE_ROOT || null,
    localHealthBaseUrl: normalizeBaseUrl(
      env.ALIFE_LOCAL_HEALTH_BASE_URL || env.FOXD_ALIFE_LOCAL_HEALTH_BASE_URL,
      DEFAULT_LOCAL_HEALTH_BASE_URL,
    ),
    localHealthToken:
      env.ALIFE_LOCAL_HEALTH_TOKEN || env.FOXD_ALIFE_LOCAL_HEALTH_TOKEN || null,
    evidenceEnabled: env.ALIFE_LIVE_DESKTOP_CONFIRMATION === 'true',
    timeoutMs: parsePositiveInteger(
      env.ALIFE_LIVE_DESKTOP_CONFIRMATION_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS,
    ),
    pollMs: parsePositiveInteger(env.ALIFE_LIVE_DESKTOP_CONFIRMATION_POLL_MS, DEFAULT_POLL_MS),
  };
}

export function validateLiveDesktopConfirmationConfig(
  config: LiveDesktopConfirmationConfig,
): ValidLiveDesktopConfirmationConfig {
  if (!config.evidenceEnabled) {
    throw new Error(
      'ALIFE_LIVE_DESKTOP_CONFIRMATION must be set to true before live desktop confirmation evidence can run.',
    );
  }

  if (!config.dotnetExe) {
    throw new Error('DOTNET_EXE is required for live desktop confirmation evidence.');
  }

  if (!config.alifeRoot) {
    throw new Error('ALIFE_ROOT is required for live desktop confirmation evidence.');
  }

  if (!config.localHealthToken) {
    throw new Error('ALIFE_LOCAL_HEALTH_TOKEN is required for live desktop confirmation evidence.');
  }

  return {
    ...config,
    dotnetExe: config.dotnetExe,
    alifeRoot: config.alifeRoot,
    localHealthToken: config.localHealthToken,
  };
}

export async function runLiveDesktopConfirmationEvidence(): Promise<void> {
  validateLiveDesktopConfirmationConfig(createLiveDesktopConfirmationConfig());
  throw new Error('Live desktop confirmation runner is not wired yet.');
}

if (require.main === module) {
  runLiveDesktopConfirmationEvidence().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 4: Run focused test and verify pass**

Run:

```powershell
npm run test -- --runInBand tests/unit/check-webbridge-live-desktop-confirmation.test.ts
```

Expected: PASS for config tests.

- [ ] **Step 5: Commit task 2**

```powershell
git add scripts/check-webbridge-live-desktop-confirmation.ts tests/unit/check-webbridge-live-desktop-confirmation.test.ts
git commit -m "test: guard live desktop confirmation config"
```

---

### Task 3: Alife Local Health Probe

**Files:**
- Modify: `桌宠demo/新建文件夹/avatar-web-management/scripts/check-webbridge-live-desktop-confirmation.ts`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/tests/unit/check-webbridge-live-desktop-confirmation.test.ts`

- [ ] **Step 1: Write failing local health tests**

Append to `tests/unit/check-webbridge-live-desktop-confirmation.test.ts`:

```ts
import { probeAlifeLocalProcess } from '../../scripts/check-webbridge-live-desktop-confirmation';

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
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npm run test -- --runInBand tests/unit/check-webbridge-live-desktop-confirmation.test.ts
```

Expected: FAIL because `probeAlifeLocalProcess` is not exported.

- [ ] **Step 3: Implement local health probe**

Add these exports to `scripts/check-webbridge-live-desktop-confirmation.ts`:

```ts
export type AlifeLocalProbeConfig = {
  baseUrl: string;
  token: string;
  timeoutMs: number;
};

export type AlifeLocalProbeResult =
  | {
      reachable: true;
      healthStatus: string;
      runtimeStatus: string;
    }
  | {
      reachable: false;
      reason: string;
    };

function endpoint(baseUrl: string, path: string): string {
  return `${baseUrl}${path}`;
}

function stringField(value: unknown, key: string): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return 'unknown';
  }

  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'string' && field.length > 0 ? field : 'unknown';
}

async function fetchJsonWithAuth(
  fetchImpl: LiveDesktopConfirmationFetch,
  url: string,
  token: string,
  timeoutMs: number,
): Promise<{ response: Response; body: unknown }> {
  const response = await fetchImpl(url, {
    method: 'GET',
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(timeoutMs),
  });

  const body = await response.json().catch(() => ({}));
  return { response, body };
}

export async function probeAlifeLocalProcess(
  config: AlifeLocalProbeConfig,
  fetchImpl: LiveDesktopConfirmationFetch = fetch,
): Promise<AlifeLocalProbeResult> {
  try {
    const healthUrl = endpoint(config.baseUrl, '/api/alife/health');
    const health = await fetchJsonWithAuth(fetchImpl, healthUrl, config.token, config.timeoutMs);
    if (!health.response.ok) {
      return {
        reachable: false,
        reason: `HTTP ${health.response.status} from ${healthUrl}`,
      };
    }

    const statusUrl = endpoint(config.baseUrl, '/api/alife/status');
    const status = await fetchJsonWithAuth(fetchImpl, statusUrl, config.token, config.timeoutMs);
    if (!status.response.ok) {
      return {
        reachable: false,
        reason: `HTTP ${status.response.status} from ${statusUrl}`,
      };
    }

    return {
      reachable: true,
      healthStatus: stringField(health.body, 'status'),
      runtimeStatus: stringField(status.body, 'status'),
    };
  } catch (error) {
    return {
      reachable: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
```

- [ ] **Step 4: Run focused test and verify pass**

Run:

```powershell
npm run test -- --runInBand tests/unit/check-webbridge-live-desktop-confirmation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit task 3**

```powershell
git add scripts/check-webbridge-live-desktop-confirmation.ts tests/unit/check-webbridge-live-desktop-confirmation.test.ts
git commit -m "feat: probe live Alife desktop health"
```

---

### Task 4: FOXD Auth, Config Marker, And Status Polling

**Files:**
- Modify: `桌宠demo/新建文件夹/avatar-web-management/scripts/check-webbridge-live-desktop-confirmation.ts`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/tests/unit/check-webbridge-live-desktop-confirmation.test.ts`

- [ ] **Step 1: Write failing FOXD auth and marker tests**

Append:

```ts
import {
  loginToFoxd,
  publishEvidencePetConfig,
  readWebBridgeStatus,
  waitForWebBridgeStatus,
} from '../../scripts/check-webbridge-live-desktop-confirmation';

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
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npm run test -- --runInBand tests/unit/check-webbridge-live-desktop-confirmation.test.ts
```

Expected: FAIL because the FOXD helper exports do not exist.

- [ ] **Step 3: Implement FOXD helpers**

Add these exports to `scripts/check-webbridge-live-desktop-confirmation.ts`:

```ts
export type WebBridgeStatus = {
  packageState: string;
  summaryKind: string;
  primaryAction: string;
  requiresLocalConfirmation?: boolean;
};

type LoginConfig = {
  baseUrl: string;
  email: string;
  password: string;
  timeoutMs: number;
};

type AuthenticatedFoxdConfig = {
  baseUrl: string;
  accessToken: string;
  timeoutMs: number;
};

type PublishConfig = AuthenticatedFoxdConfig & {
  now?: () => Date;
};

type WaitStatusConfig = AuthenticatedFoxdConfig & {
  timeoutMs: number;
  pollMs: number;
  expectedLabel: string;
  matches: (status: WebBridgeStatus) => boolean;
};

function dataObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {};
  }

  const data = (body as Record<string, unknown>).data;
  return data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {};
}

function requiredString(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Response data missing ${key}.`);
  }
  return value;
}

async function requestJson(
  fetchImpl: LiveDesktopConfirmationFetch,
  url: string,
  init: RequestInit,
): Promise<{ response: Response; body: unknown }> {
  const response = await fetchImpl(url, init);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

export async function loginToFoxd(
  config: LoginConfig,
  fetchImpl: LiveDesktopConfirmationFetch = fetch,
): Promise<string> {
  const { response, body } = await requestJson(fetchImpl, `${config.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: config.email, password: config.password }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`FOXD login failed with HTTP ${response.status}.`);
  }

  return requiredString(dataObject(body), 'accessToken');
}

function evidenceTimestamp(now: Date): string {
  return now.toISOString().replace(/\D/g, '').slice(0, 14);
}

export async function publishEvidencePetConfig(
  config: PublishConfig,
  fetchImpl: LiveDesktopConfirmationFetch = fetch,
): Promise<string> {
  const marker = `live-desktop-confirmation-${evidenceTimestamp(config.now?.() ?? new Date())}`;
  const { response } = await requestJson(fetchImpl, `${config.baseUrl}/api/pet/config`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${config.accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      petName: marker,
      characterExtra: `${marker}-character-extra`,
    }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Publishing evidence pet config failed with HTTP ${response.status}.`);
  }

  return marker;
}

export async function readWebBridgeStatus(
  config: AuthenticatedFoxdConfig,
  fetchImpl: LiveDesktopConfirmationFetch = fetch,
): Promise<WebBridgeStatus> {
  const { response, body } = await requestJson(fetchImpl, `${config.baseUrl}/api/pet/sync/status`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${config.accessToken}`,
    },
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Reading WebBridge sync status failed with HTTP ${response.status}.`);
  }

  const data = dataObject(body);
  return {
    packageState: requiredString(data, 'packageState'),
    summaryKind: requiredString(data, 'summaryKind'),
    primaryAction: requiredString(data, 'primaryAction'),
    requiresLocalConfirmation:
      typeof data.requiresLocalConfirmation === 'boolean'
        ? data.requiresLocalConfirmation
        : undefined,
  };
}

export async function waitForWebBridgeStatus(
  config: WaitStatusConfig,
  fetchImpl: LiveDesktopConfirmationFetch = fetch,
  delay: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<WebBridgeStatus> {
  const deadline = Date.now() + config.timeoutMs;
  let lastStatus: WebBridgeStatus | null = null;

  while (Date.now() <= deadline) {
    lastStatus = await readWebBridgeStatus(config, fetchImpl);
    if (lastStatus.packageState === 'failed' || lastStatus.summaryKind === 'failed') {
      throw new Error(
        `FOXD reported failed WebBridge status while waiting for ${config.expectedLabel}.`,
      );
    }
    if (config.matches(lastStatus)) {
      return lastStatus;
    }
    await delay(config.pollMs);
  }

  const lastLabel = lastStatus
    ? `${lastStatus.packageState}/${lastStatus.summaryKind}/${lastStatus.primaryAction}`
    : 'no status observed';
  throw new Error(`Timed out waiting for ${config.expectedLabel}. Last status: ${lastLabel}.`);
}
```

- [ ] **Step 4: Run focused test and verify pass**

Run:

```powershell
npm run test -- --runInBand tests/unit/check-webbridge-live-desktop-confirmation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit task 4**

```powershell
git add scripts/check-webbridge-live-desktop-confirmation.ts tests/unit/check-webbridge-live-desktop-confirmation.test.ts
git commit -m "feat: poll live desktop WebBridge status"
```

---

### Task 5: Manual Confirmation Orchestration And Evidence Output

**Files:**
- Modify: `桌宠demo/新建文件夹/avatar-web-management/scripts/check-webbridge-live-desktop-confirmation.ts`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/tests/unit/check-webbridge-live-desktop-confirmation.test.ts`

- [ ] **Step 1: Write failing orchestration test**

Append:

```ts
import { runLiveDesktopConfirmationEvidence } from '../../scripts/check-webbridge-live-desktop-confirmation';

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
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npm run test -- --runInBand tests/unit/check-webbridge-live-desktop-confirmation.test.ts
```

Expected: FAIL because `runLiveDesktopConfirmationEvidence` still throws the temporary wiring error and does not accept dependencies.

- [ ] **Step 3: Implement orchestration dependencies and manual prompt**

Update runner imports:

```ts
import { createInterface, type Interface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
```

Add dependency type and prompt helper:

```ts
export type LiveDesktopConfirmationDependencies = {
  fetch?: LiveDesktopConfirmationFetch;
  console?: ConsoleLike;
  promptForManualConfirmation?: () => Promise<void>;
  delay?: (ms: number) => Promise<void>;
  now?: () => Date;
};

async function promptForManualConfirmation(): Promise<void> {
  let reader: Interface | null = null;
  try {
    reader = createInterface({ input, output });
    await reader.question('Press Enter after confirming the package inside Alife desktop...');
  } finally {
    reader?.close();
  }
}

function isStagedConfirmationStatus(status: WebBridgeStatus): boolean {
  return (
    status.packageState === 'staged' &&
    status.summaryKind === 'localConfirmationRequired' &&
    status.primaryAction === 'confirmInDesktop'
  );
}

function isAppliedStatus(status: WebBridgeStatus): boolean {
  return (
    status.packageState === 'applied' &&
    status.summaryKind === 'upToDate' &&
    status.primaryAction === 'none' &&
    status.requiresLocalConfirmation === false
  );
}
```

Replace `runLiveDesktopConfirmationEvidence` with:

```ts
export async function runLiveDesktopConfirmationEvidence(
  config = createLiveDesktopConfirmationConfig(),
  dependencies: LiveDesktopConfirmationDependencies = {},
): Promise<void> {
  const validConfig = validateLiveDesktopConfirmationConfig(config);
  const fetchImpl = dependencies.fetch ?? fetch;
  const logger = dependencies.console ?? console;
  const delay = dependencies.delay;
  const manualPrompt = dependencies.promptForManualConfirmation ?? promptForManualConfirmation;

  const initialProbe = await probeAlifeLocalProcess(
    {
      baseUrl: validConfig.localHealthBaseUrl,
      token: validConfig.localHealthToken,
      timeoutMs: validConfig.timeoutMs,
    },
    fetchImpl,
  );
  if (!initialProbe.reachable) {
    throw new Error(`Alife local management API unreachable before staging: ${initialProbe.reason}`);
  }

  const accessToken = await loginToFoxd(
    {
      baseUrl: validConfig.baseUrl,
      email: validConfig.email,
      password: validConfig.password,
      timeoutMs: validConfig.timeoutMs,
    },
    fetchImpl,
  );

  await publishEvidencePetConfig(
    {
      baseUrl: validConfig.baseUrl,
      accessToken,
      timeoutMs: validConfig.timeoutMs,
      now: dependencies.now,
    },
    fetchImpl,
  );

  await waitForWebBridgeStatus(
    {
      baseUrl: validConfig.baseUrl,
      accessToken,
      timeoutMs: validConfig.timeoutMs,
      pollMs: validConfig.pollMs,
      expectedLabel: 'staged/localConfirmationRequired/confirmInDesktop',
      matches: isStagedConfirmationStatus,
    },
    fetchImpl,
    delay,
  );

  logger.log('ManualActionRequired: confirm package inside the already-running Alife desktop process.');
  await manualPrompt();

  const followupProbe = await probeAlifeLocalProcess(
    {
      baseUrl: validConfig.localHealthBaseUrl,
      token: validConfig.localHealthToken,
      timeoutMs: validConfig.timeoutMs,
    },
    fetchImpl,
  );
  if (!followupProbe.reachable) {
    throw new Error(`Alife local management API unreachable after manual confirmation: ${followupProbe.reason}`);
  }

  await waitForWebBridgeStatus(
    {
      baseUrl: validConfig.baseUrl,
      accessToken,
      timeoutMs: validConfig.timeoutMs,
      pollMs: validConfig.pollMs,
      expectedLabel: 'applied/upToDate/none/requiresLocalConfirmation=false',
      matches: isAppliedStatus,
    },
    fetchImpl,
    delay,
  );

  logger.log('Live desktop confirmation evidence passed.');
  logger.log('EvidenceMode: live-desktop-manual-confirmation');
  logger.log(`AlifeRoot: ${validConfig.alifeRoot}`);
  logger.log('AlifeProcessReachable: true');
  logger.log('ManualActionRequired: confirmInDesktop');
  logger.log('WebStatusBefore: staged/localConfirmationRequired/confirmInDesktop');
  logger.log('WebStatusAfter: applied/upToDate/none/requiresLocalConfirmation=false');
  logger.log('BrowserControlUsed: false');
  logger.log('LocalApiApplyEndpointUsed: false');
  logger.log('DefaultRuntimeStorageTouched: false');
  logger.log('TouchedPath: FOXD WebBridge package pulled by already-running desktop process');
}
```

- [ ] **Step 4: Run focused test and verify pass**

Run:

```powershell
npm run test -- --runInBand tests/unit/check-webbridge-live-desktop-confirmation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit task 5**

```powershell
git add scripts/check-webbridge-live-desktop-confirmation.ts tests/unit/check-webbridge-live-desktop-confirmation.test.ts
git commit -m "feat: add live desktop confirmation evidence runner"
```

---

### Task 6: Static Guardrails

**Files:**
- Create: `桌宠demo/新建文件夹/avatar-web-management/tests/unit/live-desktop-confirmation-guardrails.test.ts`

- [ ] **Step 1: Write static guardrail tests**

Create `tests/unit/live-desktop-confirmation-guardrails.test.ts`:

```ts
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const appRoot = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(join(appRoot, relativePath), 'utf8');
}

function listSourceFiles(relativeRoot: string): string[] {
  const root = join(appRoot, relativeRoot);
  const results: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const fullPath = join(directory, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        visit(fullPath);
        continue;
      }
      if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
        results.push(fullPath);
      }
    }
  };
  visit(root);
  return results;
}

describe('live desktop confirmation guardrails', () => {
  it('does not expose a Web route that applies or confirms local packages', () => {
    const apiRoot = join(appRoot, 'src', 'app', 'api');
    const files = listSourceFiles('src/app/api');
    const forbiddenRoute = files.find((file) =>
      /[\\\/](apply|confirm)[\\\/]route\.(ts|js)$/.test(file.slice(apiRoot.length)),
    );

    expect(forbiddenRoute).toBeUndefined();
  });

  it('does not add browser-side child_process usage or direct Alife loopback calls', () => {
    const files = [
      ...listSourceFiles('src/app'),
      ...listSourceFiles('src/components'),
    ];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('child_process');
      expect(source).not.toContain('127.0.0.1:8787');
      expect(source).not.toContain('localhost:8787');
      expect(source).not.toContain('/api/alife/health');
      expect(source).not.toContain('/api/alife/status');
    }
  });

  it('keeps live desktop runner separate from active-service apply evidence', () => {
    const runner = readSource('scripts/check-webbridge-live-desktop-confirmation.ts');

    expect(runner).not.toContain('check-webbridge-active-apply');
    expect(runner).not.toContain('webbridge-active-apply-evidence');
    expect(runner).not.toContain('ApplyPackage');
    expect(runner).not.toContain('LocalApiApplyEndpointUsed: true');
    expect(runner).toContain('LocalApiApplyEndpointUsed: false');
  });

  it('does not create a live desktop C# helper that could call ApplyPackage', () => {
    expect(existsSync(join(appRoot, '..', '..', '..', 'tools', 'webbridge-live-desktop-confirmation'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run guardrail test and verify pass**

Run:

```powershell
npm run test -- --runInBand tests/unit/live-desktop-confirmation-guardrails.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit task 6**

```powershell
git add tests/unit/live-desktop-confirmation-guardrails.test.ts
git commit -m "test: guard live desktop confirmation boundaries"
```

---

### Task 7: Documentation Updates

**Files:**
- Modify: `docs/webbridge-alife-local-integration.md`
- Modify: `docs/2026-07-03-alife-webbridge-protocol-status.md`
- Modify: `docs/project-status-2026-07-03.md`

- [ ] **Step 1: Update WebBridge runbook**

In `docs/webbridge-alife-local-integration.md`, add a section after `Active WebBridge Service Apply Evidence`:

```md
## Live Desktop Manual Confirmation Evidence

The live desktop confirmation check is opt-in and manual. It is intended to prove that an already-running Alife desktop process participates in the local confirmation flow.

Run it only after Alife desktop is already running and its local management API is reachable:

```powershell
$env:ALIFE_LIVE_DESKTOP_CONFIRMATION='true'
$env:DOTNET_EXE='C:\Users\hu shu\.dotnet\dotnet.exe'
$env:ALIFE_ROOT='D:\Alife'
$env:ALIFE_LOCAL_HEALTH_TOKEN='<local-management-token>'
npm run check:webbridge:live-desktop-confirmation
```

Expected successful evidence:

```text
Live desktop confirmation evidence passed.
EvidenceMode: live-desktop-manual-confirmation
AlifeProcessReachable: true
ManualActionRequired: confirmInDesktop
WebStatusBefore: staged/localConfirmationRequired/confirmInDesktop
WebStatusAfter: applied/upToDate/none/requiresLocalConfirmation=false
BrowserControlUsed: false
LocalApiApplyEndpointUsed: false
DefaultRuntimeStorageTouched: false
```

The runner does not call `WebBridgeService.ApplyPackage(...)`. It publishes a new FOXD package revision, waits for the already-running desktop process to report `confirmInDesktop`, asks the user to confirm inside Alife desktop, then observes the applied Web status.

If the command times out before `confirmInDesktop`, that is honest evidence that the current live desktop process did not stage the package through this path. Do not replace this with active-service apply output.
```

- [ ] **Step 2: Update protocol status**

In `docs/2026-07-03-alife-webbridge-protocol-status.md`, update the protocol matrix row for live desktop confirmation or add this row if it does not exist:

```md
| Live already-running desktop confirmation | `npm run check:webbridge:live-desktop-confirmation` | Already-running Alife desktop process plus local management health | Implemented as opt-in manual evidence runner | Requires `ALIFE_LIVE_DESKTOP_CONFIRMATION=true`; runner does not apply locally; success requires manual confirmation inside Alife desktop. |
```

Update `Open Protocol Gaps` so it says live desktop confirmation has a runner, but real pass/fail depends on an already-running Alife desktop process exposing the staging and confirmation path.

- [ ] **Step 3: Update project status**

In `docs/project-status-2026-07-03.md`, add a dated note:

```md
### 2026-07-09 Live Desktop Confirmation Evidence Runner

- Added opt-in `npm run check:webbridge:live-desktop-confirmation`.
- The runner checks that an already-running Alife local management API is reachable, publishes a FOXD WebBridge package revision, waits for `staged/localConfirmationRequired/confirmInDesktop`, blocks for manual confirmation inside Alife desktop, then waits for `applied/upToDate/none/requiresLocalConfirmation=false`.
- The runner intentionally does not call `WebBridgeService.ApplyPackage(...)`, does not expose browser-side local control, and does not enable asset sync.
```

- [ ] **Step 4: Run docs grep checks**

Run from `D:\FOXD`:

```powershell
rg -n "live-desktop-manual-confirmation|check:webbridge:live-desktop-confirmation|LocalApiApplyEndpointUsed" docs
```

Expected: output includes the new spec, plan, runbook, protocol status, and project status references.

- [ ] **Step 5: Commit task 7**

```powershell
git add docs/webbridge-alife-local-integration.md docs/2026-07-03-alife-webbridge-protocol-status.md docs/project-status-2026-07-03.md
git commit -m "docs: document live desktop confirmation evidence"
```

---

### Task 8: Verification And Optional Manual Evidence Run

**Files:**
- No source files expected unless verification exposes a defect.

- [ ] **Step 1: Run focused runner tests**

Run from `桌宠demo/新建文件夹/avatar-web-management`:

```powershell
npm run test -- --runInBand tests/unit/check-webbridge-live-desktop-confirmation.test.ts tests/unit/test-integration-local.test.ts tests/unit/package-scripts.test.ts tests/unit/live-desktop-confirmation-guardrails.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full unit suite**

Run:

```powershell
npm run test -- --runInBand
```

Expected: PASS.

- [ ] **Step 3: Run contract tests**

Run:

```powershell
npm run test:contracts -- --runInBand
```

Expected: PASS.

- [ ] **Step 4: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Run production build**

Run:

```powershell
$env:JWT_SECRET='temporary-verification-secret-at-least-32-chars'
$env:DATABASE_URL='file:./dev.db'
npm run build
```

Expected: PASS.

- [ ] **Step 6: Run boundary scans**

Run:

```powershell
rg -n "child_process|127\.0\.0\.1:8787|localhost:8787|/api/alife/(health|status)" src/app src/components
rg -n "ApplyPackage|webbridge-active-apply-evidence|check-webbridge-active-apply" scripts/check-webbridge-live-desktop-confirmation.ts
```

Expected: first command has no browser-side direct local control hits. Second command has no hits except if the file name appears in a test failure message; source should not reference active-apply or `ApplyPackage`.

- [ ] **Step 7: Optional manual evidence run**

Run only after the user confirms Alife desktop is already running and provides the local management token:

```powershell
$env:ALIFE_LIVE_DESKTOP_CONFIRMATION='true'
$env:DOTNET_EXE='C:\Users\hu shu\.dotnet\dotnet.exe'
$env:ALIFE_ROOT='D:\Alife'
$env:ALIFE_LOCAL_HEALTH_TOKEN='<local-management-token>'
npm run check:webbridge:live-desktop-confirmation
```

Expected success output:

```text
Live desktop confirmation evidence passed.
EvidenceMode: live-desktop-manual-confirmation
AlifeProcessReachable: true
ManualActionRequired: confirmInDesktop
WebStatusBefore: staged/localConfirmationRequired/confirmInDesktop
WebStatusAfter: applied/upToDate/none/requiresLocalConfirmation=false
BrowserControlUsed: false
LocalApiApplyEndpointUsed: false
DefaultRuntimeStorageTouched: false
```

Acceptable truthful failure:

```text
Timed out waiting for staged/localConfirmationRequired/confirmInDesktop.
```

That failure means the already-running desktop process did not stage the package through this path during the timeout. Do not replace it with `check:webbridge:active-apply`.

- [ ] **Step 8: Commit verification fixes if needed**

If verification required fixes, commit them:

```powershell
git add <changed-files>
git commit -m "fix: stabilize live desktop confirmation evidence"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review Notes

- Spec coverage: The plan covers opt-in command, process reachability, local health as non-apply evidence, manual confirmation, applied status observation, stable evidence lines, no browser local control, no active-service apply reuse, documentation, and verification.
- Storage boundary: This implementation does not write default runtime storage from FOXD. It prints `DefaultRuntimeStorageTouched: false` because any touched local runtime path belongs to the already-running Alife process, not the FOXD runner. If future evidence requires default runtime path snapshots, write a separate spec and plan before touching that data.
- Known risk: If the current Alife desktop has no active pull/stage/confirm UI path, the optional manual evidence command will time out truthfully. That is an acceptable result and should be documented as the next Alife-side gap.
