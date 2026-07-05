# Pet Sync POST Persistence Round Trip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `POST /api/pet/sync` persist the desktop WebBridge config-pull state in the existing `PetSyncStatus` model while preserving the current exported-config response.

**Architecture:** Keep `/api/pet/sync` as the desktop config export route. Add a narrow `petSyncStatusService.reportConfigPull(...)` method that upserts a `pulled` desktop sync snapshot using the existing `PetSyncStatus` table, then have the route call it before returning the exported config. Do not change Prisma schema, Alife code, UI, WebBridge package routes, or the response shape consumed by desktop clients.

**Tech Stack:** Next.js app route handlers, TypeScript, Jest unit and contract tests, Prisma existing model, PowerShell verification commands.

---

## Design Inputs

- Design spec: `docs/superpowers/specs/2026-07-05-pet-sync-post-persistence-round-trip-design.md`
- Protocol status: `docs/2026-07-03-alife-webbridge-protocol-status.md`
- Route to modify: `桌宠demo/新建文件夹/avatar-web-management/src/app/api/pet/sync/route.ts`
- Service to modify: `桌宠demo/新建文件夹/avatar-web-management/src/lib/services/petSyncStatusService.ts`
- Existing status model: `桌宠demo/新建文件夹/avatar-web-management/src/lib/webbridge/sync-status.ts`
- Existing route contract test: `桌宠demo/新建文件夹/avatar-web-management/tests/contract/pet-sync-contract.test.ts`
- Existing service unit test: `桌宠demo/新建文件夹/avatar-web-management/tests/unit/pet-sync-status-service.test.ts`

## Boundaries

- Do not modify Prisma schema or migrations.
- Do not modify `D:\Alife`.
- Do not update the FOXD `alife-service` gitlink.
- Do not modify dashboard UI, i18n copy, or WebBridge package manifest/file routes.
- Do not add browser shell, PowerShell, start, stop, restart, apply, delete, or repair actions.
- Do not change the `POST /api/pet/sync` response shape. It must continue returning the exported pet config envelope.
- Do not treat `POST /api/pet/sync` as active apply confirmation. Apply confirmation remains `/api/pet/sync/status` with `packageApplied`.
- Do not persist `clientVersion` or `capabilities`; the current schema has no columns for them.

## File Structure

- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/lib/services/petSyncStatusService.ts`
  - Add `ReportPetSyncPullInput`.
  - Add `reportConfigPull(...)`.
  - Reuse existing ISO time and version validation helpers.
  - Preserve same-version higher state while refreshing `lastSyncAt`.
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/app/api/pet/sync/route.ts`
  - Validate POST body as an object.
  - Export config.
  - Persist config-pull status through `petSyncStatusService.reportConfigPull(...)`.
  - Return the unchanged config envelope.
- Modify: `桌宠demo/新建文件夹/avatar-web-management/tests/unit/pet-sync-status-service.test.ts`
  - Add service behavior tests.
- Modify: `桌宠demo/新建文件夹/avatar-web-management/tests/contract/pet-sync-contract.test.ts`
  - Add route contract tests.
- Optional modify: `docs/2026-07-03-alife-webbridge-protocol-status.md`
  - Update the open gap after implementation is verified.

## Task 1: Add Failing Service Tests For Config-Pull Persistence

**Files:**

- Modify: `桌宠demo/新建文件夹/avatar-web-management/tests/unit/pet-sync-status-service.test.ts`

- [ ] **Step 1: Add config-pull service tests**

Append these tests inside the existing `describe('petSyncStatusService', () => { ... })` block, before the final closing `});`.

```ts
  it('config pull creates a pulled desktop status when no row exists', async () => {
    const version = updatedAt.getTime();
    mockPrismaClient.petConfig.findUnique.mockResolvedValue(makePetConfig());
    mockPrismaClient.petSyncStatus.findUnique.mockResolvedValue(null);
    mockPrismaClient.petSyncStatus.upsert.mockResolvedValue(makeSyncStatusRow({
      desktopKnownVersion: BigInt(version),
      packageState: 'pulled',
      requiresLocalConfirmation: true,
      lastSyncAt: reportedAt,
    }));

    const status = await petSyncStatusService.reportConfigPull(
      userId,
      workspaceId,
      {
        clientVersion: 'desktop-webbridge',
        capabilities: ['config', 'assets', 'avatar'],
        lastSyncAt: reportedAtIso,
      },
      version,
    );

    expect(mockPrismaClient.petSyncStatus.upsert).toHaveBeenCalledWith({
      where: { petConfigId },
      create: expect.objectContaining({
        petConfigId,
        desktopKnownVersion: BigInt(version),
        packageState: 'pulled',
        requiresLocalConfirmation: true,
        lastSyncAt: reportedAt,
        lastErrorCode: null,
        lastErrorMessage: null,
        lastErrorDetail: null,
      }),
      update: expect.objectContaining({
        desktopKnownVersion: BigInt(version),
        packageState: 'pulled',
        requiresLocalConfirmation: true,
        lastSyncAt: reportedAt,
        lastErrorCode: null,
        lastErrorMessage: null,
        lastErrorDetail: null,
      }),
    });
    expect(status.packageState).toBe('pulled');
    expect(status.desktopKnownVersion).toBe(version);
    expect(status.summaryKind).toBe('localConfirmationRequired');
  });

  it('config pull refreshes lastSyncAt without downgrading same-version applied state', async () => {
    const version = updatedAt.getTime();
    const appliedAt = new Date('2026-06-27T10:02:00.000Z');
    mockPrismaClient.petConfig.findUnique.mockResolvedValue(makePetConfig());
    mockPrismaClient.petSyncStatus.findUnique.mockResolvedValue(makeSyncStatusRow({
      desktopKnownVersion: BigInt(version),
      desktopAppliedVersion: BigInt(version),
      packageState: 'applied',
      requiresLocalConfirmation: false,
      lastSyncAt: appliedAt,
      lastAppliedAt: appliedAt,
    }));
    mockPrismaClient.petSyncStatus.upsert.mockResolvedValue(makeSyncStatusRow({
      desktopKnownVersion: BigInt(version),
      desktopAppliedVersion: BigInt(version),
      packageState: 'applied',
      requiresLocalConfirmation: false,
      lastSyncAt: reportedAt,
      lastAppliedAt: appliedAt,
    }));

    const status = await petSyncStatusService.reportConfigPull(
      userId,
      workspaceId,
      { lastSyncAt: reportedAtIso },
      version,
    );

    expect(mockPrismaClient.petSyncStatus.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        desktopKnownVersion: BigInt(version),
        packageState: 'applied',
        requiresLocalConfirmation: false,
        lastSyncAt: reportedAt,
      }),
    }));
    expect(status.packageState).toBe('applied');
    expect(status.desktopAppliedVersion).toBe(version);
    expect(status.summaryKind).toBe('upToDate');
  });

  it('config pull clears stale older-version failure when Web exports a newer version', async () => {
    const oldVersion = updatedAt.getTime() - 1;
    const newVersion = updatedAt.getTime();
    mockPrismaClient.petConfig.findUnique.mockResolvedValue(makePetConfig());
    mockPrismaClient.petSyncStatus.findUnique.mockResolvedValue(makeSyncStatusRow({
      desktopKnownVersion: BigInt(oldVersion),
      packageState: 'failed',
      requiresLocalConfirmation: true,
      lastErrorCode: 'PACKAGE_HASH_MISMATCH',
      lastErrorMessage: 'old hash mismatch',
      lastErrorDetail: 'old detail',
    }));
    mockPrismaClient.petSyncStatus.upsert.mockResolvedValue(makeSyncStatusRow({
      desktopKnownVersion: BigInt(newVersion),
      packageState: 'pulled',
      requiresLocalConfirmation: true,
      lastSyncAt: reportedAt,
      lastErrorCode: null,
      lastErrorMessage: null,
      lastErrorDetail: null,
    }));

    const status = await petSyncStatusService.reportConfigPull(
      userId,
      workspaceId,
      { lastSyncAt: reportedAtIso },
      newVersion,
    );

    expect(mockPrismaClient.petSyncStatus.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        desktopKnownVersion: BigInt(newVersion),
        packageState: 'pulled',
        lastErrorCode: null,
        lastErrorMessage: null,
        lastErrorDetail: null,
      }),
    }));
    expect(status.packageState).toBe('pulled');
    expect(status.lastError).toBeNull();
  });

  it('config pull rejects invalid explicit desktopKnownVersion values', async () => {
    mockPrismaClient.petConfig.findUnique.mockResolvedValue(makePetConfig());

    await expect(
      petSyncStatusService.reportConfigPull(
        userId,
        workspaceId,
        { desktopKnownVersion: -1 },
        updatedAt.getTime(),
      ),
    ).rejects.toThrow('Desktop packageVersion must be a positive safe integer');
    expect(mockPrismaClient.petSyncStatus.upsert).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run the service test and observe RED**

Run from `桌宠demo\新建文件夹\avatar-web-management`:

```powershell
npx jest tests/unit/pet-sync-status-service.test.ts --runInBand
```

Expected: FAIL because `petSyncStatusService.reportConfigPull` does not exist.

## Task 2: Implement Config-Pull Persistence In The Status Service

**Files:**

- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/lib/services/petSyncStatusService.ts`

- [ ] **Step 1: Add the public input type**

Add this interface near `ReportPetSyncMilestoneInput`.

```ts
export interface ReportPetSyncPullInput {
  clientVersion?: string;
  capabilities?: string[];
  lastSyncAt?: string | null;
  desktopKnownVersion?: number | null;
  packageVersion?: number | null;
}
```

- [ ] **Step 2: Add `reportConfigPull` to `petSyncStatusService`**

Add this method after `getStatus(...)` and before `reportMilestone(...)`.

```ts
  async reportConfigPull(
    userId: string,
    workspaceId: string,
    input: ReportPetSyncPullInput,
    exportedConfigVersion: number
  ): Promise<DesktopSyncStatus> {
    const prisma = getPetSyncStatusPrisma();
    const petConfig = await findPetConfig(prisma, userId, workspaceId);
    const webConfigVersion = webConfigVersionFromPetConfig(petConfig);
    const reportedAt = normalizeReportedAt(input.lastSyncAt);
    const explicitVersion = input.desktopKnownVersion ?? input.packageVersion;
    const desktopKnownVersion = BigInt(
      normalizePackageVersion(explicitVersion) ?? exportedConfigVersion
    );
    const currentRow = await prisma.petSyncStatus.findUnique({
      where: { petConfigId: petConfig.id },
    });
    const data = buildConfigPullUpdateData(currentRow, desktopKnownVersion, reportedAt);

    if (!data) {
      return statusFromRow(currentRow as PetSyncStatusRow, webConfigVersion, reportedAt);
    }

    const row = await prisma.petSyncStatus.upsert({
      where: { petConfigId: petConfig.id },
      create: {
        petConfigId: petConfig.id,
        ...data,
      },
      update: data,
    });

    return statusFromRow(row, webConfigVersion, reportedAt);
  },
```

- [ ] **Step 3: Add config-pull update helpers**

Add these helper functions below `shouldIgnoreStaleMilestone(...)`.

```ts
function buildConfigPullUpdateData(
  currentRow: PetSyncStatusRow | null,
  desktopKnownVersion: bigint,
  reportedAt: Date
): Record<string, unknown> | null {
  if (!currentRow) {
    return {
      desktopKnownVersion,
      packageState: 'pulled',
      requiresLocalConfirmation: true,
      lastSyncAt: reportedAt,
      lastErrorCode: null,
      lastErrorMessage: null,
      lastErrorDetail: null,
    };
  }

  const currentVersion = maxVersion(
    currentRow.desktopKnownVersion,
    currentRow.desktopAppliedVersion
  );

  if (currentVersion !== null && desktopKnownVersion < currentVersion) {
    return null;
  }

  const currentPackageState = toDesktopPackageState(currentRow.packageState);
  const shouldPreserveState =
    currentVersion !== null &&
    desktopKnownVersion === currentVersion &&
    PACKAGE_STATE_RANK[currentPackageState] > PACKAGE_STATE_RANK.pulled;

  if (shouldPreserveState) {
    return {
      desktopKnownVersion,
      packageState: currentPackageState,
      requiresLocalConfirmation: currentRow.requiresLocalConfirmation,
      lastSyncAt: reportedAt,
      lastErrorCode: currentRow.lastErrorCode,
      lastErrorMessage: currentRow.lastErrorMessage,
      lastErrorDetail: currentRow.lastErrorDetail,
    };
  }

  return {
    desktopKnownVersion,
    packageState: 'pulled',
    requiresLocalConfirmation: true,
    lastSyncAt: reportedAt,
    lastErrorCode: null,
    lastErrorMessage: null,
    lastErrorDetail: null,
  };
}
```

- [ ] **Step 4: Run the service test and observe GREEN**

Run from `桌宠demo\新建文件夹\avatar-web-management`:

```powershell
npx jest tests/unit/pet-sync-status-service.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit the service change**

Run from `D:\FOXD`:

```powershell
git add "桌宠demo/新建文件夹/avatar-web-management/src/lib/services/petSyncStatusService.ts"
git add "桌宠demo/新建文件夹/avatar-web-management/tests/unit/pet-sync-status-service.test.ts"
git commit -m "feat: persist pet sync config pulls"
```

Expected: one focused service commit.

## Task 3: Wire `/api/pet/sync` POST To The Status Service

**Files:**

- Modify: `桌宠demo/新建文件夹/avatar-web-management/tests/contract/pet-sync-contract.test.ts`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/app/api/pet/sync/route.ts`

- [ ] **Step 1: Update the route contract mock**

In `tests/contract/pet-sync-contract.test.ts`, add `mockPetSyncStatusService` after `mockPetService`.

```ts
const mockPetSyncStatusService = {
  reportConfigPull: jest.fn(),
};
```

Add this mock below the existing `petService` mock.

```ts
jest.mock('@/lib/services/petSyncStatusService', () => ({
  petSyncStatusService: mockPetSyncStatusService,
}));
```

- [ ] **Step 2: Update the existing happy-path contract test**

In the existing `accepts desktop sync metadata and returns exported config` test, add the resolved status mock before importing the route.

```ts
    mockPetSyncStatusService.reportConfigPull.mockResolvedValue({
      webConfigVersion: 1,
      packageState: 'pulled',
      desktopConnection: 'online',
      desktopKnownVersion: 1,
      desktopAppliedVersion: null,
      requiresLocalConfirmation: true,
      summaryKind: 'localConfirmationRequired',
      primaryAction: 'confirmInDesktop',
      isUpToDate: false,
      lastSyncAt: '2026-06-23T00:00:00.000Z',
      lastAppliedAt: null,
      lastError: null,
      errorMessage: null,
      milestones: [],
    });
```

Store the request body in a variable and assert the new call.

```ts
    const syncBody = {
      clientVersion: 'desktop-webbridge',
      lastSyncAt: new Date('2026-06-23T00:00:00.000Z').toISOString(),
      capabilities: ['config', 'assets', 'avatar'],
    };

    const { POST } = await import('@/app/api/pet/sync/route');
    const res = await POST(mockRequest('POST', '/api/pet/sync', syncBody));
```

Add this assertion after the existing `exportConfig` assertion.

```ts
    expect(mockPetSyncStatusService.reportConfigPull).toHaveBeenCalledWith(
      'user-1',
      'ws-1',
      syncBody,
      1,
    );
```

- [ ] **Step 3: Add invalid-body and unauthenticated contract assertions**

Add these tests inside `describe('POST /api/pet/sync contract', () => { ... })`.

```ts
  it('returns 400 and does not export config for null sync metadata', async () => {
    const { POST } = await import('@/app/api/pet/sync/route');
    const res = await POST(mockRequest('POST', '/api/pet/sync', null));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(mockPetService.exportConfig).not.toHaveBeenCalled();
    expect(mockPetSyncStatusService.reportConfigPull).not.toHaveBeenCalled();
  });

  it('returns 401 without auth and does not export or persist sync state', async () => {
    const { POST } = await import('@/app/api/pet/sync/route');
    const res = await POST(mockRequest('POST', '/api/pet/sync', {
      clientVersion: 'desktop-webbridge',
    }, false));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(401);
    expect(body.success).toBe(false);
    expect(mockPetService.exportConfig).not.toHaveBeenCalled();
    expect(mockPetSyncStatusService.reportConfigPull).not.toHaveBeenCalled();
  });
```

- [ ] **Step 4: Run the contract test and observe RED**

Run from `桌宠demo\新建文件夹\avatar-web-management`:

```powershell
npx jest tests/contract/pet-sync-contract.test.ts --runInBand
```

Expected: FAIL because `/api/pet/sync` does not call `reportConfigPull` and still accepts `null`.

- [ ] **Step 5: Wire the route implementation**

Modify `src/app/api/pet/sync/route.ts`.

Replace the imports with:

```ts
import { withAuth } from '@/lib/auth/middleware';
import { petService } from '@/lib/services/petService';
import {
  petSyncStatusService,
  type ReportPetSyncPullInput,
} from '@/lib/services/petSyncStatusService';
import { success, error } from '@/lib/api-response';
import { ValidationError } from '@/lib/errors';
import { createLogger } from '@/lib/logger';
```

Replace `POST` with:

```ts
export const POST = withAuth(async (req, user) => {
  try {
    const body = await req.json().catch(() => ({}));
    const report = validateSyncBody(body);
    const config = await exportForDesktop(user.sub, user.workspaceId);
    await petSyncStatusService.reportConfigPull(
      user.sub,
      user.workspaceId,
      report,
      config.version,
    );
    return success(config);
  } catch (err) {
    log.error({ err }, 'Pet sync failed');
    return error(err);
  }
});
```

Add this helper at the bottom of the file.

```ts
function validateSyncBody(body: unknown): ReportPetSyncPullInput {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Pet sync report body must be an object');
  }

  return body as ReportPetSyncPullInput;
}
```

- [ ] **Step 6: Run the contract test and observe GREEN**

Run from `桌宠demo\新建文件夹\avatar-web-management`:

```powershell
npx jest tests/contract/pet-sync-contract.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit the route wiring**

Run from `D:\FOXD`:

```powershell
git add "桌宠demo/新建文件夹/avatar-web-management/src/app/api/pet/sync/route.ts"
git add "桌宠demo/新建文件夹/avatar-web-management/tests/contract/pet-sync-contract.test.ts"
git commit -m "feat: persist pet sync POST reports"
```

Expected: one focused route commit.

## Task 4: Integration Verification And Protocol Snapshot

**Files:**

- Modify: `docs/2026-07-03-alife-webbridge-protocol-status.md`

- [ ] **Step 1: Run focused implementation tests**

Run from `桌宠demo\新建文件夹\avatar-web-management`:

```powershell
npx jest tests/unit/pet-sync-status-service.test.ts tests/contract/pet-sync-contract.test.ts tests/contract/pet-sync-status-api.test.ts tests/unit/webbridge-sync-status.test.ts --runInBand
```

Expected: all listed suites pass.

- [ ] **Step 2: Run full verification**

Run from `桌宠demo\新建文件夹\avatar-web-management`:

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

- [ ] **Step 3: Run boundary scans**

Run from `D:\FOXD`:

```powershell
rg -n "child_process|exec\(|spawn\(|PowerShell|Start Alife|Stop Alife|Restart Alife|Repair Alife|Apply Alife|Delete Alife" "桌宠demo\新建文件夹\avatar-web-management\src\app\api\pet\sync" "桌宠demo\新建文件夹\avatar-web-management\src\lib\services\petSyncStatusService.ts"
rg -n "model PetSyncStatus|desktop_known_version|pet_sync_statuses" "桌宠demo\新建文件夹\avatar-web-management\prisma"
git diff --check
git diff --name-only HEAD
git status --short --branch
```

Expected:

- First `rg` exits with no matches.
- Second `rg` shows only the existing Prisma model evidence, not a migration change.
- `git diff --check` exits 0.
- Changed tracked files are limited to sync route, sync status service, tests, and the optional protocol doc.
- `docs/superpowers/plans/2026-07-03-foxd-next-roadmap.md` remains untracked unless the user explicitly asks to commit it.

- [ ] **Step 4: Update the protocol status document**

In `docs/2026-07-03-alife-webbridge-protocol-status.md`, update the protocol matrix row:

```markdown
| Pet config pull | `GET/POST /api/pet/sync` | Alife config pull | Implemented and persisted | POST records a desktop config-pull snapshot in `PetSyncStatus`; active apply confirmation remains `/api/pet/sync/status`. |
```

Update the open gaps list by replacing:

```markdown
3. Web `/api/pet/sync` POST is not yet a persisted desktop-state round trip.
```

with:

```markdown
3. Web `/api/pet/sync` POST now persists config-pull evidence; active desktop runtime apply evidence remains separate.
```

- [ ] **Step 5: Verify protocol doc anchors**

Run from `D:\FOXD`:

```powershell
Select-String -Path docs\2026-07-03-alife-webbridge-protocol-status.md -Pattern "Implemented and persisted|config-pull snapshot|active desktop runtime apply evidence remains separate"
git diff --check
```

Expected: each anchor appears and diff check exits 0.

- [ ] **Step 6: Commit verification doc update**

Run from `D:\FOXD`:

```powershell
git add docs/2026-07-03-alife-webbridge-protocol-status.md
git commit -m "docs: record pet sync POST persistence"
```

Expected: one documentation commit.

## Task 5: Final Review And Branch Finish

**Files:**

- No source changes unless review finds issues.

- [ ] **Step 1: Request code review**

Use `superpowers:requesting-code-review`.

Review range:

```text
Base: 41a8884ec1226537a56f803c1a0357e991caf5cd
Head: latest commit after Task 4
```

Ask the reviewer to check:

- `POST /api/pet/sync` response compatibility.
- No Prisma schema or migration changes.
- No Alife code or gitlink changes.
- `reportConfigPull` does not downgrade same-version applied/staged/failed states.
- Stale errors are cleared only when a newer config pull arrives.
- Invalid bodies and invalid timestamps fail safely.
- No shell/PowerShell/browser management actions are introduced.

- [ ] **Step 2: Apply review fixes with TDD if needed**

If the review finds Critical or Important issues, use `superpowers:receiving-code-review` and `superpowers:test-driven-development` before changing implementation.

Expected: every fix has a failing test first.

- [ ] **Step 3: Run final verification**

Run the same commands from Task 4 Steps 1-3.

Expected: all pass, with no tracked diff after the final commit.

- [ ] **Step 4: Use finishing skill**

Use `superpowers:finishing-a-development-branch`.

Expected: present the user with the standard finish options. Since this repo is currently a normal repo on `master`, do not merge or push unless the user chooses that option.

## Self-Review Checklist

Spec coverage:

- `POST /api/pet/sync` persists config-pull state in `PetSyncStatus`.
- The desktop config export response remains unchanged.
- The implementation does not modify Prisma schema, migrations, Alife source, UI, or gitlinks.
- Apply confirmation remains separate from config pull.
- Invalid input and stale status transitions are tested.

Marker scan:

- This plan contains no intentionally unfinished implementation markers.

Type consistency:

- `ReportPetSyncPullInput` is defined before the route imports it.
- `reportConfigPull` arguments match every contract test assertion.
- Existing `DesktopSyncStatus` fields are reused without adding new public UI fields.
