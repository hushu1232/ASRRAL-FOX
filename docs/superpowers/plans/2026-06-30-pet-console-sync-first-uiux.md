# Pet Console Sync-First UI/UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework `/dashboard/pet` into a sync-first control surface where the real WebBridge and Alife .NET 9 state is the first thing users understand.

**Architecture:** Keep the change frontend-only and page-scoped. Reorder the pet dashboard so live sync status comes before preview/config editing, add a default-collapsed diagnostics section for the mock package simulation, and refine existing sync components rather than introducing a new design system.

**Tech Stack:** Next.js 16, React 19, TypeScript, Ant Design 6, next-intl, Jest, Testing Library, WebBridge `DesktopSyncStatus`, Alife .NET 9 copy.

---

## File Structure

Work from the app directory:

```powershell
cd "D:\FOXD\桌宠demo\新建文件夹\avatar-web-management"
```

Create:

- `src/components/pet/sync/PetDiagnosticsSection.tsx`
- `src/components/__tests__/PetDiagnosticsSection.test.tsx`

Modify:

- `src/app/(auth)/dashboard/pet/page.tsx`
- `src/components/pet/PetRuntimeSummary.tsx`
- `src/components/pet/sync/PetSyncStatusPanel.tsx`
- `src/components/__tests__/PetConfigPageSync.test.tsx`
- `src/components/__tests__/PetRuntimeSummary.test.tsx`
- `src/components/__tests__/PetSyncStatusPanel.test.tsx`
- `src/components/__tests__/PetSyncLocaleCopy.test.ts`
- `messages/en.json`
- `messages/zh-CN.json`
- `messages/ja.json`

Do not modify:

- `D:\Alife`
- `D:\FOXD\alife-service`
- Prisma schema or migrations
- WebBridge protocol handlers
- Unity-related files
- Global site token files unless a compile error proves a tiny page-scoped helper cannot work

## Task 1: Page-Level Sync-First Ordering And Diagnostics Collapse

**Files:**

- Create: `src/components/pet/sync/PetDiagnosticsSection.tsx`
- Create: `src/components/__tests__/PetDiagnosticsSection.test.tsx`
- Modify: `src/app/(auth)/dashboard/pet/page.tsx`
- Test: `src/components/__tests__/PetConfigPageSync.test.tsx`

- [ ] **Step 1: Write the failing diagnostics section test**

Create `src/components/__tests__/PetDiagnosticsSection.test.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import PetDiagnosticsSection from '@/components/pet/sync/PetDiagnosticsSection';

jest.mock('@ant-design/icons', () => ({
  BugOutlined: () => <span data-testid="icon-bug" />,
  DownOutlined: () => <span data-testid="icon-down" />,
  UpOutlined: () => <span data-testid="icon-up" />,
}));

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      'pet.diagnostics': {
        title: 'Diagnostics and package simulation',
        description: 'Simulation tools are hidden by default so live Alife .NET status stays first.',
        show: 'Show diagnostics',
        hide: 'Hide diagnostics',
      },
    };

    return (key: string) => messages[namespace]?.[key] ?? key;
  },
}));

describe('PetDiagnosticsSection', () => {
  it('keeps simulation content collapsed until the operator opens diagnostics', () => {
    render(
      <PetDiagnosticsSection>
        <div>WebBridge package simulation</div>
      </PetDiagnosticsSection>,
    );

    expect(screen.getByText('Diagnostics and package simulation')).toBeDefined();
    expect(
      screen.getByText('Simulation tools are hidden by default so live Alife .NET status stays first.'),
    ).toBeDefined();
    expect(screen.queryByText('WebBridge package simulation')).toBeNull();

    const toggle = screen.getByRole('button', { name: 'Show diagnostics' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);

    expect(screen.getByRole('button', { name: 'Hide diagnostics' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText('WebBridge package simulation')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the new diagnostics section test and verify RED**

Run:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetDiagnosticsSection.test.tsx
```

Expected: FAIL because `PetDiagnosticsSection` does not exist.

- [ ] **Step 3: Implement `PetDiagnosticsSection`**

Create `src/components/pet/sync/PetDiagnosticsSection.tsx`:

```tsx
'use client';

import { useState, type ReactNode } from 'react';
import { BugOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import { Button, Space, Typography } from 'antd';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface PetDiagnosticsSectionProps {
  children: ReactNode;
}

export default function PetDiagnosticsSection({ children }: PetDiagnosticsSectionProps) {
  const t = useTranslations('pet.diagnostics');
  const [open, setOpen] = useState(false);

  return (
    <section
      aria-label={t('title')}
      data-testid="pet-diagnostics-section"
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--ds-panel-radius)',
        background: 'var(--bg-card)',
        padding: 'var(--ds-panel-densePadding)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <Space align="start" size="middle">
          <BugOutlined style={{ color: 'var(--text-secondary)', marginTop: 3 }} />
          <span>
            <Text strong style={{ display: 'block', color: 'var(--text-primary)' }}>
              {t('title')}
            </Text>
            <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
              {t('description')}
            </Text>
          </span>
        </Space>

        <Button
          type="text"
          icon={open ? <UpOutlined /> : <DownOutlined />}
          aria-expanded={open}
          aria-controls="pet-diagnostics-content"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? t('hide') : t('show')}
        </Button>
      </div>

      {open && (
        <div id="pet-diagnostics-content" style={{ marginTop: 16 }}>
          {children}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run the diagnostics section test and verify GREEN**

Run:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetDiagnosticsSection.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Write the failing page-order regression test**

In `src/components/__tests__/PetConfigPageSync.test.tsx`, update the `next-intl` mock to use real diagnostics copy:

```tsx
jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const messages: Record<string, Record<string, string>> = {
      pet: {
        title: 'Pet console',
        consoleSubtitle:
          'Prepare and validate the Web pet configuration here. Alife .NET applies staged changes only after local confirmation.',
        exportConfig: 'Export Config',
        saveConfig: 'Save Config',
        saveSuccess: 'Config saved',
        saveFailed: 'Save failed',
        exportSuccess: 'Config exported',
        exportFailed: 'Export failed',
        'wizard.title': 'First time? Follow these steps to launch your pet',
        'wizard.step5Desc': 'Approve the staged update in Alife .NET',
        'wizard.step6Desc': 'Your web settings and Alife .NET pet are up to date',
        'runtimeSummary.title': 'Runtime control',
        'runtimeSummary.nextAction.label': 'Next action',
        'preview.webPreview': 'Web Preview',
        'assetPicker.typeModel': 'Model',
        'assetPicker.typeTexture': 'Texture',
        'assetPicker.typeAnimation': 'Animation',
      },
      'pet.diagnostics': {
        title: 'Diagnostics and package simulation',
        description: 'Simulation tools are hidden by default so live Alife .NET status stays first.',
        show: 'Show diagnostics',
        hide: 'Hide diagnostics',
      },
    };

    const t = (key: string) => messages[namespace ?? '']?.[key] ?? key;
    t.rich = (key: string) => key;
    return t;
  },
}));
```

Replace the simulation-visible assertions in `renders desktop sync panel after config loads`:

```tsx
expect(screen.getByText('WebBridge package simulation')).toBeDefined();
expect(screen.getByText('Alife .NET 9')).toBeDefined();
expect(screen.getByText('No live Alife calls')).toBeDefined();
```

with:

```tsx
expect(screen.getByTestId('pet-sync-status-panel')).toBeDefined();
expect(screen.getByText('Diagnostics and package simulation')).toBeDefined();
expect(screen.getByRole('button', { name: 'Show diagnostics' })).toHaveAttribute(
  'aria-expanded',
  'false',
);
expect(screen.queryByText('WebBridge package simulation')).toBeNull();

fireEvent.click(screen.getByRole('button', { name: 'Show diagnostics' }));

expect(screen.getByRole('button', { name: 'Hide diagnostics' })).toHaveAttribute(
  'aria-expanded',
  'true',
);
expect(screen.getByText('WebBridge package simulation')).toBeDefined();
expect(screen.getByText('Alife .NET 9')).toBeDefined();
expect(screen.getByText('No live Alife calls')).toBeDefined();
```

- [ ] **Step 6: Run the page-level test and verify RED**

Run:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetConfigPageSync.test.tsx
```

Expected: FAIL because simulation content is still visible by default and `PetDiagnosticsSection` is not used by the page.

- [ ] **Step 7: Move simulation into the diagnostics section**

In `src/app/(auth)/dashboard/pet/page.tsx`, add the import:

```tsx
import PetDiagnosticsSection from '@/components/pet/sync/PetDiagnosticsSection';
```

Replace the current live/simulation grid:

```tsx
<div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
  <PetSyncStatusPanel
    status={syncStatus}
    loading={syncStatusLoading}
    onRefresh={fetchSyncStatus}
  />
  <WebBridgeMockStatusPanel />
</div>
```

with:

```tsx
<PetSyncStatusPanel
  status={syncStatus}
  loading={syncStatusLoading}
  onRefresh={fetchSyncStatus}
/>

<PetDiagnosticsSection>
  <WebBridgeMockStatusPanel />
</PetDiagnosticsSection>
```

Keep `PetRuntimeSummary` above `PetSyncStatusPanel`. Keep `PetSetupReadiness`, `PetPreviewCard`, and `PetConfigEditor` after diagnostics.

- [ ] **Step 8: Run page and diagnostics tests and verify GREEN**

Run:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetDiagnosticsSection.test.tsx src/components/__tests__/PetConfigPageSync.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit Task 1**

Run:

```powershell
git add "src/components/pet/sync/PetDiagnosticsSection.tsx" "src/components/__tests__/PetDiagnosticsSection.test.tsx" "src/app/(auth)/dashboard/pet/page.tsx" "src/components/__tests__/PetConfigPageSync.test.tsx"
git commit -m "feat: move WebBridge simulation into diagnostics"
```

## Task 2: Runtime Summary As Sync Command Strip

**Files:**

- Modify: `src/components/pet/PetRuntimeSummary.tsx`
- Test: `src/components/__tests__/PetRuntimeSummary.test.tsx`

- [ ] **Step 1: Write failing command-strip tests**

In `src/components/__tests__/PetRuntimeSummary.test.tsx`, add these keys to the `pet` mock:

```tsx
'runtimeSummary.commandTitle': 'WebBridge command strip',
'runtimeSummary.commandDescription': 'Track Web package state against Alife .NET 9.',
```

Add these keys to the `pet.syncStatus` mock:

```tsx
'action.confirmInDesktop': 'Confirm in Alife .NET',
'action.openDesktop': 'Open Alife .NET',
'actionHint.confirmInDesktop':
  'Confirm the staged package inside Alife .NET. Web activation is not available.',
'actionHint.openDesktop': 'Open Alife .NET locally, then check again from Web.',
```

Add these tests inside `describe('PetRuntimeSummary', ...)`:

```tsx
it('renders a sync command strip with an emphasized next action', () => {
  render(<PetRuntimeSummary status={createStatus()} loading={false} onRefresh={jest.fn()} />, {
    wrapper: Wrapper,
  });

  expect(screen.getByTestId('sync-command-strip')).toBeDefined();
  expect(screen.getByText('WebBridge command strip')).toBeDefined();
  expect(screen.getByText('Track Web package state against Alife .NET 9.')).toBeDefined();
  expect(screen.getByTestId('sync-next-action')).toHaveTextContent(
    'Confirm the staged package inside Alife .NET',
  );
});

it('shows a disabled local confirmation action because confirmation happens in Alife .NET', () => {
  render(<PetRuntimeSummary status={createStatus()} loading={false} onRefresh={jest.fn()} />, {
    wrapper: Wrapper,
  });

  expect(screen.getByRole('button', { name: 'Confirm in Alife .NET' })).toBeDisabled();
});

it('shows an Alife .NET open guidance action for openDesktop state', () => {
  render(
    <PetRuntimeSummary
      status={createStatus({
        primaryAction: 'openDesktop',
        summaryKind: 'desktopOffline',
        desktopConnection: 'offline',
      })}
      loading={false}
      onRefresh={jest.fn()}
    />,
    { wrapper: Wrapper },
  );

  expect(screen.getByRole('button', { name: 'Open Alife .NET' })).toBeDisabled();
  expect(screen.getByTestId('sync-next-action')).toHaveTextContent('Open Alife .NET runtime');
});
```

- [ ] **Step 2: Run runtime summary tests and verify RED**

Run:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetRuntimeSummary.test.tsx
```

Expected: FAIL because `sync-command-strip`, command title copy, and disabled `confirmInDesktop`/`openDesktop` action buttons do not exist yet.

- [ ] **Step 3: Update imports in `PetRuntimeSummary.tsx`**

Change imports:

```tsx
import { DesktopOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Space, Tooltip, Typography } from 'antd';
```

- [ ] **Step 4: Replace the summary body with command-strip layout**

In the non-null status render path, replace the current `<Space vertical ...>` block with:

```tsx
<Space vertical size="middle" style={{ width: '100%' }}>
  <div
    data-testid="sync-command-strip"
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
      gap: 16,
      alignItems: 'stretch',
    }}
  >
    <div>
      <Text type="secondary" style={{ display: 'block', fontSize: 'var(--ds-type-metadata-size)' }}>
        {tPet('runtimeSummary.commandTitle')}
      </Text>
      <div style={{ marginTop: 8 }}>
        <StatusChip tone={SUMMARY_TONES[status.summaryKind]}>
          {tSync(`summary.${status.summaryKind}`)}
        </StatusChip>
      </div>
      <div style={{ marginTop: 10, color: 'var(--text-primary)', lineHeight: 1.55 }}>
        {tSync(getRuntimeDetailKey(status.summaryKind))}
      </div>
      <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
        {tPet('runtimeSummary.commandDescription')}
      </Text>
    </div>

    <div
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--ds-panel-radius)',
        background: 'var(--bg-card-hover)',
        padding: 'var(--ds-panel-densePadding)',
      }}
    >
      <Text type="secondary">{tPet('runtimeSummary.nextAction.label')}</Text>
      <div
        data-testid="sync-next-action"
        style={{
          marginTop: 8,
          color: 'var(--text-primary)',
          fontSize: 'var(--ds-type-cardTitle-size)',
          fontWeight: 700,
          lineHeight: 1.35,
        }}
      >
        {tPet(`runtimeSummary.nextAction.${status.primaryAction}`)}
      </div>
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
      value={status.desktopKnownVersion ?? tSync('never')}
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

- [ ] **Step 5: Add command-strip action rendering**

Replace `renderPrimaryAction` in `PetRuntimeSummary.tsx` with:

```tsx
function renderPrimaryAction(
  action: DesktopPrimaryAction,
  loading: boolean,
  onRefresh: () => void,
  t: (key: string) => string,
) {
  if (action === 'checkAgain') {
    return <RefreshAction loading={loading} onRefresh={onRefresh} label={t('action.checkAgain')} />;
  }

  if (action === 'confirmInDesktop') {
    return (
      <Tooltip title={t('actionHint.confirmInDesktop')}>
        <Button type="primary" icon={<DesktopOutlined />} disabled>
          {t('action.confirmInDesktop')}
        </Button>
      </Tooltip>
    );
  }

  if (action === 'openDesktop') {
    return (
      <Tooltip title={t('actionHint.openDesktop')}>
        <Button icon={<DesktopOutlined />} disabled>
          {t('action.openDesktop')}
        </Button>
      </Tooltip>
    );
  }

  return null;
}
```

- [ ] **Step 6: Run runtime summary tests and verify GREEN**

Run:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetRuntimeSummary.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

Run:

```powershell
git add "src/components/pet/PetRuntimeSummary.tsx" "src/components/__tests__/PetRuntimeSummary.test.tsx"
git commit -m "feat: make pet runtime summary sync-first"
```

## Task 3: Live Sync Panel Product-Calm Polish

**Files:**

- Modify: `src/components/pet/sync/PetSyncStatusPanel.tsx`
- Test: `src/components/__tests__/PetSyncStatusPanel.test.tsx`

- [ ] **Step 1: Write failing live-panel hierarchy test**

In `src/components/__tests__/PetSyncStatusPanel.test.tsx`, add this key to the `pet.syncStatus` mock:

```tsx
livePanelDescription: 'Live WebBridge status from Alife .NET 9.',
```

Add this test:

```tsx
it('marks the panel as the live Alife .NET sync source', () => {
  render(<PetSyncStatusPanel status={createStatus()} loading={false} onRefresh={jest.fn()} />, {
    wrapper: Wrapper,
  });

  expect(screen.getByTestId('live-sync-status-panel')).toBeDefined();
  expect(screen.getByText('Live WebBridge status from Alife .NET 9.')).toBeDefined();
  expect(screen.getByText('Live API')).toBeDefined();
  expect(screen.getByText('Raw state')).toBeDefined();
});
```

- [ ] **Step 2: Run sync panel test and verify RED**

Run:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetSyncStatusPanel.test.tsx
```

Expected: FAIL because `live-sync-status-panel` and `livePanelDescription` are not rendered.

- [ ] **Step 3: Add live-panel wrapper and description**

In `PetSyncStatusPanel.tsx`, wrap the non-null panel content by adding `data-testid` to `OperationPanel`:

```tsx
<OperationPanel
  data-testid="live-sync-status-panel"
  title={t('title')}
  extra={renderAction(status.primaryAction, loading, onRefresh, t)}
>
```

Change the first status block to include the live description:

```tsx
<Space vertical size={6} style={{ width: '100%' }}>
  <Space size="small" wrap>
    <StatusChip tone={SUMMARY_TONES[status.summaryKind]}>
      {t(`summary.${status.summaryKind}`)}
    </StatusChip>
    <StatusChip tone="success">{t('source.live')}</StatusChip>
  </Space>
  <Text type="secondary">{t('livePanelDescription')}</Text>
  <Text style={{ color: 'var(--text-primary)', lineHeight: 1.55 }}>
    {t(getRuntimeDetailKey(status.summaryKind))}
  </Text>
</Space>
```

- [ ] **Step 4: Keep lifecycle step content on Ant Design 6 API**

Leave `Steps.items[].content` in place because this project uses Ant Design `6.4.3`, where `content` is the current StepItem field and `description` is deprecated. The lifecycle mapping remains:

```tsx
items={lifecycleSteps.map((step) => ({
  title: t(step.titleKey),
  content: t(step.descriptionKey),
  status: step.state,
}))}
```

- [ ] **Step 5: Run sync panel tests and verify GREEN**

Run:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetSyncStatusPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

Run:

```powershell
git add "src/components/pet/sync/PetSyncStatusPanel.tsx" "src/components/__tests__/PetSyncStatusPanel.test.tsx"
git commit -m "feat: emphasize live Alife sync panel"
```

## Task 4: Locale Copy Coverage For Diagnostics And Command Strip

**Files:**

- Modify: `messages/en.json`
- Modify: `messages/zh-CN.json`
- Modify: `messages/ja.json`
- Modify: `src/components/__tests__/PetSyncLocaleCopy.test.ts`

- [ ] **Step 1: Write failing locale coverage tests**

In `src/components/__tests__/PetSyncLocaleCopy.test.ts`, add these English expectations inside the English test:

```ts
expect(en.pet.diagnostics.title).toBe('Diagnostics and package simulation');
expect(en.pet.diagnostics.description).toBe(
  'Simulation tools are hidden by default so live Alife .NET status stays first.',
);
expect(en.pet.diagnostics.show).toBe('Show diagnostics');
expect(en.pet.diagnostics.hide).toBe('Hide diagnostics');
expect(en.pet.runtimeSummary.commandTitle).toBe('WebBridge command strip');
expect(en.pet.runtimeSummary.commandDescription).toBe(
  'Track Web package state against Alife .NET 9.',
);
expect(en.pet.syncStatus.livePanelDescription).toBe(
  'Live WebBridge status from Alife .NET 9.',
);
expect(en.pet.syncStatus.actionHint.openDesktop).toBe(
  'Open Alife .NET locally, then check again from Web.',
);
```

Add these zh-CN expectations inside the zh-CN test:

```ts
expect(zh.pet.diagnostics.title).toBe('WebBridge 诊断与包模拟');
expect(zh.pet.diagnostics.description).toBe(
  '模拟工具默认收起，让真实 Alife .NET 状态保持优先。',
);
expect(zh.pet.diagnostics.show).toBe('显示诊断');
expect(zh.pet.diagnostics.hide).toBe('收起诊断');
expect(zh.pet.runtimeSummary.commandTitle).toBe('WebBridge 指挥区');
expect(zh.pet.runtimeSummary.commandDescription).toBe(
  '对照 Alife .NET 9 跟踪 Web 包状态。',
);
expect(zh.pet.syncStatus.livePanelDescription).toBe(
  '来自 Alife .NET 9 的实时 WebBridge 状态。',
);
expect(zh.pet.syncStatus.actionHint.openDesktop).toBe(
  '请在本地打开 Alife .NET，然后回到 Web 重新检查。',
);
```

Add these ja expectations inside the Japanese test:

```ts
expect(ja.pet.diagnostics.title).toBe('WebBridge 診断とパッケージシミュレーション');
expect(ja.pet.diagnostics.description).toBe(
  'シミュレーションツールは既定で閉じ、実際の Alife .NET 状態を優先します。',
);
expect(ja.pet.diagnostics.show).toBe('診断を表示');
expect(ja.pet.diagnostics.hide).toBe('診断を閉じる');
expect(ja.pet.runtimeSummary.commandTitle).toBe('WebBridge コマンドストリップ');
expect(ja.pet.runtimeSummary.commandDescription).toBe(
  'Web パッケージ状態を Alife .NET 9 と照合します。',
);
expect(ja.pet.syncStatus.livePanelDescription).toBe(
  'Alife .NET 9 から取得したライブ WebBridge 状態です。',
);
expect(ja.pet.syncStatus.actionHint.openDesktop).toBe(
  'ローカルで Alife .NET を開いてから、Web で再確認してください。',
);
```

- [ ] **Step 2: Run locale copy test and verify RED**

Run:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetSyncLocaleCopy.test.ts
```

Expected: FAIL because the new diagnostics, command-strip, live-panel, and open-desktop hint keys are not in the locale files.

- [ ] **Step 3: Add English locale keys**

In `messages/en.json`, under `pet`, add:

```json
"diagnostics": {
  "title": "Diagnostics and package simulation",
  "description": "Simulation tools are hidden by default so live Alife .NET status stays first.",
  "show": "Show diagnostics",
  "hide": "Hide diagnostics"
}
```

Under `pet.runtimeSummary`, add:

```json
"commandTitle": "WebBridge command strip",
"commandDescription": "Track Web package state against Alife .NET 9."
```

Under `pet.syncStatus`, add:

```json
"livePanelDescription": "Live WebBridge status from Alife .NET 9."
```

Under `pet.syncStatus.actionHint`, add:

```json
"openDesktop": "Open Alife .NET locally, then check again from Web."
```

- [ ] **Step 4: Add Simplified Chinese locale keys**

In `messages/zh-CN.json`, under `pet`, add:

```json
"diagnostics": {
  "title": "WebBridge 诊断与包模拟",
  "description": "模拟工具默认收起，让真实 Alife .NET 状态保持优先。",
  "show": "显示诊断",
  "hide": "收起诊断"
}
```

Under `pet.runtimeSummary`, add:

```json
"commandTitle": "WebBridge 指挥区",
"commandDescription": "对照 Alife .NET 9 跟踪 Web 包状态。"
```

Under `pet.syncStatus`, add:

```json
"livePanelDescription": "来自 Alife .NET 9 的实时 WebBridge 状态。"
```

Under `pet.syncStatus.actionHint`, add:

```json
"openDesktop": "请在本地打开 Alife .NET，然后回到 Web 重新检查。"
```

- [ ] **Step 5: Add Japanese locale keys**

In `messages/ja.json`, under `pet`, add:

```json
"diagnostics": {
  "title": "WebBridge 診断とパッケージシミュレーション",
  "description": "シミュレーションツールは既定で閉じ、実際の Alife .NET 状態を優先します。",
  "show": "診断を表示",
  "hide": "診断を閉じる"
}
```

Under `pet.runtimeSummary`, add:

```json
"commandTitle": "WebBridge コマンドストリップ",
"commandDescription": "Web パッケージ状態を Alife .NET 9 と照合します。"
```

Under `pet.syncStatus`, add:

```json
"livePanelDescription": "Alife .NET 9 から取得したライブ WebBridge 状態です。"
```

Under `pet.syncStatus.actionHint`, add:

```json
"openDesktop": "ローカルで Alife .NET を開いてから、Web で再確認してください。"
```

- [ ] **Step 6: Run locale and focused component tests and verify GREEN**

Run:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetSyncLocaleCopy.test.ts src/components/__tests__/PetRuntimeSummary.test.tsx src/components/__tests__/PetSyncStatusPanel.test.tsx src/components/__tests__/PetConfigPageSync.test.tsx src/components/__tests__/PetDiagnosticsSection.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

Run:

```powershell
git add "messages/en.json" "messages/zh-CN.json" "messages/ja.json" "src/components/__tests__/PetSyncLocaleCopy.test.ts"
git commit -m "feat: localize pet sync diagnostics copy"
```

## Task 5: Regression, Typecheck, Build, And Smoke

**Files:**

- No planned source edits unless verification exposes a failure caused by this UI/UX slice.

- [ ] **Step 1: Run focused UI Jest**

Run:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetRuntimeSummary.test.tsx src/components/__tests__/PetSyncStatusPanel.test.tsx src/components/__tests__/WebBridgeMockStatusPanel.test.tsx src/components/__tests__/PetConfigPageSync.test.tsx src/components/__tests__/PetDiagnosticsSection.test.tsx src/components/__tests__/syncStatusPresentation.test.ts src/components/__tests__/PetSyncLocaleCopy.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run existing WebBridge regression tests**

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

- [ ] **Step 4: Run production build with local verification env**

Run:

```powershell
$env:JWT_SECRET='local-build-only-pet-console-sync-first-uiux-secret'; $env:DATABASE_PATH='database/data.db'; npm run build
```

Expected: exit 0.

- [ ] **Step 5: Check Alife cleanliness before smoke**

Run:

```powershell
git -C D:\Alife status --short --branch
```

Expected: `## master...alife-byastralfox/master` with no modified files. If the status shows active changes, do not run smoke; report that smoke was skipped to avoid interfering with Alife.

- [ ] **Step 6: Run WebBridge staged-to-applied smoke when Alife is clean**

Run:

```powershell
$env:DOTNET_EXE='C:\Users\hu shu\.dotnet\dotnet.exe'; $env:ALIFE_ROOT='D:\Alife'; npm run check:webbridge:smoke
```

Expected: PASS with both states observed:

```text
WebStatus: staged/localConfirmationRequired/confirmInDesktop
WebStatus: applied/upToDate/none/requiresLocalConfirmation=false
```

- [ ] **Step 7: Inspect final diff and status**

Run:

```powershell
git diff --check
git status --short --branch
git log --oneline -8
```

Expected:

- `git diff --check` has no whitespace errors.
- Only intended frontend, locale, and test files changed since the last task commit.
- No Alife, Unity, database schema, or submodule files changed.

- [ ] **Step 8: Commit verification fixes only when files changed**

If Step 1-7 required direct fixes, commit them:

```powershell
git add "src/app/(auth)/dashboard/pet/page.tsx" "src/components/pet" "src/components/__tests__" "messages/en.json" "messages/zh-CN.json" "messages/ja.json"
git commit -m "fix: stabilize pet sync-first console UI"
```

If Step 1-7 did not change files, do not create a commit.

## Completion Criteria

This implementation is complete only when:

- `/dashboard/pet` shows live sync status before diagnostics, preview, and config editing.
- `WebBridgeMockStatusPanel` is hidden behind a default-collapsed diagnostics section.
- `PetRuntimeSummary` reads as a sync command strip with an emphasized next action.
- `PetSyncStatusPanel` clearly identifies itself as live Alife .NET 9 WebBridge status.
- All new user-facing copy exists in English, Simplified Chinese, and Japanese locale files.
- Focused UI Jest, WebBridge regression Jest, typecheck, build, and feasible staged-to-applied smoke verification pass with fresh evidence.
- `D:\Alife`, `D:\FOXD\alife-service`, Prisma schema/migrations, Unity-related paths, and WebBridge protocol handlers remain untouched.
