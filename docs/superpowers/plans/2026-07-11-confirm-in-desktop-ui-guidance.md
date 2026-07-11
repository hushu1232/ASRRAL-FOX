# Confirm-In-Desktop UI Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve `/dashboard/pet` confirm-in-desktop guidance with a secondary recheck action, a 3-step callout, optional local-health one-liner, and diagnostics catalog copy for three WebBridge evidence commands — without adding browser apply/confirm or loopback control.

**Architecture:** Keep protocol boundary intact. Extend presentational pet sync components and i18n only. Pass existing page-level `alifeLocalHealth` into the sync status panel as a derived guidance key. Diagnostics remain read-only text.

**Tech Stack:** Next.js client components, Ant Design, next-intl, Jest + Testing Library.

**Design:** `docs/superpowers/specs/2026-07-11-confirm-in-desktop-ui-guidance-design.md`

---

## Scope Check

- In: Batch A (confirm-state actions + callout + health sentence) and Batch B (diagnostics evidence catalog).
- Out: polling, applied-success banner, broad copy rename, any apply API, frontend loopback/shell.

## File Structure

- Modify `桌宠demo/新建文件夹/avatar-web-management/src/components/pet/PetRuntimeSummary.tsx`
- Modify `桌宠demo/新建文件夹/avatar-web-management/src/components/pet/sync/PetSyncStatusPanel.tsx`
- Modify `桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/dashboard/pet/page.tsx`
- Modify `桌宠demo/新建文件夹/avatar-web-management/src/components/pet/sync/PetSyncDiagnosticsPanel.tsx`
- Modify `桌宠demo/新建文件夹/avatar-web-management/messages/en.json`
- Modify `桌宠demo/新建文件夹/avatar-web-management/messages/zh-CN.json`
- Modify `桌宠demo/新建文件夹/avatar-web-management/messages/ja.json`
- Create/Modify unit tests under `src/components/__tests__` or existing pet sync tests
- Optional helper: `src/components/pet/sync/confirmInDesktopGuidance.ts` if mapping logic deserves isolation

---

### Task 1: i18n Keys For Confirm Callout And Health Guidance

**Files:**
- Modify: `messages/en.json`, `messages/zh-CN.json`, `messages/ja.json`
- Create or modify: unit test that asserts required keys exist for all locales

- [ ] **Step 1: Write failing locale key test**

Add a focused test (new file or existing locale guardrail style) asserting these keys exist and are non-empty in en / zh-CN / ja under `pet.syncStatus`:

```ts
const requiredKeys = [
  'confirmSteps.title',
  'confirmSteps.step1',
  'confirmSteps.step2',
  'confirmSteps.step3',
  'healthGuidance.reachable',
  'healthGuidance.unreachable',
  'healthGuidance.authRequired',
  'healthGuidance.invalidResponse',
  'healthGuidance.error',
  'healthGuidance.notConfigured',
  'action.checkAgain', // already exists; keep assert
];
```

- [ ] **Step 2: Run test and verify failure**

```powershell
npm run test -- --runInBand tests/unit/<locale-test-file>.test.ts
```

Expected: FAIL missing keys.

- [ ] **Step 3: Add locale strings**

Suggested zh-CN:

```json
"confirmSteps": {
  "title": "在 Alife 桌面完成确认",
  "step1": "打开或切换到已运行的 Alife 桌面。",
  "step2": "在 Alife 内确认已暂存的包。",
  "step3": "回到 Web，点击「重新检查」。"
},
"healthGuidance": {
  "reachable": "本地健康检查显示桌面进程可达；请在 Alife 内确认。",
  "unreachable": "本地健康检查无法连接桌面；请先启动 Alife，再确认。",
  "authRequired": "本地健康检查需要鉴权；确认仍只能在 Alife 内完成。",
  "invalidResponse": "本地健康响应异常；请勿假设桌面已就绪。",
  "error": "本地健康检查失败；请先排查桌面侧，再确认。",
  "notConfigured": "未配置本地健康检查；确认仍只能在 Alife 桌面完成。"
}
```

Mirror intent in en and ja. Keep existing `action.confirmInDesktop` / `actionHint.confirmInDesktop`.

- [ ] **Step 4: Run test and verify pass**

- [ ] **Step 5: Commit**

```powershell
git add messages/en.json messages/zh-CN.json messages/ja.json tests/unit/<locale-test-file>.test.ts
git commit -m "i18n: add confirm-in-desktop guidance strings"
```

---

### Task 2: Confirm-State Actions (Disabled Primary + Secondary Recheck)

**Files:**
- Modify: `PetRuntimeSummary.tsx`
- Modify: `PetSyncStatusPanel.tsx`
- Modify/create: component tests

- [ ] **Step 1: Write failing tests**

For both RuntimeSummary and SyncStatusPanel (or shared render helper tests):

```ts
it('keeps confirmInDesktop primary disabled and exposes enabled recheck', () => {
  // render with primaryAction: 'confirmInDesktop'
  // expect primary button disabled with confirm label
  // expect secondary/check-again button enabled
  // click recheck -> onRefresh called
});
```

- [ ] **Step 2: Run tests and verify failure**

- [ ] **Step 3: Implement action pair**

In both components’ action renderers when `primaryAction === 'confirmInDesktop'`:

```tsx
<Space size="small" wrap>
  <Tooltip title={t('actionHint.confirmInDesktop')}>
    <Button type="primary" icon={<DesktopOutlined />} disabled>
      {t('action.confirmInDesktop')}
    </Button>
  </Tooltip>
  <Button icon={<ReloadOutlined />} loading={loading} onClick={onRefresh}>
    {t('action.checkAgain')}
  </Button>
</Space>
```

Do not enable the primary confirm button.

- [ ] **Step 4: Run tests and verify pass**

- [ ] **Step 5: Commit**

```powershell
git commit -m "fix(ui): expose recheck beside disabled confirm-in-desktop action"
```

---

### Task 3: Three-Step Callout + Local Health One-Liner

**Files:**
- Optional create: `src/components/pet/sync/confirmInDesktopGuidance.ts`
- Modify: `PetSyncStatusPanel.tsx`
- Modify: `dashboard/pet/page.tsx`
- Tests for mapping + panel render

- [ ] **Step 1: Write failing mapping tests**

```ts
it('maps local health states to guidance keys without inventing reachability', () => {
  expect(getConfirmHealthGuidanceKey({ state: 'reachable' })).toBe('healthGuidance.reachable');
  expect(getConfirmHealthGuidanceKey(null)).toBeNull();
});
```

- [ ] **Step 2: Write failing panel test for callout content when confirmInDesktop**

Expect step title + three steps; when health reachable, expect guidance sentence.

- [ ] **Step 3: Implement helper + panel UI**

Replace single Alert with:

```tsx
{status.primaryAction === 'confirmInDesktop' && (
  <Alert
    type="warning"
    showIcon
    title={t('confirmSteps.title')}
    description={
      <Space vertical size={4}>
        <Text>1. {t('confirmSteps.step1')}</Text>
        <Text>2. {t('confirmSteps.step2')}</Text>
        <Text>3. {t('confirmSteps.step3')}</Text>
        {healthGuidanceKey && <Text type="secondary">{t(healthGuidanceKey)}</Text>}
      </Space>
    }
  />
)}
```

Pass `localHealth` or `healthGuidanceKey` from page:

```tsx
<PetSyncStatusPanel
  status={syncStatus}
  loading={syncStatusLoading}
  onRefresh={fetchSyncStatus}
  localHealth={alifeLocalHealth}
/>
```

- [ ] **Step 4: Run focused tests and verify pass**

- [ ] **Step 5: Commit**

```powershell
git commit -m "feat(ui): add confirm-in-desktop steps and health guidance"
```

---

### Task 4: Diagnostics Evidence Catalog (Batch B)

**Files:**
- Modify: `PetSyncDiagnosticsPanel.tsx`
- Modify: locale files under `pet.diagnostics` or equivalent
- Tests for catalog keys and panel text

- [ ] **Step 1: Write failing locale + panel tests**

Required keys example:

```ts
[
  'evidenceCatalog.title',
  'evidenceCatalog.readOnly',
  'evidenceCatalog.smoke.label',
  'evidenceCatalog.smoke.command',
  'evidenceCatalog.smoke.purpose',
  'evidenceCatalog.activeApply.label',
  'evidenceCatalog.activeApply.command',
  'evidenceCatalog.activeApply.purpose',
  'evidenceCatalog.liveDesktop.label',
  'evidenceCatalog.liveDesktop.command',
  'evidenceCatalog.liveDesktop.purpose',
]
```

- [ ] **Step 2: Add locale strings**

Purpose examples (zh-CN):

- smoke: 隔离 harness 的 staged→applied 冒烟，不代表已运行桌面。
- activeApply: 主动服务 apply 证据，需 opt-in，不代表 live desktop。
- liveDesktop: 已运行桌面 + 人工确认证据，需 `ALIFE_LIVE_DESKTOP_CONFIRMATION=true`；Web 不执行该命令。

Command strings:

```text
npm run check:webbridge:smoke
npm run check:webbridge:active-apply
npm run check:webbridge:live-desktop-confirmation
```

- [ ] **Step 3: Render read-only catalog in diagnostics panel**

Use existing read-only styling patterns. No buttons that execute commands.

- [ ] **Step 4: Run tests and verify pass**

- [ ] **Step 5: Commit**

```powershell
git commit -m "docs(ui): catalog WebBridge evidence commands in diagnostics"
```

---

### Task 5: Guardrails And Verification

**Files:**
- Existing guardrail tests; add assertions if needed

- [ ] **Step 1: Run boundary-minded unit tests**

```powershell
npm run test -- --runInBand src/components/__tests__ tests/unit --testPathPattern="PetSync|PetRuntime|confirmInDesktop|AlifeLocalHealth|locale"
```

Expected: PASS for touched suites.

- [ ] **Step 2: Run typecheck**

```powershell
npm run typecheck
```

- [ ] **Step 3: Static grep**

```powershell
# product code only; should not introduce loopback/shell in app/components product files
```

Confirm no new `child_process`, `127.0.0.1:8787`, or apply/confirm routes.

- [ ] **Step 4: Manual UI checklist**

1. Mock or fixture status `primaryAction=confirmInDesktop`.
2. See disabled confirm + enabled recheck.
3. See 3 steps.
4. With local health reachable/unreachable fixtures, see correct one-liner.
5. Open diagnostics: three evidence commands, read-only.

- [ ] **Step 5: Commit only if fixes needed**

```powershell
git commit -m "test: verify confirm-in-desktop UI guidance boundaries"
```

---

## Self-Review Notes

- Spec coverage: Batch A actions/callout/health sentence and Batch B diagnostics catalog are planned.
- Protocol boundary preserved: primary confirm stays disabled; no browser apply.
- Stacking: implement on a branch separate from or after `worktree-live-desktop-confirmation-evidence` PR to keep evidence runner PR reviewable.
- Deferred intentionally: polling, success banner, denser layout refactor, full “Alife 桌面” rename.
