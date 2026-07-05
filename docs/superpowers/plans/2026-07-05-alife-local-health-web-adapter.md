# Alife Local Health Web Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a disabled-by-default, mock-tested, read-only FOXD Web adapter and dashboard panel for Alife local management health.

**Architecture:** Keep the browser away from `http://127.0.0.1:8787` and the bearer token. A server-side adapter reads `FOXD_ALIFE_LOCAL_HEALTH_*` env vars, probes Alife only when explicitly enabled, maps raw local API JSON into a sanitized view model, and exposes that model through an authenticated FOXD route. The pet dashboard renders advisory health awareness only; it never starts, stops, restarts, applies, deletes, or shells out.

**Tech Stack:** Next.js app route handlers, TypeScript, Jest contract and component tests, Ant Design, next-intl message JSON, PowerShell verification commands.

---

## Design Inputs

- Contract spec: `docs/superpowers/specs/2026-07-05-alife-local-health-contract-design.md`
- Existing WebBridge status model: `桌宠demo/新建文件夹/avatar-web-management/src/lib/webbridge/sync-status.ts`
- Existing authenticated route pattern: `桌宠demo/新建文件夹/avatar-web-management/src/app/api/pet/sync/status/route.ts`
- Existing contract test pattern: `桌宠demo/新建文件夹/avatar-web-management/tests/contract/pet-sync-status-api.test.ts`
- Existing pet dashboard surface: `桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/dashboard/pet/page.tsx`
- Existing read-only diagnostics UI pattern: `桌宠demo/新建文件夹/avatar-web-management/src/components/pet/sync/PetSyncDiagnosticsPanel.tsx`

## Boundaries

- Do not modify `D:\Alife`.
- Do not probe the live local Alife port in automated tests.
- Do not add browser-side calls to `http://127.0.0.1:8787`.
- Do not expose `FOXD_ALIFE_LOCAL_HEALTH_TOKEN` or `ALIFE_WEB_MANAGEMENT_TOKEN` to client code.
- Do not show Alife `ownerId` or `botId` in the sanitized model or UI.
- Do not add start, stop, restart, repair, apply, delete, shell, or PowerShell actions.
- Do not change Prisma schema, migrations, WebBridge protocol persistence, or Alife submodule pinning.
- Do not commit `docs/superpowers/plans/2026-07-03-foxd-next-roadmap.md`.

## File Structure

- Create: `桌宠demo/新建文件夹/avatar-web-management/src/lib/alife/local-health.ts`
  - Owns env parsing, loopback validation, local API fetches, timeout behavior, and raw-to-sanitized mapping.
- Create: `桌宠demo/新建文件夹/avatar-web-management/tests/unit/alife-local-health.test.ts`
  - Unit tests for disabled-by-default, reachable, unreachable, auth, invalid response, non-loopback config, and token redaction behavior.
- Create: `桌宠demo/新建文件夹/avatar-web-management/src/app/api/pet/alife/local-health/route.ts`
  - Authenticated `GET` route returning the sanitized view model in the existing `{ success, data }` envelope.
- Create: `桌宠demo/新建文件夹/avatar-web-management/tests/contract/alife-local-health-api.test.ts`
  - Contract tests for the authenticated route and 401 behavior.
- Create: `桌宠demo/新建文件夹/avatar-web-management/src/components/pet/sync/AlifeLocalHealthPanel.tsx`
  - Advisory read-only dashboard panel.
- Create: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/AlifeLocalHealthPanel.test.tsx`
  - Render tests for configured, not configured, unreachable, auth-required, invalid-response, and no-action boundaries.
- Create: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/AlifeLocalHealthGuardrails.test.ts`
  - Source guardrails for no direct browser loopback fetch, no client token reads, no shell/action verbs, route shape, and i18n keys.
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/dashboard/pet/page.tsx`
  - Fetches sanitized FOXD route and renders `AlifeLocalHealthPanel`.
- Modify: `桌宠demo/新建文件夹/avatar-web-management/messages/en.json`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/messages/zh-CN.json`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/messages/ja.json`
  - Adds `pet.alifeLocalHealth` labels.

## Task 1: Add The Server-Side Local Health Adapter

**Files:**

- Create: `桌宠demo/新建文件夹/avatar-web-management/tests/unit/alife-local-health.test.ts`
- Create: `桌宠demo/新建文件夹/avatar-web-management/src/lib/alife/local-health.ts`

- [ ] **Step 1: Write the failing adapter unit tests**

Create `tests/unit/alife-local-health.test.ts` with this content:

```ts
import {
  getAlifeLocalHealth,
  isLoopbackBaseUrl,
  type AlifeLocalHealthView,
} from '@/lib/alife/local-health';

type FetchMock = jest.Mock<Promise<Response>, [RequestInfo | URL, RequestInit?]>;

const enabledEnv = {
  FOXD_ALIFE_LOCAL_HEALTH_ENABLED: 'true',
  FOXD_ALIFE_LOCAL_HEALTH_BASE_URL: 'http://127.0.0.1:8787',
  FOXD_ALIFE_LOCAL_HEALTH_TOKEN: 'secret-token',
  FOXD_ALIFE_LOCAL_HEALTH_TIMEOUT_MS: '1500',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function healthBody(overrides: Record<string, unknown> = {}) {
  return {
    status: 'healthy',
    service: 'Alife',
    version: 'local',
    timestampUtc: '2026-07-05T00:00:00.000Z',
    ...overrides,
  };
}

function statusBody(overrides: Record<string, unknown> = {}) {
  return {
    status: 'healthy',
    agent: 'xiayu',
    ownerId: '3045846738',
    botId: '2905391496',
    qchatEnabled: true,
    visionEnabled: true,
    visionStatus: 'ready',
    visionReason: 'ready',
    ttsEnabled: false,
    ttsStatus: 'disabled',
    ttsReason: 'tts_disabled',
    outboxEnabled: true,
    timestampUtc: '2026-07-05T00:00:01.000Z',
    ...overrides,
  };
}

function createFetchMock(...responses: Response[]): FetchMock {
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(response);
  }
  return fetchMock;
}

describe('Alife local health adapter', () => {
  it('is disabled by default and does not fetch loopback', async () => {
    const fetchMock = createFetchMock();

    const result = await getAlifeLocalHealth({
      env: {},
      fetchImpl: fetchMock,
      now: () => '2026-07-05T00:00:00.000Z',
    });

    expect(result).toEqual<AlifeLocalHealthView>({
      state: 'notConfigured',
      configured: false,
      checkedAt: '2026-07-05T00:00:00.000Z',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires an explicit loopback URL', async () => {
    expect(isLoopbackBaseUrl('http://127.0.0.1:8787')).toBe(true);
    expect(isLoopbackBaseUrl('http://localhost:8787')).toBe(true);
    expect(isLoopbackBaseUrl('https://example.com')).toBe(false);
    expect(isLoopbackBaseUrl('http://192.168.1.20:8787')).toBe(false);

    const fetchMock = createFetchMock();

    const result = await getAlifeLocalHealth({
      env: {
        ...enabledEnv,
        FOXD_ALIFE_LOCAL_HEALTH_BASE_URL: 'https://example.com',
      },
      fetchImpl: fetchMock,
      now: () => '2026-07-05T00:00:00.000Z',
    });

    expect(result.state).toBe('error');
    expect(result.reason).toBe('baseUrlMustBeLoopback');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires a token when enabled', async () => {
    const fetchMock = createFetchMock();

    const result = await getAlifeLocalHealth({
      env: {
        FOXD_ALIFE_LOCAL_HEALTH_ENABLED: 'true',
        FOXD_ALIFE_LOCAL_HEALTH_BASE_URL: 'http://127.0.0.1:8787',
      },
      fetchImpl: fetchMock,
      now: () => '2026-07-05T00:00:00.000Z',
    });

    expect(result.state).toBe('authRequired');
    expect(result.configured).toBe(true);
    expect(result.reason).toBe('tokenMissing');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a sanitized reachable model and never includes owner, bot, token, or base URL', async () => {
    const fetchMock = createFetchMock(
      jsonResponse(healthBody()),
      jsonResponse(statusBody()),
    );

    const result = await getAlifeLocalHealth({
      env: enabledEnv,
      fetchImpl: fetchMock,
      now: () => '2026-07-05T00:00:02.000Z',
    });

    expect(result).toEqual<AlifeLocalHealthView>({
      state: 'reachable',
      configured: true,
      checkedAt: '2026-07-05T00:00:02.000Z',
      health: {
        status: 'healthy',
        service: 'Alife',
        version: 'local',
        timestampUtc: '2026-07-05T00:00:00.000Z',
      },
      runtime: {
        status: 'healthy',
        agent: 'xiayu',
        qchatEnabled: true,
        visionEnabled: true,
        visionStatus: 'ready',
        visionReason: 'ready',
        ttsEnabled: false,
        ttsStatus: 'disabled',
        ttsReason: 'tts_disabled',
        outboxEnabled: true,
        timestampUtc: '2026-07-05T00:00:01.000Z',
      },
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('3045846738');
    expect(serialized).not.toContain('2905391496');
    expect(serialized).not.toContain('secret-token');
    expect(serialized).not.toContain('127.0.0.1:8787');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8787/api/alife/health',
      expect.objectContaining({
        headers: { Authorization: 'Bearer secret-token' },
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8787/api/alife/status',
      expect.objectContaining({
        headers: { Authorization: 'Bearer secret-token' },
      }),
    );
  });

  it('maps auth rejection without leaking the token', async () => {
    const fetchMock = createFetchMock(jsonResponse({ error: 'nope' }, 401));

    const result = await getAlifeLocalHealth({
      env: enabledEnv,
      fetchImpl: fetchMock,
      now: () => '2026-07-05T00:00:00.000Z',
    });

    expect(result.state).toBe('authRequired');
    expect(JSON.stringify(result)).not.toContain('secret-token');
  });

  it('maps thrown fetch errors to unreachable', async () => {
    const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
    fetchMock.mockRejectedValueOnce(new TypeError('connect ECONNREFUSED'));

    const result = await getAlifeLocalHealth({
      env: enabledEnv,
      fetchImpl: fetchMock,
      now: () => '2026-07-05T00:00:00.000Z',
    });

    expect(result.state).toBe('unreachable');
    expect(result.reason).toBe('requestFailed');
  });

  it('maps invalid JSON and missing required fields to invalidResponse', async () => {
    const invalidJson = new Response('not json', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    const fetchMock = createFetchMock(invalidJson);

    const invalidJsonResult = await getAlifeLocalHealth({
      env: enabledEnv,
      fetchImpl: fetchMock,
      now: () => '2026-07-05T00:00:00.000Z',
    });

    expect(invalidJsonResult.state).toBe('invalidResponse');

    const missingFieldFetch = createFetchMock(jsonResponse({ status: 'healthy' }));
    const missingFieldResult = await getAlifeLocalHealth({
      env: enabledEnv,
      fetchImpl: missingFieldFetch,
      now: () => '2026-07-05T00:00:00.000Z',
    });

    expect(missingFieldResult.state).toBe('invalidResponse');
  });

  it('maps non-auth HTTP failures to error', async () => {
    const fetchMock = createFetchMock(jsonResponse({ error: 'boom' }, 500));

    const result = await getAlifeLocalHealth({
      env: enabledEnv,
      fetchImpl: fetchMock,
      now: () => '2026-07-05T00:00:00.000Z',
    });

    expect(result.state).toBe('error');
    expect(result.reason).toBe('http_500');
  });
});
```

- [ ] **Step 2: Run the focused adapter test and observe RED**

Run from `桌宠demo/新建文件夹/avatar-web-management`:

```powershell
npx jest tests/unit/alife-local-health.test.ts --runInBand
```

Expected: FAIL because `@/lib/alife/local-health` does not exist.

- [ ] **Step 3: Create the adapter implementation**

Create `src/lib/alife/local-health.ts` with this content:

```ts
export type AlifeLocalHealthState =
  | 'notConfigured'
  | 'reachable'
  | 'unreachable'
  | 'authRequired'
  | 'invalidResponse'
  | 'error';

export interface AlifeLocalHealthView {
  state: AlifeLocalHealthState;
  configured: boolean;
  checkedAt: string;
  reason?: string;
  health?: {
    status: string;
    service: string;
    version: string;
    timestampUtc: string;
  };
  runtime?: {
    status: string;
    agent: string;
    qchatEnabled: boolean;
    visionEnabled: boolean;
    visionStatus: string;
    visionReason: string;
    ttsEnabled: boolean;
    ttsStatus: string;
    ttsReason: string;
    outboxEnabled: boolean;
    timestampUtc: string;
  };
}

interface AlifeLocalHealthEnv {
  FOXD_ALIFE_LOCAL_HEALTH_ENABLED?: string;
  FOXD_ALIFE_LOCAL_HEALTH_BASE_URL?: string;
  FOXD_ALIFE_LOCAL_HEALTH_TOKEN?: string;
  FOXD_ALIFE_LOCAL_HEALTH_TIMEOUT_MS?: string;
}

interface GetAlifeLocalHealthOptions {
  env?: AlifeLocalHealthEnv;
  fetchImpl?: typeof fetch;
  now?: () => string;
}

interface AdapterConfig {
  enabled: boolean;
  baseUrl: string;
  token?: string;
  timeoutMs: number;
}

type FetchJsonResult =
  | { kind: 'ok'; body: unknown }
  | { kind: 'authRequired' }
  | { kind: 'unreachable'; reason: string }
  | { kind: 'invalidResponse'; reason: string }
  | { kind: 'error'; reason: string };

const DEFAULT_BASE_URL = 'http://127.0.0.1:8787';
const DEFAULT_TIMEOUT_MS = 1500;

export async function getAlifeLocalHealth(
  options: GetAlifeLocalHealthOptions = {},
): Promise<AlifeLocalHealthView> {
  const env = options.env ?? process.env;
  const now = options.now ?? (() => new Date().toISOString());
  const checkedAt = now();
  const config = readConfig(env);

  if (!config.enabled) {
    return {
      state: 'notConfigured',
      configured: false,
      checkedAt,
    };
  }

  if (!isLoopbackBaseUrl(config.baseUrl)) {
    return {
      state: 'error',
      configured: true,
      checkedAt,
      reason: 'baseUrlMustBeLoopback',
    };
  }

  if (!config.token) {
    return {
      state: 'authRequired',
      configured: true,
      checkedAt,
      reason: 'tokenMissing',
    };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const healthResult = await fetchJson(fetchImpl, `${config.baseUrl}/api/alife/health`, config);
  if (healthResult.kind !== 'ok') {
    return resultFromFetchFailure(healthResult, checkedAt);
  }

  const health = sanitizeHealth(healthResult.body);
  if (!health) {
    return {
      state: 'invalidResponse',
      configured: true,
      checkedAt,
      reason: 'invalidHealthShape',
    };
  }

  const statusResult = await fetchJson(fetchImpl, `${config.baseUrl}/api/alife/status`, config);
  if (statusResult.kind !== 'ok') {
    return resultFromFetchFailure(statusResult, checkedAt);
  }

  const runtime = sanitizeRuntimeStatus(statusResult.body);
  if (!runtime) {
    return {
      state: 'invalidResponse',
      configured: true,
      checkedAt,
      reason: 'invalidStatusShape',
    };
  }

  return {
    state: 'reachable',
    configured: true,
    checkedAt,
    health,
    runtime,
  };
}

export function isLoopbackBaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'http:' &&
      (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]')
    );
  } catch {
    return false;
  }
}

function readConfig(env: AlifeLocalHealthEnv): AdapterConfig {
  const enabled = env.FOXD_ALIFE_LOCAL_HEALTH_ENABLED === 'true';
  return {
    enabled,
    baseUrl: normalizeBaseUrl(env.FOXD_ALIFE_LOCAL_HEALTH_BASE_URL ?? DEFAULT_BASE_URL),
    token: normalizeOptional(env.FOXD_ALIFE_LOCAL_HEALTH_TOKEN),
    timeoutMs: normalizeTimeout(env.FOXD_ALIFE_LOCAL_HEALTH_TIMEOUT_MS),
  };
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeTimeout(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_TIMEOUT_MS;
}

async function fetchJson(
  fetchImpl: typeof fetch,
  url: string,
  config: AdapterConfig,
): Promise<FetchJsonResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${config.token}` },
      cache: 'no-store',
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      return { kind: 'authRequired' };
    }

    if (!response.ok) {
      return { kind: 'error', reason: `http_${response.status}` };
    }

    try {
      return { kind: 'ok', body: await response.json() };
    } catch {
      return { kind: 'invalidResponse', reason: 'invalidJson' };
    }
  } catch {
    return { kind: 'unreachable', reason: 'requestFailed' };
  } finally {
    clearTimeout(timeout);
  }
}

function resultFromFetchFailure(
  result: Exclude<FetchJsonResult, { kind: 'ok' }>,
  checkedAt: string,
): AlifeLocalHealthView {
  if (result.kind === 'authRequired') {
    return {
      state: 'authRequired',
      configured: true,
      checkedAt,
    };
  }

  return {
    state: result.kind,
    configured: true,
    checkedAt,
    reason: result.reason,
  };
}

function sanitizeHealth(value: unknown): AlifeLocalHealthView['health'] | null {
  if (!isRecord(value)) {
    return null;
  }

  const status = stringField(value, 'status');
  const service = stringField(value, 'service');
  const version = stringField(value, 'version');
  const timestampUtc = stringField(value, 'timestampUtc');

  if (!status || !service || !version || !timestampUtc) {
    return null;
  }

  return { status, service, version, timestampUtc };
}

function sanitizeRuntimeStatus(value: unknown): AlifeLocalHealthView['runtime'] | null {
  if (!isRecord(value)) {
    return null;
  }

  const status = stringField(value, 'status');
  const agent = stringField(value, 'agent');
  const visionStatus = stringField(value, 'visionStatus');
  const visionReason = stringField(value, 'visionReason');
  const ttsStatus = stringField(value, 'ttsStatus');
  const ttsReason = stringField(value, 'ttsReason');
  const timestampUtc = stringField(value, 'timestampUtc');
  const qchatEnabled = booleanField(value, 'qchatEnabled');
  const visionEnabled = booleanField(value, 'visionEnabled');
  const ttsEnabled = booleanField(value, 'ttsEnabled');
  const outboxEnabled = booleanField(value, 'outboxEnabled');

  if (
    !status ||
    !agent ||
    !visionStatus ||
    !visionReason ||
    !ttsStatus ||
    !ttsReason ||
    !timestampUtc ||
    qchatEnabled === null ||
    visionEnabled === null ||
    ttsEnabled === null ||
    outboxEnabled === null
  ) {
    return null;
  }

  return {
    status,
    agent,
    qchatEnabled,
    visionEnabled,
    visionStatus,
    visionReason,
    ttsEnabled,
    ttsStatus,
    ttsReason,
    outboxEnabled,
    timestampUtc,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stringField(value: Record<string, unknown>, key: string): string | null {
  const field = value[key];
  return typeof field === 'string' && field.trim() ? field : null;
}

function booleanField(value: Record<string, unknown>, key: string): boolean | null {
  const field = value[key];
  return typeof field === 'boolean' ? field : null;
}
```

- [ ] **Step 4: Run the adapter tests and observe GREEN**

Run from `桌宠demo/新建文件夹/avatar-web-management`:

```powershell
npx jest tests/unit/alife-local-health.test.ts --runInBand
```

Expected: PASS, 1 suite with all adapter unit tests passing.

- [ ] **Step 5: Commit Task 1**

Run from `D:\FOXD`:

```powershell
git add "桌宠demo/新建文件夹/avatar-web-management/tests/unit/alife-local-health.test.ts"
git add "桌宠demo/新建文件夹/avatar-web-management/src/lib/alife/local-health.ts"
git commit -m "feat: add Alife local health adapter"
```

Expected: one focused adapter commit.

## Task 2: Add The Authenticated FOXD API Route

**Files:**

- Create: `桌宠demo/新建文件夹/avatar-web-management/tests/contract/alife-local-health-api.test.ts`
- Create: `桌宠demo/新建文件夹/avatar-web-management/src/app/api/pet/alife/local-health/route.ts`

- [ ] **Step 1: Write the failing route contract test**

Create `tests/contract/alife-local-health-api.test.ts` with this content:

```ts
import type { NextRequest } from 'next/server';

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
        return new Response(JSON.stringify({ success: false, error: 'Missing authorization header' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        });
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
    const localHealth = {
      state: 'reachable',
      configured: true,
      checkedAt: '2026-07-05T00:00:02.000Z',
      health: {
        status: 'healthy',
        service: 'Alife',
        version: 'local',
        timestampUtc: '2026-07-05T00:00:00.000Z',
      },
      runtime: {
        status: 'healthy',
        agent: 'xiayu',
        qchatEnabled: true,
        visionEnabled: true,
        visionStatus: 'ready',
        visionReason: 'ready',
        ttsEnabled: false,
        ttsStatus: 'disabled',
        ttsReason: 'tts_disabled',
        outboxEnabled: true,
        timestampUtc: '2026-07-05T00:00:01.000Z',
      },
    };
    mockGetAlifeLocalHealth.mockResolvedValue(localHealth);

    const { GET } = await import('@/app/api/pet/alife/local-health/route');
    const res = await GET(mockRequest('GET', '/api/pet/alife/local-health'));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
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
    expect(body.success).toBe(false);
    expect(mockGetAlifeLocalHealth).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the route contract test and observe RED**

Run from `桌宠demo/新建文件夹/avatar-web-management`:

```powershell
npx jest tests/contract/alife-local-health-api.test.ts --runInBand
```

Expected: FAIL because `@/app/api/pet/alife/local-health/route` does not exist.

- [ ] **Step 3: Create the route**

Create `src/app/api/pet/alife/local-health/route.ts` with this content:

```ts
export const runtime = 'nodejs';

import { withAuth } from '@/lib/auth/middleware';
import { success, error } from '@/lib/api-response';
import { getAlifeLocalHealth } from '@/lib/alife/local-health';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:pet:alife-local-health');

export const GET = withAuth(async () => {
  try {
    const localHealth = await getAlifeLocalHealth();
    return success(localHealth);
  } catch (err) {
    log.error({ err }, 'Alife local health probe failed');
    return error(err);
  }
});
```

- [ ] **Step 4: Run focused route and adapter tests**

Run from `桌宠demo/新建文件夹/avatar-web-management`:

```powershell
npx jest tests/unit/alife-local-health.test.ts tests/contract/alife-local-health-api.test.ts --runInBand
```

Expected: PASS, both suites pass.

- [ ] **Step 5: Commit Task 2**

Run from `D:\FOXD`:

```powershell
git add "桌宠demo/新建文件夹/avatar-web-management/tests/contract/alife-local-health-api.test.ts"
git add "桌宠demo/新建文件夹/avatar-web-management/src/app/api/pet/alife/local-health/route.ts"
git commit -m "feat: expose Alife local health status"
```

Expected: one focused route commit.

## Task 3: Add The Dashboard Panel And Guardrails

**Files:**

- Create: `桌宠demo/新建文件夹/avatar-web-management/src/components/pet/sync/AlifeLocalHealthPanel.tsx`
- Create: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/AlifeLocalHealthPanel.test.tsx`
- Create: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/AlifeLocalHealthGuardrails.test.ts`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/dashboard/pet/page.tsx`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/messages/en.json`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/messages/zh-CN.json`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/messages/ja.json`

- [ ] **Step 1: Write the failing panel render tests**

Create `src/components/__tests__/AlifeLocalHealthPanel.test.tsx` with this content:

```tsx
/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { App } from 'antd';
import type { ReactNode } from 'react';
import AlifeLocalHealthPanel from '@/components/pet/sync/AlifeLocalHealthPanel';
import type { AlifeLocalHealthView } from '@/lib/alife/local-health';

const messages: Record<string, Record<string, string>> = {
  'pet.alifeLocalHealth': {
    title: 'Alife local health',
    source: 'Local API',
    loading: 'Checking Alife local health...',
    advisory: 'Advisory only. Web cannot start, stop, restart, or apply Alife runtime changes.',
    refresh: 'Check local health',
    notReported: 'Not reported',
    agent: 'Agent',
    version: 'Version',
    qchat: 'QChat',
    vision: 'Vision',
    tts: 'TTS',
    outbox: 'Outbox',
    lastChecked: 'Last checked',
    enabled: 'Enabled',
    disabled: 'Disabled',
    ready: 'Ready',
    notReady: 'Not ready',
    reason: 'Reason',
    'state.notConfigured': 'Not configured',
    'state.reachable': 'Reachable',
    'state.unreachable': 'Unreachable',
    'state.authRequired': 'Auth required',
    'state.invalidResponse': 'Invalid response',
    'state.error': 'Error',
    'description.notConfigured': 'Set FOXD_ALIFE_LOCAL_HEALTH_ENABLED=true to enable server-side local health probing.',
    'description.reachable': 'Alife local management API responded with sanitized health data.',
    'description.unreachable': 'FOXD could not reach the local Alife management API.',
    'description.authRequired': 'The local Alife API requires a matching bearer token.',
    'description.invalidResponse': 'The local Alife API response did not match the documented contract.',
    'description.error': 'FOXD could not read local health because of a configuration or HTTP error.',
  },
};

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => messages[namespace]?.[key] ?? key,
}));

jest.mock('@ant-design/icons', () => ({
  ApiOutlined: () => <span data-testid="icon-api" />,
  ReloadOutlined: () => <span data-testid="icon-reload" />,
}));

function Wrapper({ children }: { children: ReactNode }) {
  return <App>{children}</App>;
}

function createHealth(overrides: Partial<AlifeLocalHealthView> = {}): AlifeLocalHealthView {
  return {
    state: 'reachable',
    configured: true,
    checkedAt: '2026-07-05T00:00:02.000Z',
    health: {
      status: 'healthy',
      service: 'Alife',
      version: 'local',
      timestampUtc: '2026-07-05T00:00:00.000Z',
    },
    runtime: {
      status: 'healthy',
      agent: 'xiayu',
      qchatEnabled: true,
      visionEnabled: true,
      visionStatus: 'ready',
      visionReason: 'ready',
      ttsEnabled: false,
      ttsStatus: 'disabled',
      ttsReason: 'tts_disabled',
      outboxEnabled: true,
      timestampUtc: '2026-07-05T00:00:01.000Z',
    },
    ...overrides,
  };
}

describe('AlifeLocalHealthPanel', () => {
  it('renders reachable sanitized local health without owner, bot, token, base URL, or management actions', () => {
    const onRefresh = jest.fn();

    render(<AlifeLocalHealthPanel health={createHealth()} loading={false} onRefresh={onRefresh} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByTestId('alife-local-health-panel')).toBeDefined();
    expect(screen.getByText('Alife local health')).toBeDefined();
    expect(screen.getByText('Local API')).toBeDefined();
    expect(screen.getByText('Reachable')).toBeDefined();
    expect(screen.getByText('Alife local management API responded with sanitized health data.')).toBeDefined();
    expect(screen.getByText('Advisory only. Web cannot start, stop, restart, or apply Alife runtime changes.')).toBeDefined();
    expect(screen.getByText('Agent')).toBeDefined();
    expect(screen.getByText('xiayu')).toBeDefined();
    expect(screen.getByText('Version')).toBeDefined();
    expect(screen.getByText('local')).toBeDefined();
    expect(screen.getByText('QChat')).toBeDefined();
    expect(screen.getByText('Vision')).toBeDefined();
    expect(screen.getByText('TTS')).toBeDefined();
    expect(screen.getByText('Outbox')).toBeDefined();

    const text = document.body.textContent ?? '';
    expect(text).not.toContain('3045846738');
    expect(text).not.toContain('2905391496');
    expect(text).not.toContain('secret-token');
    expect(text).not.toContain('127.0.0.1:8787');
    expect(screen.queryByRole('button', { name: /start/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /stop/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /restart/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /apply/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Check local health' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('renders not configured without inventing local runtime values', () => {
    render(
      <AlifeLocalHealthPanel
        health={{ state: 'notConfigured', configured: false, checkedAt: '2026-07-05T00:00:02.000Z' }}
        loading={false}
        onRefresh={jest.fn()}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('Not configured')).toBeDefined();
    expect(screen.getByText('Set FOXD_ALIFE_LOCAL_HEALTH_ENABLED=true to enable server-side local health probing.')).toBeDefined();
    expect(screen.getAllByText('Not reported').length).toBeGreaterThanOrEqual(2);
  });

  it.each([
    ['unreachable', 'Unreachable', 'FOXD could not reach the local Alife management API.'],
    ['authRequired', 'Auth required', 'The local Alife API requires a matching bearer token.'],
    ['invalidResponse', 'Invalid response', 'The local Alife API response did not match the documented contract.'],
    ['error', 'Error', 'FOXD could not read local health because of a configuration or HTTP error.'],
  ] as const)('renders %s as advisory status', (state, label, description) => {
    render(
      <AlifeLocalHealthPanel
        health={{
          state,
          configured: true,
          checkedAt: '2026-07-05T00:00:02.000Z',
          reason: 'requestFailed',
        }}
        loading={false}
        onRefresh={jest.fn()}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText(label)).toBeDefined();
    expect(screen.getByText(description)).toBeDefined();
    expect(screen.getByText('Reason')).toBeDefined();
    expect(screen.getByText('requestFailed')).toBeDefined();
  });

  it('shows loading state without stale status values', () => {
    render(<AlifeLocalHealthPanel health={null} loading onRefresh={jest.fn()} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('Checking Alife local health...')).toBeDefined();
    expect(screen.queryByText('Reachable')).toBeNull();
  });
});
```

- [ ] **Step 2: Write the failing source guardrails**

Create `src/components/__tests__/AlifeLocalHealthGuardrails.test.ts` with this content:

```ts
import { readFileSync } from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Alife local health guardrails', () => {
  it('keeps local probing server-side and authenticated', () => {
    const route = readSource('src/app/api/pet/alife/local-health/route.ts');
    const adapter = readSource('src/lib/alife/local-health.ts');

    expect(route).toContain("export const runtime = 'nodejs'");
    expect(route).toContain("import { withAuth } from '@/lib/auth/middleware'");
    expect(route).toContain("import { getAlifeLocalHealth } from '@/lib/alife/local-health'");
    expect(route).toContain('export const GET = withAuth');
    expect(adapter).toContain('FOXD_ALIFE_LOCAL_HEALTH_ENABLED');
    expect(adapter).toContain('FOXD_ALIFE_LOCAL_HEALTH_TOKEN');
    expect(adapter).toContain('isLoopbackBaseUrl');
  });

  it('does not let browser components call loopback or read server tokens', () => {
    const dashboardPage = readSource('src/app/(auth)/dashboard/pet/page.tsx');
    const panel = readSource('src/components/pet/sync/AlifeLocalHealthPanel.tsx');

    expect(dashboardPage).toContain("apiGet<AlifeLocalHealthView>('/api/pet/alife/local-health')");
    expect(dashboardPage).toContain('<AlifeLocalHealthPanel');
    expect(dashboardPage).not.toContain('127.0.0.1:8787');
    expect(dashboardPage).not.toContain('FOXD_ALIFE_LOCAL_HEALTH_TOKEN');
    expect(panel).not.toContain('127.0.0.1:8787');
    expect(panel).not.toContain('FOXD_ALIFE_LOCAL_HEALTH_TOKEN');
    expect(panel).not.toContain('ALIFE_WEB_MANAGEMENT_TOKEN');
  });

  it('does not introduce browser management actions for Alife', () => {
    const panel = readSource('src/components/pet/sync/AlifeLocalHealthPanel.tsx');
    const forbidden = ['Start Alife', 'Stop Alife', 'Restart Alife', 'PowerShell', 'child_process', 'exec(', 'spawn('];

    for (const value of forbidden) {
      expect(panel).not.toContain(value);
    }
  });

  it('defines local health messages in every locale', () => {
    for (const locale of ['en', 'zh-CN', 'ja']) {
      const messages = readSource(`messages/${locale}.json`);

      expect(messages).toContain('"alifeLocalHealth"');
      expect(messages).toContain('"notConfigured"');
      expect(messages).toContain('"reachable"');
      expect(messages).toContain('"unreachable"');
      expect(messages).toContain('"authRequired"');
      expect(messages).toContain('"invalidResponse"');
    }
  });
});
```

- [ ] **Step 3: Run the panel and guardrail tests and observe RED**

Run from `桌宠demo/新建文件夹/avatar-web-management`:

```powershell
npx jest src/components/__tests__/AlifeLocalHealthPanel.test.tsx src/components/__tests__/AlifeLocalHealthGuardrails.test.ts --runInBand
```

Expected: FAIL because the panel, route, dashboard integration, and i18n keys do not exist yet.

- [ ] **Step 4: Create the dashboard panel**

Create `src/components/pet/sync/AlifeLocalHealthPanel.tsx` with this content:

```tsx
'use client';

import { ApiOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Descriptions, Space, Spin, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import MetricTile from '@/components/ui/MetricTile';
import OperationPanel from '@/components/ui/OperationPanel';
import StatusChip, { type StatusChipTone } from '@/components/ui/StatusChip';
import type { AlifeLocalHealthState, AlifeLocalHealthView } from '@/lib/alife/local-health';

const { Text } = Typography;

const STATE_TONES: Record<AlifeLocalHealthState, StatusChipTone> = {
  notConfigured: 'neutral',
  reachable: 'success',
  unreachable: 'warning',
  authRequired: 'warning',
  invalidResponse: 'error',
  error: 'error',
};

export interface AlifeLocalHealthPanelProps {
  health: AlifeLocalHealthView | null;
  loading: boolean;
  onRefresh: () => void;
}

export default function AlifeLocalHealthPanel({
  health,
  loading,
  onRefresh,
}: AlifeLocalHealthPanelProps) {
  const t = useTranslations('pet.alifeLocalHealth');

  return (
    <OperationPanel
      data-testid="alife-local-health-panel"
      title={renderTitle(t)}
      extra={
        <Button icon={<ReloadOutlined />} loading={loading} onClick={onRefresh}>
          {t('refresh')}
        </Button>
      }
    >
      {!health && loading && (
        <Space>
          <Spin />
          <Text>{t('loading')}</Text>
        </Space>
      )}

      {health && (
        <Space vertical size="middle" style={{ width: '100%' }}>
          <Space vertical size={6} style={{ width: '100%' }}>
            <Space size="small" wrap>
              <StatusChip tone={STATE_TONES[health.state]}>{t(`state.${health.state}`)}</StatusChip>
              <StatusChip tone="neutral">{t('source')}</StatusChip>
            </Space>
            <Text type="secondary">{t(`description.${health.state}`)}</Text>
            <Alert type="info" showIcon message={t('advisory')} />
          </Space>

          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(var(--ds-panel-gridMinWidth), 1fr))',
            }}
          >
            <MetricTile label={t('agent')} value={health.runtime?.agent ?? t('notReported')} />
            <MetricTile label={t('version')} value={health.health?.version ?? t('notReported')} />
            <MetricTile label={t('qchat')} value={formatEnabled(health.runtime?.qchatEnabled, t)} />
            <MetricTile label={t('outbox')} value={formatEnabled(health.runtime?.outboxEnabled, t)} />
          </div>

          <Descriptions column={1} size="small">
            <Descriptions.Item label={t('vision')}>
              {formatCapability(health.runtime?.visionEnabled, health.runtime?.visionStatus, t)}
            </Descriptions.Item>
            <Descriptions.Item label={t('tts')}>
              {formatCapability(health.runtime?.ttsEnabled, health.runtime?.ttsStatus, t)}
            </Descriptions.Item>
            <Descriptions.Item label={t('lastChecked')}>{formatDate(health.checkedAt, t)}</Descriptions.Item>
            {health.reason && (
              <Descriptions.Item label={t('reason')}>
                <Text code>{health.reason}</Text>
              </Descriptions.Item>
            )}
          </Descriptions>
        </Space>
      )}
    </OperationPanel>
  );
}

function renderTitle(t: (key: string) => string) {
  return (
    <Space size="small" wrap>
      <ApiOutlined />
      <span>{t('title')}</span>
    </Space>
  );
}

function formatEnabled(value: boolean | undefined, t: (key: string) => string) {
  if (value === undefined) {
    return t('notReported');
  }

  return (
    <StatusChip tone={value ? 'success' : 'neutral'}>
      {value ? t('enabled') : t('disabled')}
    </StatusChip>
  );
}

function formatCapability(
  enabled: boolean | undefined,
  status: string | undefined,
  t: (key: string) => string,
) {
  if (enabled === undefined) {
    return <Text type="secondary">{t('notReported')}</Text>;
  }

  return (
    <Space size="small" wrap>
      {formatEnabled(enabled, t)}
      {status && (
        <StatusChip tone={enabled && status === 'ready' ? 'success' : 'warning'}>
          {status === 'ready' ? t('ready') : status}
        </StatusChip>
      )}
    </Space>
  );
}

function formatDate(value: string, t: (key: string) => string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return t('notReported');
  }

  return date.toLocaleString();
}
```

- [ ] **Step 5: Wire the panel into the pet dashboard page**

Modify `src/app/(auth)/dashboard/pet/page.tsx`.

Add imports:

```ts
import AlifeLocalHealthPanel from '@/components/pet/sync/AlifeLocalHealthPanel';
import type { AlifeLocalHealthView } from '@/lib/alife/local-health';
```

Add state below the existing sync status state:

```ts
  const [alifeLocalHealth, setAlifeLocalHealth] = useState<AlifeLocalHealthView | null>(null);
  const [alifeLocalHealthLoading, setAlifeLocalHealthLoading] = useState(false);
```

Add this fetch function after `fetchSyncStatus`:

```ts
  const fetchAlifeLocalHealth = async () => {
    setAlifeLocalHealthLoading(true);
    try {
      const res = await apiGet<AlifeLocalHealthView>('/api/pet/alife/local-health');
      if (res.success && res.data) {
        setAlifeLocalHealth(res.data);
      }
    } finally {
      setAlifeLocalHealthLoading(false);
    }
  };
```

Replace the first mount effect with:

```ts
  useEffect(() => {
    fetchConfig().then(() => {
      fetchSyncStatus();
      fetchAlifeLocalHealth();
    });
  }, []);
```

Insert the new panel after `PetRuntimeSummary` and before `PetSyncStatusPanel`:

```tsx
        <AlifeLocalHealthPanel
          health={alifeLocalHealth}
          loading={alifeLocalHealthLoading}
          onRefresh={fetchAlifeLocalHealth}
        />
```

- [ ] **Step 6: Add locale keys**

In `messages/en.json`, add `alifeLocalHealth` under the existing `pet` object, near `syncDiagnostics` and `syncStatus`:

```json
    "alifeLocalHealth": {
      "title": "Alife local health",
      "source": "Local API",
      "loading": "Checking Alife local health...",
      "advisory": "Advisory only. Web cannot start, stop, restart, or apply Alife runtime changes.",
      "refresh": "Check local health",
      "notReported": "Not reported",
      "agent": "Agent",
      "version": "Version",
      "qchat": "QChat",
      "vision": "Vision",
      "tts": "TTS",
      "outbox": "Outbox",
      "lastChecked": "Last checked",
      "enabled": "Enabled",
      "disabled": "Disabled",
      "ready": "Ready",
      "notReady": "Not ready",
      "reason": "Reason",
      "state": {
        "notConfigured": "Not configured",
        "reachable": "Reachable",
        "unreachable": "Unreachable",
        "authRequired": "Auth required",
        "invalidResponse": "Invalid response",
        "error": "Error"
      },
      "description": {
        "notConfigured": "Set FOXD_ALIFE_LOCAL_HEALTH_ENABLED=true to enable server-side local health probing.",
        "reachable": "Alife local management API responded with sanitized health data.",
        "unreachable": "FOXD could not reach the local Alife management API.",
        "authRequired": "The local Alife API requires a matching bearer token.",
        "invalidResponse": "The local Alife API response did not match the documented contract.",
        "error": "FOXD could not read local health because of a configuration or HTTP error."
      }
    },
```

In `messages/zh-CN.json`, add:

```json
    "alifeLocalHealth": {
      "title": "Alife 本地健康",
      "source": "本地 API",
      "loading": "正在检查 Alife 本地健康...",
      "advisory": "仅作提示。Web 不能启动、停止、重启或应用 Alife 运行时变更。",
      "refresh": "检查本地健康",
      "notReported": "未上报",
      "agent": "Agent",
      "version": "版本",
      "qchat": "QChat",
      "vision": "视觉",
      "tts": "TTS",
      "outbox": "Outbox",
      "lastChecked": "检查时间",
      "enabled": "已启用",
      "disabled": "已禁用",
      "ready": "就绪",
      "notReady": "未就绪",
      "reason": "原因",
      "state": {
        "notConfigured": "未配置",
        "reachable": "可连接",
        "unreachable": "不可连接",
        "authRequired": "需要认证",
        "invalidResponse": "响应无效",
        "error": "错误"
      },
      "description": {
        "notConfigured": "设置 FOXD_ALIFE_LOCAL_HEALTH_ENABLED=true 后，才会启用服务端本地健康探测。",
        "reachable": "Alife 本地管理 API 已返回脱敏后的健康数据。",
        "unreachable": "FOXD 无法连接到本地 Alife 管理 API。",
        "authRequired": "本地 Alife API 需要匹配的 bearer token。",
        "invalidResponse": "本地 Alife API 响应不符合已记录的契约。",
        "error": "FOXD 因配置或 HTTP 错误无法读取本地健康。"
      }
    },
```

In `messages/ja.json`, add:

```json
    "alifeLocalHealth": {
      "title": "Alife ローカルヘルス",
      "source": "ローカル API",
      "loading": "Alife ローカルヘルスを確認しています...",
      "advisory": "参照専用です。Web は Alife ランタイムの開始、停止、再起動、適用を実行できません。",
      "refresh": "ローカルヘルスを確認",
      "notReported": "未報告",
      "agent": "Agent",
      "version": "バージョン",
      "qchat": "QChat",
      "vision": "Vision",
      "tts": "TTS",
      "outbox": "Outbox",
      "lastChecked": "確認時刻",
      "enabled": "有効",
      "disabled": "無効",
      "ready": "準備完了",
      "notReady": "未準備",
      "reason": "理由",
      "state": {
        "notConfigured": "未設定",
        "reachable": "到達可能",
        "unreachable": "到達不可",
        "authRequired": "認証が必要",
        "invalidResponse": "無効な応答",
        "error": "エラー"
      },
      "description": {
        "notConfigured": "FOXD_ALIFE_LOCAL_HEALTH_ENABLED=true を設定すると、サーバー側のローカルヘルス確認が有効になります。",
        "reachable": "Alife ローカル管理 API がサニタイズ済みヘルスデータを返しました。",
        "unreachable": "FOXD はローカル Alife 管理 API に接続できませんでした。",
        "authRequired": "ローカル Alife API には一致する bearer token が必要です。",
        "invalidResponse": "ローカル Alife API の応答が記録済み契約と一致しません。",
        "error": "設定または HTTP エラーにより、FOXD はローカルヘルスを読み取れませんでした。"
      }
    },
```

- [ ] **Step 7: Run panel, guardrail, adapter, and route tests**

Run from `桌宠demo/新建文件夹/avatar-web-management`:

```powershell
npx jest tests/unit/alife-local-health.test.ts tests/contract/alife-local-health-api.test.ts src/components/__tests__/AlifeLocalHealthPanel.test.tsx src/components/__tests__/AlifeLocalHealthGuardrails.test.ts --runInBand
```

Expected: PASS, all four suites pass.

- [ ] **Step 8: Commit Task 3**

Run from `D:\FOXD`:

```powershell
git add "桌宠demo/新建文件夹/avatar-web-management/src/components/pet/sync/AlifeLocalHealthPanel.tsx"
git add "桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/AlifeLocalHealthPanel.test.tsx"
git add "桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/AlifeLocalHealthGuardrails.test.ts"
git add "桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/dashboard/pet/page.tsx"
git add "桌宠demo/新建文件夹/avatar-web-management/messages/en.json"
git add "桌宠demo/新建文件夹/avatar-web-management/messages/zh-CN.json"
git add "桌宠demo/新建文件夹/avatar-web-management/messages/ja.json"
git commit -m "feat: show Alife local health awareness"
```

Expected: one focused UI commit.

## Task 4: Full Verification And Snapshot

**Files:**

- Modify if needed: `docs/2026-07-03-alife-webbridge-protocol-status.md`
- Modify if needed: `docs/webbridge-alife-local-integration.md`

- [ ] **Step 1: Run focused implementation verification**

Run from `桌宠demo/新建文件夹/avatar-web-management`:

```powershell
npx jest tests/unit/alife-local-health.test.ts tests/contract/alife-local-health-api.test.ts src/components/__tests__/AlifeLocalHealthPanel.test.tsx src/components/__tests__/AlifeLocalHealthGuardrails.test.ts src/components/__tests__/PetRuntimeSummary.test.tsx src/components/__tests__/PetSyncDiagnosticsPanel.test.tsx --runInBand
```

Expected: PASS. No live local Alife port is required.

- [ ] **Step 2: Run full verification**

Run from `桌宠demo/新建文件夹/avatar-web-management`:

```powershell
npm run test -- --runInBand
npm run test:contracts -- --runInBand
npm run typecheck
npm run build
```

Expected:

- Jest exits 0. Existing console noise may include React `act(...)` warnings and jsdom canvas/WebGL messages.
- Contract tests exit 0.
- Typecheck exits 0.
- Build exits 0.

- [ ] **Step 3: Check contract boundaries with literal scans**

Run from `D:\FOXD`:

```powershell
rg -n "127\\.0\\.0\\.1:8787|FOXD_ALIFE_LOCAL_HEALTH_TOKEN|ALIFE_WEB_MANAGEMENT_TOKEN" "桌宠demo\新建文件夹\avatar-web-management\src\components" "桌宠demo\新建文件夹\avatar-web-management\src\app\(auth)"
rg -n "child_process|exec\\(|spawn\\(|Start Alife|Stop Alife|Restart Alife|PowerShell" "桌宠demo\新建文件夹\avatar-web-management\src\components\pet\sync\AlifeLocalHealthPanel.tsx"
```

Expected:

- First command exits with no matches.
- Second command exits with no matches.

- [ ] **Step 4: Check diff hygiene and changed files**

Run from `D:\FOXD`:

```powershell
git diff --check
git diff --name-only HEAD
git status --short --branch
```

Expected:

- `git diff --check` exits 0.
- Changed files are limited to local health adapter, tests, route, dashboard page, message JSON, and optional docs listed in this task.
- `docs/superpowers/plans/2026-07-03-foxd-next-roadmap.md` remains untracked unless the user explicitly asks to commit it.
- No files under `D:\Alife` are modified.

- [ ] **Step 5: Optional docs update**

If the implementation is complete, append a short "FOXD Web local health adapter" section to `docs/2026-07-03-alife-webbridge-protocol-status.md` with:

```markdown
## FOXD Web Local Health Adapter

FOXD now exposes an authenticated, disabled-by-default server-side adapter for Alife local management health.

- FOXD route: `GET /api/pet/alife/local-health`
- Local Alife source endpoint: `GET http://127.0.0.1:8787/api/alife/health` and `GET http://127.0.0.1:8787/api/alife/status`
- Enable flag: `FOXD_ALIFE_LOCAL_HEALTH_ENABLED=true`
- Token: `FOXD_ALIFE_LOCAL_HEALTH_TOKEN`
- Boundary: Web UI receives sanitized advisory status only. It does not read the token, call loopback directly, start Alife, stop Alife, restart Alife, apply packages, or execute shell commands.
```

Then run:

```powershell
Select-String -Path docs\2026-07-03-alife-webbridge-protocol-status.md -Pattern "FOXD Web Local Health Adapter|/api/pet/alife/local-health|disabled-by-default|sanitized advisory"
git diff --check
```

Expected: all anchors match and diff check exits 0.

- [ ] **Step 6: Commit optional docs**

Only if Task 4 Step 5 changed docs, run from `D:\FOXD`:

```powershell
git add docs/2026-07-03-alife-webbridge-protocol-status.md
git commit -m "docs: record Alife local health adapter"
```

Expected: one documentation commit.

## Self-Review Checklist

Spec coverage:

- Endpoint paths are represented by server-side adapter calls to `/api/alife/health` and `/api/alife/status`, and by FOXD route `/api/pet/alife/local-health`.
- Port source is represented by `FOXD_ALIFE_LOCAL_HEALTH_BASE_URL` with default `http://127.0.0.1:8787`.
- Process ownership boundary is represented by UI copy and guardrails that prohibit management actions.
- Authentication boundary is represented by server-only token reads and route auth tests.
- Display permissions are represented by sanitized view model fields.
- Disallowed behavior is represented by guardrails and absence of management buttons.
- The first implementation is read-only and mock-tested.

Marker scan:

- This plan contains no intentionally unfinished implementation markers.

Type consistency:

- `AlifeLocalHealthView` is shared by the adapter, route response, dashboard state, and panel props.
- `AlifeLocalHealthState` values match route tests, component tests, locale keys, and guardrail expectations.
