# Desktop Pet Sync Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a visible, testable desktop pet sync status experience so Web saves, desktop pulls, local confirmation, applied versions, and failures are clearly separated for the user.

**Architecture:** Add a pure sync status domain model first, then persist/report desktop milestones through a small service and `/api/pet/sync/status` route. The pet settings page consumes that status through a focused panel component; the preview page shows a lightweight desktop parity note without claiming the desktop has applied a Web-only preview.

**Tech Stack:** Next.js App Router, TypeScript, React 19, Ant Design 6, Prisma 7, Jest, Testing Library.

---

## Scope Check

The approved spec covers one product slice: desktop pet sync visibility. It touches Web state modeling, one API surface, and two pet-related UI surfaces. This is one coherent implementation plan because each task advances the same user journey and can be verified independently.

## File Structure

- Create `src/lib/webbridge/sync-status.ts`
  - Owns public status types, desktop milestone validation, error mapping, and user-facing summary derivation.
- Create `src/lib/services/petSyncStatusService.ts`
  - Owns persistence and retrieval of sync status records through Prisma.
- Modify `prisma/schema.prisma`
  - Adds `PetSyncStatus` table and relation to `PetConfig`.
- Create `src/app/api/pet/sync/status/route.ts`
  - Exposes authenticated `GET` for Web UI and `POST` for desktop milestone reports.
- Create `src/components/pet/sync/PetSyncStatusPanel.tsx`
  - Renders the primary status panel used by the pet settings page.
- Create `src/components/pet/sync/PetDesktopStatusChip.tsx`
  - Renders a compact preview-page note that distinguishes Web preview from desktop-applied state.
- Modify `src/app/(auth)/dashboard/pet/page.tsx`
  - Fetches sync status, refreshes it after save, renders the status panel, and maps the setup wizard to real status.
- Modify `src/components/pet/preview/PetPreview.tsx`
  - Fetches sync status and renders the compact desktop status chip.
- Modify `messages/en.json`, `messages/zh-CN.json`, and `messages/ja.json`
  - Adds text keys for status panel and preview chip.
- Add focused tests:
  - `tests/unit/webbridge-sync-status.test.ts`
  - `tests/unit/pet-sync-status-service.test.ts`
  - `tests/contract/pet-sync-status-api.test.ts`
  - `src/components/__tests__/PetSyncStatusPanel.test.tsx`
  - Update `src/components/__tests__/PetPreview.test.tsx`

---

### Task 1: Sync Status Domain Model

**Files:**
- Create: `src/lib/webbridge/sync-status.ts`
- Test: `tests/unit/webbridge-sync-status.test.ts`

- [ ] **Step 1: Write the failing unit tests**

Create `tests/unit/webbridge-sync-status.test.ts`:

```ts
import {
  DESKTOP_SYNC_ERROR_MESSAGES,
  buildDesktopSyncStatus,
  normalizeDesktopMilestone,
} from '@/lib/webbridge/sync-status';

describe('webbridge sync status model', () => {
  it('reports pending desktop pull when Web has a newer config version', () => {
    const status = buildDesktopSyncStatus({
      webConfigVersion: 12,
      desktopKnownVersion: 11,
      desktopAppliedVersion: 11,
      packageState: 'published',
      requiresLocalConfirmation: true,
      lastSyncAt: '2026-06-27T10:00:00.000Z',
      lastAppliedAt: '2026-06-27T09:00:00.000Z',
      lastError: null,
    });

    expect(status.packageState).toBe('published');
    expect(status.summaryKind).toBe('pendingPull');
    expect(status.primaryAction).toBe('checkAgain');
    expect(status.isUpToDate).toBe(false);
  });

  it('reports local confirmation when the desktop staged the latest version', () => {
    const status = buildDesktopSyncStatus({
      webConfigVersion: 12,
      desktopKnownVersion: 12,
      desktopAppliedVersion: 11,
      packageState: 'staged',
      requiresLocalConfirmation: true,
      lastSyncAt: '2026-06-27T10:05:00.000Z',
      lastAppliedAt: '2026-06-27T09:00:00.000Z',
      lastError: null,
    });

    expect(status.summaryKind).toBe('localConfirmationRequired');
    expect(status.primaryAction).toBe('confirmInDesktop');
    expect(status.isUpToDate).toBe(false);
  });

  it('reports applied when desktop applied version matches Web version', () => {
    const status = buildDesktopSyncStatus({
      webConfigVersion: 12,
      desktopKnownVersion: 12,
      desktopAppliedVersion: 12,
      packageState: 'applied',
      requiresLocalConfirmation: true,
      lastSyncAt: '2026-06-27T10:05:00.000Z',
      lastAppliedAt: '2026-06-27T10:06:00.000Z',
      lastError: null,
    });

    expect(status.summaryKind).toBe('upToDate');
    expect(status.primaryAction).toBe('none');
    expect(status.isUpToDate).toBe(true);
  });

  it('maps package hash mismatch to a recovery action', () => {
    expect(DESKTOP_SYNC_ERROR_MESSAGES.PACKAGE_HASH_MISMATCH).toEqual({
      title: 'Package validation failed',
      recovery: 'Re-download the package from the Web management app.',
    });
  });

  it('accepts known desktop milestones', () => {
    expect(normalizeDesktopMilestone('manifestFetched')).toBe('manifestFetched');
    expect(normalizeDesktopMilestone('filesDownloaded')).toBe('filesDownloaded');
    expect(normalizeDesktopMilestone('hashValidated')).toBe('hashValidated');
    expect(normalizeDesktopMilestone('packageStaged')).toBe('packageStaged');
    expect(normalizeDesktopMilestone('confirmationRequested')).toBe('confirmationRequested');
    expect(normalizeDesktopMilestone('packageApplied')).toBe('packageApplied');
    expect(normalizeDesktopMilestone('packageFailed')).toBe('packageFailed');
  });

  it('rejects unknown desktop milestones', () => {
    expect(() => normalizeDesktopMilestone('other')).toThrow('Unknown desktop sync milestone: other');
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run from `桌宠demo/新建文件夹/avatar-web-management`:

```powershell
npx jest --runInBand tests/unit/webbridge-sync-status.test.ts
```

Expected: fail because `@/lib/webbridge/sync-status` does not exist.

- [ ] **Step 3: Implement the status model**

Create `src/lib/webbridge/sync-status.ts`:

```ts
import { ValidationError } from '@/lib/errors';

export type DesktopConnectionState = 'unknown' | 'checking' | 'online' | 'offline';
export type DesktopPackageState = 'notPublished' | 'published' | 'pulled' | 'staged' | 'applied' | 'failed';
export type DesktopPrimaryAction = 'none' | 'checkAgain' | 'openDesktop' | 'confirmInDesktop' | 'viewDetails';
export type DesktopSummaryKind =
  | 'unknown'
  | 'desktopOffline'
  | 'pendingPull'
  | 'localConfirmationRequired'
  | 'upToDate'
  | 'failed';

export type DesktopSyncMilestone =
  | 'manifestFetched'
  | 'filesDownloaded'
  | 'hashValidated'
  | 'packageStaged'
  | 'confirmationRequested'
  | 'packageApplied'
  | 'packageFailed';

export type DesktopSyncErrorCode =
  | 'WEBBRIDGE_OFFLINE'
  | 'PACKAGE_HASH_MISMATCH'
  | 'LOCAL_CONFIRMATION_REQUIRED'
  | 'PACKAGE_APPLY_FAILED'
  | 'PACKAGE_DOWNLOAD_FAILED'
  | 'PACKAGE_SECURITY_BLOCKED';

export interface DesktopSyncError {
  code: DesktopSyncErrorCode;
  message: string;
  technicalDetail?: string;
}

export interface DesktopSyncStatusInput {
  desktopConnection?: DesktopConnectionState;
  webConfigVersion: number;
  desktopKnownVersion: number | null;
  desktopAppliedVersion: number | null;
  packageState: DesktopPackageState;
  requiresLocalConfirmation: boolean;
  lastSyncAt: string | null;
  lastAppliedAt: string | null;
  lastError: DesktopSyncError | null;
}

export interface DesktopSyncStatus extends DesktopSyncStatusInput {
  desktopConnection: DesktopConnectionState;
  summaryKind: DesktopSummaryKind;
  primaryAction: DesktopPrimaryAction;
  isUpToDate: boolean;
}

export interface DesktopSyncErrorMessage {
  title: string;
  recovery: string;
}

export const DESKTOP_SYNC_ERROR_MESSAGES: Record<DesktopSyncErrorCode, DesktopSyncErrorMessage> = {
  WEBBRIDGE_OFFLINE: {
    title: 'Desktop client is offline',
    recovery: 'Start Alife and click Check again.',
  },
  PACKAGE_HASH_MISMATCH: {
    title: 'Package validation failed',
    recovery: 'Re-download the package from the Web management app.',
  },
  LOCAL_CONFIRMATION_REQUIRED: {
    title: 'Local confirmation required',
    recovery: 'Confirm the staged update in Alife.',
  },
  PACKAGE_APPLY_FAILED: {
    title: 'Desktop apply failed',
    recovery: 'Open Alife logs and retry after fixing the desktop error.',
  },
  PACKAGE_DOWNLOAD_FAILED: {
    title: 'Package download failed',
    recovery: 'Check the Web management app connection and retry the package pull.',
  },
  PACKAGE_SECURITY_BLOCKED: {
    title: 'Package blocked for safety',
    recovery: 'Inspect the package paths and reject the unsafe package.',
  },
};

const MILESTONES: DesktopSyncMilestone[] = [
  'manifestFetched',
  'filesDownloaded',
  'hashValidated',
  'packageStaged',
  'confirmationRequested',
  'packageApplied',
  'packageFailed',
];

export function normalizeDesktopMilestone(value: unknown): DesktopSyncMilestone {
  if (typeof value === 'string' && MILESTONES.includes(value as DesktopSyncMilestone)) {
    return value as DesktopSyncMilestone;
  }
  throw new ValidationError(`Unknown desktop sync milestone: ${String(value)}`);
}

export function buildDesktopSyncStatus(input: DesktopSyncStatusInput): DesktopSyncStatus {
  const desktopConnection = input.desktopConnection ?? deriveConnection(input);
  const isUpToDate =
    input.packageState === 'applied' &&
    input.desktopAppliedVersion !== null &&
    input.desktopAppliedVersion >= input.webConfigVersion;

  if (input.lastError || input.packageState === 'failed') {
    return {
      ...input,
      desktopConnection,
      summaryKind: 'failed',
      primaryAction: 'viewDetails',
      isUpToDate: false,
    };
  }

  if (desktopConnection === 'offline') {
    return {
      ...input,
      desktopConnection,
      summaryKind: 'desktopOffline',
      primaryAction: 'checkAgain',
      isUpToDate: false,
    };
  }

  if (isUpToDate) {
    return {
      ...input,
      desktopConnection,
      summaryKind: 'upToDate',
      primaryAction: 'none',
      isUpToDate: true,
    };
  }

  if (input.packageState === 'staged' || input.packageState === 'pulled') {
    return {
      ...input,
      desktopConnection,
      summaryKind: 'localConfirmationRequired',
      primaryAction: 'confirmInDesktop',
      isUpToDate: false,
    };
  }

  if (
    input.desktopKnownVersion === null ||
    input.desktopKnownVersion < input.webConfigVersion ||
    input.packageState === 'published'
  ) {
    return {
      ...input,
      desktopConnection,
      summaryKind: 'pendingPull',
      primaryAction: 'checkAgain',
      isUpToDate: false,
    };
  }

  return {
    ...input,
    desktopConnection,
    summaryKind: 'unknown',
    primaryAction: 'checkAgain',
    isUpToDate: false,
  };
}

function deriveConnection(input: DesktopSyncStatusInput): DesktopConnectionState {
  if (!input.lastSyncAt) return 'unknown';
  const lastSync = Date.parse(input.lastSyncAt);
  if (!Number.isFinite(lastSync)) return 'unknown';
  return Date.now() - lastSync <= 5 * 60 * 1000 ? 'online' : 'offline';
}
```

- [ ] **Step 4: Run the focused test**

```powershell
npx jest --runInBand tests/unit/webbridge-sync-status.test.ts
```

Expected: pass with 6 tests.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/webbridge/sync-status.ts tests/unit/webbridge-sync-status.test.ts
git commit -m "feat: add desktop sync status model"
```

---

### Task 2: Persistent Sync Status Service

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/lib/services/petSyncStatusService.ts`
- Test: `tests/unit/pet-sync-status-service.test.ts`

- [ ] **Step 1: Write the failing service tests**

Create `tests/unit/pet-sync-status-service.test.ts`:

```ts
import { petSyncStatusService } from '@/lib/services/petSyncStatusService';

const mockPrismaClient = {
  petConfig: {
    findUnique: jest.fn(),
  },
  petSyncStatus: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

jest.mock('@/lib/db', () => ({
  getPrisma: jest.fn(() => mockPrismaClient),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

const userId = 'user-1';
const workspaceId = 'ws-1';

describe('petSyncStatusService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a default published status when no desktop report exists', async () => {
    mockPrismaClient.petConfig.findUnique.mockResolvedValue({
      id: 'config-1',
      userId,
      workspaceId,
      updatedAt: new Date('2026-06-27T10:00:00.000Z'),
    });
    mockPrismaClient.petSyncStatus.findUnique.mockResolvedValue(null);

    const status = await petSyncStatusService.getStatus(userId, workspaceId);

    expect(status.webConfigVersion).toBeGreaterThan(0);
    expect(status.desktopKnownVersion).toBeNull();
    expect(status.desktopAppliedVersion).toBeNull();
    expect(status.packageState).toBe('published');
    expect(status.summaryKind).toBe('pendingPull');
  });

  it('updates status when desktop reports packageStaged', async () => {
    mockPrismaClient.petConfig.findUnique.mockResolvedValue({
      id: 'config-1',
      userId,
      workspaceId,
      updatedAt: new Date('2026-06-27T10:00:00.000Z'),
    });
    mockPrismaClient.petSyncStatus.upsert.mockResolvedValue({
      petConfigId: 'config-1',
      desktopKnownVersion: 1793162400000,
      desktopAppliedVersion: null,
      packageState: 'staged',
      lastSyncAt: new Date('2026-06-27T10:05:00.000Z'),
      lastAppliedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      lastErrorDetail: null,
      requiresLocalConfirmation: true,
    });

    const status = await petSyncStatusService.reportMilestone(userId, workspaceId, {
      milestone: 'packageStaged',
      packageVersion: 1793162400000,
      reportedAt: '2026-06-27T10:05:00.000Z',
    });

    expect(mockPrismaClient.petSyncStatus.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { petConfigId: 'config-1' },
        create: expect.objectContaining({
          petConfigId: 'config-1',
          packageState: 'staged',
          desktopKnownVersion: 1793162400000,
        }),
        update: expect.objectContaining({
          packageState: 'staged',
          desktopKnownVersion: 1793162400000,
        }),
      })
    );
    expect(status.summaryKind).toBe('localConfirmationRequired');
  });

  it('updates applied version when desktop reports packageApplied', async () => {
    mockPrismaClient.petConfig.findUnique.mockResolvedValue({
      id: 'config-1',
      userId,
      workspaceId,
      updatedAt: new Date('2026-06-27T10:00:00.000Z'),
    });
    mockPrismaClient.petSyncStatus.upsert.mockResolvedValue({
      petConfigId: 'config-1',
      desktopKnownVersion: 1793162400000,
      desktopAppliedVersion: 1793162400000,
      packageState: 'applied',
      lastSyncAt: new Date('2026-06-27T10:06:00.000Z'),
      lastAppliedAt: new Date('2026-06-27T10:06:00.000Z'),
      lastErrorCode: null,
      lastErrorMessage: null,
      lastErrorDetail: null,
      requiresLocalConfirmation: true,
    });

    const status = await petSyncStatusService.reportMilestone(userId, workspaceId, {
      milestone: 'packageApplied',
      packageVersion: 1793162400000,
      reportedAt: '2026-06-27T10:06:00.000Z',
    });

    expect(status.packageState).toBe('applied');
    expect(status.desktopAppliedVersion).toBe(1793162400000);
  });
});
```

- [ ] **Step 2: Run the service test and verify it fails**

```powershell
npx jest --runInBand tests/unit/pet-sync-status-service.test.ts
```

Expected: fail because `petSyncStatusService` does not exist.

- [ ] **Step 3: Add the Prisma model**

In `prisma/schema.prisma`, add the relation inside `PetConfig`:

```prisma
  syncStatus PetSyncStatus?
```

Then add this model after `PetSessionLog`:

```prisma
model PetSyncStatus {
  id                        String   @id @default(uuid())
  petConfigId               String   @unique @map("pet_config_id")
  desktopKnownVersion       BigInt?  @map("desktop_known_version")
  desktopAppliedVersion     BigInt?  @map("desktop_applied_version")
  packageState              String   @default("notPublished") @map("package_state")
  requiresLocalConfirmation Boolean  @default(true) @map("requires_local_confirmation")
  lastSyncAt                DateTime? @map("last_sync_at")
  lastAppliedAt             DateTime? @map("last_applied_at")
  lastErrorCode             String?  @map("last_error_code")
  lastErrorMessage          String?  @map("last_error_message")
  lastErrorDetail           String?  @map("last_error_detail")
  updatedAt                 DateTime @updatedAt @map("updated_at")
  createdAt                 DateTime @default(now()) @map("created_at")

  petConfig PetConfig @relation(fields: [petConfigId], references: [id], onDelete: Cascade)

  @@index([packageState])
  @@map("pet_sync_statuses")
}
```

- [ ] **Step 4: Implement the service**

Create `src/lib/services/petSyncStatusService.ts`:

```ts
import { getPrisma } from '@/lib/db';
import { NotFoundError, ValidationError } from '@/lib/errors';
import {
  type DesktopPackageState,
  type DesktopSyncError,
  type DesktopSyncMilestone,
  type DesktopSyncStatus,
  buildDesktopSyncStatus,
  normalizeDesktopMilestone,
} from '@/lib/webbridge/sync-status';

interface ReportMilestoneInput {
  milestone: DesktopSyncMilestone | string;
  packageVersion?: number;
  reportedAt?: string;
  error?: DesktopSyncError | null;
}

type RawSyncRow = {
  desktopKnownVersion: bigint | number | null;
  desktopAppliedVersion: bigint | number | null;
  packageState: string;
  requiresLocalConfirmation: boolean;
  lastSyncAt: Date | string | null;
  lastAppliedAt: Date | string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lastErrorDetail: string | null;
};

export const petSyncStatusService = {
  async getStatus(userId: string, workspaceId: string): Promise<DesktopSyncStatus> {
    const prisma = getPrisma();
    const config = await prisma.petConfig.findUnique({ where: { userId } });
    if (!config || config.workspaceId !== workspaceId) {
      throw new NotFoundError('PetConfig', userId);
    }

    const webConfigVersion = versionFromUpdatedAt(config.updatedAt);
    const row = await prisma.petSyncStatus.findUnique({
      where: { petConfigId: config.id },
    });

    if (!row) {
      return buildDesktopSyncStatus({
        desktopConnection: 'unknown',
        webConfigVersion,
        desktopKnownVersion: null,
        desktopAppliedVersion: null,
        packageState: 'published',
        requiresLocalConfirmation: true,
        lastSyncAt: null,
        lastAppliedAt: null,
        lastError: null,
      });
    }

    return rowToStatus(row as RawSyncRow, webConfigVersion);
  },

  async reportMilestone(
    userId: string,
    workspaceId: string,
    input: ReportMilestoneInput
  ): Promise<DesktopSyncStatus> {
    const milestone = normalizeDesktopMilestone(input.milestone);
    const prisma = getPrisma();
    const config = await prisma.petConfig.findUnique({ where: { userId } });
    if (!config || config.workspaceId !== workspaceId) {
      throw new NotFoundError('PetConfig', userId);
    }

    const webConfigVersion = versionFromUpdatedAt(config.updatedAt);
    const packageVersion = input.packageVersion ?? webConfigVersion;
    if (!Number.isFinite(packageVersion) || packageVersion <= 0) {
      throw new ValidationError('packageVersion must be a positive number');
    }

    const reportedAt = input.reportedAt ? new Date(input.reportedAt) : new Date();
    if (!Number.isFinite(reportedAt.getTime())) {
      throw new ValidationError('reportedAt must be a valid ISO timestamp');
    }

    const state = stateForMilestone(milestone);
    const error = milestone === 'packageFailed' ? input.error ?? {
      code: 'PACKAGE_APPLY_FAILED' as const,
      message: 'Desktop package processing failed',
    } : null;

    const data = {
      desktopKnownVersion: BigInt(packageVersion),
      desktopAppliedVersion: milestone === 'packageApplied' ? BigInt(packageVersion) : undefined,
      packageState: state,
      requiresLocalConfirmation: true,
      lastSyncAt: reportedAt,
      lastAppliedAt: milestone === 'packageApplied' ? reportedAt : undefined,
      lastErrorCode: error?.code ?? null,
      lastErrorMessage: error?.message ?? null,
      lastErrorDetail: error?.technicalDetail ?? null,
    };

    const row = await prisma.petSyncStatus.upsert({
      where: { petConfigId: config.id },
      create: {
        petConfigId: config.id,
        ...data,
        desktopAppliedVersion: data.desktopAppliedVersion ?? null,
        lastAppliedAt: data.lastAppliedAt ?? null,
      },
      update: data,
    });

    return rowToStatus(row as RawSyncRow, webConfigVersion);
  },
};

function versionFromUpdatedAt(value: Date | string): number {
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return 1;
  return Math.max(1, ms);
}

function stateForMilestone(milestone: DesktopSyncMilestone): DesktopPackageState {
  if (milestone === 'manifestFetched') return 'published';
  if (milestone === 'filesDownloaded') return 'pulled';
  if (milestone === 'hashValidated') return 'pulled';
  if (milestone === 'packageStaged') return 'staged';
  if (milestone === 'confirmationRequested') return 'staged';
  if (milestone === 'packageApplied') return 'applied';
  return 'failed';
}

function rowToStatus(row: RawSyncRow, webConfigVersion: number): DesktopSyncStatus {
  return buildDesktopSyncStatus({
    webConfigVersion,
    desktopKnownVersion: numberOrNull(row.desktopKnownVersion),
    desktopAppliedVersion: numberOrNull(row.desktopAppliedVersion),
    packageState: row.packageState as DesktopPackageState,
    requiresLocalConfirmation: row.requiresLocalConfirmation,
    lastSyncAt: isoOrNull(row.lastSyncAt),
    lastAppliedAt: isoOrNull(row.lastAppliedAt),
    lastError: row.lastErrorCode ? {
      code: row.lastErrorCode as DesktopSyncError['code'],
      message: row.lastErrorMessage || 'Desktop sync failed',
      technicalDetail: row.lastErrorDetail || undefined,
    } : null,
  });
}

function numberOrNull(value: bigint | number | null): number | null {
  if (value === null) return null;
  return Number(value);
}

function isoOrNull(value: Date | string | null): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}
```

- [ ] **Step 5: Run focused service tests**

```powershell
npx jest --runInBand tests/unit/webbridge-sync-status.test.ts tests/unit/pet-sync-status-service.test.ts
```

Expected: both suites pass.

- [ ] **Step 6: Regenerate Prisma client after schema change**

```powershell
npx prisma generate
```

Expected: Prisma Client generated successfully.

- [ ] **Step 7: Commit**

```powershell
git add prisma/schema.prisma src/lib/services/petSyncStatusService.ts tests/unit/pet-sync-status-service.test.ts
git commit -m "feat: persist desktop sync status"
```

---

### Task 3: Sync Status API Contract

**Files:**
- Create: `src/app/api/pet/sync/status/route.ts`
- Test: `tests/contract/pet-sync-status-api.test.ts`

- [ ] **Step 1: Write the failing contract tests**

Create `tests/contract/pet-sync-status-api.test.ts`:

```ts
import type { NextRequest } from 'next/server';

export {};

const mockPetSyncStatusService = {
  getStatus: jest.fn(),
  reportMilestone: jest.fn(),
};

jest.mock('@/lib/services/petSyncStatusService', () => ({
  petSyncStatusService: mockPetSyncStatusService,
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

function mockRequest(method: string, url: string, body?: unknown, auth = true): NextRequest {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (auth) headers.set('authorization', 'Bearer test-token');

  return new Request(`http://localhost${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as NextRequest;
}

async function parseResponse(res: Response) {
  return { status: res.status, body: await res.json() };
}

const statusPayload = {
  desktopConnection: 'online',
  webConfigVersion: 12,
  desktopKnownVersion: 12,
  desktopAppliedVersion: 11,
  packageState: 'staged',
  requiresLocalConfirmation: true,
  lastSyncAt: '2026-06-27T10:05:00.000Z',
  lastAppliedAt: '2026-06-27T09:00:00.000Z',
  lastError: null,
  summaryKind: 'localConfirmationRequired',
  primaryAction: 'confirmInDesktop',
  isUpToDate: false,
};

describe('/api/pet/sync/status contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns current desktop sync status', async () => {
    mockPetSyncStatusService.getStatus.mockResolvedValue(statusPayload);

    const { GET } = await import('@/app/api/pet/sync/status/route');
    const res = await GET(mockRequest('GET', '/api/pet/sync/status'));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(statusPayload);
    expect(mockPetSyncStatusService.getStatus).toHaveBeenCalledWith('user-1', 'ws-1');
  });

  it('accepts desktop milestone reports', async () => {
    mockPetSyncStatusService.reportMilestone.mockResolvedValue(statusPayload);

    const { POST } = await import('@/app/api/pet/sync/status/route');
    const res = await POST(mockRequest('POST', '/api/pet/sync/status', {
      milestone: 'packageStaged',
      packageVersion: 12,
      reportedAt: '2026-06-27T10:05:00.000Z',
    }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.summaryKind).toBe('localConfirmationRequired');
    expect(mockPetSyncStatusService.reportMilestone).toHaveBeenCalledWith('user-1', 'ws-1', {
      milestone: 'packageStaged',
      packageVersion: 12,
      reportedAt: '2026-06-27T10:05:00.000Z',
    });
  });

  it('returns 401 without auth', async () => {
    const { GET } = await import('@/app/api/pet/sync/status/route');
    const res = await GET(mockRequest('GET', '/api/pet/sync/status', undefined, false));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the contract test and verify it fails**

```powershell
npx jest --runInBand tests/contract/pet-sync-status-api.test.ts
```

Expected: fail because the route does not exist.

- [ ] **Step 3: Implement the route**

Create `src/app/api/pet/sync/status/route.ts`:

```ts
export const runtime = 'nodejs';

import { withAuth } from '@/lib/auth/middleware';
import { success, error } from '@/lib/api-response';
import { petSyncStatusService } from '@/lib/services/petSyncStatusService';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:pet:sync-status');

export const GET = withAuth(async (_req, user) => {
  try {
    const status = await petSyncStatusService.getStatus(user.sub, user.workspaceId);
    return success(status);
  } catch (err) {
    log.error({ err }, 'Pet sync status fetch failed');
    return error(err);
  }
});

export const POST = withAuth(async (req, user) => {
  try {
    const body = await req.json().catch(() => ({}));
    const status = await petSyncStatusService.reportMilestone(user.sub, user.workspaceId, body);
    return success(status);
  } catch (err) {
    log.error({ err }, 'Pet sync status report failed');
    return error(err);
  }
});
```

- [ ] **Step 4: Run status and existing sync contract tests**

```powershell
npx jest --runInBand tests/contract/pet-sync-status-api.test.ts tests/contract/pet-sync-contract.test.ts tests/contract/webbridge-package-api.test.ts
```

Expected: all listed suites pass.

- [ ] **Step 5: Commit**

```powershell
git add src/app/api/pet/sync/status/route.ts tests/contract/pet-sync-status-api.test.ts
git commit -m "feat: add desktop sync status API"
```

---

### Task 4: Pet Settings Status Panel

**Files:**
- Create: `src/components/pet/sync/PetSyncStatusPanel.tsx`
- Test: `src/components/__tests__/PetSyncStatusPanel.test.tsx`
- Modify: `messages/en.json`
- Modify: `messages/zh-CN.json`
- Modify: `messages/ja.json`

- [ ] **Step 1: Write the failing component tests**

Create `src/components/__tests__/PetSyncStatusPanel.test.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { App } from 'antd';
import PetSyncStatusPanel from '@/components/pet/sync/PetSyncStatusPanel';
import type { DesktopSyncStatus } from '@/lib/webbridge/sync-status';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <App>{children}</App>;
}

function status(overrides: Partial<DesktopSyncStatus>): DesktopSyncStatus {
  return {
    desktopConnection: 'online',
    webConfigVersion: 12,
    desktopKnownVersion: 12,
    desktopAppliedVersion: 11,
    packageState: 'staged',
    requiresLocalConfirmation: true,
    lastSyncAt: '2026-06-27T10:05:00.000Z',
    lastAppliedAt: '2026-06-27T09:00:00.000Z',
    lastError: null,
    summaryKind: 'localConfirmationRequired',
    primaryAction: 'confirmInDesktop',
    isUpToDate: false,
    ...overrides,
  };
}

describe('PetSyncStatusPanel', () => {
  it('shows local confirmation required state', () => {
    render(<PetSyncStatusPanel status={status({})} loading={false} onRefresh={jest.fn()} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('syncStatus.summary.localConfirmationRequired')).toBeDefined();
    expect(screen.getByText('syncStatus.action.confirmInDesktop')).toBeDefined();
  });

  it('shows up-to-date state without a primary action', () => {
    render(
      <PetSyncStatusPanel
        status={status({
          desktopAppliedVersion: 12,
          packageState: 'applied',
          summaryKind: 'upToDate',
          primaryAction: 'none',
          isUpToDate: true,
        })}
        loading={false}
        onRefresh={jest.fn()}
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getByText('syncStatus.summary.upToDate')).toBeDefined();
    expect(screen.queryByText('syncStatus.action.checkAgain')).toBeNull();
  });

  it('calls refresh from the check again action', () => {
    const onRefresh = jest.fn();
    render(
      <PetSyncStatusPanel
        status={status({
          desktopConnection: 'offline',
          summaryKind: 'desktopOffline',
          primaryAction: 'checkAgain',
        })}
        loading={false}
        onRefresh={onRefresh}
      />,
      { wrapper: Wrapper }
    );

    fireEvent.click(screen.getByText('syncStatus.action.checkAgain'));
    expect(onRefresh).toHaveBeenCalled();
  });

  it('shows failure technical details', () => {
    render(
      <PetSyncStatusPanel
        status={status({
          packageState: 'failed',
          summaryKind: 'failed',
          primaryAction: 'viewDetails',
          lastError: {
            code: 'PACKAGE_HASH_MISMATCH',
            message: 'Hash did not match',
            technicalDetail: 'expected abc, got def',
          },
        })}
        loading={false}
        onRefresh={jest.fn()}
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getByText('PACKAGE_HASH_MISMATCH')).toBeDefined();
    expect(screen.getByText('expected abc, got def')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the component test and verify it fails**

```powershell
npx jest --runInBand src/components/__tests__/PetSyncStatusPanel.test.tsx
```

Expected: fail because `PetSyncStatusPanel` does not exist.

- [ ] **Step 3: Implement the panel component**

Create directory `src/components/pet/sync` and file `src/components/pet/sync/PetSyncStatusPanel.tsx`:

```tsx
'use client';

import { Alert, Button, Card, Descriptions, Space, Spin, Tag, Typography } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DisconnectOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { DesktopSyncStatus } from '@/lib/webbridge/sync-status';

const { Text } = Typography;

interface PetSyncStatusPanelProps {
  status: DesktopSyncStatus | null;
  loading: boolean;
  onRefresh: () => void;
}

const TAG_COLOR: Record<DesktopSyncStatus['summaryKind'], string> = {
  unknown: 'default',
  desktopOffline: 'red',
  pendingPull: 'gold',
  localConfirmationRequired: 'blue',
  upToDate: 'green',
  failed: 'red',
};

const ICONS: Record<DesktopSyncStatus['summaryKind'], React.ReactNode> = {
  unknown: <ClockCircleOutlined />,
  desktopOffline: <DisconnectOutlined />,
  pendingPull: <ClockCircleOutlined />,
  localConfirmationRequired: <ExclamationCircleOutlined />,
  upToDate: <CheckCircleOutlined />,
  failed: <ExclamationCircleOutlined />,
};

export default function PetSyncStatusPanel({
  status,
  loading,
  onRefresh,
}: PetSyncStatusPanelProps) {
  const t = useTranslations('pet');

  if (loading && !status) {
    return (
      <Card className="mb-4">
        <Spin size="small" /> <Text>{t('syncStatus.loading')}</Text>
      </Card>
    );
  }

  if (!status) {
    return (
      <Alert
        className="mb-4"
        type="warning"
        showIcon
        message={t('syncStatus.unavailable')}
        action={<Button size="small" icon={<ReloadOutlined />} onClick={onRefresh}>{t('syncStatus.action.checkAgain')}</Button>}
      />
    );
  }

  const action = renderAction(status, t, onRefresh, loading);

  return (
    <Card
      className="mb-4"
      title={
        <Space>
          {ICONS[status.summaryKind]}
          <span>{t('syncStatus.title')}</span>
          <Tag color={TAG_COLOR[status.summaryKind]}>
            {t(`syncStatus.summary.${status.summaryKind}`)}
          </Tag>
        </Space>
      }
      extra={action}
    >
      <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }}>
        <Descriptions.Item label={t('syncStatus.connection')}>
          {t(`syncStatus.connectionState.${status.desktopConnection}`)}
        </Descriptions.Item>
        <Descriptions.Item label={t('syncStatus.webVersion')}>
          {status.webConfigVersion}
        </Descriptions.Item>
        <Descriptions.Item label={t('syncStatus.desktopAppliedVersion')}>
          {status.desktopAppliedVersion ?? t('syncStatus.notApplied')}
        </Descriptions.Item>
        <Descriptions.Item label={t('syncStatus.lastSyncAt')}>
          {formatTime(status.lastSyncAt, t('syncStatus.never'))}
        </Descriptions.Item>
        <Descriptions.Item label={t('syncStatus.lastAppliedAt')}>
          {formatTime(status.lastAppliedAt, t('syncStatus.never'))}
        </Descriptions.Item>
        <Descriptions.Item label={t('syncStatus.localConfirmation')}>
          {status.requiresLocalConfirmation ? t('syncStatus.required') : t('syncStatus.notRequired')}
        </Descriptions.Item>
      </Descriptions>

      {status.lastError && (
        <Alert
          className="mt-3"
          type="error"
          showIcon
          message={status.lastError.message}
          description={
            <Space direction="vertical" size={2}>
              <Text code>{status.lastError.code}</Text>
              {status.lastError.technicalDetail && <Text>{status.lastError.technicalDetail}</Text>}
            </Space>
          }
        />
      )}
    </Card>
  );
}

function renderAction(
  status: DesktopSyncStatus,
  t: (key: string) => string,
  onRefresh: () => void,
  loading: boolean
) {
  if (status.primaryAction === 'none') return null;
  if (status.primaryAction === 'confirmInDesktop') {
    return <Button size="small" type="primary">{t('syncStatus.action.confirmInDesktop')}</Button>;
  }
  if (status.primaryAction === 'viewDetails') {
    return <Button size="small">{t('syncStatus.action.viewDetails')}</Button>;
  }
  return (
    <Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={onRefresh}>
      {t('syncStatus.action.checkAgain')}
    </Button>
  );
}

function formatTime(value: string | null, empty: string): string {
  if (!value) return empty;
  return new Date(value).toLocaleString();
}
```

- [ ] **Step 4: Add translation keys**

Add these keys under the existing `pet` object in `messages/en.json`:

```json
"syncStatus": {
  "title": "Desktop sync",
  "loading": "Checking desktop sync status...",
  "unavailable": "Desktop sync status is unavailable.",
  "connection": "Connection",
  "webVersion": "Web version",
  "desktopAppliedVersion": "Desktop applied version",
  "lastSyncAt": "Last sync",
  "lastAppliedAt": "Last applied",
  "localConfirmation": "Local confirmation",
  "required": "Required",
  "notRequired": "Not required",
  "notApplied": "Not applied",
  "never": "Never",
  "summary": {
    "unknown": "Unknown",
    "desktopOffline": "Desktop offline",
    "pendingPull": "Pending desktop pull",
    "localConfirmationRequired": "Local confirmation required",
    "upToDate": "Up to date",
    "failed": "Failed"
  },
  "connectionState": {
    "unknown": "Unknown",
    "checking": "Checking",
    "online": "Online",
    "offline": "Offline"
  },
  "action": {
    "checkAgain": "Check again",
    "confirmInDesktop": "Confirm in Alife",
    "viewDetails": "View details"
  }
}
```

Add equivalent keys under `pet` in `messages/zh-CN.json`:

```json
"syncStatus": {
  "title": "桌宠同步",
  "loading": "正在检查桌宠同步状态...",
  "unavailable": "暂时无法获取桌宠同步状态。",
  "connection": "连接状态",
  "webVersion": "网页版本",
  "desktopAppliedVersion": "桌宠已应用版本",
  "lastSyncAt": "上次同步",
  "lastAppliedAt": "上次应用",
  "localConfirmation": "本地确认",
  "required": "需要",
  "notRequired": "不需要",
  "notApplied": "未应用",
  "never": "从未",
  "summary": {
    "unknown": "未知",
    "desktopOffline": "桌宠离线",
    "pendingPull": "等待桌宠拉取",
    "localConfirmationRequired": "等待本地确认",
    "upToDate": "已是最新",
    "failed": "同步失败"
  },
  "connectionState": {
    "unknown": "未知",
    "checking": "检查中",
    "online": "在线",
    "offline": "离线"
  },
  "action": {
    "checkAgain": "重新检查",
    "confirmInDesktop": "在 Alife 中确认",
    "viewDetails": "查看详情"
  }
}
```

Add equivalent keys under `pet` in `messages/ja.json`:

```json
"syncStatus": {
  "title": "デスクトップ同期",
  "loading": "デスクトップ同期状態を確認しています...",
  "unavailable": "デスクトップ同期状態を取得できません。",
  "connection": "接続状態",
  "webVersion": "Web バージョン",
  "desktopAppliedVersion": "適用済みバージョン",
  "lastSyncAt": "最終同期",
  "lastAppliedAt": "最終適用",
  "localConfirmation": "ローカル確認",
  "required": "必要",
  "notRequired": "不要",
  "notApplied": "未適用",
  "never": "なし",
  "summary": {
    "unknown": "不明",
    "desktopOffline": "デスクトップはオフライン",
    "pendingPull": "デスクトップ取得待ち",
    "localConfirmationRequired": "ローカル確認待ち",
    "upToDate": "最新",
    "failed": "失敗"
  },
  "connectionState": {
    "unknown": "不明",
    "checking": "確認中",
    "online": "オンライン",
    "offline": "オフライン"
  },
  "action": {
    "checkAgain": "再確認",
    "confirmInDesktop": "Alife で確認",
    "viewDetails": "詳細を見る"
  }
}
```

- [ ] **Step 5: Run the component test**

```powershell
npx jest --runInBand src/components/__tests__/PetSyncStatusPanel.test.tsx
```

Expected: pass.

- [ ] **Step 6: Commit**

```powershell
git add src/components/pet/sync/PetSyncStatusPanel.tsx src/components/__tests__/PetSyncStatusPanel.test.tsx messages/en.json messages/zh-CN.json messages/ja.json
git commit -m "feat: add desktop sync status panel"
```

---

### Task 5: Wire Status Into Pet Settings Page

**Files:**
- Modify: `src/app/(auth)/dashboard/pet/page.tsx`
- Test: add or update `src/components/__tests__/PetConfigPageSync.test.tsx`

- [ ] **Step 1: Write a page-level test**

Create `src/components/__tests__/PetConfigPageSync.test.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { App } from 'antd';
import PetConfigPage from '@/app/(auth)/dashboard/pet/page';

Element.prototype.scrollIntoView = jest.fn();

const mockApiGet = jest.fn();
const mockApiPut = jest.fn();
const mockApiPost = jest.fn();

jest.mock('@/lib/api-client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPut: (...args: unknown[]) => mockApiPut(...args),
  apiPost: (...args: unknown[]) => mockApiPost(...args),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => key;
    t.rich = (key: string) => key;
    return t;
  },
}));

jest.mock('@/components/pet/sync/PetSyncStatusPanel', () => ({
  __esModule: true,
  default: ({ status, onRefresh }: any) => (
    <div data-testid="sync-status-panel">
      <span>{status?.summaryKind}</span>
      <button onClick={onRefresh}>refresh status</button>
    </div>
  ),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <App>{children}</App>;
}

const config = {
  id: 'config-1',
  pet_name: 'XiaYu',
  personality: 'calm',
  backstory: '',
  animation_model: 'live2d',
  idle_timeout: 300,
  wander_interval: 15,
};

const syncStatus = {
  desktopConnection: 'online',
  webConfigVersion: 12,
  desktopKnownVersion: 12,
  desktopAppliedVersion: 11,
  packageState: 'staged',
  requiresLocalConfirmation: true,
  lastSyncAt: '2026-06-27T10:05:00.000Z',
  lastAppliedAt: '2026-06-27T09:00:00.000Z',
  lastError: null,
  summaryKind: 'localConfirmationRequired',
  primaryAction: 'confirmInDesktop',
  isUpToDate: false,
};

describe('PetConfigPage desktop sync status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockImplementation((path: string) => {
      if (path === '/api/pet/config') return Promise.resolve({ success: true, data: config });
      if (path === '/api/pet/sync/status') return Promise.resolve({ success: true, data: syncStatus });
      if (path.startsWith('/api/pet/assets')) return Promise.resolve({ success: true, data: [] });
      return Promise.resolve({ success: false, error: 'unexpected path' });
    });
    mockApiPut.mockResolvedValue({ success: true, data: config });
  });

  it('renders the desktop sync panel after config loads', async () => {
    render(<PetConfigPage />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByTestId('sync-status-panel')).toBeDefined());
    expect(screen.getByText('localConfirmationRequired')).toBeDefined();
  });

  it('refreshes sync status after saving config', async () => {
    render(<PetConfigPage />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByText('saveConfig')).toBeDefined());
    fireEvent.click(screen.getByText('saveConfig'));

    await waitFor(() => expect(mockApiPut).toHaveBeenCalledWith('/api/pet/config', expect.any(Object)));
    expect(mockApiGet).toHaveBeenCalledWith('/api/pet/sync/status');
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

```powershell
npx jest --runInBand src/components/__tests__/PetConfigPageSync.test.tsx
```

Expected: fail because the page does not fetch or render sync status yet.

- [ ] **Step 3: Add imports and local status state**

Modify `src/app/(auth)/dashboard/pet/page.tsx`.

Add imports:

```ts
import PetSyncStatusPanel from '@/components/pet/sync/PetSyncStatusPanel';
import type { DesktopSyncStatus } from '@/lib/webbridge/sync-status';
```

Inside `PetConfigPage`, add state:

```ts
  const [syncStatus, setSyncStatus] = useState<DesktopSyncStatus | null>(null);
  const [syncStatusLoading, setSyncStatusLoading] = useState(false);
```

Add fetch function:

```ts
  const fetchSyncStatus = async () => {
    setSyncStatusLoading(true);
    const res = await apiGet<DesktopSyncStatus>('/api/pet/sync/status');
    if (res.success && res.data) {
      setSyncStatus(res.data);
    }
    setSyncStatusLoading(false);
  };
```

Update the first effect:

```ts
  useEffect(() => {
    fetchConfig();
    fetchSyncStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
```

Update successful save handling:

```ts
    if (res.success) {
      message.success(t('saveSuccess'));
      await fetchConfig();
      await fetchSyncStatus();
    } else {
      message.error(res.error || t('saveFailed'));
    }
```

Render the panel after the header block and before the wizard:

```tsx
      <PetSyncStatusPanel
        status={syncStatus}
        loading={syncStatusLoading}
        onRefresh={fetchSyncStatus}
      />
```

- [ ] **Step 4: Upgrade wizard step state**

In the existing `<Steps>` item list, set `current` based on sync state:

```ts
  const wizardCurrent = syncStatus?.summaryKind === 'upToDate'
    ? 5
    : syncStatus?.summaryKind === 'localConfirmationRequired'
      ? 4
      : syncStatus?.summaryKind === 'pendingPull'
        ? 3
        : syncStatus?.desktopConnection === 'online'
          ? 2
          : 0;
```

Use it in `<Steps>`:

```tsx
              current={wizardCurrent}
```

Extend wizard items to six steps using existing translation style:

```tsx
                {
                  title: t('wizard.step5Title'),
                  description: (
                    <span className="text-gray-400 text-xs">
                      {t('wizard.step5Desc')}
                    </span>
                  ),
                  icon: <CheckCircleOutlined />,
                },
                {
                  title: t('wizard.step6Title'),
                  description: (
                    <span className="text-gray-400 text-xs">
                      {t('wizard.step6Desc')}
                    </span>
                  ),
                  icon: <CheckCircleOutlined />,
                },
```

Add the new wizard translation keys to all three locale files under `pet.wizard`:

```json
"step5Title": "Confirm locally",
"step5Desc": "Confirm the staged update in Alife.",
"step6Title": "Verify applied",
"step6Desc": "The Web app shows the desktop-applied version after Alife reports success."
```

Use localized equivalents in `zh-CN.json` and `ja.json`.

- [ ] **Step 5: Run page and panel tests**

```powershell
npx jest --runInBand src/components/__tests__/PetConfigPageSync.test.tsx src/components/__tests__/PetSyncStatusPanel.test.tsx
```

Expected: both suites pass.

- [ ] **Step 6: Commit**

```powershell
git add "src/app/(auth)/dashboard/pet/page.tsx" src/components/__tests__/PetConfigPageSync.test.tsx messages/en.json messages/zh-CN.json messages/ja.json
git commit -m "feat: show desktop sync status on pet settings"
```

---

### Task 6: Preview Page Desktop Status Chip

**Files:**
- Create: `src/components/pet/sync/PetDesktopStatusChip.tsx`
- Modify: `src/components/pet/preview/PetPreview.tsx`
- Test: update `src/components/__tests__/PetPreview.test.tsx`

- [ ] **Step 1: Add preview test coverage**

Update `src/components/__tests__/PetPreview.test.tsx`.

Add API client mock near the other mocks:

```ts
const mockApiGet = jest.fn();

jest.mock('@/lib/api-client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
}));
```

Add this to `beforeEach`:

```ts
    mockApiGet.mockResolvedValue({
      success: true,
      data: {
        desktopConnection: 'online',
        webConfigVersion: 12,
        desktopKnownVersion: 12,
        desktopAppliedVersion: 11,
        packageState: 'staged',
        requiresLocalConfirmation: true,
        lastSyncAt: '2026-06-27T10:05:00.000Z',
        lastAppliedAt: '2026-06-27T09:00:00.000Z',
        lastError: null,
        summaryKind: 'localConfirmationRequired',
        primaryAction: 'confirmInDesktop',
        isUpToDate: false,
      },
    });
```

Add this component mock:

```ts
jest.mock('@/components/pet/sync/PetDesktopStatusChip', () => ({
  __esModule: true,
  default: ({ status }: any) => <span data-testid="desktop-status-chip">{status?.summaryKind}</span>,
}));
```

Add a test:

```ts
    it('loads desktop status for the preview chip', async () => {
      render(<PetPreview />, { wrapper: Wrapper });
      expect(await screen.findByTestId('desktop-status-chip')).toBeDefined();
      expect(mockApiGet).toHaveBeenCalledWith('/api/pet/sync/status');
    });
```

- [ ] **Step 2: Run the preview test and verify it fails**

```powershell
npx jest --runInBand src/components/__tests__/PetPreview.test.tsx
```

Expected: fail because `PetPreview` does not load sync status or render the chip.

- [ ] **Step 3: Create the chip component**

Create `src/components/pet/sync/PetDesktopStatusChip.tsx`:

```tsx
'use client';

import { Tag, Tooltip } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { DesktopSyncStatus } from '@/lib/webbridge/sync-status';

interface PetDesktopStatusChipProps {
  status: DesktopSyncStatus | null;
}

export default function PetDesktopStatusChip({ status }: PetDesktopStatusChipProps) {
  const t = useTranslations('pet');

  if (!status) {
    return <Tag>{t('syncStatus.summary.unknown')}</Tag>;
  }

  const color = status.isUpToDate ? 'green' : status.summaryKind === 'failed' ? 'red' : 'blue';
  const icon = status.isUpToDate
    ? <CheckCircleOutlined />
    : status.summaryKind === 'failed'
      ? <ExclamationCircleOutlined />
      : <ClockCircleOutlined />;

  return (
    <Tooltip title={t('preview.desktopStatusTip')}>
      <Tag color={color} icon={icon}>
        {t(`syncStatus.summary.${status.summaryKind}`)}
      </Tag>
    </Tooltip>
  );
}
```

Add `preview.desktopStatusTip` to all three locale files:

```json
"desktopStatusTip": "This Web preview may differ from the desktop pet until Alife reports the latest applied version."
```

Use localized equivalents in `zh-CN.json` and `ja.json`.

- [ ] **Step 4: Wire the chip into preview**

Modify `src/components/pet/preview/PetPreview.tsx`.

Add imports:

```ts
import { apiGet } from '@/lib/api-client';
import PetDesktopStatusChip from '@/components/pet/sync/PetDesktopStatusChip';
import type { DesktopSyncStatus } from '@/lib/webbridge/sync-status';
```

Add state inside `PetPreview`:

```ts
  const [desktopStatus, setDesktopStatus] = useState<DesktopSyncStatus | null>(null);
```

Add effect:

```ts
  useEffect(() => {
    let cancelled = false;
    apiGet<DesktopSyncStatus>('/api/pet/sync/status').then((res) => {
      if (!cancelled && res.success && res.data) {
        setDesktopStatus(res.data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
```

Render the chip beside the title:

```tsx
          <PetDesktopStatusChip status={desktopStatus} />
```

- [ ] **Step 5: Run preview and panel tests**

```powershell
npx jest --runInBand src/components/__tests__/PetPreview.test.tsx src/components/__tests__/PetSyncStatusPanel.test.tsx
```

Expected: both suites pass.

- [ ] **Step 6: Commit**

```powershell
git add src/components/pet/sync/PetDesktopStatusChip.tsx src/components/pet/preview/PetPreview.tsx src/components/__tests__/PetPreview.test.tsx messages/en.json messages/zh-CN.json messages/ja.json
git commit -m "feat: show desktop applied status in preview"
```

---

### Task 7: Verification And Regression Gate

**Files:**
- Modify only if previous tasks reveal compile or test issues.

- [ ] **Step 1: Run focused Jest regression set**

```powershell
npx jest --runInBand tests/unit/webbridge-sync-status.test.ts tests/unit/pet-sync-status-service.test.ts tests/contract/pet-sync-status-api.test.ts tests/contract/pet-sync-contract.test.ts tests/contract/webbridge-package-api.test.ts src/components/__tests__/PetSyncStatusPanel.test.tsx src/components/__tests__/PetConfigPageSync.test.tsx src/components/__tests__/PetPreview.test.tsx
```

Expected: all listed suites pass.

- [ ] **Step 2: Run typecheck**

```powershell
npm run typecheck
```

Expected: TypeScript exits with code 0.

- [ ] **Step 3: Run WebBridge check**

```powershell
npm run check:webbridge
```

Expected: health, login, refresh, pet config, pet sync, pet export, and package manifest checks pass. If local services are not running, record the exact missing service output before deciding whether to retry.

- [ ] **Step 4: Run build if local dependencies are ready**

```powershell
npm run build
```

Expected: build exits with code 0. The known Turbopack NFT warning around JWKS may remain unless this task explicitly fixes it.

- [ ] **Step 5: Commit final fixes if any verification-only fixes were needed**

If verification required code fixes, first inspect the changed files:

```powershell
git status --short
```

Then stage only files from this plan that were edited during verification. For example, if the verification fix touched only the status model and route, run:

```powershell
git add src/lib/webbridge/sync-status.ts src/app/api/pet/sync/status/route.ts
git commit -m "fix: stabilize desktop sync status experience"
```

If no fixes were needed, do not create an empty commit.

---

## Spec Coverage Review

- Pet settings status panel: Task 4 creates the panel, Task 5 renders it on the page.
- First-run wizard state: Task 5 maps wizard progress to real sync status.
- Error details and recovery: Task 1 defines error mappings; Task 4 renders error code and details.
- Web API surface: Task 3 implements `GET` and `POST /api/pet/sync/status`.
- Desktop contract milestones: Task 1 validates milestones; Task 2 persists milestone-derived state.
- Save and publish flow: Task 5 refreshes status after successful config save.
- Desktop pull and local confirmation: Task 2 maps pull/stage/apply reports; Task 4 shows local confirmation.
- Preview parity warning: Task 6 adds the preview status chip.
- Required testing: Tasks 1 through 7 add unit, contract, component, typecheck, WebBridge, and build checks.

## Execution Notes

- Work from `D:\FOXD\桌宠demo\新建文件夹\avatar-web-management` for package commands.
- Commit after each task. Do not combine UI, API, and Prisma changes into one large commit.
- Keep the Alife submodule pointer unchanged unless a later implementation task explicitly modifies desktop client code.
- Do not push to the `github` remote from `D:\FOXD`; the root GitHub remote is divergent. Use the existing Gitee flow unless the user gives a separate GitHub strategy.
