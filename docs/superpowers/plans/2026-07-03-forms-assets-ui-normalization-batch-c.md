# Forms Assets UI Normalization Batch C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize the highest-traffic forms and asset surfaces for Phase 3 Batch C without changing business logic or protocol behavior.

**Architecture:** Keep this as a presentation-only pass over `/assets` and `/marketplace/new`. Add source guardrails first, then replace page-local purple/gradient wrappers with shared `OperationPanel`, `EmptyState`, stable responsive grids, tooltip-labeled icon actions, and localized form placeholders.

**Tech Stack:** Next.js React components, TypeScript, Ant Design, Jest source guardrail tests, JSON i18n messages, PowerShell verification commands.

---

## File Structure

- Create: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/FormsAssetsUiGuardrails.test.ts`
  - Pins Batch C source-level UI rules for `/assets`, `/marketplace/new`, and required i18n keys.
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/assets/page.tsx`
  - Converts asset directory/filter/list/empty surfaces to shared operational panels and stable responsive asset grid rules.
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/marketplace/new/page.tsx`
  - Converts the listing form shell to `PageHeader` + `OperationPanel`, removes the broad submit gradient, and makes the price/currency row responsive.
- Modify: `桌宠demo/新建文件夹/avatar-web-management/messages/en.json`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/messages/zh-CN.json`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/messages/ja.json`
  - Adds localized asset view-toggle labels, listing defaults, and placeholders for preview image URLs and file paths.

## Boundaries

- Do not edit API routes, Prisma files, WebBridge protocol code, or Alife files.
- Do not change upload, listing, routing, filtering, pagination, or marketplace submit behavior.
- Do not change global design tokens.
- Do not normalize marketplace detail, admin, settings, auth, or seller pages in this batch.
- Do not commit `docs/superpowers/plans/2026-07-03-foxd-next-roadmap.md`.

## Task 1: Add Batch C Source Guardrails

**Files:**

- Create: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/FormsAssetsUiGuardrails.test.ts`

- [ ] **Step 1: Create the failing guardrail file**

Create this exact test file:

```ts
import { readFileSync } from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function readMessages(locale: 'en' | 'zh-CN' | 'ja') {
  return JSON.parse(readSource(`messages/${locale}.json`));
}

describe('forms and asset UI guardrails', () => {
  it('uses shared operational surfaces on the asset library page', () => {
    const source = readSource('src/app/(auth)/assets/page.tsx');

    expect(source).toContain("import OperationPanel from '@/components/ui/OperationPanel'");
    expect(source).toContain("import EmptyState from '@/components/ui/EmptyState'");
    expect(source).toContain('data-testid="asset-directory-panel"');
    expect(source).toContain('data-testid="asset-filter-panel"');
    expect(source).toContain('data-testid="asset-empty-panel"');
    expect(source).toContain('data-testid="asset-list-panel"');
    expect(source).toContain('data-testid="asset-grid"');
  });

  it('keeps asset cards responsive and free of broad purple gradient styling', () => {
    const source = readSource('src/app/(auth)/assets/page.tsx');

    expect(source).toContain('repeat(auto-fit, minmax(160px, 1fr))');
    expect(source).toContain('Tooltip title={t(\\'upload.sellOnMarket\\')}');
    expect(source).not.toContain('!border-purple-500/10');
    expect(source).not.toContain('bg-gradient-to-br');
    expect(source).not.toContain('border-purple-500/20');
  });

  it('normalizes the marketplace listing form shell without a broad submit gradient', () => {
    const source = readSource('src/app/(auth)/marketplace/new/page.tsx');

    expect(source).toContain("import PageHeader from '@/components/layout/PageHeader'");
    expect(source).toContain("import OperationPanel from '@/components/ui/OperationPanel'");
    expect(source).toContain('data-testid="marketplace-listing-form-panel"');
    expect(source).toContain('className="grid grid-cols-1 gap-4 sm:grid-cols-2"');
    expect(source).toContain("placeholder={t('previewImagesPlaceholder')}");
    expect(source).toContain("placeholder={t('filesPlaceholder')}");
    expect(source).not.toContain('bg-gradient-to-r from-purple-600 to-blue-600');
  });

  it('defines localized listing form placeholders in every supported locale', () => {
    for (const locale of ['en', 'zh-CN', 'ja'] as const) {
      const messages = readMessages(locale);

      expect(messages.marketplace.new.previewImagesPlaceholder).toBeTruthy();
      expect(messages.marketplace.new.filesPlaceholder).toBeTruthy();
    }
  });

  it('keeps marketplace listing defaults localized', () => {
    const source = readSource('src/app/(auth)/marketplace/new/page.tsx');

    expect(source).toContain("title: avatarTitle || t('defaultAvatarTitle')");
    expect(source).toContain("title: assetFilename || t('defaultAssetTitle')");
    expect(source).not.toContain("'我的形象'");
    expect(source).not.toContain("'我的资产'");

    for (const locale of ['en', 'zh-CN', 'ja'] as const) {
      const messages = readMessages(locale);

      expect(messages.marketplace.new.defaultAvatarTitle).toBeTruthy();
      expect(messages.marketplace.new.defaultAssetTitle).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run the focused guardrail test and observe RED**

Run from `桌宠demo/新建文件夹/avatar-web-management`:

```powershell
npx jest src/components/__tests__/FormsAssetsUiGuardrails.test.ts --runInBand
```

Expected: FAIL because the assets page still uses page-local purple/gradient wrappers, the listing form still uses a broad submit gradient, and the new placeholder keys do not exist.

## Task 2: Normalize The Asset Library Page

**Files:**

- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/assets/page.tsx`

- [ ] **Step 1: Update imports**

Change imports so the page imports `Tooltip`, `OperationPanel`, and `EmptyState`:

```ts
import { Card, Button, Input, Select, Table, Tag, Tree, App, Spin, Pagination, Progress, Tooltip } from 'antd';
import OperationPanel from '@/components/ui/OperationPanel';
import EmptyState from '@/components/ui/EmptyState';
```

Remove `Space` from the Ant Design import.

- [ ] **Step 2: Replace the directory card**

Replace:

```tsx
<Card className="!border-purple-500/10 w-52 shrink-0" title={t('upload.directory')}>
```

with:

```tsx
<OperationPanel
  data-testid="asset-directory-panel"
  className="w-full lg:w-56 lg:shrink-0"
  title={t('upload.directory')}
>
```

and close it with `</OperationPanel>`.

- [ ] **Step 3: Make the page layout mobile-safe**

Replace:

```tsx
<div className="flex gap-4">
```

with:

```tsx
<div className="flex flex-col gap-4 lg:flex-row">
```

Replace:

```tsx
<div className="flex-1">
```

with:

```tsx
<div className="min-w-0 flex-1">
```

- [ ] **Step 4: Replace the filter card**

Replace the purple filter `Card` and `Space` with:

```tsx
<OperationPanel data-testid="asset-filter-panel" className="mb-4" title={null}>
  <div className="flex min-w-0 flex-wrap items-center gap-3">
    <Input
      prefix={<SearchOutlined />}
      placeholder={t('upload.searchFiles')}
      value={search}
      onChange={e => { setSearch(e.target.value); setPage(1); }}
      className="w-full sm:w-64"
    />
    <Select
      placeholder={t('upload.typeFilter')}
      value={typeFilter || undefined}
      onChange={(v) => { setTypeFilter(v || ''); setPage(1); }}
      allowClear
      className="w-full sm:w-40"
      options={Object.entries(assetTypeLabels).map(([k, v]) => ({ value: k, label: v }))}
    />
    <div className="flex gap-1 rounded-lg border border-[var(--border-subtle)] p-0.5">
      <Tooltip title={t('upload.gridView')}>
        <Button
          type={viewMode === 'grid' ? 'primary' : 'text'}
          size="small"
          icon={<AppstoreOutlined />}
          onClick={() => setViewMode('grid')}
          aria-label={t('upload.gridView')}
        />
      </Tooltip>
      <Tooltip title={t('upload.listView')}>
        <Button
          type={viewMode === 'list' ? 'primary' : 'text'}
          size="small"
          icon={<UnorderedListOutlined />}
          onClick={() => setViewMode('list')}
          aria-label={t('upload.listView')}
        />
      </Tooltip>
    </div>
  </div>
</OperationPanel>
```

- [ ] **Step 5: Replace loading, empty, and list surfaces**

Use a stable loading footprint:

```tsx
<div className="flex min-h-[220px] items-center justify-center"><Spin size="large" /></div>
```

Use shared empty state inside an operation panel:

```tsx
<OperationPanel data-testid="asset-empty-panel" title={null}>
  <EmptyState description={t('noAssets')} />
  <p className="mt-[-24px] text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
    {t('upload.noAssetsHint')}
  </p>
</OperationPanel>
```

Use an operation panel for list view:

```tsx
<OperationPanel data-testid="asset-list-panel" title={null}>
  <Table
    dataSource={assets}
    columns={columns}
    rowKey="id"
    pagination={false}
    size="middle"
    scroll={{ x: 'max-content' }}
  />
</OperationPanel>
```

- [ ] **Step 6: Normalize repeated asset cards**

Replace the grid wrapper with:

```tsx
<div
  data-testid="asset-grid"
  className="grid gap-3"
  style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}
>
```

Replace asset card purple classes and gradient cover with neutral surfaces:

```tsx
className="text-left transition-all"
style={{
  borderColor: 'var(--border-subtle)',
  borderRadius: 'var(--ds-panel-radius)',
  background: 'var(--bg-card)',
}}
```

```tsx
<div className="relative flex h-24 items-center justify-center overflow-hidden" style={{ background: 'var(--bg-card-hover)' }}>
```

Wrap icon-only sell actions in `Tooltip` and `Button type="text"` in both table and card actions.

## Task 3: Normalize The Marketplace Listing Form

**Files:**

- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/marketplace/new/page.tsx`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/messages/en.json`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/messages/zh-CN.json`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/messages/ja.json`

- [ ] **Step 1: Update imports**

Change imports to:

```ts
import { Form, Input, Select, InputNumber, Button, App, Divider, Alert } from 'antd';
import PageHeader from '@/components/layout/PageHeader';
import OperationPanel from '@/components/ui/OperationPanel';
```

Remove `Card` from the Ant Design import.

- [ ] **Step 2: Replace custom title shell with PageHeader**

Replace the root opening and back button/title/card start with:

```tsx
<div className="mx-auto max-w-2xl">
  <PageHeader
    title={t('title')}
    actions={
      <Button type="text" onClick={() => router.back()} className="text-gray-400 hover:text-white">
        {t('back')}
      </Button>
    }
  />

  <OperationPanel data-testid="marketplace-listing-form-panel" title={null}>
```

Remove the inner `<h1>`.

- [ ] **Step 3: Make the price/currency row responsive**

Replace:

```tsx
<div className="grid grid-cols-2 gap-4">
```

with:

```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
```

- [ ] **Step 4: Localize multiline placeholders**

Replace:

```tsx
<TextArea rows={3} placeholder="https://example.com/preview1.png&#10;https://example.com/preview2.png" />
```

with:

```tsx
<TextArea rows={3} placeholder={t('previewImagesPlaceholder')} />
```

Replace:

```tsx
<TextArea rows={2} placeholder="models/my-model.model3.json&#10;textures/my-tex.png" />
```

with:

```tsx
<TextArea rows={2} placeholder={t('filesPlaceholder')} />
```

- [ ] **Step 5: Remove broad submit gradient**

Replace submit button class:

```tsx
className="bg-gradient-to-r from-purple-600 to-blue-600 border-0 h-12 text-lg font-bold"
```

with:

```tsx
className="h-11 font-semibold"
```

- [ ] **Step 6: Add i18n keys**

In `messages/en.json` under `marketplace.new`, add:

```json
"defaultAvatarTitle": "My avatar",
"defaultAssetTitle": "My asset",
"previewImagesPlaceholder": "https://example.com/preview1.png\nhttps://example.com/preview2.png",
"filesPlaceholder": "models/my-model.model3.json\ntextures/my-texture.png"
```

In `messages/zh-CN.json` under `marketplace.new`, add:

```json
"defaultAvatarTitle": "我的形象",
"defaultAssetTitle": "我的资产",
"previewImagesPlaceholder": "https://example.com/preview1.png\nhttps://example.com/preview2.png",
"filesPlaceholder": "models/my-model.model3.json\ntextures/my-texture.png"
```

In `messages/ja.json` under `marketplace.new`, add:

```json
"defaultAvatarTitle": "マイアバター",
"defaultAssetTitle": "マイアセット",
"previewImagesPlaceholder": "https://example.com/preview1.png\nhttps://example.com/preview2.png",
"filesPlaceholder": "models/my-model.model3.json\ntextures/my-texture.png"
```

Also add `assets.upload.gridView` and `assets.upload.listView` in all three locales because the asset view toggle now exposes tooltip and aria labels.

## Task 4: Verify And Commit

**Files:**

- Add: this plan file.
- Add: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/FormsAssetsUiGuardrails.test.ts`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/assets/page.tsx`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/marketplace/new/page.tsx`
- Modify: message JSON files listed above.

- [ ] **Step 1: Run focused guardrails and related render tests**

Run from `桌宠demo/新建文件夹/avatar-web-management`:

```powershell
npx jest src/components/__tests__/FormsAssetsUiGuardrails.test.ts src/components/__tests__/MarketplaceAssets.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run full verification**

Run from `桌宠demo/新建文件夹/avatar-web-management`:

```powershell
npm run test -- --runInBand
npm run typecheck
npm run build
```

Expected:

- Jest exits 0. Existing console noise may include React `act(...)` warnings and jsdom canvas/WebGL not implemented messages.
- Typecheck exits 0.
- Build exits 0.

- [ ] **Step 3: Check diff hygiene**

Run from `D:\FOXD`:

```powershell
git diff --check
git diff --name-only HEAD
git status --short --branch
```

Expected:

- `git diff --check` exits 0.
- Changed files are limited to this Batch C plan, focused test, `/assets`, `/marketplace/new`, and message JSON files.
- The roadmap file remains untracked.

- [ ] **Step 4: Commit Batch C**

Run from `D:\FOXD`:

```powershell
git add docs/superpowers/plans/2026-07-03-forms-assets-ui-normalization-batch-c.md
git add "桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/FormsAssetsUiGuardrails.test.ts"
git add "桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/assets/page.tsx"
git add "桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/marketplace/new/page.tsx"
git add "桌宠demo/新建文件夹/avatar-web-management/messages/en.json"
git add "桌宠demo/新建文件夹/avatar-web-management/messages/zh-CN.json"
git add "桌宠demo/新建文件夹/avatar-web-management/messages/ja.json"
git commit -m "style: normalize forms and asset UI"
```

Expected: one focused Batch C commit.

## Self-Review

Spec coverage:

- Forms are covered by `/marketplace/new` shell, responsive field grid, localized placeholders, and restrained submit styling.
- Asset surfaces are covered by `/assets` directory/filter/list/empty panels.
- Repeated lists/cards are covered by `/assets` stable grid and neutral repeated card surface.
- Button/icon/tooltip consistency is covered by tooltip-labeled view toggles and sell actions.

Marker scan:

- This plan contains no intentionally unfinished implementation markers.

Type consistency:

- Paths, test names, class strings, i18n keys, and commit message match the planned implementation.
