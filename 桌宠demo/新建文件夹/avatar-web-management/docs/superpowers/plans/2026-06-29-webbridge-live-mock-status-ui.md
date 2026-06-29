# WebBridge Live/Mock Status UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the pet dashboard WebBridge status area clearly distinguish live `/api/pet/sync/status` evidence from mock package-install simulation.

**Architecture:** Keep `PetConfigPage` data flow unchanged. Enhance `PetSyncStatusPanel` as the live status detail panel and `WebBridgeMockStatusPanel` as the mock-only simulation panel, using existing Ant Design and local UI primitives.

**Tech Stack:** Next.js 16, React 19, TypeScript, Ant Design 6, Jest, Testing Library, next-intl message files.

---

## Files

- Modify: `src/components/__tests__/PetSyncStatusPanel.test.tsx`
- Modify: `src/components/pet/sync/PetSyncStatusPanel.tsx`
- Modify: `src/components/__tests__/WebBridgeMockStatusPanel.test.tsx`
- Modify: `src/components/pet/sync/WebBridgeMockStatusPanel.tsx`
- Modify if needed: `src/components/__tests__/PetConfigPageSync.test.tsx`

## Task 1: Live Status Panel Test

- [ ] **Step 1: Add failing assertions for live source, package state, known version, milestones, and local-only confirm action**

In `src/components/__tests__/PetSyncStatusPanel.test.tsx`, extend the translation mock and the `localConfirmationRequired` test:

```tsx
'source.live': 'Live API',
packageState: 'Package state',
desktopKnownVersion: 'Desktop known version',
milestones: 'Reported milestones',
none: 'None',
```

Then update `createStatus()` milestones:

```tsx
milestones: [
  'manifestFetched',
  'filesDownloaded',
  'hashValidated',
  'packageStaged',
  'confirmationRequested',
],
```

Then extend the assertion:

```tsx
expect(screen.getByText('Live API')).toBeDefined();
expect(screen.getByText('staged')).toBeDefined();
expect(screen.getByText('7')).toBeDefined();
expect(screen.getByText('manifestFetched')).toBeDefined();
expect(screen.getByText('confirmationRequested')).toBeDefined();
expect(screen.getByRole('button', { name: /confirm in desktop/i })).toBeDisabled();
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm test -- src/components/__tests__/PetSyncStatusPanel.test.tsx --runInBand
```

Expected: fail because the panel does not yet render live source, package state, known version, milestone tags, or a disabled confirm action.

## Task 2: Live Status Panel Implementation

- [ ] **Step 1: Implement the minimal live panel UI**

In `src/components/pet/sync/PetSyncStatusPanel.tsx`:

- Import `Tooltip` and `Tag` from `antd`.
- Import `DesktopOutlined`.
- Add a live source `StatusChip`.
- Add `packageState`, `desktopKnownVersion`, and `milestones` rows.
- Render `confirmInDesktop` as a disabled primary button with desktop icon and tooltip.

Expected implementation shape:

```tsx
<Space size="small" wrap>
  <StatusChip tone={SUMMARY_TONES[status.summaryKind]}>
    {t(`summary.${status.summaryKind}`)}
  </StatusChip>
  <StatusChip tone="success">{t('source.live')}</StatusChip>
</Space>
```

```tsx
<Descriptions.Item label={t('packageState')}>
  <Text code>{status.packageState}</Text>
</Descriptions.Item>
<Descriptions.Item label={t('desktopKnownVersion')}>
  {status.desktopKnownVersion ?? t('notApplied')}
</Descriptions.Item>
<Descriptions.Item label={t('milestones')}>
  <Space size={[6, 6]} wrap>
    {status.milestones.length > 0
      ? status.milestones.map((milestone) => <Tag key={milestone}>{milestone}</Tag>)
      : <Text type="secondary">{t('none')}</Text>}
  </Space>
</Descriptions.Item>
```

```tsx
return (
  <Tooltip title={t('actionHint.confirmInDesktop')}>
    <Button type="primary" icon={<DesktopOutlined />} disabled>
      {t('action.confirmInDesktop')}
    </Button>
  </Tooltip>
);
```

- [ ] **Step 2: Add message keys**

Update `messages/en.json`, `messages/zh-CN.json`, and `messages/ja.json` under `pet.syncStatus`:

```json
"packageState": "Package state",
"desktopKnownVersion": "Desktop known version",
"milestones": "Reported milestones",
"none": "None",
"source": {
  "live": "Live API"
},
"actionHint": {
  "confirmInDesktop": "Confirm the staged package inside Alife. Web activation is not available yet."
}
```

Use equivalent Chinese and Japanese translations.

- [ ] **Step 3: Run the focused test and verify GREEN**

Run:

```powershell
npm test -- src/components/__tests__/PetSyncStatusPanel.test.tsx --runInBand
```

Expected: pass.

## Task 3: Mock Panel Test And Implementation

- [ ] **Step 1: Add failing mock-panel assertions**

In `src/components/__tests__/WebBridgeMockStatusPanel.test.tsx`, update expectations:

```tsx
expect(screen.getByText('Mock simulation')).toBeDefined();
expect(screen.getByText('D:\\FOXD\\.worktrees\\_alife-webbridge-integration')).toBeDefined();
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm test -- src/components/__tests__/WebBridgeMockStatusPanel.test.tsx --runInBand
```

Expected: fail because the mock panel still says `Mock` and uses the old `D:\tmp\alife-webbridge-integration` root.

- [ ] **Step 3: Implement mock-panel wording and root update**

In `src/components/pet/sync/WebBridgeMockStatusPanel.tsx`:

```tsx
const PACKAGE_ROOT = 'D:\\FOXD\\.worktrees\\_alife-webbridge-integration';
```

Change the title tag:

```tsx
<Tag color="default">Mock simulation</Tag>
```

Keep the isolation tile:

```tsx
<MetricTile label="Isolation" value={<Tag color="default">No live Alife calls</Tag>} />
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
npm test -- src/components/__tests__/WebBridgeMockStatusPanel.test.tsx --runInBand
```

Expected: pass.

## Task 4: Page Integration Test

- [ ] **Step 1: Run the existing page sync test**

Run:

```powershell
npm test -- src/components/__tests__/PetConfigPageSync.test.tsx --runInBand
```

Expected: it may fail only because expected mock wording changed from `Mock` to `Mock simulation`.

- [ ] **Step 2: If needed, update the assertion**

Replace:

```tsx
expect(screen.getByText('No live Alife calls')).toBeDefined();
```

with both assertions:

```tsx
expect(screen.getByText('Mock simulation')).toBeDefined();
expect(screen.getByText('No live Alife calls')).toBeDefined();
```

- [ ] **Step 3: Re-run the page sync test**

Run:

```powershell
npm test -- src/components/__tests__/PetConfigPageSync.test.tsx --runInBand
```

Expected: pass with the same API call count as before.

## Task 5: Verification And Commit

- [ ] **Step 1: Run focused component tests**

Run:

```powershell
npm test -- src/components/__tests__/PetSyncStatusPanel.test.tsx src/components/__tests__/WebBridgeMockStatusPanel.test.tsx src/components/__tests__/PetConfigPageSync.test.tsx --runInBand
```

Expected: all tests pass.

- [ ] **Step 2: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: TypeScript exits with code 0.

- [ ] **Step 3: Run build if dependencies and local generated state are available**

Run:

```powershell
npm run build
```

Expected: build exits with code 0. If local DB or generated Prisma state blocks build, capture the exact error and do not claim build success.

- [ ] **Step 4: Check diff and commit**

Run:

```powershell
git diff --check
git status --short
git add "桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PetSyncStatusPanel.test.tsx" "桌宠demo/新建文件夹/avatar-web-management/src/components/pet/sync/PetSyncStatusPanel.tsx" "桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/WebBridgeMockStatusPanel.test.tsx" "桌宠demo/新建文件夹/avatar-web-management/src/components/pet/sync/WebBridgeMockStatusPanel.tsx" "桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PetConfigPageSync.test.tsx" "桌宠demo/新建文件夹/avatar-web-management/messages/en.json" "桌宠demo/新建文件夹/avatar-web-management/messages/zh-CN.json" "桌宠demo/新建文件夹/avatar-web-management/messages/ja.json"
git commit -m "feat: distinguish WebBridge live and mock status"
```

Expected: commit succeeds with only scoped UI/test/message changes.
