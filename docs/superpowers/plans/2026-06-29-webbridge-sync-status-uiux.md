# WebBridge Sync Status UIUX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the `/dashboard/pet` WebBridge sync status experience so operators can clearly see whether Web has published, Alife .NET has staged, and Alife .NET has applied the current package.

**Architecture:** Keep the implementation frontend-only and scoped to the existing pet dashboard sync components. Add one small presentation helper module for status labels, lifecycle rail state, tones, and compact preview copy, then consume it from the existing React components.

**Tech Stack:** Next.js 16, React 19, TypeScript, Ant Design 6, next-intl, Jest, Testing Library, WebBridge `DesktopSyncStatus`.

---

## File Structure

Work from:

```powershell
cd "D:\FOXD\桌宠demo\新建文件夹\avatar-web-management"
```

Create:

- `src/components/pet/sync/syncStatusPresentation.ts`

Modify:

- `src/components/pet/PetRuntimeSummary.tsx`
- `src/components/pet/sync/PetSyncStatusPanel.tsx`
- `src/components/pet/sync/PetDesktopStatusChip.tsx`
- `src/components/pet/sync/WebBridgeMockStatusPanel.tsx`
- `src/components/__tests__/PetRuntimeSummary.test.tsx`
- `src/components/__tests__/PetSyncStatusPanel.test.tsx`
- `src/components/__tests__/PetDesktopStatusChip.test.tsx`
- `src/components/__tests__/WebBridgeMockStatusPanel.test.tsx`
- `src/components/__tests__/PetConfigPageSync.test.tsx`
- `messages/en.json`
- `messages/zh-CN.json`
- `messages/ja.json`

Do not modify:

- `D:\Alife`
- `D:\FOXD\alife-service`
- Prisma schema or migrations
- Unity-related files

## Presentation Helper Contract

Create `syncStatusPresentation.ts` as the single place for UI-only status mapping. Keep it pure: no React, no browser APIs, no network, no local Alife calls.

Use this exact shape unless implementation reveals an existing equivalent:

```ts
import type {
  DesktopPackageState,
  DesktopSummaryKind,
  DesktopSyncStatus,
} from '@/lib/webbridge/sync-status';
import type { StatusChipTone } from '@/components/ui/StatusChip';

export type SyncLifecycleStage = 'published' | 'staged' | 'applied';

export interface SyncLifecycleStep {
  key: SyncLifecycleStage;
  titleKey: string;
  descriptionKey: string;
  state: 'finish' | 'process' | 'wait' | 'error';
}

export const SUMMARY_TONES: Record<DesktopSummaryKind, StatusChipTone> = {
  unknown: 'neutral',
  desktopOffline: 'warning',
  pendingPull: 'processing',
  localConfirmationRequired: 'warning',
  upToDate: 'success',
  failed: 'error',
};

export const PACKAGE_STATE_TONES: Record<DesktopPackageState, StatusChipTone> = {
  notPublished: 'neutral',
  published: 'processing',
  pulled: 'warning',
  staged: 'warning',
  applied: 'success',
  failed: 'error',
};

export function getPackageStateLabelKey(state: DesktopPackageState): string {
  return `packageStateLabel.${state}`;
}

export function getPackageStateDescriptionKey(state: DesktopPackageState): string {
  return `packageStateDescription.${state}`;
}

export function getRuntimeDetailKey(summaryKind: DesktopSummaryKind): string {
  return `detail.${summaryKind}`;
}

export function getPreviewChipLabelKey(summaryKind: DesktopSummaryKind): string {
  return `previewChip.${summaryKind}`;
}

export function getLifecycleSteps(status: DesktopSyncStatus): SyncLifecycleStep[] {
  const publishedState = status.summaryKind === 'failed' ? 'error' : 'finish';
  const stagedState = getStagedStepState(status);
  const appliedState = getAppliedStepState(status);

  return [
    {
      key: 'published',
      titleKey: 'lifecycle.published.title',
      descriptionKey: 'lifecycle.published.description',
      state: publishedState,
    },
    {
      key: 'staged',
      titleKey: 'lifecycle.staged.title',
      descriptionKey: 'lifecycle.staged.description',
      state: stagedState,
    },
    {
      key: 'applied',
      titleKey: 'lifecycle.applied.title',
      descriptionKey: 'lifecycle.applied.description',
      state: appliedState,
    },
  ];
}

function getStagedStepState(status: DesktopSyncStatus): SyncLifecycleStep['state'] {
  if (status.summaryKind === 'failed') {
    return status.milestones.includes('packageStaged') ? 'error' : 'wait';
  }

  if (
    status.packageState === 'pulled' ||
    status.packageState === 'staged' ||
    status.packageState === 'applied' ||
    status.milestones.includes('packageStaged') ||
    status.milestones.includes('confirmationRequested') ||
    status.milestones.includes('packageApplied')
  ) {
    return status.summaryKind === 'localConfirmationRequired' ? 'process' : 'finish';
  }

  return status.summaryKind === 'pendingPull' ? 'process' : 'wait';
}

function getAppliedStepState(status: DesktopSyncStatus): SyncLifecycleStep['state'] {
  if (status.summaryKind === 'failed') {
    return 'error';
  }

  if (status.isUpToDate || status.packageState === 'applied') {
    return 'finish';
  }

  if (status.summaryKind === 'localConfirmationRequired') {
    return 'process';
  }

  return 'wait';
}
```

## Task 1: Runtime Summary Copy And Tests

**Files:**

- Create: `src/components/pet/sync/syncStatusPresentation.ts`
- Modify: `src/components/pet/PetRuntimeSummary.tsx`
- Test: `src/components/__tests__/PetRuntimeSummary.test.tsx`

- [ ] **Step 1: Write the failing runtime summary tests**

Replace the `next-intl` mock in `PetRuntimeSummary.test.tsx` with a dictionary so tests assert real operator copy:

```tsx
jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const keys: Record<string, Record<string, string>> = {
      pet: {
        'runtimeSummary.title': 'Runtime status',
        'runtimeSummary.unavailable':
          'Runtime sync status is unavailable. Check again after the web service is ready.',
        'runtimeSummary.currentState': 'Current state',
        'runtimeSummary.nextAction.label': 'Next action',
        'runtimeSummary.nextAction.none': 'No action required',
        'runtimeSummary.nextAction.checkAgain': 'Check Alife .NET runtime status again',
        'runtimeSummary.nextAction.openDesktop': 'Open Alife .NET runtime',
        'runtimeSummary.nextAction.confirmInDesktop':
          'Confirm the staged package inside Alife .NET',
        'runtimeSummary.nextAction.viewDetails': 'Review sync details before retrying',
      },
      'pet.syncStatus': {
        webVersion: 'Web version',
        desktopKnownVersion: 'Alife known version',
        desktopAppliedVersion: 'Alife applied version',
        localConfirmation: 'Local confirmation',
        required: 'Required',
        notRequired: 'Not required',
        notApplied: 'Not applied',
        lastSyncAt: 'Last sync',
        never: 'Never',
        'action.checkAgain': 'Check again',
        'summary.pendingPull': 'Waiting for Alife .NET pull',
        'summary.localConfirmationRequired': 'Awaiting local confirmation',
        'summary.upToDate': 'Applied in Alife .NET',
        'summary.desktopOffline': 'Alife .NET offline',
        'summary.failed': 'Sync failed',
        'summary.unknown': 'Unknown',
        'detail.pendingPull': 'Web has a newer package waiting for Alife .NET to pull.',
        'detail.localConfirmationRequired':
          'Package staged locally. Confirm it in Alife .NET before apply.',
        'detail.upToDate': 'Alife .NET is running the current Web version.',
        'detail.desktopOffline': 'Alife .NET is offline or has not reported recently.',
        'detail.failed': 'Review the sync error before retrying.',
        'detail.unknown': 'Status is incomplete. Check again after Alife .NET reports.',
      },
    };

    return (key: string) => keys[namespace]?.[key] ?? key;
  },
}));
```

Add these tests under `describe('PetRuntimeSummary', ...)`:

```tsx
it('pendingPull explains that Alife .NET must pull the Web package', () => {
  render(
    <PetRuntimeSummary
      status={createStatus({
        packageState: 'published',
        summaryKind: 'pendingPull',
        primaryAction: 'checkAgain',
        desktopKnownVersion: 11,
        desktopAppliedVersion: 11,
        requiresLocalConfirmation: false,
      })}
      loading={false}
      onRefresh={jest.fn()}
    />,
    { wrapper: Wrapper },
  );

  expect(screen.getByText('Waiting for Alife .NET pull')).toBeDefined();
  expect(
    screen.getByText('Web has a newer package waiting for Alife .NET to pull.'),
  ).toBeDefined();
  expect(screen.getByText('Check Alife .NET runtime status again')).toBeDefined();
});

it('upToDate explains that Alife .NET applied the current Web version', () => {
  render(
    <PetRuntimeSummary
      status={createStatus({
        packageState: 'applied',
        summaryKind: 'upToDate',
        primaryAction: 'none',
        isUpToDate: true,
        desktopKnownVersion: 12,
        desktopAppliedVersion: 12,
        requiresLocalConfirmation: false,
      })}
      loading={false}
      onRefresh={jest.fn()}
    />,
    { wrapper: Wrapper },
  );

  expect(screen.getByText('Applied in Alife .NET')).toBeDefined();
  expect(screen.getByText('Alife .NET is running the current Web version.')).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Check again' })).toBeNull();
});
```

- [ ] **Step 2: Run the runtime summary test and verify RED**

Run:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetRuntimeSummary.test.tsx
```

Expected: FAIL because the component does not yet render `detail.pendingPull` or `detail.upToDate` copy.

- [ ] **Step 3: Add the shared presentation helper**

Create `src/components/pet/sync/syncStatusPresentation.ts` with the helper contract shown in the "Presentation Helper Contract" section.

- [ ] **Step 4: Update `PetRuntimeSummary.tsx`**

Remove the local `SUMMARY_TONES` constant and import:

```tsx
import {
  getRuntimeDetailKey,
  SUMMARY_TONES,
} from '@/components/pet/sync/syncStatusPresentation';
```

Change the existing status body to include current-state and detail copy:

```tsx
<Space vertical size="middle" style={{ width: '100%' }}>
  <div>
    <Text type="secondary">{tPet('runtimeSummary.currentState')}</Text>
    <div style={{ marginTop: 4, color: 'var(--text-primary)', fontWeight: 650 }}>
      {tSync(`summary.${status.summaryKind}`)}
    </div>
    <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
      {tSync(getRuntimeDetailKey(status.summaryKind))}
    </Text>
  </div>
  <div>
    <Text type="secondary">{tPet('runtimeSummary.nextAction.label')}</Text>
    <div style={{ marginTop: 4, color: 'var(--text-primary)', fontWeight: 650 }}>
      {tPet(`runtimeSummary.nextAction.${status.primaryAction}`)}
    </div>
  </div>
  <div
    style={{
      display: 'grid',
      gap: 12,
      gridTemplateColumns: 'repeat(auto-fit, minmax(var(--ds-panel-gridMinWidth), 1fr))',
    }}
  >
    <MetricTile label={tSync('webVersion')} value={status.webConfigVersion} />
    <MetricTile
      label={tSync('desktopKnownVersion')}
      value={status.desktopKnownVersion ?? tSync('notApplied')}
    />
    <MetricTile
      label={tSync('desktopAppliedVersion')}
      value={status.desktopAppliedVersion ?? tSync('notApplied')}
    />
    <MetricTile
      label={tSync('localConfirmation')}
      value={status.requiresLocalConfirmation ? tSync('required') : tSync('notRequired')}
    />
  </div>
</Space>
```

Keep `renderPrimaryAction` behavior unchanged: only `checkAgain` renders the refresh button.

- [ ] **Step 5: Run the runtime summary test and verify GREEN**

Run:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetRuntimeSummary.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

Run:

```powershell
git add "src/components/pet/sync/syncStatusPresentation.ts" "src/components/pet/PetRuntimeSummary.tsx" "src/components/__tests__/PetRuntimeSummary.test.tsx"
git commit -m "feat: clarify WebBridge runtime summary"
```

## Task 2: Sync Detail Lifecycle Rail And Package Labels

**Files:**

- Modify: `src/components/pet/sync/PetSyncStatusPanel.tsx`
- Modify: `src/components/pet/sync/syncStatusPresentation.ts`
- Test: `src/components/__tests__/PetSyncStatusPanel.test.tsx`

- [ ] **Step 1: Write the failing sync detail tests**

Expand the `pet.syncStatus` mock in `PetSyncStatusPanel.test.tsx` with these keys:

```tsx
'detail.pendingPull': 'Web has a newer package waiting for Alife .NET to pull.',
'detail.localConfirmationRequired':
  'Package staged locally. Confirm it in Alife .NET before apply.',
'detail.upToDate': 'Alife .NET is running the current Web version.',
'detail.desktopOffline': 'Alife .NET is offline or has not reported recently.',
'detail.failed': 'Review the sync error before retrying.',
'detail.unknown': 'Status is incomplete. Check again after Alife .NET reports.',
'lifecycle.published.title': 'Web published',
'lifecycle.published.description': 'Web has prepared the current package.',
'lifecycle.staged.title': 'Alife staged',
'lifecycle.staged.description': 'Alife .NET has pulled and validated the package.',
'lifecycle.applied.title': 'Applied',
'lifecycle.applied.description': 'Alife .NET is running the current version.',
'packageStateLabel.notPublished': 'Not published',
'packageStateLabel.published': 'Published, waiting for pull',
'packageStateLabel.pulled': 'Pulled by Alife .NET',
'packageStateLabel.staged': 'Staged locally',
'packageStateLabel.applied': 'Applied in Alife .NET',
'packageStateLabel.failed': 'Package failed',
'packageStateDescription.notPublished': 'Publish a Web package before Alife .NET can pull.',
'packageStateDescription.published': 'Web has a package ready for Alife .NET.',
'packageStateDescription.pulled': 'Alife .NET downloaded the package and is preparing it.',
'packageStateDescription.staged': 'Alife .NET is waiting for local confirmation.',
'packageStateDescription.applied': 'Alife .NET applied the current package.',
'packageStateDescription.failed': 'Review the failure before retrying.',
'rawState': 'Raw state',
'localActionNotice': 'Confirm this staged package inside Alife .NET.',
```

Replace the existing `localConfirmationRequired state shows summary and confirm button` expectations with:

```tsx
expect(screen.getByText('Awaiting local confirmation')).toBeDefined();
expect(screen.getByText('Package staged locally. Confirm it in Alife .NET before apply.')).toBeDefined();
expect(screen.getByText('Web published')).toBeDefined();
expect(screen.getByText('Alife staged')).toBeDefined();
expect(screen.getByText('Applied')).toBeDefined();
expect(screen.getByText('Staged locally')).toBeDefined();
expect(screen.getByText('Alife .NET is waiting for local confirmation.')).toBeDefined();
expect(screen.getByText('Raw state')).toBeDefined();
expect(screen.getByText('staged')).toBeDefined();
expect(screen.getByText('Confirm this staged package inside Alife .NET.')).toBeDefined();
expect(screen.getByRole('button', { name: /confirm in desktop/i })).toBeDisabled();
```

Add a pending-pull test:

```tsx
it('pendingPull shows Web published and waits for Alife .NET pull', () => {
  render(
    <PetSyncStatusPanel
      status={createStatus({
        packageState: 'published',
        summaryKind: 'pendingPull',
        primaryAction: 'checkAgain',
        desktopKnownVersion: 6,
        desktopAppliedVersion: 6,
        requiresLocalConfirmation: false,
        milestones: ['manifestFetched'],
      })}
      loading={false}
      onRefresh={jest.fn()}
    />,
    { wrapper: Wrapper },
  );

  expect(screen.getByText('Waiting for Alife .NET pull')).toBeDefined();
  expect(screen.getByText('Published, waiting for pull')).toBeDefined();
  expect(screen.getByText('Web has a package ready for Alife .NET.')).toBeDefined();
  expect(screen.getByText('Web published')).toBeDefined();
  expect(screen.getByText('Alife staged')).toBeDefined();
  expect(screen.getByText('Applied')).toBeDefined();
});
```

- [ ] **Step 2: Run the sync panel test and verify RED**

Run:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetSyncStatusPanel.test.tsx
```

Expected: FAIL because lifecycle and package label copy are not rendered yet.

- [ ] **Step 3: Update `PetSyncStatusPanel.tsx` imports**

Change imports to include `Steps` and the helper functions:

```tsx
import { Alert, Button, Descriptions, Space, Spin, Steps, Tag, Tooltip, Typography } from 'antd';
import {
  getLifecycleSteps,
  getPackageStateDescriptionKey,
  getPackageStateLabelKey,
  getRuntimeDetailKey,
  PACKAGE_STATE_TONES,
  SUMMARY_TONES,
} from '@/components/pet/sync/syncStatusPresentation';
```

Remove the local `SUMMARY_TONES` constant from this file.

- [ ] **Step 4: Add the lifecycle rail and status detail**

Inside the non-null status render path, define:

```tsx
const lifecycleSteps = getLifecycleSteps(status);
```

Replace the top chip area with:

```tsx
<Space vertical size={6} style={{ width: '100%' }}>
  <Space size="small" wrap>
    <StatusChip tone={SUMMARY_TONES[status.summaryKind]}>
      {t(`summary.${status.summaryKind}`)}
    </StatusChip>
    <StatusChip tone="success">{t('source.live')}</StatusChip>
  </Space>
  <Text type="secondary">{t(getRuntimeDetailKey(status.summaryKind))}</Text>
</Space>
```

Add this lifecycle rail directly after that block:

```tsx
<Steps
  size="small"
  current={lifecycleSteps.findIndex((step) => step.state === 'process')}
  items={lifecycleSteps.map((step) => ({
    title: t(step.titleKey),
    description: t(step.descriptionKey),
    status: step.state,
  }))}
/>
```

Replace the `packageState` description item with:

```tsx
<Descriptions.Item label={t('packageState')}>
  <Space vertical size={4}>
    <StatusChip tone={PACKAGE_STATE_TONES[status.packageState]}>
      {t(getPackageStateLabelKey(status.packageState))}
    </StatusChip>
    <Text type="secondary">{t(getPackageStateDescriptionKey(status.packageState))}</Text>
    <Text type="secondary">
      {t('rawState')}: <Text code>{status.packageState}</Text>
    </Text>
  </Space>
</Descriptions.Item>
```

- [ ] **Step 5: Update the local confirmation action**

In `renderAction`, keep the disabled button but change the tooltip and button label keys to the clearer local-action copy:

```tsx
if (primaryAction === 'confirmInDesktop') {
  return (
    <Tooltip title={t('actionHint.confirmInDesktop')}>
      <Button type="primary" icon={<DesktopOutlined />} disabled>
        {t('action.confirmInDesktop')}
      </Button>
    </Tooltip>
  );
}
```

Under the lifecycle rail, render this notice only for `confirmInDesktop`:

```tsx
{status.primaryAction === 'confirmInDesktop' && (
  <Alert type="warning" showIcon message={t('localActionNotice')} />
)}
```

- [ ] **Step 6: Run the sync panel test and verify GREEN**

Run:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetSyncStatusPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

Run:

```powershell
git add "src/components/pet/sync/PetSyncStatusPanel.tsx" "src/components/pet/sync/syncStatusPresentation.ts" "src/components/__tests__/PetSyncStatusPanel.test.tsx"
git commit -m "feat: add WebBridge sync lifecycle panel"
```

## Task 3: Compact Preview Status Chip

**Files:**

- Modify: `src/components/pet/sync/PetDesktopStatusChip.tsx`
- Test: `src/components/__tests__/PetDesktopStatusChip.test.tsx`

- [ ] **Step 1: Write the failing preview chip tests**

Expand the translation mock:

```tsx
'syncStatus.previewChip.upToDate': 'Synced',
'syncStatus.previewChip.failed': 'Sync failed',
'syncStatus.previewChip.pendingPull': 'Pending pull',
'syncStatus.previewChip.localConfirmationRequired': 'Confirm locally',
'syncStatus.previewChip.desktopOffline': 'Offline',
'syncStatus.previewChip.unknown': 'Unknown',
```

Add these tests:

```tsx
it('uses compact labels for preview states', () => {
  render(
    <div>
      <PetDesktopStatusChip status={createStatus({ summaryKind: 'pendingPull' })} />
      <PetDesktopStatusChip
        status={createStatus({
          packageState: 'staged',
          summaryKind: 'localConfirmationRequired',
          primaryAction: 'confirmInDesktop',
          requiresLocalConfirmation: true,
        })}
      />
      <PetDesktopStatusChip
        status={createStatus({
          packageState: 'applied',
          summaryKind: 'upToDate',
          primaryAction: 'none',
          isUpToDate: true,
        })}
      />
    </div>,
  );

  expect(screen.getByText('Pending pull')).toBeDefined();
  expect(screen.getByText('Confirm locally')).toBeDefined();
  expect(screen.getByText('Synced')).toBeDefined();
});

it('shows offline as a compact state when Alife .NET has not reported recently', () => {
  render(
    <PetDesktopStatusChip
      status={createStatus({
        desktopConnection: 'offline',
        summaryKind: 'desktopOffline',
        primaryAction: 'checkAgain',
      })}
    />,
  );

  expect(screen.getByText('Offline')).toBeDefined();
});
```

- [ ] **Step 2: Run the preview chip test and verify RED**

Run:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetDesktopStatusChip.test.tsx
```

Expected: FAIL because compact `previewChip.*` keys are not used yet.

- [ ] **Step 3: Update `PetDesktopStatusChip.tsx`**

Import the compact helper:

```tsx
import { getPreviewChipLabelKey } from '@/components/pet/sync/syncStatusPresentation';
```

Replace visible labels with:

```tsx
const label = t(`syncStatus.${getPreviewChipLabelKey(status.summaryKind)}`);
```

Use the same `label` in every non-null branch:

```tsx
if (status.isUpToDate) {
  return (
    <Tooltip title={t('preview.desktopStatusTip')}>
      <Tag color="green" icon={<CheckCircleOutlined />}>
        {label}
      </Tag>
    </Tooltip>
  );
}

if (status.summaryKind === 'failed') {
  return (
    <Tooltip title={t('preview.desktopStatusTip')}>
      <Tag color="red" icon={<ExclamationCircleOutlined />}>
        {label}
      </Tag>
    </Tooltip>
  );
}

const color = status.summaryKind === 'desktopOffline' ? 'orange' : 'blue';

return (
  <Tooltip title={t('preview.desktopStatusTip')}>
    <Tag color={color} icon={<ClockCircleOutlined />}>
      {label}
    </Tag>
  </Tooltip>
);
```

For null status, use:

```tsx
{t('syncStatus.previewChip.unknown')}
```

- [ ] **Step 4: Run the preview chip test and verify GREEN**

Run:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetDesktopStatusChip.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

Run:

```powershell
git add "src/components/pet/sync/PetDesktopStatusChip.tsx" "src/components/__tests__/PetDesktopStatusChip.test.tsx"
git commit -m "feat: compact Alife sync preview chip"
```

## Task 4: Mock Panel Simulation Clarity

**Files:**

- Modify: `src/components/pet/sync/WebBridgeMockStatusPanel.tsx`
- Test: `src/components/__tests__/WebBridgeMockStatusPanel.test.tsx`

- [ ] **Step 1: Write the failing mock panel tests**

Update expectations in `WebBridgeMockStatusPanel.test.tsx`:

```tsx
expect(screen.getByText('WebBridge package simulation')).toBeDefined();
expect(screen.getByText('Simulation only')).toBeDefined();
expect(screen.getByText('Alife .NET 9')).toBeDefined();
expect(screen.getByText('No live Alife calls')).toBeDefined();
expect(screen.getByText('Pending local confirmation')).toBeDefined();
expect(screen.getByText('Confirm inside Alife .NET before apply')).toBeDefined();
```

In the scenario switching test, replace:

```tsx
expect(screen.getAllByText('Local operator review before apply').length).toBeGreaterThan(0);
```

with:

```tsx
expect(screen.getAllByText('Confirm inside Alife .NET before apply').length).toBeGreaterThan(0);
```

- [ ] **Step 2: Run the mock panel test and verify RED**

Run:

```powershell
npx jest --verbose --runInBand src/components/__tests__/WebBridgeMockStatusPanel.test.tsx
```

Expected: FAIL because the panel still says `WebBridge package install`, `Mock simulation`, and generic local-operator copy.

- [ ] **Step 3: Update mock scenario copy**

In `WebBridgeMockStatusPanel.tsx`, update `mockChecks` pending entry:

```tsx
{
  key: 'pending',
  label: 'Pending local confirmation',
  detail: 'Alife .NET apply guard',
  icon: <ClockCircleOutlined />,
},
```

Update the `pendingActivation` scenario:

```tsx
pendingActivation: {
  label: 'Ready package',
  packageState: 'pendingActivation',
  tagColor: 'orange',
  activeStep: 3,
  nextAction: 'Confirm inside Alife .NET before apply',
  detail:
    'Package passed preflight, manifest, and SHA-256 checks. Alife .NET holds activation for local confirmation.',
  alertType: 'success',
  checks: {
    preflight: 'ready',
    manifest: 'ready',
    hash: 'ready',
    pending: 'waiting',
  },
},
```

Update the title:

```tsx
<span>WebBridge package simulation</span>
<Tag color="default">Simulation only</Tag>
```

Update the scenario label:

```tsx
<Text strong>Simulation scenario</Text>
```

Keep `Runtime` as `Alife .NET 9` and `Isolation` as `No live Alife calls`.

- [ ] **Step 4: Run the mock panel test and verify GREEN**

Run:

```powershell
npx jest --verbose --runInBand src/components/__tests__/WebBridgeMockStatusPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

Run:

```powershell
git add "src/components/pet/sync/WebBridgeMockStatusPanel.tsx" "src/components/__tests__/WebBridgeMockStatusPanel.test.tsx"
git commit -m "feat: clarify WebBridge simulation panel"
```

## Task 5: Locale Copy And Page-Level Regression

**Files:**

- Modify: `messages/en.json`
- Modify: `messages/zh-CN.json`
- Modify: `messages/ja.json`
- Modify: `src/components/__tests__/PetConfigPageSync.test.tsx`

- [ ] **Step 1: Write the failing page-level test update**

In `PetConfigPageSync.test.tsx`, update the first test to assert the new simulation title:

```tsx
expect(screen.getByText('WebBridge package simulation')).toBeDefined();
expect(screen.getByText('Alife .NET 9')).toBeDefined();
expect(screen.getByText('No live Alife calls')).toBeDefined();
```

Run:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetConfigPageSync.test.tsx
```

Expected: FAIL until Task 4 changes are present in the current branch. If Task 4 is already committed, this may pass; in that case continue to locale updates and run the focused suite in Step 4.

- [ ] **Step 2: Add English locale keys**

In `messages/en.json`, update `pet.consoleSubtitle` to:

```json
"Prepare and validate the Web pet configuration here. Alife .NET applies staged changes only after local confirmation."
```

Under `pet.syncStatus`, add or update these keys:

```json
"desktopAppliedVersion": "Alife applied version",
"desktopKnownVersion": "Alife known version",
"rawState": "Raw state",
"localActionNotice": "Confirm this staged package inside Alife .NET.",
"summary": {
  "unknown": "Unknown",
  "desktopOffline": "Alife .NET offline",
  "pendingPull": "Waiting for Alife .NET pull",
  "localConfirmationRequired": "Awaiting local confirmation",
  "upToDate": "Applied in Alife .NET",
  "failed": "Sync failed"
},
"detail": {
  "unknown": "Status is incomplete. Check again after Alife .NET reports.",
  "desktopOffline": "Alife .NET is offline or has not reported recently.",
  "pendingPull": "Web has a newer package waiting for Alife .NET to pull.",
  "localConfirmationRequired": "Package staged locally. Confirm it in Alife .NET before apply.",
  "upToDate": "Alife .NET is running the current Web version.",
  "failed": "Review the sync error before retrying."
},
"lifecycle": {
  "published": {
    "title": "Web published",
    "description": "Web has prepared the current package."
  },
  "staged": {
    "title": "Alife staged",
    "description": "Alife .NET has pulled and validated the package."
  },
  "applied": {
    "title": "Applied",
    "description": "Alife .NET is running the current version."
  }
},
"packageStateLabel": {
  "notPublished": "Not published",
  "published": "Published, waiting for pull",
  "pulled": "Pulled by Alife .NET",
  "staged": "Staged locally",
  "applied": "Applied in Alife .NET",
  "failed": "Package failed"
},
"packageStateDescription": {
  "notPublished": "Publish a Web package before Alife .NET can pull.",
  "published": "Web has a package ready for Alife .NET.",
  "pulled": "Alife .NET downloaded the package and is preparing it.",
  "staged": "Alife .NET is waiting for local confirmation.",
  "applied": "Alife .NET applied the current package.",
  "failed": "Review the failure before retrying."
},
"previewChip": {
  "unknown": "Unknown",
  "desktopOffline": "Offline",
  "pendingPull": "Pending pull",
  "localConfirmationRequired": "Confirm locally",
  "upToDate": "Synced",
  "failed": "Sync failed"
},
"action": {
  "checkAgain": "Check again",
  "confirmInDesktop": "Confirm in Alife .NET",
  "viewDetails": "View details",
  "openDesktop": "Open Alife .NET"
},
"actionHint": {
  "confirmInDesktop": "Confirm the staged package inside Alife .NET. Web activation is not available."
}
```

Under `pet.runtimeSummary`, add:

```json
"currentState": "Current state"
```

and update `nextAction` values:

```json
"checkAgain": "Check Alife .NET runtime status again",
"openDesktop": "Open Alife .NET runtime",
"confirmInDesktop": "Confirm the staged package inside Alife .NET"
```

- [ ] **Step 3: Add matching zh-CN and ja locale keys**

Use this zh-CN copy in `messages/zh-CN.json`. Preserve the same JSON key structure as English.

```json
{
  "consoleSubtitle": "在此准备并验证 Web 桌宠配置。Alife .NET 只会在本地确认后应用暂存变更。",
  "desktopAppliedVersion": "Alife 已应用版本",
  "desktopKnownVersion": "Alife 已知版本",
  "rawState": "原始状态",
  "localActionNotice": "请在 Alife .NET 中确认这个已暂存的包。",
  "summary": {
    "unknown": "状态未知",
    "desktopOffline": "Alife .NET 离线",
    "pendingPull": "等待 Alife .NET 拉取",
    "localConfirmationRequired": "等待本地确认",
    "upToDate": "已应用到 Alife .NET",
    "failed": "同步失败"
  },
  "detail": {
    "unknown": "状态信息不完整。请在 Alife .NET 上报后重新检查。",
    "desktopOffline": "Alife .NET 离线或最近没有上报状态。",
    "pendingPull": "Web 有更新的包，正在等待 Alife .NET 拉取。",
    "localConfirmationRequired": "包已在本地暂存。应用前请在 Alife .NET 中确认。",
    "upToDate": "Alife .NET 正在运行当前 Web 版本。",
    "failed": "重试前请先查看同步错误。"
  },
  "lifecycle": {
    "published": {
      "title": "Web 已发布",
      "description": "Web 已准备当前包。"
    },
    "staged": {
      "title": "Alife 已暂存",
      "description": "Alife .NET 已拉取并验证该包。"
    },
    "applied": {
      "title": "已应用",
      "description": "Alife .NET 正在运行当前版本。"
    }
  },
  "packageStateLabel": {
    "notPublished": "未发布",
    "published": "已发布，等待拉取",
    "pulled": "Alife .NET 已拉取",
    "staged": "已在本地暂存",
    "applied": "已应用到 Alife .NET",
    "failed": "包处理失败"
  },
  "packageStateDescription": {
    "notPublished": "先发布 Web 包，Alife .NET 才能拉取。",
    "published": "Web 已准备好可供 Alife .NET 拉取的包。",
    "pulled": "Alife .NET 已下载该包，正在准备暂存。",
    "staged": "Alife .NET 正在等待本地确认。",
    "applied": "Alife .NET 已应用当前包。",
    "failed": "重试前请先查看失败原因。"
  },
  "previewChip": {
    "unknown": "未知",
    "desktopOffline": "离线",
    "pendingPull": "待拉取",
    "localConfirmationRequired": "待本地确认",
    "upToDate": "已同步",
    "failed": "同步失败"
  },
  "action": {
    "checkAgain": "重新检查",
    "confirmInDesktop": "在 Alife .NET 中确认",
    "viewDetails": "查看详情",
    "openDesktop": "打开 Alife .NET"
  },
  "actionHint": {
    "confirmInDesktop": "请在 Alife .NET 中确认已暂存的包。Web 不提供本地激活操作。"
  },
  "runtimeSummary": {
    "currentState": "当前状态",
    "nextAction": {
      "checkAgain": "重新检查 Alife .NET 运行状态",
      "openDesktop": "打开 Alife .NET 运行时",
      "confirmInDesktop": "在 Alife .NET 中确认已暂存的包"
    }
  }
}
```

Use this ja copy in `messages/ja.json`. Preserve the same JSON key structure as English.

```json
{
  "consoleSubtitle": "ここで Web ペット設定を準備し、検証します。Alife .NET はローカル確認後にのみステージ済みの変更を適用します。",
  "desktopAppliedVersion": "Alife 適用済みバージョン",
  "desktopKnownVersion": "Alife 既知バージョン",
  "rawState": "内部状態",
  "localActionNotice": "ステージ済みパッケージは Alife .NET で確認してください。",
  "summary": {
    "unknown": "不明",
    "desktopOffline": "Alife .NET オフライン",
    "pendingPull": "Alife .NET の取得待ち",
    "localConfirmationRequired": "ローカル確認待ち",
    "upToDate": "Alife .NET に適用済み",
    "failed": "同期失敗"
  },
  "detail": {
    "unknown": "状態情報が不足しています。Alife .NET の報告後に再確認してください。",
    "desktopOffline": "Alife .NET はオフライン、または最近状態を報告していません。",
    "pendingPull": "Web に新しいパッケージがあり、Alife .NET の取得を待っています。",
    "localConfirmationRequired": "パッケージはローカルでステージ済みです。適用前に Alife .NET で確認してください。",
    "upToDate": "Alife .NET は現在の Web バージョンを実行しています。",
    "failed": "再試行前に同期エラーを確認してください。"
  },
  "lifecycle": {
    "published": {
      "title": "Web 公開済み",
      "description": "Web は現在のパッケージを準備済みです。"
    },
    "staged": {
      "title": "Alife ステージ済み",
      "description": "Alife .NET はパッケージを取得し検証しました。"
    },
    "applied": {
      "title": "適用済み",
      "description": "Alife .NET は現在のバージョンを実行しています。"
    }
  },
  "packageStateLabel": {
    "notPublished": "未公開",
    "published": "公開済み、取得待ち",
    "pulled": "Alife .NET 取得済み",
    "staged": "ローカルでステージ済み",
    "applied": "Alife .NET に適用済み",
    "failed": "パッケージ失敗"
  },
  "packageStateDescription": {
    "notPublished": "Alife .NET が取得できるように Web パッケージを公開してください。",
    "published": "Web は Alife .NET が取得できるパッケージを準備済みです。",
    "pulled": "Alife .NET はパッケージをダウンロードし、準備中です。",
    "staged": "Alife .NET はローカル確認を待っています。",
    "applied": "Alife .NET は現在のパッケージを適用しました。",
    "failed": "再試行前に失敗理由を確認してください。"
  },
  "previewChip": {
    "unknown": "不明",
    "desktopOffline": "オフライン",
    "pendingPull": "取得待ち",
    "localConfirmationRequired": "確認待ち",
    "upToDate": "同期済み",
    "failed": "同期失敗"
  },
  "action": {
    "checkAgain": "再確認",
    "confirmInDesktop": "Alife .NET で確認",
    "viewDetails": "詳細を見る",
    "openDesktop": "Alife .NET を開く"
  },
  "actionHint": {
    "confirmInDesktop": "ステージ済みパッケージは Alife .NET で確認してください。Web からのローカル適用はできません。"
  },
  "runtimeSummary": {
    "currentState": "現在の状態",
    "nextAction": {
      "checkAgain": "Alife .NET ランタイム状態を再確認",
      "openDesktop": "Alife .NET ランタイムを開く",
      "confirmInDesktop": "ステージ済みパッケージを Alife .NET で確認"
    }
  }
}
```

- [ ] **Step 4: Run the page-level and focused component tests**

Run:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetRuntimeSummary.test.tsx src/components/__tests__/PetSyncStatusPanel.test.tsx src/components/__tests__/PetDesktopStatusChip.test.tsx src/components/__tests__/WebBridgeMockStatusPanel.test.tsx src/components/__tests__/PetConfigPageSync.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

Run:

```powershell
git add "messages/en.json" "messages/zh-CN.json" "messages/ja.json" "src/components/__tests__/PetConfigPageSync.test.tsx"
git commit -m "feat: localize Alife sync status copy"
```

## Task 6: Regression, Typecheck, Build, And Smoke

**Files:**

- No planned source edits unless verification exposes a direct failure caused by this slice.

- [ ] **Step 1: Run focused Jest**

Run:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetRuntimeSummary.test.tsx src/components/__tests__/PetSyncStatusPanel.test.tsx src/components/__tests__/PetDesktopStatusChip.test.tsx src/components/__tests__/WebBridgeMockStatusPanel.test.tsx src/components/__tests__/PetConfigPageSync.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run existing WebBridge package route/service regression tests**

Run:

```powershell
npx jest --verbose --runInBand tests/unit/pet-service.test.ts tests/unit/test-integration-local.test.ts tests/unit/package-scripts.test.ts tests/unit/webbridge-package-service.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 4: Run production build**

Run:

```powershell
npm run build
```

Expected: exit 0.

- [ ] **Step 5: Run WebBridge staged-to-applied smoke if local Alife remains clean**

Run:

```powershell
$env:DOTNET_EXE='C:\Users\hu shu\.dotnet\dotnet.exe'
$env:ALIFE_ROOT='D:\Alife'
npm run check:webbridge:smoke
```

Expected: PASS with staged and applied status observed. If another long-running Alife task is actively changing `D:\Alife`, stop and report that smoke was skipped to avoid interfering with Alife.

- [ ] **Step 6: Inspect final diff**

Run:

```powershell
git diff --check
git status --short --branch
```

Expected:

- `git diff --check` has no whitespace errors.
- Only the intended frontend, locale, and test files are modified since the last implementation commit.

- [ ] **Step 7: Final implementation commit if verification required fixes**

If verification required direct fixes after Task 5, commit them:

```powershell
git add "src/components/pet" "src/components/__tests__" "messages/en.json" "messages/zh-CN.json" "messages/ja.json"
git commit -m "fix: stabilize WebBridge sync status UI"
```

If no fixes were needed, do not create an empty commit.

## Completion Criteria

This slice is complete only when:

- Runtime summary explains the active WebBridge state in Alife .NET language.
- Sync detail panel shows a three-step Web published -> Alife staged -> Applied rail.
- Raw package state is secondary detail, not the main user-facing label.
- Local confirmation is clearly a local Alife .NET action.
- Preview chip uses compact labels.
- Mock panel is clearly simulation-only and still says `Alife .NET 9` and `No live Alife calls`.
- Focused Jest, typecheck, build, and feasible smoke verification have current passing evidence.
- No Alife, Unity, DB schema, or submodule files were changed.
