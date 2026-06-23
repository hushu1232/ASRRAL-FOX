# Web Platform Core Chain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the first-pass Web platform chain verifiable, repair the pet/WebBridge contract, persist all exposed pet config fields, centralize external service env config, and remove low-risk performance/test noise.

**Architecture:** Keep the Next.js 16 App Router route handlers as the BFF boundary. Fix narrow contracts with Jest unit/contract coverage first, then apply minimal production changes in the existing service modules and hooks. Record broad product gaps in a completion matrix instead of expanding scope into marketplace/community/microservice rewrites.

**Tech Stack:** Next.js 16.2.6 App Router, React 19, Jest 30 with ts-jest, Prisma 7, Zod 4, Ant Design 6, Zustand, Node runtime route handlers.

---

## Baseline Evidence

- `npm run typecheck`: passed before this plan.
- `npm run lint`: exited 0, but reported 329 warnings and 17 fixable warnings before this plan.
- `npm run test:unit`: passed, 70 suites and 791 tests, with React `act(...)` warnings and Ant Design `Steps direction` deprecation warnings.
- `npm run test:integration`: failed as a baseline command because Jest treated `tests/*.test.ts|tests/contracts/**/*.test.ts|tests/contract/**/*.test.ts` as an invalid pattern, ran all tests, then 135 tests failed because no Next server was running at `http://localhost:3000`.
- `npm run build`: passed on Next.js 16.2.6, with 2 Turbopack NFT trace warnings from `src/lib/auth/keys.ts` through `src/app/.well-known/jwks.json/route.ts`.
- Next.js local docs read before planning route/env work:
  - `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`
  - `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`

## File Structure

- Modify `package.json`: make integration and contract test scripts target exact files instead of invalid Jest positional patterns.
- Modify `tests/pet-config.test.ts`: add WebBridge contract coverage for `POST /api/pet/sync` and config field persistence.
- Modify `tests/unit/pet-service.test.ts`: add focused unit coverage for pet config fields that the route accepts but the service currently drops.
- Modify `src/lib/services/petService.ts`: map all accepted pet config fields to Prisma camelCase fields, and export the same fields consistently.
- Modify `src/app/api/pet/sync/route.ts`: add `POST` handler compatible with the desktop WebBridge while preserving `GET`.
- Create `tests/unit/env.test.ts`: verify centralized env validation includes external service URLs/timeouts.
- Modify `src/env.ts`: include service URL/timeout/circuit fields and expose defaults through `getEnv()`.
- Modify `src/lib/rigging/circuit.ts`: read rigging URL/timeout/circuit settings through `getEnv()`.
- Modify `src/app/api/tts/health/route.ts`: read GPT-SoVITS URL through `getEnv()`.
- Modify `src/hooks/useNetworkStatus.ts`: make the initial state render-pure and avoid synchronous mount state writes where practical.
- Modify `src/hooks/useTimeAwareness.ts`: memoize merged config so effects do not restart every render.
- Modify `src/components/rigging/PipelineProgress.tsx`: replace deprecated Ant Design `Steps direction` usage with `orientation`.
- Create `docs/superpowers/reports/2026-06-23-web-platform-completion.md`: frontend/backend completion matrix and remaining gaps.

---

### Task 1: Make Focused Integration Scripts Runnable

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Write the failing command evidence**

Run:

```bash
npm run test:integration
```

Expected before the fix:

```text
Invalid testPattern tests/*.test.ts|tests/contracts/**/*.test.ts|tests/contract/**/*.test.ts supplied. Running all tests instead.
```

- [ ] **Step 2: Replace invalid Jest positional globs with `--testMatch`**

In `package.json`, replace only these script entries:

```json
{
  "test:integration": "jest --verbose --runInBand --testMatch \"**/tests/*.test.ts\" \"**/tests/contracts/**/*.test.ts\" \"**/tests/contract/**/*.test.ts\"",
  "test:contracts": "jest --verbose --runInBand --testMatch \"**/tests/contracts/**/*.test.ts\" \"**/tests/contract/**/*.test.ts\""
}
```

If `test:contracts` does not exist, add it next to `test:integration`.

- [ ] **Step 3: Verify the script selection no longer falls back to all tests**

Run:

```bash
npm run test:contracts
```

Expected after the fix:

```text
PASS tests/contracts/api-contracts.test.ts
```

The exact suite count may include the other contract files under `tests/contracts`; the command must not print `Invalid testPattern`.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "test: fix focused web platform test scripts"
```

---

### Task 2: Cover and Fix Pet Config Persistence

**Files:**
- Modify: `tests/unit/pet-service.test.ts`
- Modify: `src/lib/services/petService.ts`

- [ ] **Step 1: Add a failing unit test for fields currently dropped by `prepareConfigForDb`**

Add this test inside `describe('updateConfig', () => { ... })` in `tests/unit/pet-service.test.ts`:

```ts
it('persists desktop integration config fields accepted by the API route', async () => {
  mockPrismaClient.petConfig.findUnique.mockResolvedValue(makeRawConfig());
  mockPrismaClient.petConfig.update.mockResolvedValue(makeRawConfig({
    ttsLocalUrl: 'http://127.0.0.1:9881',
    sttLocalUrl: 'http://127.0.0.1:9000',
    llmModelPath: 'models/qwen2.5.gguf',
    sovitsUrl: 'http://127.0.0.1:9880',
    sovitsReferenceVoiceId: 'voice-1',
    enableWakeWord: false,
    wakeWord: 'astral',
    wakeSensitivity: 0.7,
    autoStartServices: false,
    pipelineTimeout: 45,
    modelPath: '/models/default.model3.json',
  }));

  await petService.updateConfig(userId, workspaceId, {
    ttsLocalUrl: 'http://127.0.0.1:9881',
    sttLocalUrl: 'http://127.0.0.1:9000',
    llmModelPath: 'models/qwen2.5.gguf',
    sovitsUrl: 'http://127.0.0.1:9880',
    sovitsReferenceVoiceId: 'voice-1',
    enableWakeWord: false,
    wakeWord: 'astral',
    wakeSensitivity: 0.7,
    autoStartServices: false,
    pipelineTimeout: 45,
    modelPath: '/models/default.model3.json',
  });

  const updateData = mockPrismaClient.petConfig.update.mock.calls[0][0].data;
  expect(updateData).toEqual(expect.objectContaining({
    ttsLocalUrl: 'http://127.0.0.1:9881',
    sttLocalUrl: 'http://127.0.0.1:9000',
    llmModelPath: 'models/qwen2.5.gguf',
    sovitsUrl: 'http://127.0.0.1:9880',
    sovitsReferenceVoiceId: 'voice-1',
    enableWakeWord: false,
    wakeWord: 'astral',
    wakeSensitivity: 0.7,
    autoStartServices: false,
    pipelineTimeout: 45,
    modelPath: '/models/default.model3.json',
  }));
  expect(updateData.updatedAt).toBeInstanceOf(Date);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npm run test:unit -- tests/unit/pet-service.test.ts
```

Expected before implementation:

```text
expect(received).toEqual(expect.objectContaining(...))
```

At least one of `ttsLocalUrl`, `sovitsUrl`, `enableWakeWord`, or `modelPath` should be missing from `updateData`.

- [ ] **Step 3: Persist every field already accepted by `/api/pet/config`**

In `src/lib/services/petService.ts`, replace `prepareConfigForDb` with:

```ts
function prepareConfigForDb(data: Partial<PetConfigData>): Record<string, unknown> {
  const dbData: Record<string, unknown> = {};
  if (data.petName !== undefined) dbData.petName = data.petName;
  if (data.personality !== undefined) dbData.personality = data.personality;
  if (data.backstory !== undefined) dbData.backstory = data.backstory;
  if (data.characterExtra !== undefined) dbData.characterExtra = data.characterExtra;
  if (data.animationModel !== undefined) dbData.animationModel = data.animationModel;
  if (data.avatarId !== undefined) dbData.avatarId = data.avatarId;
  if (data.ffmpegPath !== undefined) dbData.ffmpegPath = data.ffmpegPath;
  if (data.idleTimeout !== undefined) dbData.idleTimeout = data.idleTimeout;
  if (data.wanderInterval !== undefined) dbData.wanderInterval = data.wanderInterval;
  if (data.ttsLocalUrl !== undefined) dbData.ttsLocalUrl = data.ttsLocalUrl;
  if (data.sttLocalUrl !== undefined) dbData.sttLocalUrl = data.sttLocalUrl;
  if (data.llmModelPath !== undefined) dbData.llmModelPath = data.llmModelPath;
  if (data.sovitsUrl !== undefined) dbData.sovitsUrl = data.sovitsUrl;
  if (data.sovitsReferenceVoiceId !== undefined) dbData.sovitsReferenceVoiceId = data.sovitsReferenceVoiceId;
  if (data.enableWakeWord !== undefined) dbData.enableWakeWord = data.enableWakeWord;
  if (data.wakeWord !== undefined) dbData.wakeWord = data.wakeWord;
  if (data.wakeSensitivity !== undefined) dbData.wakeSensitivity = data.wakeSensitivity;
  if (data.autoStartServices !== undefined) dbData.autoStartServices = data.autoStartServices;
  if (data.pipelineTimeout !== undefined) dbData.pipelineTimeout = data.pipelineTimeout;
  if (data.modelPath !== undefined) dbData.modelPath = data.modelPath;
  return dbData;
}
```

- [ ] **Step 4: Run focused verification**

Run:

```bash
npm run test:unit -- tests/unit/pet-service.test.ts
```

Expected:

```text
PASS tests/unit/pet-service.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add tests/unit/pet-service.test.ts src/lib/services/petService.ts
git commit -m "fix: persist desktop pet config fields"
```

---

### Task 3: Restore WebBridge-Compatible `/api/pet/sync`

**Files:**
- Modify: `tests/pet-config.test.ts`
- Modify: `src/app/api/pet/sync/route.ts`

- [ ] **Step 1: Add a failing integration contract test for `POST /api/pet/sync`**

Add this test in `tests/pet-config.test.ts` after the existing pet export coverage:

```ts
describe('POST /api/pet/sync', () => {
  let token: string;

  beforeAll(async () => {
    const t = await loginAs('demo@example.com', 'demo1234');
    expect(t).toBeDefined();
    token = t!;
  });

  it('accepts desktop WebBridge sync payload and returns exported config', async () => {
    const res = await post('/api/pet/sync', {
      clientVersion: 'desktop-webbridge',
      lastSyncAt: new Date('2026-06-23T00:00:00.000Z').toISOString(),
      capabilities: ['config', 'assets', 'avatar'],
    }, token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(expect.objectContaining({
      version: expect.any(Number),
      petName: expect.any(String),
      animationModel: expect.any(String),
      mappedAssets: expect.any(Array),
    }));
  });
});
```

- [ ] **Step 2: Run against a local Next server and verify it fails with method mismatch**

Run:

```bash
npm run build
npm run test:integration:local -- tests/pet-config.test.ts
```

Expected before implementation:

```text
Expected: 200
Received: 405
```

If the command cannot forward the file argument through `start-server-and-test`, run `npm run start` in one terminal and then:

```bash
npx jest --verbose --runInBand tests/pet-config.test.ts
```

- [ ] **Step 3: Add the POST handler while preserving GET**

Replace `src/app/api/pet/sync/route.ts` with:

```ts
export const runtime = 'nodejs';

import { withAuth } from '@/lib/auth/middleware';
import { petService } from '@/lib/services/petService';
import { success, error } from '@/lib/api-response';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:pet:sync');

async function exportForDesktop(userId: string, workspaceId: string) {
  return petService.exportConfig(userId, workspaceId);
}

export const GET = withAuth(async (_req, user) => {
  try {
    const config = await exportForDesktop(user.sub, user.workspaceId);
    return success(config);
  } catch (err) {
    log.error({ err }, 'Pet sync failed');
    return error(err);
  }
});

export const POST = withAuth(async (req, user) => {
  try {
    await req.json().catch(() => ({}));
    const config = await exportForDesktop(user.sub, user.workspaceId);
    return success(config);
  } catch (err) {
    log.error({ err }, 'Pet sync failed');
    return error(err);
  }
});
```

- [ ] **Step 4: Verify the contract**

Run:

```bash
npm run build
npx jest --verbose --runInBand tests/pet-config.test.ts
```

Expected with a local Next server reachable at `http://localhost:3000`:

```text
PASS tests/pet-config.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add tests/pet-config.test.ts src/app/api/pet/sync/route.ts
git commit -m "fix: support desktop pet sync POST contract"
```

---

### Task 4: Centralize External Service Env Config

**Files:**
- Create: `tests/unit/env.test.ts`
- Modify: `src/env.ts`
- Modify: `src/lib/rigging/circuit.ts`
- Modify: `src/app/api/tts/health/route.ts`

- [ ] **Step 1: Add failing env tests**

Create `tests/unit/env.test.ts`:

```ts
describe('env validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, NODE_ENV: 'test' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('provides defaults for external desktop services', async () => {
    delete process.env.RIGGING_SERVICE_URL;
    delete process.env.GPT_SOVITS_URL;
    delete process.env.OLLAMA_URL;
    delete process.env.RIGGING_TIMEOUT_MS;

    const { validateEnv } = await import('@/env');
    const env = validateEnv();

    expect(env.RIGGING_SERVICE_URL).toBe('http://localhost:8001');
    expect(env.GPT_SOVITS_URL).toBe('http://localhost:8002');
    expect(env.OLLAMA_URL).toBe('http://localhost:11434');
    expect(env.RIGGING_TIMEOUT_MS).toBe(130000);
  });

  it('rejects malformed external service URLs', async () => {
    process.env.RIGGING_SERVICE_URL = 'not-a-url';
    const { validateEnv } = await import('@/env');
    expect(() => validateEnv()).toThrow(/RIGGING_SERVICE_URL/);
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run:

```bash
npm run test:unit -- tests/unit/env.test.ts
```

Expected before implementation:

```text
Property 'RIGGING_SERVICE_URL' does not exist
```

or a runtime assertion failure for missing defaults.

- [ ] **Step 3: Extend `src/env.ts` schema**

Add these fields to `envSchema`:

```ts
  // External AI and desktop bridge services
  RIGGING_SERVICE_URL: z.url().default('http://localhost:8001'),
  RIGGING_TIMEOUT_MS: z.coerce.number().int().positive().default(130000),
  RIGGING_CIRCUIT_BREAKER_THRESHOLD: z.coerce.number().int().positive().default(5),
  GPT_SOVITS_URL: z.url().default('http://localhost:8002'),
  OLLAMA_URL: z.url().default('http://localhost:11434'),
```

- [ ] **Step 4: Route rigging config through `getEnv()`**

Replace `src/lib/rigging/circuit.ts` with:

```ts
import { createCircuitBreaker } from '@/lib/circuit-breaker';
import { getEnv } from '@/env';

const env = getEnv();

export const riggingBreaker = createCircuitBreaker({
  name: 'rigging-service',
  failureThreshold: env.RIGGING_CIRCUIT_BREAKER_THRESHOLD,
  resetTimeoutMs: 30_000,
  successThreshold: 2,
});

export const RIGGING_TIMEOUT_MS = env.RIGGING_TIMEOUT_MS;
export const RIGGING_BASE_URL = env.RIGGING_SERVICE_URL;
```

- [ ] **Step 5: Route TTS health URL through `getEnv()`**

In `src/app/api/tts/health/route.ts`, replace the file with:

```ts
export const runtime = 'nodejs';

import { withAuth } from '@/lib/auth/middleware';
import { ttsService } from '@/lib/services/ttsService';
import { success } from '@/lib/api-response';
import { getEnv } from '@/env';

export const GET = withAuth(async () => {
  const health = await ttsService.healthCheck(getEnv().GPT_SOVITS_URL);
  return success(health);
});
```

- [ ] **Step 6: Verify focused tests and build**

Run:

```bash
npm run test:unit -- tests/unit/env.test.ts tests/unit/rigging-client.test.ts
npm run typecheck
npm run build
```

Expected:

```text
PASS tests/unit/env.test.ts
PASS tests/unit/rigging-client.test.ts
```

`typecheck` and `build` should exit 0.

- [ ] **Step 7: Commit**

```bash
git add tests/unit/env.test.ts src/env.ts src/lib/rigging/circuit.ts src/app/api/tts/health/route.ts
git commit -m "fix: validate external service environment"
```

---

### Task 5: Remove Low-Risk React and AntD Performance Noise

**Files:**
- Modify: `src/hooks/useNetworkStatus.ts`
- Modify: `src/hooks/useTimeAwareness.ts`
- Modify: `src/components/rigging/PipelineProgress.tsx`

- [ ] **Step 1: Add focused hook/component checks if existing tests do not cover warnings**

Run:

```bash
npm run test:unit -- src/components/__tests__/PipelineProgress.test.tsx
```

Expected before implementation:

```text
Warning: [antd: Steps] `direction` is deprecated. Please use `orientation` instead.
```

- [ ] **Step 2: Make `useNetworkStatus` render initialization pure**

In `src/hooks/useNetworkStatus.ts`, replace the initial `lastOnlineTime` state and mount effect body with:

```ts
  const lastOnlineTimeRef = useRef<number | null>(null);
```

Then update the online effect to:

```ts
  useEffect(() => {
    const setOnlineNow = () => {
      lastOnlineTimeRef.current = Date.now();
      setOnline(true);
      setOfflineDuration(0);
    };
    const handleOnline = () => setOnlineNow();
    const handleOffline = () => {
      if (lastOnlineTimeRef.current === null) lastOnlineTimeRef.current = Date.now();
      setOnline(false);
    };

    if (navigator.onLine) {
      setOnlineNow();
    } else {
      handleOffline();
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
```

Update the offline duration effect to:

```ts
  useEffect(() => {
    if (online) {
      setOfflineDuration(0);
      return;
    }
    const timer = setInterval(() => {
      const lastOnlineTime = lastOnlineTimeRef.current ?? Date.now();
      setOfflineDuration(Date.now() - lastOnlineTime);
    }, 1000);
    return () => clearInterval(timer);
  }, [online]);
```

Update successful ping handling:

```ts
      if (ok) {
        setOnline(true);
        lastOnlineTimeRef.current = Date.now();
      }
```

- [ ] **Step 3: Memoize `useTimeAwareness` merged config**

In `src/hooks/useTimeAwareness.ts`, change the import:

```ts
import { useEffect, useRef, useCallback, useMemo } from 'react';
```

Replace the `mergedConfig` line with:

```ts
  const mergedConfig = useMemo<TimeAwarenessConfig>(
    () => ({ ...DEFAULT_TIME_AWARENESS_CONFIG, ...config }),
    [config],
  );
```

- [ ] **Step 4: Replace deprecated AntD Steps prop**

In `src/components/rigging/PipelineProgress.tsx`, replace:

```tsx
direction="vertical"
```

with:

```tsx
orientation="vertical"
```

- [ ] **Step 5: Verify focused tests and lint warning reduction**

Run:

```bash
npm run test:unit -- src/components/__tests__/PipelineProgress.test.tsx
npm run lint
```

Expected:

```text
PASS src/components/__tests__/PipelineProgress.test.tsx
```

The Ant Design `Steps direction` warning should not appear in this focused test output. Lint should still exit 0; total warning count should be lower than the baseline 329.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useNetworkStatus.ts src/hooks/useTimeAwareness.ts src/components/rigging/PipelineProgress.tsx
git commit -m "fix: reduce web platform render and deprecation noise"
```

---

### Task 6: Document Build Warning Follow-Up Without Expanding Scope

**Files:**
- Create: `docs/superpowers/reports/2026-06-23-web-platform-completion.md`

- [ ] **Step 1: Create the report with completion matrix and build warning**

Create `docs/superpowers/reports/2026-06-23-web-platform-completion.md`:

```md
# Web Platform Completion Report

Date: 2026-06-23
Scope: `avatar-web-management`

## Verification

| Command | Result | Notes |
| --- | --- | --- |
| `npm run typecheck` | Pass | Baseline passed before first fixes. |
| `npm run lint` | Pass with warnings | Baseline: 329 warnings, 17 fixable. |
| `npm run test:unit` | Pass | Baseline: 70 suites, 791 tests. |
| `npm run build` | Pass with warnings | Turbopack reported 2 NFT trace warnings from JWKS key loading. |
| `npm run test:integration` | Needs script/server fix | Baseline command used invalid Jest pattern and then failed against missing `localhost:3000`. |

## Frontend Completion

| Area | Status | Evidence | Remaining Work |
| --- | --- | --- | --- |
| Auth pages and store | Substantially implemented | Login/register/reset routes and `authStore` exist. | Reduce warnings and add more browser workflow coverage. |
| Dashboard and admin | Broadly implemented | `/dashboard`, `/admin`, stats/users/reviews/payment routes exist. | Product-level completion requires role workflow QA. |
| Avatar/assets/editor | Broadly implemented | `/avatars`, `/assets`, upload, versions, export, Live2D/rigging components exist. | Some tests emit React `act(...)` warnings; editor sync needs browser e2e coverage. |
| Pet desktop bridge UI | Partially implemented | `/dashboard/pet`, `/preview/pet`, pet routes exist. | Contract and persistence fixes in this plan are required for desktop reliability. |
| Marketplace/community | Broadly scaffolded | Market/community routes and APIs exist. | Payment, moderation, seller lifecycle need product acceptance tests. |

## Backend Completion

| Area | Status | Evidence | Remaining Work |
| --- | --- | --- | --- |
| API envelope and auth middleware | Implemented | `src/lib/api-response.ts`, `src/lib/auth/middleware.ts`. | Normalize some direct `NextResponse.json` errors over time. |
| Pet API/WebBridge | Needs first-pass fixes | `/api/pet/config/assets/set-avatar/sync/export` exist. | `POST /api/pet/sync` and full config persistence are required. |
| Rigging proxy | Implemented with degradation | `src/lib/rigging/client.ts` has timeout and circuit breaker. | Centralize env config and add route contract coverage. |
| TTS proxy | Implemented with degradation | `src/lib/services/ttsService.ts` has retry, timeout, circuit breaker, fallback. | Centralize service URL and add train/voices timeout consistency later. |
| Persistence | Implemented | Prisma models and service layer exist. | Some fields are exposed by routes but not persisted until this plan is executed. |
| Observability | Partially implemented | Metrics, Sentry, OpenTelemetry files exist. | Build-time Prisma connection noise and Turbopack trace warning need follow-up. |

## Deferred Technical Debt

- Investigate `src/lib/auth/keys.ts` path usage that causes Turbopack NFT to trace too broadly during `next build`.
- Continue reducing ESLint warnings after contract fixes; avoid broad auto-fix commits.
- Add Playwright coverage for login, pet config update, asset selection, rigging health degradation, and TTS health degradation.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/reports/2026-06-23-web-platform-completion.md
git commit -m "docs: report web platform completion status"
```

---

### Task 7: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run core verification**

Run:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:contracts
npm run build
```

Expected:

```text
typecheck exits 0
lint exits 0
test:unit passes
test:contracts passes
build exits 0
```

- [ ] **Step 2: Run pet integration contract with a local server**

Run:

```bash
npm run build
npm run test:integration:local
```

Expected:

```text
tests/pet-config.test.ts passes
```

If unrelated integration tests still fail, record the failing suite names and do not broaden this plan without a new spec.

- [ ] **Step 3: Inspect git state**

Run:

```bash
git status --short
```

Expected: only intentional files from this plan are modified or committed.

## Self-Review

- Spec coverage: The plan maps and fixes the approved first-pass Web platform core chain: pet/WebBridge contract, config persistence, external service env config, focused test scripts, low-risk performance warnings, and completion reporting.
- Placeholder scan: No forbidden placeholder markers or unspecified implementation steps remain. Each code-changing task includes exact snippets and commands.
- Type consistency: New env keys match `Env` inferred from `envSchema`; pet config fields match the existing `PetConfigData` interface and Prisma camelCase service usage; `POST /api/pet/sync` returns the existing `PetConfigExport` shape.
