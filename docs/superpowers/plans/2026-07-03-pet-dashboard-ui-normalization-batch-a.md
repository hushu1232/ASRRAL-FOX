# Pet Dashboard UI Normalization Batch A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize `/dashboard/pet` runtime, sync, diagnostics, and mock diagnostics visual hierarchy against `docs/ui-component-text-style-spec-2026-07-03.md`.

**Architecture:** Keep this as a focused UI-only batch. Preserve WebBridge protocol behavior, API route handlers, Prisma schema, and Alife source. Improve existing React components in place using the local primitives already present: `PageHeader`, `OperationPanel`, `MetricTile`, and `StatusChip`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Jest, Testing Library, Ant Design 6, PowerShell verification commands.

---

## File Structure

Work from the Web app root:

```powershell
cd "D:\FOXD\桌宠demo\新建文件夹\avatar-web-management"
```

Read first:

- `D:\FOXD\docs\ui-component-text-style-spec-2026-07-03.md`
- `D:\FOXD\docs\project-status-2026-07-03.md`
- `D:\FOXD\docs\2026-07-03-alife-webbridge-protocol-status.md`

Modify:

- `src/components/pet/PetRuntimeSummary.tsx`
- `src/components/pet/sync/PetSyncStatusPanel.tsx`
- `src/components/pet/sync/PetDiagnosticsSection.tsx`
- `src/components/pet/sync/PetSyncDiagnosticsPanel.tsx`
- `src/components/pet/sync/WebBridgeMockStatusPanel.tsx`

Test:

- `src/components/__tests__/PetRuntimeSummary.test.tsx`
- `src/components/__tests__/PetSyncStatusPanel.test.tsx`
- `src/components/__tests__/PetDiagnosticsSection.test.tsx`
- `src/components/__tests__/PetSyncDiagnosticsPanel.test.tsx`
- `src/components/__tests__/WebBridgeMockStatusPanel.test.tsx`
- `src/components/__tests__/PetConsoleResponsive.test.ts`

Do not modify:

- `src/app/api/**`
- `prisma/**`
- `D:\Alife`
- `D:\FOXD\alife-service`
- global design tokens in `src/app/globals.css`

## Task 1: Runtime Summary Grid Guardrail

**Files:**

- Modify: `src/components/__tests__/PetRuntimeSummary.test.tsx`
- Modify: `src/components/pet/PetRuntimeSummary.tsx`

- [ ] **Step 1: Write the failing test**

Add this assertion to `renders a sync command strip with an emphasized next action`:

```tsx
const commandStrip = screen.getByTestId('sync-command-strip');
expect(commandStrip).toHaveStyle({
  gridTemplateColumns: 'repeat(auto-fit, minmax(var(--ds-panel-gridMinWidth), 1fr))',
});
expect(screen.getByTestId('sync-runtime-metrics-grid')).toBeDefined();
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
npm run test:unit -- --runInBand src/components/__tests__/PetRuntimeSummary.test.tsx
```

Expected:

```text
FAIL PetRuntimeSummary.test.tsx
Unable to find an element by: [data-testid="sync-runtime-metrics-grid"]
```

- [ ] **Step 3: Implement the minimal runtime summary change**

In `PetRuntimeSummary.tsx`, change the command-strip grid to the shared panel grid min-width and add a test id to the metric grid:

```tsx
gridTemplateColumns: 'repeat(auto-fit, minmax(var(--ds-panel-gridMinWidth), 1fr))',
```

```tsx
<div
  data-testid="sync-runtime-metrics-grid"
  style={{
    display: 'grid',
    gap: 12,
    gridTemplateColumns: 'repeat(auto-fit, minmax(var(--ds-panel-gridMinWidth), 1fr))',
  }}
>
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```powershell
npm run test:unit -- --runInBand src/components/__tests__/PetRuntimeSummary.test.tsx
```

Expected:

```text
PASS src/components/__tests__/PetRuntimeSummary.test.tsx
```

## Task 2: Live Sync Status Evidence Grid

**Files:**

- Modify: `src/components/__tests__/PetSyncStatusPanel.test.tsx`
- Modify: `src/components/pet/sync/PetSyncStatusPanel.tsx`

- [ ] **Step 1: Write the failing test**

Add this test to `PetSyncStatusPanel.test.tsx`:

```tsx
it('shows a scan-first evidence grid before detailed desktop sync rows', () => {
  render(<PetSyncStatusPanel status={createStatus()} loading={false} onRefresh={jest.fn()} />, {
    wrapper: Wrapper,
  });

  const grid = screen.getByTestId('live-sync-evidence-grid');
  expect(grid).toBeDefined();
  expect(grid.textContent).toContain('Web version');
  expect(grid.textContent).toContain('Desktop known version');
  expect(grid.textContent).toContain('Desktop applied version');
  expect(grid.textContent).toContain('Local confirmation');
  expect(grid.compareDocumentPosition(screen.getByText('Connection')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
npm run test:unit -- --runInBand src/components/__tests__/PetSyncStatusPanel.test.tsx
```

Expected:

```text
FAIL PetSyncStatusPanel.test.tsx
Unable to find an element by: [data-testid="live-sync-evidence-grid"]
```

- [ ] **Step 3: Implement the evidence grid**

In `PetSyncStatusPanel.tsx`, import `MetricTile`:

```tsx
import MetricTile from '@/components/ui/MetricTile';
```

Add a scan-first grid after the summary copy and before `Steps`:

```tsx
<div
  data-testid="live-sync-evidence-grid"
  style={{
    display: 'grid',
    gap: 12,
    gridTemplateColumns: 'repeat(auto-fit, minmax(var(--ds-panel-gridMinWidth), 1fr))',
  }}
>
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
</div>
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```powershell
npm run test:unit -- --runInBand src/components/__tests__/PetSyncStatusPanel.test.tsx
```

Expected:

```text
PASS src/components/__tests__/PetSyncStatusPanel.test.tsx
```

## Task 3: Diagnostics Section Not A Nested Card

**Files:**

- Modify: `src/components/__tests__/PetDiagnosticsSection.test.tsx`
- Modify: `src/components/pet/sync/PetDiagnosticsSection.tsx`
- Modify: `src/components/__tests__/PetConsoleResponsive.test.ts`

- [ ] **Step 1: Write the failing behavior test**

Add this assertion after `const section = screen.getByTestId('pet-diagnostics-section');`:

```tsx
expect(section).not.toHaveStyle({
  background: 'var(--bg-card)',
  border: '1px solid var(--border-subtle)',
});
expect(screen.getByTestId('pet-diagnostics-toggle-surface')).toBeDefined();
```

- [ ] **Step 2: Add the source guardrail**

Add this test to `PetConsoleResponsive.test.ts`:

```ts
it('keeps diagnostics children out of a card-like wrapper', () => {
  const source = readSource('src/components/pet/sync/PetDiagnosticsSection.tsx');

  expect(source).toContain('pet-diagnostics-toggle-surface');
  expect(source).not.toContain("background: 'var(--bg-card)',\n        border: '1px solid var(--border-subtle)',\n        borderRadius: 'var(--ds-panel-radius)'");
});
```

- [ ] **Step 3: Run the focused tests and verify they fail**

Run:

```powershell
npm run test:unit -- --runInBand src/components/__tests__/PetDiagnosticsSection.test.tsx src/components/__tests__/PetConsoleResponsive.test.ts
```

Expected:

```text
FAIL PetDiagnosticsSection.test.tsx
Unable to find an element by: [data-testid="pet-diagnostics-toggle-surface"]
```

- [ ] **Step 4: Implement the unframed diagnostics section**

In `PetDiagnosticsSection.tsx`, remove the card-like style from the outer `section`. Add a separate toggle surface:

```tsx
<section aria-label={t('title')} data-testid="pet-diagnostics-section">
  <div
    data-testid="pet-diagnostics-toggle-surface"
    style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--ds-panel-radius)',
      padding: 'var(--ds-panel-densePadding)',
    }}
  >
    ...
  </div>
  <div id={contentId} hidden={!open} style={{ marginTop: open ? 12 : 0 }}>
    {open ? children : null}
  </div>
</section>
```

- [ ] **Step 5: Run the focused tests and verify they pass**

Run:

```powershell
npm run test:unit -- --runInBand src/components/__tests__/PetDiagnosticsSection.test.tsx src/components/__tests__/PetConsoleResponsive.test.ts
```

Expected:

```text
PASS src/components/__tests__/PetDiagnosticsSection.test.tsx
PASS src/components/__tests__/PetConsoleResponsive.test.ts
```

## Task 4: Live Diagnostics Heading Hierarchy

**Files:**

- Modify: `src/components/__tests__/PetSyncDiagnosticsPanel.test.tsx`
- Modify: `src/components/pet/sync/PetSyncDiagnosticsPanel.tsx`

- [ ] **Step 1: Write the failing heading test**

Add this assertion to `shows pending-pull diagnostic evidence and read-only smoke mapping`:

```tsx
expect(screen.getByRole('heading', { name: 'Integration snapshot' })).toBeDefined();
expect(screen.getByRole('heading', { name: 'Evidence trail' })).toBeDefined();
expect(screen.getByRole('heading', { name: 'Smoke mapping' })).toBeDefined();
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
npm run test:unit -- --runInBand src/components/__tests__/PetSyncDiagnosticsPanel.test.tsx
```

Expected:

```text
FAIL PetSyncDiagnosticsPanel.test.tsx
Unable to find an accessible element with the role "heading" and name "Integration snapshot"
```

- [ ] **Step 3: Implement semantic section titles**

In `PetSyncDiagnosticsPanel.tsx`, update `SectionTitle`:

```tsx
function SectionTitle({ children }: { children: string }) {
  return (
    <Typography.Title
      level={3}
      style={{
        color: 'var(--text-primary)',
        fontSize: 'var(--ds-type-cardTitle-size)',
        lineHeight: 1.35,
        margin: 0,
      }}
    >
      {children}
    </Typography.Title>
  );
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```powershell
npm run test:unit -- --runInBand src/components/__tests__/PetSyncDiagnosticsPanel.test.tsx
```

Expected:

```text
PASS src/components/__tests__/PetSyncDiagnosticsPanel.test.tsx
```

## Task 5: Mock Diagnostics Simulation Hierarchy

**Files:**

- Modify: `src/components/__tests__/WebBridgeMockStatusPanel.test.tsx`
- Modify: `src/components/pet/sync/WebBridgeMockStatusPanel.tsx`

- [ ] **Step 1: Write the failing test**

Add this assertion to `shows the isolated Alife .NET 9 package install mock flow`:

```tsx
expect(screen.getByTestId('webbridge-mock-simulation-panel')).toBeDefined();
expect(screen.getByTestId('webbridge-mock-evidence-grid')).toBeDefined();
expect(screen.getByTestId('webbridge-mock-simulation-panel').textContent).toContain('Simulation only');
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
npm run test:unit -- --runInBand src/components/__tests__/WebBridgeMockStatusPanel.test.tsx
```

Expected:

```text
FAIL WebBridgeMockStatusPanel.test.tsx
Unable to find an element by: [data-testid="webbridge-mock-simulation-panel"]
```

- [ ] **Step 3: Implement mock hierarchy test ids and shared chips**

In `WebBridgeMockStatusPanel.tsx`, import `StatusChip`:

```tsx
import StatusChip from '@/components/ui/StatusChip';
```

Add the panel test id:

```tsx
<OperationPanel data-testid="webbridge-mock-simulation-panel" title={...}>
```

Replace the "Simulation only" title tag with:

```tsx
<StatusChip tone="neutral">Simulation only</StatusChip>
```

Add the evidence grid test id:

```tsx
<div
  data-testid="webbridge-mock-evidence-grid"
  style={{
    display: 'grid',
    gap: 12,
    gridTemplateColumns: 'repeat(auto-fit, minmax(var(--ds-panel-gridMinWidth), 1fr))',
  }}
>
```

Keep failure reason `Tag` elements because they intentionally show raw failure evidence.

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```powershell
npm run test:unit -- --runInBand src/components/__tests__/WebBridgeMockStatusPanel.test.tsx
```

Expected:

```text
PASS src/components/__tests__/WebBridgeMockStatusPanel.test.tsx
```

## Task 6: Batch Verification And Commit

**Files:**

- Verify all files from Tasks 1-5.

- [ ] **Step 1: Run focused pet UI tests**

Run:

```powershell
npm run test:unit -- --runInBand src/components/__tests__/PetRuntimeSummary.test.tsx src/components/__tests__/PetSyncStatusPanel.test.tsx src/components/__tests__/PetDiagnosticsSection.test.tsx src/components/__tests__/PetSyncDiagnosticsPanel.test.tsx src/components/__tests__/WebBridgeMockStatusPanel.test.tsx src/components/__tests__/PetConsoleResponsive.test.ts src/components/__tests__/PetConfigPageSync.test.tsx
```

Expected:

```text
PASS for all listed suites
```

- [ ] **Step 2: Run full unit regression**

Run:

```powershell
npm run test -- --runInBand
```

Expected:

```text
Test Suites: 93 passed, 93 total
Tests: 903+ passed
```

- [ ] **Step 3: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected:

```text
exit code 0
```

- [ ] **Step 4: Run build**

Run:

```powershell
npm run build
```

Expected:

```text
✓ Compiled successfully
```

- [ ] **Step 5: Confirm source-only UI scope**

Run from `D:\FOXD`:

```powershell
git diff --name-only HEAD
```

Expected: only the Batch A plan plus pet dashboard UI component/test files are changed. No `src/app/api`, `prisma`, `alife-service`, or `D:\Alife` changes.

- [ ] **Step 6: Commit Batch A**

Run from `D:\FOXD`:

```powershell
git add docs/superpowers/plans/2026-07-03-pet-dashboard-ui-normalization-batch-a.md "桌宠demo/新建文件夹/avatar-web-management/src/components/pet/PetRuntimeSummary.tsx" "桌宠demo/新建文件夹/avatar-web-management/src/components/pet/sync/PetSyncStatusPanel.tsx" "桌宠demo/新建文件夹/avatar-web-management/src/components/pet/sync/PetDiagnosticsSection.tsx" "桌宠demo/新建文件夹/avatar-web-management/src/components/pet/sync/PetSyncDiagnosticsPanel.tsx" "桌宠demo/新建文件夹/avatar-web-management/src/components/pet/sync/WebBridgeMockStatusPanel.tsx" "桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PetRuntimeSummary.test.tsx" "桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PetSyncStatusPanel.test.tsx" "桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PetDiagnosticsSection.test.tsx" "桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PetSyncDiagnosticsPanel.test.tsx" "桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/WebBridgeMockStatusPanel.test.tsx" "桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PetConsoleResponsive.test.ts"
git commit -m "style: normalize pet dashboard UI"
```

Expected: one verified UI batch commit.

## Self-Review Checklist

Spec coverage:

- Runtime command strip uses the shared panel grid minimum.
- Live sync status has a scan-first evidence grid.
- Diagnostics children are no longer wrapped inside a card-like parent surface.
- Live diagnostics section titles are semantic compact headings.
- Mock diagnostics clearly remains simulation-only and uses shared status presentation where appropriate.
- `/dashboard/pet` remains sync-first and diagnostics remain collapsed by default.
- No browser UI executes local commands.
- No protocol, Prisma, Alife, route handler, or global token files are changed.

Marker scan:

- This plan contains no intentionally unfinished implementation markers.

Type consistency:

- New `data-testid` values match test assertions and component implementation.
- `MetricTile`, `OperationPanel`, and `StatusChip` imports match existing file patterns.
