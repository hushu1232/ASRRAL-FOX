# Pet WebBridge Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a developer-focused live WebBridge diagnostics panel to `/dashboard/pet` so Alife .NET 9 integration state is easier to inspect without changing protocol or backend behavior.

**Architecture:** Keep the first screen operator-focused by leaving `PetRuntimeSummary` and `PetSyncStatusPanel` unchanged in the top hierarchy. Add one read-only `PetSyncDiagnosticsPanel` inside the existing default-collapsed `PetDiagnosticsSection`, render it before the mock simulation, and localize all new copy under `pet.syncDiagnostics`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Ant Design 6, next-intl, Jest, Testing Library, WebBridge `DesktopSyncStatus`, Alife .NET 9.

---

## File Structure

Execute implementation in an isolated worktree from `D:\FOXD` before touching code. The recommended worktree path is:

```powershell
D:\FOXD\.worktrees\pet-webbridge-diagnostics
```

Then work from the web app directory:

```powershell
cd "D:\FOXD\.worktrees\pet-webbridge-diagnostics\桌宠demo\新建文件夹\avatar-web-management"
```

Create:

- `src/components/pet/sync/PetSyncDiagnosticsPanel.tsx`: read-only diagnostics panel that consumes `DesktopSyncStatus | null` and `loading`.
- `src/components/__tests__/PetSyncDiagnosticsPanel.test.tsx`: focused component coverage for live diagnostic evidence, blocking reason, error evidence, and smoke mapping.

Modify:

- `src/app/(auth)/dashboard/pet/page.tsx`: import `PetSyncDiagnosticsPanel` and render it before `WebBridgeMockStatusPanel`.
- `src/components/__tests__/PetConfigPageSync.test.tsx`: mock the new panel and assert expanded diagnostics order.
- `src/components/__tests__/PetSyncLocaleCopy.test.ts`: require the new locale namespace in all supported locales.
- `messages/en.json`: add English `pet.syncDiagnostics`.
- `messages/zh-CN.json`: add Simplified Chinese `pet.syncDiagnostics` using actual Unicode for these new keys.
- `messages/ja.json`: add Japanese `pet.syncDiagnostics` using actual Unicode for these new keys.

Do not modify:

- `D:\Alife`
- `D:\FOXD\alife-service`
- Prisma schema or migrations
- WebBridge protocol route handlers
- Unity-related paths
- Global design token files
- Local command execution behavior in the browser

The new component API is fixed:

```ts
interface PetSyncDiagnosticsPanelProps {
  status: DesktopSyncStatus | null;
  loading: boolean;
}
```

## Task 1: Diagnostics Component Baseline

**Files:**

- Create: `src/components/pet/sync/PetSyncDiagnosticsPanel.tsx`
- Create: `src/components/__tests__/PetSyncDiagnosticsPanel.test.tsx`

- [ ] **Step 1: Write the failing baseline test**

Create `src/components/__tests__/PetSyncDiagnosticsPanel.test.tsx` with this content:

```tsx
/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { App } from 'antd';
import type { ReactNode } from 'react';
import PetSyncDiagnosticsPanel from '@/components/pet/sync/PetSyncDiagnosticsPanel';
import type { DesktopSyncStatus } from '@/lib/webbridge/sync-status';

jest.mock('@ant-design/icons', () => ({
  ApiOutlined: () => <span data-testid="icon-api" />,
}));

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      'pet.syncDiagnostics': {
        title: 'Live WebBridge diagnostics',
        liveData: 'Live data',
        loading: 'Checking live diagnostic evidence...',
        unavailable: 'Live WebBridge diagnostics are unavailable.',
        integrationSnapshot: 'Integration snapshot',
        blockingReason: 'Blocking reason',
        evidenceTrail: 'Evidence trail',
        smokeMapping: 'Smoke mapping',
        webVersion: 'Web package version',
        desktopKnownVersion: 'Alife known version',
        desktopAppliedVersion: 'Alife applied version',
        packageState: 'Package state',
        desktopConnection: 'Desktop connection',
        localConfirmation: 'Local confirmation',
        lastSyncAt: 'Last sync',
        lastAppliedAt: 'Last applied',
        milestones: 'Milestones',
        errorDetails: 'Error details',
        errorTitle: 'Error title',
        recovery: 'Recovery',
        technicalDetail: 'Technical detail',
        required: 'Required',
        notRequired: 'Not required',
        notReported: 'Not reported',
        never: 'Never',
        noMilestones: 'No milestones reported yet.',
        noLiveError: 'No live error reported.',
        'versionAlignment.notPulled':
          'Web package is newer; Alife .NET has not pulled the newest package.',
        'versionAlignment.knownButNotApplied':
          'Alife .NET knows or staged the package but has not applied it.',
        'versionAlignment.current':
          'Alife .NET has applied the current Web package version.',
        'versionAlignment.missingEvidence':
          'Alife .NET has not reported enough version evidence yet.',
        'blocking.pendingPull': 'Waiting for Alife .NET to pull the Web package.',
        'blocking.localConfirmationRequired':
          'Package is staged locally and must be confirmed inside Alife .NET.',
        'blocking.desktopOffline': 'Alife .NET is offline or has not reported recently.',
        'blocking.failed': 'Package sync failed; inspect error details before retrying.',
        'blocking.upToDate': 'Package is applied and current; no blocking reason.',
        'blocking.unknown': 'Status is incomplete; wait for Alife .NET to report again.',
        'smoke.expectedStagedLabel': 'Expected staged state',
        'smoke.expectedStaged': 'WebStatus: staged/localConfirmationRequired/confirmInDesktop',
        'smoke.expectedAppliedLabel': 'Expected applied state',
        'smoke.expectedApplied':
          'WebStatus: applied/upToDate/none/requiresLocalConfirmation=false',
        'smoke.commandLabel': 'Local smoke command',
        'smoke.command':
          "$env:DOTNET_EXE='C:\\Users\\hu shu\\.dotnet\\dotnet.exe'; $env:ALIFE_ROOT='D:\\Alife'; npm run check:webbridge:smoke",
      },
      'pet.syncStatus': {
        'connectionState.unknown': 'Unknown',
        'connectionState.checking': 'Checking',
        'connectionState.online': 'Online',
        'connectionState.offline': 'Offline',
        'packageStateLabel.notPublished': 'Not published',
        'packageStateLabel.published': 'Published, waiting for pull',
        'packageStateLabel.pulled': 'Pulled by Alife .NET',
        'packageStateLabel.staged': 'Staged locally',
        'packageStateLabel.applied': 'Applied in Alife .NET',
        'packageStateLabel.failed': 'Package failed',
      },
    };

    return (key: string) => {
      const namespaceMessages = messages[namespace];
      return namespaceMessages && namespaceMessages[key] ? namespaceMessages[key] : key;
    };
  },
}));

function Wrapper({ children }: { children: ReactNode }) {
  return <App>{children}</App>;
}

function createStatus(overrides: Partial<DesktopSyncStatus> = {}): DesktopSyncStatus {
  return {
    desktopConnection: 'online',
    packageState: 'published',
    summaryKind: 'pendingPull',
    primaryAction: 'checkAgain',
    isUpToDate: false,
    webConfigVersion: 2,
    desktopKnownVersion: 1,
    desktopAppliedVersion: 1,
    requiresLocalConfirmation: false,
    lastSyncAt: '2026-06-27T08:00:00.000Z',
    lastAppliedAt: null,
    lastError: null,
    errorMessage: null,
    milestones: [],
    ...overrides,
  };
}

describe('PetSyncDiagnosticsPanel', () => {
  it('shows pending-pull diagnostic evidence and read-only smoke mapping', () => {
    render(<PetSyncDiagnosticsPanel status={createStatus()} loading={false} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByTestId('pet-sync-diagnostics-panel')).toBeDefined();
    expect(screen.getByText('Live WebBridge diagnostics')).toBeDefined();
    expect(screen.getByText('Live data')).toBeDefined();
    expect(screen.getByText('Integration snapshot')).toBeDefined();
    expect(screen.getByText('Web package version')).toBeDefined();
    expect(screen.getByText('Alife known version')).toBeDefined();
    expect(screen.getByText('Alife applied version')).toBeDefined();
    expect(screen.getByText('Published, waiting for pull')).toBeDefined();
    expect(screen.getByText('Online')).toBeDefined();
    expect(screen.getByText('Not required')).toBeDefined();
    expect(
      screen.getByText('Web package is newer; Alife .NET has not pulled the newest package.'),
    ).toBeDefined();
    expect(screen.getByText('Blocking reason')).toBeDefined();
    expect(screen.getByText('Waiting for Alife .NET to pull the Web package.')).toBeDefined();
    expect(screen.getByText('Evidence trail')).toBeDefined();
    expect(screen.getByText('No milestones reported yet.')).toBeDefined();
    expect(screen.getByText('No live error reported.')).toBeDefined();
    expect(screen.getByText('Smoke mapping')).toBeDefined();
    expect(
      screen.getByText('WebStatus: staged/localConfirmationRequired/confirmInDesktop'),
    ).toBeDefined();
    expect(
      screen.getByText('WebStatus: applied/upToDate/none/requiresLocalConfirmation=false'),
    ).toBeDefined();
    expect(
      screen.getByText(
        "$env:DOTNET_EXE='C:\\Users\\hu shu\\.dotnet\\dotnet.exe'; $env:ALIFE_ROOT='D:\\Alife'; npm run check:webbridge:smoke",
      ),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: /smoke/i })).toBeNull();
  });

  it('shows loading and unavailable states without inventing diagnostic values', () => {
    const { rerender } = render(<PetSyncDiagnosticsPanel status={null} loading />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('Checking live diagnostic evidence...')).toBeDefined();
    expect(screen.queryByText('Integration snapshot')).toBeNull();

    rerender(<PetSyncDiagnosticsPanel status={null} loading={false} />);

    expect(screen.getByText('Live WebBridge diagnostics are unavailable.')).toBeDefined();
    expect(screen.queryByText('Integration snapshot')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the baseline test to verify it fails**

Run:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetSyncDiagnosticsPanel.test.tsx
```

Expected: FAIL with a module resolution error for `@/components/pet/sync/PetSyncDiagnosticsPanel`.

- [ ] **Step 3: Add the minimal diagnostics component**

Create `src/components/pet/sync/PetSyncDiagnosticsPanel.tsx`:

```tsx
'use client';

import { ApiOutlined } from '@ant-design/icons';
import { Alert, Descriptions, Space, Tag, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import MetricTile from '@/components/ui/MetricTile';
import OperationPanel from '@/components/ui/OperationPanel';
import StatusChip from '@/components/ui/StatusChip';
import {
  getPackageStateLabelKey,
  PACKAGE_STATE_TONES,
  SUMMARY_TONES,
} from '@/components/pet/sync/syncStatusPresentation';
import type { DesktopSyncStatus, DesktopSummaryKind } from '@/lib/webbridge/sync-status';

const { Text } = Typography;

interface PetSyncDiagnosticsPanelProps {
  status: DesktopSyncStatus | null;
  loading: boolean;
}

const BLOCKING_ALERT_TYPES: Record<DesktopSummaryKind, 'success' | 'info' | 'warning' | 'error'> = {
  unknown: 'info',
  desktopOffline: 'warning',
  pendingPull: 'info',
  localConfirmationRequired: 'warning',
  upToDate: 'success',
  failed: 'error',
};

export default function PetSyncDiagnosticsPanel({
  status,
  loading,
}: PetSyncDiagnosticsPanelProps) {
  const t = useTranslations('pet.syncDiagnostics');
  const tSync = useTranslations('pet.syncStatus');

  return (
    <OperationPanel
      data-testid="pet-sync-diagnostics-panel"
      title={
        <Space size="small" wrap>
          <ApiOutlined />
          <span>{t('title')}</span>
          <StatusChip tone="success">{t('liveData')}</StatusChip>
        </Space>
      }
    >
      {!status && loading && <Text type="secondary">{t('loading')}</Text>}
      {!status && !loading && <Alert type="warning" showIcon message={t('unavailable')} />}
      {status && (
        <Space vertical size="large" style={{ width: '100%' }}>
          <section aria-label={t('integrationSnapshot')}>
            <SectionHeading>{t('integrationSnapshot')}</SectionHeading>
            <div
              style={{
                display: 'grid',
                gap: 12,
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              }}
            >
              <MetricTile label={t('webVersion')} value={status.webConfigVersion} />
              <MetricTile
                label={t('desktopKnownVersion')}
                value={formatNullableNumber(status.desktopKnownVersion, t)}
              />
              <MetricTile
                label={t('desktopAppliedVersion')}
                value={formatNullableNumber(status.desktopAppliedVersion, t)}
              />
              <MetricTile
                label={t('packageState')}
                value={
                  <StatusChip tone={PACKAGE_STATE_TONES[status.packageState]}>
                    {tSync(getPackageStateLabelKey(status.packageState))}
                  </StatusChip>
                }
              />
              <MetricTile
                label={t('desktopConnection')}
                value={tSync(`connectionState.${status.desktopConnection}`)}
              />
              <MetricTile
                label={t('localConfirmation')}
                value={status.requiresLocalConfirmation ? t('required') : t('notRequired')}
              />
            </div>
            <Text type="secondary" style={{ display: 'block', marginTop: 10 }}>
              {t(getVersionAlignmentKey(status))}
            </Text>
          </section>

          <section aria-label={t('blockingReason')}>
            <SectionHeading>{t('blockingReason')}</SectionHeading>
            <Alert
              type={BLOCKING_ALERT_TYPES[status.summaryKind]}
              showIcon
              message={t(`blocking.${status.summaryKind}`)}
            />
          </section>

          <section aria-label={t('evidenceTrail')}>
            <SectionHeading>{t('evidenceTrail')}</SectionHeading>
            <Descriptions column={1} size="small">
              <Descriptions.Item label={t('lastSyncAt')}>
                {formatDate(status.lastSyncAt, t)}
              </Descriptions.Item>
              <Descriptions.Item label={t('lastAppliedAt')}>
                {formatDate(status.lastAppliedAt, t)}
              </Descriptions.Item>
              <Descriptions.Item label={t('milestones')}>
                <Space size={[6, 6]} wrap>
                  {status.milestones.length > 0 ? (
                    status.milestones.map((milestone) => <Tag key={milestone}>{milestone}</Tag>)
                  ) : (
                    <Text type="secondary">{t('noMilestones')}</Text>
                  )}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label={t('errorDetails')}>
                {renderErrorEvidence(status, t)}
              </Descriptions.Item>
            </Descriptions>
          </section>

          <section aria-label={t('smokeMapping')}>
            <SectionHeading>{t('smokeMapping')}</SectionHeading>
            <Space vertical size={6} style={{ width: '100%' }}>
              <SmokeLine label={t('smoke.expectedStagedLabel')} value={t('smoke.expectedStaged')} />
              <SmokeLine label={t('smoke.expectedAppliedLabel')} value={t('smoke.expectedApplied')} />
              <SmokeLine label={t('smoke.commandLabel')} value={t('smoke.command')} />
            </Space>
          </section>
        </Space>
      )}
    </OperationPanel>
  );
}

function SectionHeading({ children }: { children: string }) {
  return (
    <Text strong style={{ display: 'block', marginBottom: 8, color: 'var(--text-primary)' }}>
      {children}
    </Text>
  );
}

function SmokeLine({ label, value }: { label: string; value: string }) {
  return (
    <Space direction="vertical" size={2} style={{ width: '100%' }}>
      <Text type="secondary">{label}</Text>
      <Text code style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
        {value}
      </Text>
    </Space>
  );
}

function getVersionAlignmentKey(status: DesktopSyncStatus): string {
  const webVersion = status.webConfigVersion;
  const knownVersion = status.desktopKnownVersion;
  const appliedVersion = status.desktopAppliedVersion;

  if (knownVersion === null || appliedVersion === null) {
    return 'versionAlignment.missingEvidence';
  }

  if (webVersion > knownVersion && webVersion > appliedVersion) {
    return 'versionAlignment.notPulled';
  }

  if (knownVersion === webVersion && appliedVersion < webVersion) {
    return 'versionAlignment.knownButNotApplied';
  }

  if (appliedVersion === webVersion && status.summaryKind === 'upToDate') {
    return 'versionAlignment.current';
  }

  return 'versionAlignment.missingEvidence';
}

function formatNullableNumber(value: number | null, t: (key: string) => string): string | number {
  return value === null ? t('notReported') : value;
}

function formatDate(value: Date | number | string | null, t: (key: string) => string): string {
  if (value === null) {
    return t('never');
  }

  const date = value instanceof Date ? value : new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return t('never');
  }

  return date.toLocaleString();
}

function renderErrorEvidence(status: DesktopSyncStatus, t: (key: string) => string) {
  if (!status.lastError && !status.errorMessage) {
    return <Text type="secondary">{t('noLiveError')}</Text>;
  }

  return (
    <Space vertical size={4}>
      {status.errorMessage?.title && (
        <Text>
          {t('errorTitle')}: {status.errorMessage.title}
        </Text>
      )}
      {status.errorMessage?.recovery && (
        <Text>
          {t('recovery')}: {status.errorMessage.recovery}
        </Text>
      )}
      {status.lastError?.code && <Text code>{status.lastError.code}</Text>}
      {status.lastError?.message && <Text>{status.lastError.message}</Text>}
      {status.lastError?.technicalDetail && (
        <Text type="secondary">
          {t('technicalDetail')}: {status.lastError.technicalDetail}
        </Text>
      )}
    </Space>
  );
}
```

- [ ] **Step 4: Run the baseline test to verify it passes**

Run:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetSyncDiagnosticsPanel.test.tsx
```

Expected: PASS, including `shows pending-pull diagnostic evidence and read-only smoke mapping`.

- [ ] **Step 5: Commit Task 1**

Run:

```powershell
git add src/components/pet/sync/PetSyncDiagnosticsPanel.tsx src/components/__tests__/PetSyncDiagnosticsPanel.test.tsx
git commit -m "feat: add pet WebBridge diagnostics panel"
```

Expected: commit succeeds with only the new component and its focused test.

## Task 2: Status-Specific Diagnostic Behavior

**Files:**

- Modify: `src/components/__tests__/PetSyncDiagnosticsPanel.test.tsx`
- Modify: `src/components/pet/sync/PetSyncDiagnosticsPanel.tsx`

- [ ] **Step 1: Add failing tests for local confirmation, failures, current state, offline, and unknown state**

Append these tests inside the existing `describe('PetSyncDiagnosticsPanel', () => { ... })` block in `src/components/__tests__/PetSyncDiagnosticsPanel.test.tsx`:

```tsx
  it('explains locally staged packages that require Alife .NET confirmation', () => {
    render(
      <PetSyncDiagnosticsPanel
        status={createStatus({
          packageState: 'staged',
          summaryKind: 'localConfirmationRequired',
          primaryAction: 'confirmInDesktop',
          webConfigVersion: 7,
          desktopKnownVersion: 7,
          desktopAppliedVersion: 6,
          requiresLocalConfirmation: true,
          milestones: ['manifestFetched', 'filesDownloaded', 'hashValidated', 'packageStaged'],
        })}
        loading={false}
      />,
      { wrapper: Wrapper },
    );

    expect(
      screen.getByText('Alife .NET knows or staged the package but has not applied it.'),
    ).toBeDefined();
    expect(
      screen.getByText('Package is staged locally and must be confirmed inside Alife .NET.'),
    ).toBeDefined();
    expect(screen.getByText('Required')).toBeDefined();
    expect(screen.getByText('Staged locally')).toBeDefined();
    expect(screen.getByText('manifestFetched')).toBeDefined();
    expect(screen.getByText('packageStaged')).toBeDefined();
  });

  it('shows failed package error evidence including recovery and technical detail', () => {
    render(
      <PetSyncDiagnosticsPanel
        status={createStatus({
          packageState: 'failed',
          summaryKind: 'failed',
          primaryAction: 'viewDetails',
          lastError: {
            code: 'PACKAGE_HASH_MISMATCH',
            message: 'Package validation failed',
            technicalDetail: 'Expected sha256 abc but received def',
          },
          errorMessage: {
            title: 'Package validation failed',
            recovery: 'Re-download the package from the Web management app.',
          },
          milestones: ['manifestFetched', 'filesDownloaded', 'packageFailed'],
        })}
        loading={false}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('Package sync failed; inspect error details before retrying.')).toBeDefined();
    expect(screen.getByText('PACKAGE_HASH_MISMATCH')).toBeDefined();
    expect(screen.getAllByText('Package validation failed').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Recovery: Re-download the package from the Web management app.'),
    ).toBeDefined();
    expect(screen.getByText('Technical detail: Expected sha256 abc but received def')).toBeDefined();
    expect(screen.getByText('packageFailed')).toBeDefined();
  });

  it('shows applied/current interpretation for up-to-date packages', () => {
    render(
      <PetSyncDiagnosticsPanel
        status={createStatus({
          packageState: 'applied',
          summaryKind: 'upToDate',
          primaryAction: 'none',
          isUpToDate: true,
          webConfigVersion: 9,
          desktopKnownVersion: 9,
          desktopAppliedVersion: 9,
          requiresLocalConfirmation: false,
          lastAppliedAt: '2026-06-27T08:10:00.000Z',
          milestones: ['manifestFetched', 'filesDownloaded', 'hashValidated', 'packageApplied'],
        })}
        loading={false}
      />,
      { wrapper: Wrapper },
    );

    expect(
      screen.getByText('Alife .NET has applied the current Web package version.'),
    ).toBeDefined();
    expect(screen.getByText('Package is applied and current; no blocking reason.')).toBeDefined();
    expect(screen.getByText('Applied in Alife .NET')).toBeDefined();
    expect(screen.getByText('packageApplied')).toBeDefined();
  });

  it('keeps offline and unknown diagnostics explicit without adding probes', () => {
    const { rerender } = render(
      <PetSyncDiagnosticsPanel
        status={createStatus({
          desktopConnection: 'offline',
          summaryKind: 'desktopOffline',
          desktopKnownVersion: null,
          desktopAppliedVersion: null,
        })}
        loading={false}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByText('Alife .NET is offline or has not reported recently.')).toBeDefined();
    expect(screen.getByText('Alife .NET has not reported enough version evidence yet.')).toBeDefined();
    expect(screen.getAllByText('Not reported').length).toBeGreaterThanOrEqual(2);

    rerender(
      <PetSyncDiagnosticsPanel
        status={createStatus({
          desktopConnection: 'unknown',
          packageState: 'notPublished',
          summaryKind: 'unknown',
          desktopKnownVersion: null,
          desktopAppliedVersion: null,
        })}
        loading={false}
      />,
    );

    expect(screen.getByText('Status is incomplete; wait for Alife .NET to report again.')).toBeDefined();
    expect(screen.getByText('Unknown')).toBeDefined();
    expect(screen.getByText('Not published')).toBeDefined();
  });
```

- [ ] **Step 2: Run the expanded diagnostics test to verify it fails if the component is incomplete**

Run:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetSyncDiagnosticsPanel.test.tsx
```

Expected before the Task 1 implementation is complete: FAIL on missing status-specific text such as `Package sync failed; inspect error details before retrying.` If Task 1 already included the full helper implementation exactly as specified, this command may already PASS; record that the expanded cases are covered by the existing implementation.

- [ ] **Step 3: Confirm the component implements each status mapping exactly**

Open `src/components/pet/sync/PetSyncDiagnosticsPanel.tsx` and confirm these exact implementation points are present:

```tsx
const BLOCKING_ALERT_TYPES: Record<DesktopSummaryKind, 'success' | 'info' | 'warning' | 'error'> = {
  unknown: 'info',
  desktopOffline: 'warning',
  pendingPull: 'info',
  localConfirmationRequired: 'warning',
  upToDate: 'success',
  failed: 'error',
};
```

```tsx
function getVersionAlignmentKey(status: DesktopSyncStatus): string {
  const webVersion = status.webConfigVersion;
  const knownVersion = status.desktopKnownVersion;
  const appliedVersion = status.desktopAppliedVersion;

  if (knownVersion === null || appliedVersion === null) {
    return 'versionAlignment.missingEvidence';
  }

  if (webVersion > knownVersion && webVersion > appliedVersion) {
    return 'versionAlignment.notPulled';
  }

  if (knownVersion === webVersion && appliedVersion < webVersion) {
    return 'versionAlignment.knownButNotApplied';
  }

  if (appliedVersion === webVersion && status.summaryKind === 'upToDate') {
    return 'versionAlignment.current';
  }

  return 'versionAlignment.missingEvidence';
}
```

```tsx
function renderErrorEvidence(status: DesktopSyncStatus, t: (key: string) => string) {
  if (!status.lastError && !status.errorMessage) {
    return <Text type="secondary">{t('noLiveError')}</Text>;
  }

  return (
    <Space vertical size={4}>
      {status.errorMessage?.title && (
        <Text>
          {t('errorTitle')}: {status.errorMessage.title}
        </Text>
      )}
      {status.errorMessage?.recovery && (
        <Text>
          {t('recovery')}: {status.errorMessage.recovery}
        </Text>
      )}
      {status.lastError?.code && <Text code>{status.lastError.code}</Text>}
      {status.lastError?.message && <Text>{status.lastError.message}</Text>}
      {status.lastError?.technicalDetail && (
        <Text type="secondary">
          {t('technicalDetail')}: {status.lastError.technicalDetail}
        </Text>
      )}
    </Space>
  );
}
```

If any block differs in behavior, replace it with the exact block above.

- [ ] **Step 4: Run the diagnostics component tests**

Run:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetSyncDiagnosticsPanel.test.tsx
```

Expected: PASS for all component diagnostics cases.

- [ ] **Step 5: Commit Task 2**

Run:

```powershell
git add src/components/pet/sync/PetSyncDiagnosticsPanel.tsx src/components/__tests__/PetSyncDiagnosticsPanel.test.tsx
git commit -m "test: cover pet WebBridge diagnostic states"
```

Expected: commit succeeds. If Task 1 already committed the exact final component and Task 2 changed only tests, this commit should contain only the expanded test coverage.

## Task 3: Page Integration And Expanded Diagnostics Order

**Files:**

- Modify: `src/app/(auth)/dashboard/pet/page.tsx`
- Modify: `src/components/__tests__/PetConfigPageSync.test.tsx`

- [ ] **Step 1: Add the failing page-level mock and order assertion**

In `src/components/__tests__/PetConfigPageSync.test.tsx`, add this mock after the existing `PetSyncStatusPanel` mock:

```tsx
jest.mock('@/components/pet/sync/PetSyncDiagnosticsPanel', () => ({
  __esModule: true,
  default: ({
    status,
    loading,
  }: {
    status: DesktopSyncStatus | null;
    loading: boolean;
  }) => (
    <section data-testid="pet-sync-diagnostics-panel">
      <span>Live WebBridge diagnostics</span>
      <span data-testid="diagnostics-status-props">
        {loading ? 'loading' : status ? status.summaryKind : 'empty'}
      </span>
    </section>
  ),
}));
```

In the `renders desktop sync panel after config loads` test, replace the post-expand simulation-only assertions:

```tsx
expect(screen.getByText('WebBridge package simulation')).toBeDefined();
expect(screen.getByText('Alife .NET 9')).toBeDefined();
expect(screen.getByText('No live Alife calls')).toBeDefined();
expect(mockApiGet).toHaveBeenCalledTimes(2);
```

with:

```tsx
const diagnosticsPanel = screen.getByTestId('pet-sync-diagnostics-panel');
const simulation = screen.getByText('WebBridge package simulation');
expect(diagnosticsPanel).toBeDefined();
expect(screen.getByText('Live WebBridge diagnostics')).toBeDefined();
expect(screen.getByTestId('diagnostics-status-props').textContent).toBe('pendingPull');
expect(
  diagnosticsPanel.compareDocumentPosition(simulation) & Node.DOCUMENT_POSITION_FOLLOWING,
).toBeTruthy();
expect(screen.getByText('Alife .NET 9')).toBeDefined();
expect(screen.getByText('No live Alife calls')).toBeDefined();
expect(mockApiGet).toHaveBeenCalledTimes(2);
```

- [ ] **Step 2: Run the page test to verify it fails**

Run:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetConfigPageSync.test.tsx
```

Expected: FAIL because `pet-sync-diagnostics-panel` is not rendered yet.

- [ ] **Step 3: Render live diagnostics before simulation on the page**

In `src/app/(auth)/dashboard/pet/page.tsx`, add this import beside the existing sync imports:

```tsx
import PetSyncDiagnosticsPanel from '@/components/pet/sync/PetSyncDiagnosticsPanel';
```

Then replace the diagnostics section body:

```tsx
        <PetDiagnosticsSection>
          <WebBridgeMockStatusPanel />
        </PetDiagnosticsSection>
```

with:

```tsx
        <PetDiagnosticsSection>
          <PetSyncDiagnosticsPanel status={syncStatus} loading={syncStatusLoading} />
          <WebBridgeMockStatusPanel />
        </PetDiagnosticsSection>
```

- [ ] **Step 4: Run the page test to verify it passes**

Run:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetConfigPageSync.test.tsx
```

Expected: PASS. Diagnostics remain default-collapsed, and after expansion live diagnostics appear before the simulation panel.

- [ ] **Step 5: Commit Task 3**

Run:

```powershell
git add "src/app/(auth)/dashboard/pet/page.tsx" src/components/__tests__/PetConfigPageSync.test.tsx
git commit -m "feat: surface live diagnostics before WebBridge simulation"
```

Expected: commit succeeds with page integration and page test changes.

## Task 4: Locale Copy Coverage

**Files:**

- Modify: `messages/en.json`
- Modify: `messages/zh-CN.json`
- Modify: `messages/ja.json`
- Modify: `src/components/__tests__/PetSyncLocaleCopy.test.ts`

- [ ] **Step 1: Add a failing locale test for `pet.syncDiagnostics`**

Append this test to `src/components/__tests__/PetSyncLocaleCopy.test.ts`:

```ts
  it('defines live WebBridge diagnostics copy in all supported pet locales', () => {
    const requiredKeys = [
      'title',
      'liveData',
      'loading',
      'unavailable',
      'integrationSnapshot',
      'blockingReason',
      'evidenceTrail',
      'smokeMapping',
      'webVersion',
      'desktopKnownVersion',
      'desktopAppliedVersion',
      'packageState',
      'desktopConnection',
      'localConfirmation',
      'lastSyncAt',
      'lastAppliedAt',
      'milestones',
      'errorDetails',
      'errorTitle',
      'recovery',
      'technicalDetail',
      'required',
      'notRequired',
      'notReported',
      'never',
      'noMilestones',
      'noLiveError',
    ];

    for (const locale of [en, zh, ja]) {
      for (const key of requiredKeys) {
        expect(locale.pet.syncDiagnostics[key]).toEqual(expect.any(String));
        expect(locale.pet.syncDiagnostics[key].length).toBeGreaterThan(0);
      }

      expect(Object.keys(locale.pet.syncDiagnostics.versionAlignment).sort()).toEqual([
        'current',
        'knownButNotApplied',
        'missingEvidence',
        'notPulled',
      ]);
      expect(Object.keys(locale.pet.syncDiagnostics.blocking).sort()).toEqual([
        'desktopOffline',
        'failed',
        'localConfirmationRequired',
        'pendingPull',
        'unknown',
        'upToDate',
      ]);
      expect(locale.pet.syncDiagnostics.smoke).toEqual({
        expectedStagedLabel: expect.any(String),
        expectedStaged: 'WebStatus: staged/localConfirmationRequired/confirmInDesktop',
        expectedAppliedLabel: expect.any(String),
        expectedApplied: 'WebStatus: applied/upToDate/none/requiresLocalConfirmation=false',
        commandLabel: expect.any(String),
        command:
          "$env:DOTNET_EXE='C:\\Users\\hu shu\\.dotnet\\dotnet.exe'; $env:ALIFE_ROOT='D:\\Alife'; npm run check:webbridge:smoke",
      });
    }

    expect(en.pet.syncDiagnostics.title).toBe('Live WebBridge diagnostics');
    expect(en.pet.syncDiagnostics.liveData).toBe('Live data');
    expect(en.pet.syncDiagnostics.versionAlignment.notPulled).toContain('Alife .NET');
    expect(en.pet.syncDiagnostics.blocking.localConfirmationRequired).toContain('Alife .NET');
    expect(zh.pet.syncDiagnostics.title).toBe('实时 WebBridge 诊断');
    expect(zh.pet.syncDiagnostics.blocking.pendingPull).toContain('Alife .NET');
    expect(ja.pet.syncDiagnostics.title).toBe('ライブ WebBridge 診断');
    expect(ja.pet.syncDiagnostics.blocking.pendingPull).toContain('Alife .NET');
  });
```

- [ ] **Step 2: Run the locale test to verify it fails**

Run:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetSyncLocaleCopy.test.ts
```

Expected: FAIL because `pet.syncDiagnostics` is undefined.

- [ ] **Step 3: Add English locale copy**

In `messages/en.json`, add this sibling object next to `pet.diagnostics` and `pet.syncStatus`:

```json
"syncDiagnostics": {
  "title": "Live WebBridge diagnostics",
  "liveData": "Live data",
  "loading": "Checking live diagnostic evidence...",
  "unavailable": "Live WebBridge diagnostics are unavailable.",
  "integrationSnapshot": "Integration snapshot",
  "blockingReason": "Blocking reason",
  "evidenceTrail": "Evidence trail",
  "smokeMapping": "Smoke mapping",
  "webVersion": "Web package version",
  "desktopKnownVersion": "Alife known version",
  "desktopAppliedVersion": "Alife applied version",
  "packageState": "Package state",
  "desktopConnection": "Desktop connection",
  "localConfirmation": "Local confirmation",
  "lastSyncAt": "Last sync",
  "lastAppliedAt": "Last applied",
  "milestones": "Milestones",
  "errorDetails": "Error details",
  "errorTitle": "Error title",
  "recovery": "Recovery",
  "technicalDetail": "Technical detail",
  "required": "Required",
  "notRequired": "Not required",
  "notReported": "Not reported",
  "never": "Never",
  "noMilestones": "No milestones reported yet.",
  "noLiveError": "No live error reported.",
  "versionAlignment": {
    "notPulled": "Web package is newer; Alife .NET has not pulled the newest package.",
    "knownButNotApplied": "Alife .NET knows or staged the package but has not applied it.",
    "current": "Alife .NET has applied the current Web package version.",
    "missingEvidence": "Alife .NET has not reported enough version evidence yet."
  },
  "blocking": {
    "pendingPull": "Waiting for Alife .NET to pull the Web package.",
    "localConfirmationRequired": "Package is staged locally and must be confirmed inside Alife .NET.",
    "desktopOffline": "Alife .NET is offline or has not reported recently.",
    "failed": "Package sync failed; inspect error details before retrying.",
    "upToDate": "Package is applied and current; no blocking reason.",
    "unknown": "Status is incomplete; wait for Alife .NET to report again."
  },
  "smoke": {
    "expectedStagedLabel": "Expected staged state",
    "expectedStaged": "WebStatus: staged/localConfirmationRequired/confirmInDesktop",
    "expectedAppliedLabel": "Expected applied state",
    "expectedApplied": "WebStatus: applied/upToDate/none/requiresLocalConfirmation=false",
    "commandLabel": "Local smoke command",
    "command": "$env:DOTNET_EXE='C:\\Users\\hu shu\\.dotnet\\dotnet.exe'; $env:ALIFE_ROOT='D:\\Alife'; npm run check:webbridge:smoke"
  }
}
```

- [ ] **Step 4: Add Simplified Chinese locale copy**

In `messages/zh-CN.json`, add this sibling object next to `pet.diagnostics` and `pet.syncStatus`:

```json
"syncDiagnostics": {
  "title": "实时 WebBridge 诊断",
  "liveData": "实时数据",
  "loading": "正在检查实时诊断证据...",
  "unavailable": "实时 WebBridge 诊断暂不可用。",
  "integrationSnapshot": "集成快照",
  "blockingReason": "阻塞原因",
  "evidenceTrail": "证据链",
  "smokeMapping": "冒烟映射",
  "webVersion": "Web 包版本",
  "desktopKnownVersion": "Alife 已知版本",
  "desktopAppliedVersion": "Alife 已应用版本",
  "packageState": "包状态",
  "desktopConnection": "桌面端连接",
  "localConfirmation": "本地确认",
  "lastSyncAt": "上次同步",
  "lastAppliedAt": "上次应用",
  "milestones": "里程碑",
  "errorDetails": "错误详情",
  "errorTitle": "错误标题",
  "recovery": "恢复建议",
  "technicalDetail": "技术细节",
  "required": "需要",
  "notRequired": "不需要",
  "notReported": "未上报",
  "never": "从未",
  "noMilestones": "暂未上报里程碑。",
  "noLiveError": "暂未上报实时错误。",
  "versionAlignment": {
    "notPulled": "Web 包版本更新，Alife .NET 还没有拉取最新包。",
    "knownButNotApplied": "Alife .NET 已知道或已暂存该包，但还没有应用它。",
    "current": "Alife .NET 已应用当前 Web 包版本。",
    "missingEvidence": "Alife .NET 暂未上报足够的版本证据。"
  },
  "blocking": {
    "pendingPull": "正在等待 Alife .NET 拉取 Web 包。",
    "localConfirmationRequired": "包已在本地暂存，需要在 Alife .NET 内确认。",
    "desktopOffline": "Alife .NET 离线或最近没有上报状态。",
    "failed": "包同步失败，请先查看错误详情再重试。",
    "upToDate": "包已应用且为当前版本，没有阻塞原因。",
    "unknown": "状态不完整，等待 Alife .NET 再次上报。"
  },
  "smoke": {
    "expectedStagedLabel": "预期暂存状态",
    "expectedStaged": "WebStatus: staged/localConfirmationRequired/confirmInDesktop",
    "expectedAppliedLabel": "预期已应用状态",
    "expectedApplied": "WebStatus: applied/upToDate/none/requiresLocalConfirmation=false",
    "commandLabel": "本地冒烟命令",
    "command": "$env:DOTNET_EXE='C:\\Users\\hu shu\\.dotnet\\dotnet.exe'; $env:ALIFE_ROOT='D:\\Alife'; npm run check:webbridge:smoke"
  }
}
```

- [ ] **Step 5: Add Japanese locale copy**

In `messages/ja.json`, add this sibling object next to `pet.diagnostics` and `pet.syncStatus`:

```json
"syncDiagnostics": {
  "title": "ライブ WebBridge 診断",
  "liveData": "ライブデータ",
  "loading": "ライブ診断の証拠を確認しています...",
  "unavailable": "ライブ WebBridge 診断は利用できません。",
  "integrationSnapshot": "連携スナップショット",
  "blockingReason": "ブロック理由",
  "evidenceTrail": "証拠トレイル",
  "smokeMapping": "スモーク対応",
  "webVersion": "Web パッケージバージョン",
  "desktopKnownVersion": "Alife 既知バージョン",
  "desktopAppliedVersion": "Alife 適用済みバージョン",
  "packageState": "パッケージ状態",
  "desktopConnection": "デスクトップ接続",
  "localConfirmation": "ローカル確認",
  "lastSyncAt": "最終同期",
  "lastAppliedAt": "最終適用",
  "milestones": "マイルストーン",
  "errorDetails": "エラー詳細",
  "errorTitle": "エラータイトル",
  "recovery": "復旧手順",
  "technicalDetail": "技術詳細",
  "required": "必要",
  "notRequired": "不要",
  "notReported": "未報告",
  "never": "未実行",
  "noMilestones": "まだマイルストーンは報告されていません。",
  "noLiveError": "ライブエラーは報告されていません。",
  "versionAlignment": {
    "notPulled": "Web パッケージが新しく、Alife .NET はまだ最新パッケージを取得していません。",
    "knownButNotApplied": "Alife .NET はパッケージを認識またはステージしていますが、まだ適用していません。",
    "current": "Alife .NET は現在の Web パッケージバージョンを適用済みです。",
    "missingEvidence": "Alife .NET から十分なバージョン証拠がまだ報告されていません。"
  },
  "blocking": {
    "pendingPull": "Alife .NET が Web パッケージを取得するのを待っています。",
    "localConfirmationRequired": "パッケージはローカルでステージ済みで、Alife .NET 内で確認が必要です。",
    "desktopOffline": "Alife .NET はオフライン、または最近状態を報告していません。",
    "failed": "パッケージ同期に失敗しました。再試行前にエラー詳細を確認してください。",
    "upToDate": "パッケージは適用済みで最新です。ブロック理由はありません。",
    "unknown": "状態が不完全です。Alife .NET からの次の報告を待ってください。"
  },
  "smoke": {
    "expectedStagedLabel": "想定ステージ状態",
    "expectedStaged": "WebStatus: staged/localConfirmationRequired/confirmInDesktop",
    "expectedAppliedLabel": "想定適用済み状態",
    "expectedApplied": "WebStatus: applied/upToDate/none/requiresLocalConfirmation=false",
    "commandLabel": "ローカルスモークコマンド",
    "command": "$env:DOTNET_EXE='C:\\Users\\hu shu\\.dotnet\\dotnet.exe'; $env:ALIFE_ROOT='D:\\Alife'; npm run check:webbridge:smoke"
  }
}
```

- [ ] **Step 6: Run locale copy coverage**

Run:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetSyncLocaleCopy.test.ts
```

Expected: PASS. The new locale test confirms all supported locales define `pet.syncDiagnostics`, keep the smoke command read-only as text, and preserve Alife .NET wording.

- [ ] **Step 7: Commit Task 4**

Run:

```powershell
git add messages/en.json messages/zh-CN.json messages/ja.json src/components/__tests__/PetSyncLocaleCopy.test.ts
git commit -m "feat: localize pet WebBridge diagnostics"
```

Expected: commit succeeds with locale and locale-test changes only.

## Task 5: Focused Regression, Typecheck, Build, And Smoke

**Files:**

- Read/verify only unless a command exposes a defect in files changed above.

- [ ] **Step 1: Run focused UI regression**

Run from `D:\FOXD\.worktrees\pet-webbridge-diagnostics\桌宠demo\新建文件夹\avatar-web-management`:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetRuntimeSummary.test.tsx src/components/__tests__/PetSyncStatusPanel.test.tsx src/components/__tests__/WebBridgeMockStatusPanel.test.tsx src/components/__tests__/PetConfigPageSync.test.tsx src/components/__tests__/PetDiagnosticsSection.test.tsx src/components/__tests__/PetSyncDiagnosticsPanel.test.tsx src/components/__tests__/syncStatusPresentation.test.ts src/components/__tests__/PetSyncLocaleCopy.test.ts
```

Expected: PASS for all listed UI and sync presentation suites.

- [ ] **Step 2: Run WebBridge package regression**

Run:

```powershell
npx jest --verbose --runInBand tests/unit/pet-service.test.ts tests/unit/test-integration-local.test.ts tests/unit/package-scripts.test.ts tests/unit/webbridge-package-service.test.ts
```

Expected: PASS for WebBridge package and script coverage. This confirms the diagnostics panel did not change protocol or route-handler behavior.

- [ ] **Step 3: Run TypeScript typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 4: Run production build**

Run:

```powershell
$env:JWT_SECRET='local-build-only-pet-webbridge-diagnostics-secret'; $env:DATABASE_PATH='database/data.db'; npm run build
```

Expected: PASS. The build can emit normal Next.js build output, but it must not fail on missing locale keys, invalid JSON, or TypeScript errors.

- [ ] **Step 5: Check Alife repository status before smoke**

Run:

```powershell
git -C D:\Alife status --short --branch
```

Expected if Alife is idle: a clean branch status such as `## master...origin/master`.

If `D:\Alife` shows user or long-task changes, do not touch those files. Record the dirty status in the final verification note and skip the smoke command for this pass.

- [ ] **Step 6: Run WebBridge smoke only when Alife is clean**

Run only if Step 5 shows no dirty files:

```powershell
$env:DOTNET_EXE='C:\Users\hu shu\.dotnet\dotnet.exe'; $env:ALIFE_ROOT='D:\Alife'; npm run check:webbridge:smoke
```

Expected: PASS with staged-to-applied smoke output that includes both:

```text
WebStatus: staged/localConfirmationRequired/confirmInDesktop
WebStatus: applied/upToDate/none/requiresLocalConfirmation=false
```

- [ ] **Step 7: Run whitespace and repository state checks**

Run from `D:\FOXD\.worktrees\pet-webbridge-diagnostics`:

```powershell
git diff --check
```

Expected: no output and exit code 0.

Run:

```powershell
git status --short --branch
```

Expected: branch is ahead by the implementation commits and has no unstaged or staged files.

Run:

```powershell
git log --oneline -8
```

Expected: the latest commits include:

```text
feat: localize pet WebBridge diagnostics
feat: surface live diagnostics before WebBridge simulation
test: cover pet WebBridge diagnostic states
feat: add pet WebBridge diagnostics panel
```

- [ ] **Step 8: Commit a verification-only fix only if commands found an actual defect**

If any verification command required a source fix, make the smallest scoped change and commit it:

```powershell
git add <changed-files>
git commit -m "fix: stabilize pet WebBridge diagnostics verification"
```

Expected: this step is skipped when Task 5 passes without further edits.

## Self-Review Checklist

Spec coverage:

- `PetSyncDiagnosticsPanel` consumes only `DesktopSyncStatus | null` and `loading`.
- The new panel does not fetch, mutate, apply, confirm, execute local commands, call Alife .NET directly, or add probes.
- Expanded diagnostics order is live diagnostics first and simulation second.
- Integration snapshot shows Web version, Alife known version, Alife applied version, package state, desktop connection, and local confirmation.
- Version alignment covers not pulled, known-but-not-applied, current, and missing-evidence cases.
- Blocking reason covers `pendingPull`, `localConfirmationRequired`, `desktopOffline`, `failed`, `upToDate`, and `unknown`.
- Evidence trail renders timestamps, milestones, error code, error message, technical detail, computed title, and recovery.
- Empty evidence states use `No milestones reported yet.` and `No live error reported.`
- Smoke mapping renders the staged/applied expectations and the local command as text only.
- Locale coverage exists in English, Simplified Chinese, and Japanese, with Alife .NET and Alife .NET 9 wording preserved.

Marker scan:

- The plan intentionally contains no unfinished marker words and no open-ended implementation instructions.

Type consistency:

- Component props match the approved API: `status: DesktopSyncStatus | null` and `loading: boolean`.
- Status field names match `src/lib/webbridge/sync-status.ts`.
- Presentation helper imports match `src/components/pet/sync/syncStatusPresentation.ts`.
- Test paths match the current web app test layout.
