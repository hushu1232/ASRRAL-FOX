# Pet Dashboard UI Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize the `/dashboard/pet` console and sync diagnostics to follow `docs/ui-component-text-style-spec-2026-07-03.md` without changing WebBridge protocol behavior.

**Architecture:** Keep the page sync-first and read-only for desktop runtime actions. Add one small shared `EvidenceGrid` primitive for repeated metric layouts, then adopt it in pet runtime, sync status, local health, live diagnostics, and mock diagnostics panels. Localize the WebBridge mock diagnostics copy so Batch A does not leave hard-coded user-facing English in the pet console.

**Tech Stack:** Next.js 16, React 19, TypeScript, Ant Design, next-intl, Jest, Testing Library, PowerShell, Git.

---

## Scope Boundary

This plan implements Phase 3 Batch A from the roadmap:

- `/dashboard/pet`
- Pet runtime summary
- Pet sync status panel
- Pet diagnostics panel
- WebBridge mock diagnostics panel visual hierarchy
- Advisory Alife local health panel placement and read-only evidence presentation

Out of scope:

- Route handlers under `src/app/api`
- Prisma schema or migrations
- WebBridge protocol behavior
- Alife source under `D:\Alife`
- The FOXD `alife-service` gitlink
- Global design token changes
- Browser UI that executes shell, PowerShell, local process, or desktop management actions

## File Structure

Create:

- `桌宠demo/新建文件夹/avatar-web-management/src/components/ui/EvidenceGrid.tsx`
  - Shared stable grid for scan-first evidence blocks.
- `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/EvidenceGrid.test.tsx`
  - Unit coverage for grid tracks, custom min width, gap, class name, and merged style.

Modify:

- `桌宠demo/新建文件夹/avatar-web-management/src/components/pet/PetRuntimeSummary.tsx`
  - Replace duplicated inline metric grid layout with `EvidenceGrid`.
- `桌宠demo/新建文件夹/avatar-web-management/src/components/pet/sync/PetSyncStatusPanel.tsx`
  - Replace duplicated inline evidence grid layout with `EvidenceGrid`.
- `桌宠demo/新建文件夹/avatar-web-management/src/components/pet/sync/AlifeLocalHealthPanel.tsx`
  - Replace duplicated advisory metric grid layout with `EvidenceGrid`.
- `桌宠demo/新建文件夹/avatar-web-management/src/components/pet/sync/PetSyncDiagnosticsPanel.tsx`
  - Replace duplicated live diagnostic snapshot grid with `EvidenceGrid`.
- `桌宠demo/新建文件夹/avatar-web-management/src/components/pet/sync/WebBridgeMockStatusPanel.tsx`
  - Replace duplicated mock evidence grid with `EvidenceGrid`.
  - Move visible labels and descriptions to `next-intl`.
  - Keep raw package states and paths as exact evidence.
- `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PetConsoleResponsive.test.ts`
  - Add source-level guardrails that Batch A panels use the shared evidence grid and keep diagnostics non-executable.
- `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/AlifeLocalHealthPanel.test.tsx`
  - Assert advisory health evidence uses the shared grid test id.
- `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PetSyncDiagnosticsPanel.test.tsx`
  - Assert live diagnostics evidence uses the shared grid test id.
- `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/WebBridgeMockStatusPanel.test.tsx`
  - Mock `next-intl`, keep interaction coverage, and assert no runtime network calls.
- `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PetConfigPageSync.test.tsx`
  - Strengthen page-order coverage so Alife local health remains advisory between runtime summary and detailed desktop sync.
- `桌宠demo/新建文件夹/avatar-web-management/messages/en.json`
- `桌宠demo/新建文件夹/avatar-web-management/messages/zh-CN.json`
- `桌宠demo/新建文件夹/avatar-web-management/messages/ja.json`
  - Add `pet.webbridgeMock` strings for the mock diagnostics panel.

Do not modify:

- `桌宠demo/新建文件夹/avatar-web-management/src/app/api/**`
- `桌宠demo/新建文件夹/avatar-web-management/prisma/**`
- `D:\Alife`
- `D:\FOXD\alife-service`

## Task 1: Add Shared EvidenceGrid Primitive

**Files:**

- Create: `桌宠demo/新建文件夹/avatar-web-management/src/components/ui/EvidenceGrid.tsx`
- Create: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/EvidenceGrid.test.tsx`

- [ ] **Step 1: Write the failing EvidenceGrid test**

Create `src/components/__tests__/EvidenceGrid.test.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import EvidenceGrid from '@/components/ui/EvidenceGrid';

describe('EvidenceGrid', () => {
  it('renders stable auto-fit evidence tracks with the default panel min width', () => {
    render(
      <EvidenceGrid data-testid="evidence-grid">
        <div>Web version</div>
        <div>Desktop version</div>
      </EvidenceGrid>,
    );

    const grid = screen.getByTestId('evidence-grid');
    expect(grid).toHaveStyle({
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'repeat(auto-fit, minmax(var(--ds-panel-gridMinWidth), 1fr))',
    });
    expect(grid.textContent).toContain('Web version');
    expect(grid.textContent).toContain('Desktop version');
  });

  it('allows a custom min width, gap, class name, and merged style', () => {
    render(
      <EvidenceGrid
        data-testid="custom-evidence-grid"
        minWidth="180px"
        gap={16}
        className="scan-grid"
        style={{ marginTop: 12 }}
      >
        <div>Connection</div>
      </EvidenceGrid>,
    );

    const grid = screen.getByTestId('custom-evidence-grid');
    expect(grid).toHaveClass('scan-grid');
    expect(grid).toHaveStyle({
      gap: '16px',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      marginTop: '12px',
    });
  });
});
```

- [ ] **Step 2: Run the new test and verify it fails**

Run from `桌宠demo\新建文件夹\avatar-web-management`:

```powershell
npx jest src/components/__tests__/EvidenceGrid.test.tsx --runInBand
```

Expected: FAIL because `@/components/ui/EvidenceGrid` does not exist.

- [ ] **Step 3: Implement EvidenceGrid**

Create `src/components/ui/EvidenceGrid.tsx`:

```tsx
import type { CSSProperties, ReactNode } from 'react';

export interface EvidenceGridProps {
  children: ReactNode;
  minWidth?: string;
  gap?: number;
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
}

export default function EvidenceGrid({
  children,
  minWidth = 'var(--ds-panel-gridMinWidth)',
  gap = 12,
  className,
  style,
  'data-testid': dataTestId,
}: EvidenceGridProps) {
  return (
    <div
      className={className}
      data-testid={dataTestId}
      style={{
        display: 'grid',
        gap,
        gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}, 1fr))`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Run the EvidenceGrid test and verify it passes**

Run:

```powershell
npx jest src/components/__tests__/EvidenceGrid.test.tsx --runInBand
```

Expected: PASS, 1 suite and 2 tests.

- [ ] **Step 5: Commit Task 1**

Run from `D:\FOXD`:

```powershell
git add "桌宠demo/新建文件夹/avatar-web-management/src/components/ui/EvidenceGrid.tsx" "桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/EvidenceGrid.test.tsx"
git commit -m "style: add shared evidence grid"
```

Expected: commit created with only the new component and its test.

## Task 2: Use EvidenceGrid In Primary Runtime And Sync Panels

**Files:**

- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PetConsoleResponsive.test.ts`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/components/pet/PetRuntimeSummary.tsx`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/components/pet/sync/PetSyncStatusPanel.tsx`

- [ ] **Step 1: Write the failing source guardrail**

Append this test to `src/components/__tests__/PetConsoleResponsive.test.ts`:

```ts
  it('uses the shared EvidenceGrid for primary runtime and sync evidence', () => {
    const runtimeSummary = readSource('src/components/pet/PetRuntimeSummary.tsx');
    const syncStatusPanel = readSource('src/components/pet/sync/PetSyncStatusPanel.tsx');

    for (const source of [runtimeSummary, syncStatusPanel]) {
      expect(source).toContain("import EvidenceGrid from '@/components/ui/EvidenceGrid'");
      expect(source).not.toContain(
        "gridTemplateColumns: 'repeat(auto-fit, minmax(var(--ds-panel-gridMinWidth), 1fr))'",
      );
    }
  });
```

- [ ] **Step 2: Run the guardrail and verify it fails**

Run from `桌宠demo\新建文件夹\avatar-web-management`:

```powershell
npx jest src/components/__tests__/PetConsoleResponsive.test.ts --runInBand
```

Expected: FAIL because `PetRuntimeSummary.tsx` and `PetSyncStatusPanel.tsx` still use inline grid styles.

- [ ] **Step 3: Replace the PetRuntimeSummary inline grids**

In `src/components/pet/PetRuntimeSummary.tsx`, add the import:

```tsx
import EvidenceGrid from '@/components/ui/EvidenceGrid';
```

Replace the command strip wrapper:

```tsx
<EvidenceGrid data-testid="sync-command-strip">
  <div>
    <Text
      type="secondary"
      style={{
        display: 'block',
        fontSize: 'var(--ds-type-metadata-size)',
        lineHeight: 1.4,
      }}
    >
      {tPet('runtimeSummary.commandTitle')}
    </Text>
    <div style={{ marginTop: 8 }}>
      <StatusChip tone={SUMMARY_TONES[status.summaryKind]}>
        {tSync(`summary.${status.summaryKind}`)}
      </StatusChip>
    </div>
    <div style={{ marginTop: 8, color: 'var(--text-primary)', lineHeight: 1.55 }}>
      {tSync(getRuntimeDetailKey(status.summaryKind))}
    </div>
    <Text type="secondary" style={{ display: 'block', marginTop: 8, lineHeight: 1.5 }}>
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
    <Text
      type="secondary"
      style={{
        display: 'block',
        fontSize: 'var(--ds-type-metadata-size)',
        lineHeight: 1.4,
      }}
    >
      {tPet('runtimeSummary.nextAction.label')}
    </Text>
    <div
      data-testid="sync-next-action"
      style={{
        marginTop: 6,
        color: 'var(--text-primary)',
        fontSize: 'var(--ds-type-cardTitle-size)',
        fontWeight: 700,
        lineHeight: 1.35,
      }}
    >
      {tPet(`runtimeSummary.nextAction.${status.primaryAction}`)}
    </div>
  </div>
</EvidenceGrid>
```

Replace the metrics wrapper:

```tsx
<EvidenceGrid data-testid="sync-runtime-metrics-grid">
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
</EvidenceGrid>
```

- [ ] **Step 4: Replace the PetSyncStatusPanel inline grid**

In `src/components/pet/sync/PetSyncStatusPanel.tsx`, add the import:

```tsx
import EvidenceGrid from '@/components/ui/EvidenceGrid';
```

Replace the `live-sync-evidence-grid` wrapper:

```tsx
<EvidenceGrid data-testid="live-sync-evidence-grid">
  <MetricTile label={t('webVersion')} value={status.webConfigVersion} />
  <MetricTile
    label={t('desktopKnownVersion')}
    value={status.desktopKnownVersion ?? t('notApplied')}
  />
  <MetricTile
    label={t('desktopAppliedVersion')}
    value={status.desktopAppliedVersion ?? t('notApplied')}
  />
  <MetricTile
    label={t('localConfirmation')}
    value={status.requiresLocalConfirmation ? t('required') : t('notRequired')}
  />
</EvidenceGrid>
```

- [ ] **Step 5: Run targeted tests**

Run:

```powershell
npx jest src/components/__tests__/PetConsoleResponsive.test.ts src/components/__tests__/PetRuntimeSummary.test.tsx src/components/__tests__/PetSyncStatusPanel.test.tsx --runInBand
```

Expected: PASS. The existing component tests still find `sync-command-strip`, `sync-runtime-metrics-grid`, and `live-sync-evidence-grid`.

- [ ] **Step 6: Commit Task 2**

Run from `D:\FOXD`:

```powershell
git add "桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PetConsoleResponsive.test.ts" "桌宠demo/新建文件夹/avatar-web-management/src/components/pet/PetRuntimeSummary.tsx" "桌宠demo/新建文件夹/avatar-web-management/src/components/pet/sync/PetSyncStatusPanel.tsx"
git commit -m "style: normalize primary pet sync evidence grids"
```

Expected: commit contains only Task 2 files.

## Task 3: Use EvidenceGrid In Advisory And Diagnostic Panels

**Files:**

- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PetConsoleResponsive.test.ts`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/AlifeLocalHealthPanel.test.tsx`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PetSyncDiagnosticsPanel.test.tsx`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/components/pet/sync/AlifeLocalHealthPanel.tsx`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/components/pet/sync/PetSyncDiagnosticsPanel.tsx`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/components/pet/sync/WebBridgeMockStatusPanel.tsx`

- [ ] **Step 1: Write failing guardrails for advisory and diagnostic grids**

Append this test to `src/components/__tests__/PetConsoleResponsive.test.ts`:

```ts
  it('uses the shared EvidenceGrid for advisory and diagnostic evidence', () => {
    const alifeHealth = readSource('src/components/pet/sync/AlifeLocalHealthPanel.tsx');
    const liveDiagnostics = readSource('src/components/pet/sync/PetSyncDiagnosticsPanel.tsx');
    const mockDiagnostics = readSource('src/components/pet/sync/WebBridgeMockStatusPanel.tsx');

    for (const source of [alifeHealth, liveDiagnostics, mockDiagnostics]) {
      expect(source).toContain("import EvidenceGrid from '@/components/ui/EvidenceGrid'");
      expect(source).not.toContain(
        "gridTemplateColumns: 'repeat(auto-fit, minmax(var(--ds-panel-gridMinWidth), 1fr))'",
      );
    }
  });
```

In `src/components/__tests__/AlifeLocalHealthPanel.test.tsx`, add this assertion inside the reachable-health test after checking `Outbox`:

```tsx
    expect(screen.getByTestId('alife-local-health-evidence-grid')).toBeDefined();
```

In `src/components/__tests__/PetSyncDiagnosticsPanel.test.tsx`, add this assertion inside the integration snapshot test:

```tsx
    expect(screen.getByTestId('pet-sync-diagnostics-evidence-grid')).toBeDefined();
```

- [ ] **Step 2: Run targeted tests and verify they fail**

Run:

```powershell
npx jest src/components/__tests__/PetConsoleResponsive.test.ts src/components/__tests__/AlifeLocalHealthPanel.test.tsx src/components/__tests__/PetSyncDiagnosticsPanel.test.tsx --runInBand
```

Expected: FAIL because advisory and diagnostic panels still use inline grids and the new test ids are missing.

- [ ] **Step 3: Replace the AlifeLocalHealthPanel evidence grid**

In `src/components/pet/sync/AlifeLocalHealthPanel.tsx`, add:

```tsx
import EvidenceGrid from '@/components/ui/EvidenceGrid';
```

Replace the metric grid `div` with:

```tsx
<EvidenceGrid data-testid="alife-local-health-evidence-grid">
  <MetricTile label={t('agent')} value={formatText(health.runtime?.agent, t)} />
  <MetricTile label={t('version')} value={formatText(health.health?.version, t)} />
  <MetricTile label={t('qchat')} value={formatEnabled(health.runtime?.qchatEnabled, t)} />
  <MetricTile label={t('outbox')} value={formatEnabled(health.runtime?.outboxEnabled, t)} />
</EvidenceGrid>
```

- [ ] **Step 4: Replace the PetSyncDiagnosticsPanel snapshot grid**

In `src/components/pet/sync/PetSyncDiagnosticsPanel.tsx`, add:

```tsx
import EvidenceGrid from '@/components/ui/EvidenceGrid';
```

Replace the snapshot grid `div` with:

```tsx
<EvidenceGrid data-testid="pet-sync-diagnostics-evidence-grid" style={{ marginTop: 12 }}>
  <MetricTile label={t('webVersion')} value={status.webConfigVersion} />
  <MetricTile
    label={t('desktopKnownVersion')}
    value={formatVersion(status.desktopKnownVersion, t)}
  />
  <MetricTile
    label={t('desktopAppliedVersion')}
    value={formatVersion(status.desktopAppliedVersion, t)}
  />
  <MetricTile
    label={t('packageState')}
    value={
      <StatusChip tone={PACKAGE_STATE_TONES[status.packageState]}>
        {tStatus(getPackageStateLabelKey(status.packageState))}
      </StatusChip>
    }
  />
  <MetricTile
    label={t('desktopConnection')}
    value={
      <StatusChip tone={CONNECTION_TONES[status.desktopConnection]}>
        {tStatus(`connectionState.${status.desktopConnection}`)}
      </StatusChip>
    }
  />
  <MetricTile
    label={t('localConfirmation')}
    value={
      <StatusChip tone={status.requiresLocalConfirmation ? 'warning' : 'success'}>
        {status.requiresLocalConfirmation ? t('required') : t('notRequired')}
      </StatusChip>
    }
  />
</EvidenceGrid>
```

- [ ] **Step 5: Replace the WebBridgeMockStatusPanel evidence grid**

In `src/components/pet/sync/WebBridgeMockStatusPanel.tsx`, add:

```tsx
import EvidenceGrid from '@/components/ui/EvidenceGrid';
```

Replace the `webbridge-mock-evidence-grid` wrapper with:

```tsx
<EvidenceGrid data-testid="webbridge-mock-evidence-grid">
  <MetricTile label="Runtime" value="Alife .NET 9" />
  <MetricTile label="Package state" value={<Tag color={scenario.tagColor}>{scenario.packageState}</Tag>} />
  <MetricTile label="Next action" value={scenario.nextAction} />
  <MetricTile label="Isolation" value={<Tag color="default">No live Alife calls</Tag>} />
</EvidenceGrid>
```

This step only moves the grid wrapper. Task 4 localizes the visible strings.

- [ ] **Step 6: Run targeted tests**

Run:

```powershell
npx jest src/components/__tests__/PetConsoleResponsive.test.ts src/components/__tests__/AlifeLocalHealthPanel.test.tsx src/components/__tests__/PetSyncDiagnosticsPanel.test.tsx src/components/__tests__/WebBridgeMockStatusPanel.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

Run from `D:\FOXD`:

```powershell
git add "桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PetConsoleResponsive.test.ts" "桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/AlifeLocalHealthPanel.test.tsx" "桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PetSyncDiagnosticsPanel.test.tsx" "桌宠demo/新建文件夹/avatar-web-management/src/components/pet/sync/AlifeLocalHealthPanel.tsx" "桌宠demo/新建文件夹/avatar-web-management/src/components/pet/sync/PetSyncDiagnosticsPanel.tsx" "桌宠demo/新建文件夹/avatar-web-management/src/components/pet/sync/WebBridgeMockStatusPanel.tsx"
git commit -m "style: normalize pet diagnostic evidence grids"
```

Expected: commit contains only Task 3 files.

## Task 4: Localize And Tighten WebBridge Mock Diagnostics

**Files:**

- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/WebBridgeMockStatusPanel.test.tsx`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PetConsoleResponsive.test.ts`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/components/pet/sync/WebBridgeMockStatusPanel.tsx`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/messages/en.json`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/messages/zh-CN.json`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/messages/ja.json`

- [ ] **Step 1: Update the WebBridgeMockStatusPanel test to require next-intl**

Add this mock near the top of `src/components/__tests__/WebBridgeMockStatusPanel.test.tsx`:

```tsx
const messages: Record<string, string> = {
  title: 'WebBridge package simulation',
  simulationOnly: 'Simulation only',
  scenarioLabel: 'Simulation scenario',
  runtime: 'Runtime',
  packageState: 'Package state',
  nextAction: 'Next action',
  isolation: 'Isolation',
  noLiveCalls: 'No live Alife calls',
  packageRoot: 'Package root',
  manifest: 'Manifest',
  file: 'File',
  scenarioDetail: 'Scenario detail',
  failureStates: 'Failure states',
  activationGuard: 'Activation guard',
  autoApplyGuard: 'autoApply=false, requiresLocalConfirmation=true',
  readOnlyNotice: 'This panel is a read-only simulation and does not call local Alife.',
  'scenario.pendingActivation.label': 'Ready package',
  'scenario.pendingActivation.nextAction': 'Confirm inside Alife .NET before apply',
  'scenario.pendingActivation.detail':
    'Package passed preflight, manifest, and SHA-256 checks. Alife .NET holds activation for local confirmation.',
  'scenario.unauthorized.label': 'Auth failure',
  'scenario.unauthorized.nextAction': 'Refresh package bearer token before download',
  'scenario.unauthorized.detail':
    'The manifest can be reached, but a package file request is rejected by authorization.',
  'scenario.hashMismatch.label': 'Hash mismatch',
  'scenario.hashMismatch.nextAction': 'Reject package and re-download bundle',
  'scenario.hashMismatch.detail':
    'The downloaded file digest does not match the signed package manifest.',
  'scenario.securityBlocked.label': 'Security block',
  'scenario.securityBlocked.nextAction': 'Keep activation disabled until path validation passes',
  'scenario.securityBlocked.detail':
    'A path traversal or unsafe package file target is blocked before activation.',
  'check.preflight.label': 'Preflight',
  'check.preflight.detail': 'WebBridge readiness',
  'check.manifest.label': 'Package manifest',
  'check.manifest.detail': 'current-pet-character-bundle',
  'check.hash.label': 'SHA-256 validation',
  'check.hash.detail': 'character-card',
  'check.pending.label': 'Pending local confirmation',
  'check.pending.detail': 'Alife .NET apply guard',
  'state.ready': 'Ready',
  'state.waiting': 'Waiting',
  'state.failed': 'Failed',
  'state.blocked': 'Blocked',
};

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    if (namespace !== 'pet.webbridgeMock') {
      return (key: string) => key;
    }

    return (key: string) => messages[key] ?? key;
  },
}));
```

The existing assertions can continue to use English test text because the mock returns English strings.

- [ ] **Step 2: Add a source guardrail for localized mock diagnostics**

Append this test to `src/components/__tests__/PetConsoleResponsive.test.ts`:

```ts
  it('keeps WebBridge mock diagnostics localized and non-executable', () => {
    const source = readSource('src/components/pet/sync/WebBridgeMockStatusPanel.tsx');

    expect(source).toContain("useTranslations('pet.webbridgeMock')");
    expect(source).not.toContain("'WebBridge package simulation'");
    expect(source).not.toContain("'Simulation only'");
    expect(source).not.toContain("'No live Alife calls'");

    for (const term of ['child_process', 'exec(', 'spawn(', 'PowerShell', 'Start Alife', 'Stop Alife', 'Restart Alife']) {
      expect(source).not.toContain(term);
    }
  });
```

- [ ] **Step 3: Run targeted tests and verify they fail**

Run:

```powershell
npx jest src/components/__tests__/WebBridgeMockStatusPanel.test.tsx src/components/__tests__/PetConsoleResponsive.test.ts --runInBand
```

Expected: FAIL because `WebBridgeMockStatusPanel.tsx` does not call `useTranslations('pet.webbridgeMock')` and still contains hard-coded visible English labels.

- [ ] **Step 4: Refactor WebBridgeMockStatusPanel to use translation keys**

In `src/components/pet/sync/WebBridgeMockStatusPanel.tsx`, add:

```tsx
import { useTranslations } from 'next-intl';
```

Update the check and scenario metadata to store keys:

```tsx
const mockChecks = [
  { key: 'preflight', icon: <CloudServerOutlined /> },
  { key: 'manifest', icon: <ApiOutlined /> },
  { key: 'hash', icon: <SafetyCertificateOutlined /> },
  { key: 'pending', icon: <ClockCircleOutlined /> },
];

const mockScenarios: Record<
  MockScenarioKey,
  {
    packageState: string;
    tagColor: string;
    activeStep: number;
    alertType: 'success' | 'warning' | 'error';
    checks: Record<string, CheckState>;
  }
> = {
  pendingActivation: {
    packageState: 'pendingActivation',
    tagColor: 'orange',
    activeStep: 3,
    alertType: 'success',
    checks: { preflight: 'ready', manifest: 'ready', hash: 'ready', pending: 'waiting' },
  },
  unauthorized: {
    packageState: '401 package file',
    tagColor: 'red',
    activeStep: 1,
    alertType: 'error',
    checks: { preflight: 'ready', manifest: 'failed', hash: 'blocked', pending: 'blocked' },
  },
  hashMismatch: {
    packageState: 'PACKAGE_HASH_MISMATCH',
    tagColor: 'red',
    activeStep: 2,
    alertType: 'error',
    checks: { preflight: 'ready', manifest: 'ready', hash: 'failed', pending: 'blocked' },
  },
  securityBlocked: {
    packageState: 'PACKAGE_SECURITY_BLOCKED',
    tagColor: 'red',
    activeStep: 0,
    alertType: 'error',
    checks: { preflight: 'failed', manifest: 'blocked', hash: 'blocked', pending: 'blocked' },
  },
};
```

Inside `WebBridgeMockStatusPanel`, initialize translations and derived values:

```tsx
const t = useTranslations('pet.webbridgeMock');
const scenario = mockScenarios[scenarioKey];
const scenarioOptions = useMemo(
  () =>
    Object.keys(mockScenarios).map((value) => ({
      label: t(`scenario.${value}.label`),
      value,
    })),
  [t],
);
const nextAction = t(`scenario.${scenarioKey}.nextAction`);
```

Use translated labels in the JSX:

```tsx
<OperationPanel
  data-testid="webbridge-mock-simulation-panel"
  title={
    <Space size="small" wrap>
      <ApiOutlined />
      <span>{t('title')}</span>
      <StatusChip tone="neutral">{t('simulationOnly')}</StatusChip>
    </Space>
  }
>
  <Space vertical size="large" style={{ width: '100%' }}>
    <Alert type="info" showIcon title={t('readOnlyNotice')} />

    <div>
      <Text strong>{t('scenarioLabel')}</Text>
      <div style={{ marginTop: 8, maxWidth: '100%', overflowX: 'auto', paddingBottom: 2 }}>
        <Segmented
          options={scenarioOptions}
          value={scenarioKey}
          onChange={(value) => setScenarioKey(value as MockScenarioKey)}
          style={{ minWidth: 'max-content' }}
        />
      </div>
    </div>

    <EvidenceGrid data-testid="webbridge-mock-evidence-grid">
      <MetricTile label={t('runtime')} value="Alife .NET 9" />
      <MetricTile label={t('packageState')} value={<Tag color={scenario.tagColor}>{scenario.packageState}</Tag>} />
      <MetricTile label={t('nextAction')} value={nextAction} />
      <MetricTile label={t('isolation')} value={<StatusChip tone="neutral">{t('noLiveCalls')}</StatusChip>} />
    </EvidenceGrid>

    <Steps
      size="small"
      current={scenario.activeStep}
      items={mockChecks.map((check) => ({
        title: t(`check.${check.key}.label`),
        status: toStepStatus(scenario.checks[check.key]),
        content: (
          <Space vertical size={2}>
            <Text type="secondary">{t(`check.${check.key}.detail`)}</Text>
            <Tag color={checkStateColors[scenario.checks[check.key]]}>
              {t(`state.${scenario.checks[check.key]}`)}
            </Tag>
          </Space>
        ),
        icon: check.icon,
      }))}
    />
```

Use translated descriptions below:

```tsx
<Descriptions column={1} size="small">
  <Descriptions.Item label={t('packageRoot')}>
    <Text code>{PACKAGE_ROOT}</Text>
  </Descriptions.Item>
  <Descriptions.Item label={t('manifest')}>current-pet-character-bundle</Descriptions.Item>
  <Descriptions.Item label={t('file')}>characters/current-pet/card.json</Descriptions.Item>
  <Descriptions.Item label={t('scenarioDetail')}>
    {t(`scenario.${scenarioKey}.detail`)}
  </Descriptions.Item>
</Descriptions>

<Alert
  type="warning"
  showIcon
  icon={<ExclamationCircleOutlined />}
  title={t('failureStates')}
  description={
    <Space size={[8, 8]} wrap>
      {failureReasons.map((reason) => (
        <Tag key={reason} color="red">
          {reason}
        </Tag>
      ))}
    </Space>
  }
/>

<Alert
  type={scenario.alertType}
  showIcon
  icon={<CheckCircleOutlined />}
  title={t('activationGuard')}
  description={
    <Space vertical size={4}>
      <Text>{nextAction}</Text>
      <Text code>{t('autoApplyGuard')}</Text>
    </Space>
  }
/>
```

- [ ] **Step 5: Add locale keys**

Add this object under `pet` in `messages/en.json`:

```json
"webbridgeMock": {
  "title": "WebBridge package simulation",
  "simulationOnly": "Simulation only",
  "scenarioLabel": "Simulation scenario",
  "runtime": "Runtime",
  "packageState": "Package state",
  "nextAction": "Next action",
  "isolation": "Isolation",
  "noLiveCalls": "No live Alife calls",
  "packageRoot": "Package root",
  "manifest": "Manifest",
  "file": "File",
  "scenarioDetail": "Scenario detail",
  "failureStates": "Failure states",
  "activationGuard": "Activation guard",
  "autoApplyGuard": "autoApply=false, requiresLocalConfirmation=true",
  "readOnlyNotice": "This panel is a read-only simulation and does not call local Alife.",
  "scenario": {
    "pendingActivation": {
      "label": "Ready package",
      "nextAction": "Confirm inside Alife .NET before apply",
      "detail": "Package passed preflight, manifest, and SHA-256 checks. Alife .NET holds activation for local confirmation."
    },
    "unauthorized": {
      "label": "Auth failure",
      "nextAction": "Refresh package bearer token before download",
      "detail": "The manifest can be reached, but a package file request is rejected by authorization."
    },
    "hashMismatch": {
      "label": "Hash mismatch",
      "nextAction": "Reject package and re-download bundle",
      "detail": "The downloaded file digest does not match the signed package manifest."
    },
    "securityBlocked": {
      "label": "Security block",
      "nextAction": "Keep activation disabled until path validation passes",
      "detail": "A path traversal or unsafe package file target is blocked before activation."
    }
  },
  "check": {
    "preflight": { "label": "Preflight", "detail": "WebBridge readiness" },
    "manifest": { "label": "Package manifest", "detail": "current-pet-character-bundle" },
    "hash": { "label": "SHA-256 validation", "detail": "character-card" },
    "pending": { "label": "Pending local confirmation", "detail": "Alife .NET apply guard" }
  },
  "state": {
    "ready": "Ready",
    "waiting": "Waiting",
    "failed": "Failed",
    "blocked": "Blocked"
  }
}
```

Add equivalent keys in `messages/zh-CN.json`:

```json
"webbridgeMock": {
  "title": "WebBridge 包模拟",
  "simulationOnly": "仅模拟",
  "scenarioLabel": "模拟场景",
  "runtime": "运行时",
  "packageState": "包状态",
  "nextAction": "下一步",
  "isolation": "隔离边界",
  "noLiveCalls": "不调用实时 Alife",
  "packageRoot": "包根目录",
  "manifest": "清单",
  "file": "文件",
  "scenarioDetail": "场景详情",
  "failureStates": "失败状态",
  "activationGuard": "激活防护",
  "autoApplyGuard": "autoApply=false, requiresLocalConfirmation=true",
  "readOnlyNotice": "此面板是只读模拟，不会调用本地 Alife。",
  "scenario": {
    "pendingActivation": {
      "label": "包已就绪",
      "nextAction": "在 Alife .NET 内确认后再应用",
      "detail": "包已通过预检、清单和 SHA-256 校验。Alife .NET 会等待本地确认后再激活。"
    },
    "unauthorized": {
      "label": "鉴权失败",
      "nextAction": "刷新包下载令牌后重新下载",
      "detail": "清单可访问，但包文件请求被鉴权拒绝。"
    },
    "hashMismatch": {
      "label": "哈希不匹配",
      "nextAction": "拒绝该包并重新下载",
      "detail": "下载文件摘要与签名清单不一致。"
    },
    "securityBlocked": {
      "label": "安全阻止",
      "nextAction": "路径校验通过前保持激活禁用",
      "detail": "路径穿越或不安全包文件目标会在激活前被阻止。"
    }
  },
  "check": {
    "preflight": { "label": "预检", "detail": "WebBridge 就绪状态" },
    "manifest": { "label": "包清单", "detail": "current-pet-character-bundle" },
    "hash": { "label": "SHA-256 校验", "detail": "character-card" },
    "pending": { "label": "等待本地确认", "detail": "Alife .NET 应用防护" }
  },
  "state": {
    "ready": "就绪",
    "waiting": "等待",
    "failed": "失败",
    "blocked": "阻止"
  }
}
```

Add equivalent keys in `messages/ja.json`:

```json
"webbridgeMock": {
  "title": "WebBridge パッケージシミュレーション",
  "simulationOnly": "シミュレーションのみ",
  "scenarioLabel": "シミュレーションシナリオ",
  "runtime": "ランタイム",
  "packageState": "パッケージ状態",
  "nextAction": "次の操作",
  "isolation": "分離境界",
  "noLiveCalls": "ライブ Alife 呼び出しなし",
  "packageRoot": "パッケージルート",
  "manifest": "マニフェスト",
  "file": "ファイル",
  "scenarioDetail": "シナリオ詳細",
  "failureStates": "失敗状態",
  "activationGuard": "有効化ガード",
  "autoApplyGuard": "autoApply=false, requiresLocalConfirmation=true",
  "readOnlyNotice": "このパネルは読み取り専用のシミュレーションで、ローカル Alife を呼び出しません。",
  "scenario": {
    "pendingActivation": {
      "label": "準備済みパッケージ",
      "nextAction": "Alife .NET 内で確認してから適用",
      "detail": "パッケージはプリフライト、マニフェスト、SHA-256 検証を通過しました。Alife .NET はローカル確認まで有効化を保留します。"
    },
    "unauthorized": {
      "label": "認証失敗",
      "nextAction": "パッケージの Bearer トークンを更新してから再ダウンロード",
      "detail": "マニフェストには到達できますが、パッケージファイル要求が認可で拒否されています。"
    },
    "hashMismatch": {
      "label": "ハッシュ不一致",
      "nextAction": "パッケージを拒否して再ダウンロード",
      "detail": "ダウンロードしたファイルのダイジェストが署名済みマニフェストと一致しません。"
    },
    "securityBlocked": {
      "label": "セキュリティブロック",
      "nextAction": "パス検証が通るまで有効化を無効のままにする",
      "detail": "パストラバーサルまたは安全でないパッケージファイルの対象は有効化前にブロックされます。"
    }
  },
  "check": {
    "preflight": { "label": "プリフライト", "detail": "WebBridge 準備状態" },
    "manifest": { "label": "パッケージマニフェスト", "detail": "current-pet-character-bundle" },
    "hash": { "label": "SHA-256 検証", "detail": "character-card" },
    "pending": { "label": "ローカル確認待ち", "detail": "Alife .NET 適用ガード" }
  },
  "state": {
    "ready": "準備完了",
    "waiting": "待機中",
    "failed": "失敗",
    "blocked": "ブロック"
  }
}
```

- [ ] **Step 6: Add locale guardrails for webbridgeMock**

Append this test to `src/components/__tests__/AlifeLocalHealthGuardrails.test.ts`:

```ts
  it('defines WebBridge mock diagnostics locale keys for every supported locale', () => {
    const localePaths = ['messages/en.json', 'messages/zh-CN.json', 'messages/ja.json'];
    const requiredTopLevelKeys = [
      'title',
      'simulationOnly',
      'scenarioLabel',
      'runtime',
      'packageState',
      'nextAction',
      'isolation',
      'noLiveCalls',
      'packageRoot',
      'manifest',
      'file',
      'scenarioDetail',
      'failureStates',
      'activationGuard',
      'autoApplyGuard',
      'readOnlyNotice',
    ];
    const scenarioKeys = ['pendingActivation', 'unauthorized', 'hashMismatch', 'securityBlocked'];
    const checkKeys = ['preflight', 'manifest', 'hash', 'pending'];
    const stateKeys = ['ready', 'waiting', 'failed', 'blocked'];

    for (const localePath of localePaths) {
      const locale = readJson(localePath) as {
        pet?: {
          webbridgeMock?: {
            scenario?: Record<string, Record<string, unknown>>;
            check?: Record<string, Record<string, unknown>>;
            state?: Record<string, unknown>;
          } & Record<string, unknown>;
        };
      };
      const webbridgeMock = locale.pet?.webbridgeMock;

      expect(webbridgeMock).toEqual(expect.any(Object));
      for (const key of requiredTopLevelKeys) {
        expectNonEmptyString(webbridgeMock?.[key]);
      }
      for (const key of scenarioKeys) {
        expectNonEmptyString(webbridgeMock?.scenario?.[key]?.label);
        expectNonEmptyString(webbridgeMock?.scenario?.[key]?.nextAction);
        expectNonEmptyString(webbridgeMock?.scenario?.[key]?.detail);
      }
      for (const key of checkKeys) {
        expectNonEmptyString(webbridgeMock?.check?.[key]?.label);
        expectNonEmptyString(webbridgeMock?.check?.[key]?.detail);
      }
      for (const key of stateKeys) {
        expectNonEmptyString(webbridgeMock?.state?.[key]);
      }
    }
  });
```

- [ ] **Step 7: Run targeted tests**

Run:

```powershell
npx jest src/components/__tests__/WebBridgeMockStatusPanel.test.tsx src/components/__tests__/PetConsoleResponsive.test.ts src/components/__tests__/AlifeLocalHealthGuardrails.test.ts --runInBand
```

Expected: PASS. WebBridge mock interactions still switch scenarios, `global.fetch` is not called, and every locale has required keys.

- [ ] **Step 8: Commit Task 4**

Run from `D:\FOXD`:

```powershell
git add "桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/WebBridgeMockStatusPanel.test.tsx" "桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PetConsoleResponsive.test.ts" "桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/AlifeLocalHealthGuardrails.test.ts" "桌宠demo/新建文件夹/avatar-web-management/src/components/pet/sync/WebBridgeMockStatusPanel.tsx" "桌宠demo/新建文件夹/avatar-web-management/messages/en.json" "桌宠demo/新建文件夹/avatar-web-management/messages/zh-CN.json" "桌宠demo/新建文件夹/avatar-web-management/messages/ja.json"
git commit -m "style: localize pet WebBridge mock diagnostics"
```

Expected: commit contains only Task 4 files.

## Task 5: Strengthen Pet Page Ordering And Final Verification

**Files:**

- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PetConfigPageSync.test.tsx`

- [ ] **Step 1: Write the ordering guardrail**

In `src/components/__tests__/PetConfigPageSync.test.tsx`, inside `renders desktop sync panel after config loads`, add these assertions after `const syncStatusPanel = screen.getByTestId('pet-sync-status-panel');`:

```tsx
    const alifeLocalHealthPanel = screen.getByTestId('alife-local-health-panel');
    expect(
      runtimeSummaryTitle.compareDocumentPosition(alifeLocalHealthPanel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      alifeLocalHealthPanel.compareDocumentPosition(syncStatusPanel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
```

- [ ] **Step 2: Run the page test**

Run:

```powershell
npx jest src/components/__tests__/PetConfigPageSync.test.tsx --runInBand
```

Expected: PASS if the current page already follows the spec order. If it fails, move `AlifeLocalHealthPanel` so it renders after `PetRuntimeSummary` and before `PetSyncStatusPanel`, then rerun the same command.

- [ ] **Step 3: Run the Batch A targeted test set**

Run:

```powershell
npx jest src/components/__tests__/EvidenceGrid.test.tsx src/components/__tests__/PetConsoleResponsive.test.ts src/components/__tests__/PetRuntimeSummary.test.tsx src/components/__tests__/AlifeLocalHealthPanel.test.tsx src/components/__tests__/PetSyncStatusPanel.test.tsx src/components/__tests__/PetSyncDiagnosticsPanel.test.tsx src/components/__tests__/WebBridgeMockStatusPanel.test.tsx src/components/__tests__/PetConfigPageSync.test.tsx src/components/__tests__/AlifeLocalHealthGuardrails.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 4: Run boundary scans**

Run from `桌宠demo\新建文件夹\avatar-web-management`:

```powershell
rg -n "child_process|exec\(|spawn\(|PowerShell|Start Alife|Stop Alife|Restart Alife|autoApply=true" 'src/app/(auth)/dashboard/pet/page.tsx' 'src/components/pet' 'src/components/ui/EvidenceGrid.tsx'
```

Expected: no matches.

Run:

```powershell
git diff --name-only
```

Expected changed paths are limited to Batch A UI components, component tests, and message JSON files listed in this plan.

- [ ] **Step 5: Run full verification**

Run from `桌宠demo\新建文件夹\avatar-web-management`:

```powershell
npm run test -- --runInBand
npm run typecheck
npm run build
```

Expected:

- Jest passes with zero failing suites.
- TypeScript exits 0.
- Next build exits 0.
- Existing non-blocking console noise may remain: React `act(...)` warnings, jsdom canvas/WebGL messages, Prisma build logs, and the npm `--runInBand` warning.

- [ ] **Step 6: Commit Task 5**

Run from `D:\FOXD`:

```powershell
git add "桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PetConfigPageSync.test.tsx"
git commit -m "test: lock pet dashboard sync-first order"
```

Expected: commit created only if `PetConfigPageSync.test.tsx` changed. If Step 1 was already present because another task added it, skip this commit and record that there were no Task 5 file changes.

## Final Review Checklist

After all tasks:

- [ ] `git status --short --branch` shows no unexpected modified tracked files.
- [ ] The untracked roadmap `docs/superpowers/plans/2026-07-03-foxd-next-roadmap.md` remains uncommitted unless the user explicitly asks otherwise.
- [ ] No `src/app/api/**` files changed.
- [ ] No `prisma/**` files changed.
- [ ] No `D:\Alife` files changed.
- [ ] No `alife-service` gitlink changed.
- [ ] `EvidenceGrid` is used for repeated pet evidence grids.
- [ ] `/dashboard/pet` remains sync-first.
- [ ] Diagnostics remain collapsed by default.
- [ ] Alife local health remains advisory and read-only.
- [ ] WebBridge mock diagnostics remain simulation-only and do not call local runtime APIs.
- [ ] Locale keys exist for English, Chinese, and Japanese.
- [ ] Full verification commands passed.
