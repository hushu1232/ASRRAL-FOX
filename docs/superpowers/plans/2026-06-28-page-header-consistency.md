# Page Header Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the first batch of authenticated FOXD Web pages to the shared `PageHeader` page shell while preserving behavior.

**Architecture:** The existing `src/components/layout/PageHeader.tsx` remains the only page-shell header abstraction. Each target page imports it, replaces its local title/action row, and leaves data fetching, filters, tabs, pagination, cards, and navigation logic unchanged. A static AST regression test locks the scoped pages to importing and rendering `PageHeader`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Ant Design 6, Jest 30 with `ts-jest`, TypeScript compiler, ESLint.

---

## File Structure

- Create: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PageHeaderShell.test.ts`
  - Static regression test that parses the four scoped page files and asserts each imports and renders `PageHeader`.
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/assets/page.tsx`
  - Import `PageHeader`, replace local title/action row, keep hidden file input and upload button behavior.
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/marketplace/page.tsx`
  - Import `PageHeader`, move list-item button to `actions`, keep marketplace category tabs in the body.
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/notifications/page.tsx`
  - Import `PageHeader`, move mark-all-read button to `actions`, keep list behavior and pagination unchanged.
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/settings/page.tsx`
  - Import `PageHeader`, replace the hand-written settings `h1`, keep settings `Tabs` local.

---

### Task 1: Static Regression Test

**Files:**
- Create: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PageHeaderShell.test.ts`

- [ ] **Step 1: Write the failing test**

Create `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PageHeaderShell.test.ts` with this content:

```ts
import { readFileSync } from 'fs';
import path from 'path';
import ts from 'typescript';

type PageHeaderUsage = {
  file: string;
  hasImport: boolean;
  rendersPageHeader: boolean;
};

const TARGET_PAGES = [
  'src/app/(auth)/assets/page.tsx',
  'src/app/(auth)/marketplace/page.tsx',
  'src/app/(auth)/notifications/page.tsx',
  'src/app/(auth)/settings/page.tsx',
];

function inspectPageHeaderUsage(file: string): PageHeaderUsage {
  const sourceText = readFileSync(path.join(process.cwd(), file), 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  let hasImport = false;
  let rendersPageHeader = false;

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) {
      const moduleName = node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, '');
      const defaultImport = node.importClause?.name?.getText(sourceFile);
      if (moduleName === '@/components/layout/PageHeader' && defaultImport === 'PageHeader') {
        hasImport = true;
      }
    }

    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (node.tagName.getText(sourceFile) === 'PageHeader') {
        rendersPageHeader = true;
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return { file, hasImport, rendersPageHeader };
}

describe('authenticated page shells', () => {
  it('uses the shared PageHeader on scoped high-traffic pages', () => {
    expect(TARGET_PAGES.map(inspectPageHeaderUsage)).toEqual(
      TARGET_PAGES.map((file) => ({
        file,
        hasImport: true,
        rendersPageHeader: true,
      })),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run from `D:\FOXD\桌宠demo\新建文件夹\avatar-web-management`:

```powershell
npx jest --runInBand src/components/__tests__/PageHeaderShell.test.ts
```

Expected: test fails and reports the four target files with `hasImport: false` and `rendersPageHeader: false`.

- [ ] **Step 3: Commit nothing yet**

Keep the failing test uncommitted until the implementation makes it pass. The implementation commit should contain the test and page migrations together.

---

### Task 2: Assets Page Header

**Files:**
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/assets/page.tsx`
- Test: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PageHeaderShell.test.ts`

- [ ] **Step 1: Add the import**

Add this import near the existing app imports:

```ts
import PageHeader from '@/components/layout/PageHeader';
```

- [ ] **Step 2: Replace the local title/action row**

Replace this block:

```tsx
<div className="flex items-center justify-between mb-6">
  <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
  <input
    ref={fileInputRef}
    type="file"
    accept=".glb,.gltf,.png,.jpg,.jpeg,.hdr,.exr,.fbx,.blend,.obj,.mtl,.mp4"
    className="hidden"
    onChange={handleFileChange}
  />
  <Button type="primary" icon={<UploadOutlined />} onClick={handleUploadClick} loading={uploading}>
    {t('uploadButton')}
  </Button>
</div>
```

with this block:

```tsx
<PageHeader
  title={t('title')}
  actions={
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.gltf,.png,.jpg,.jpeg,.hdr,.exr,.fbx,.blend,.obj,.mtl,.mp4"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button type="primary" icon={<UploadOutlined />} onClick={handleUploadClick} loading={uploading}>
        {t('uploadButton')}
      </Button>
    </>
  }
/>
```

- [ ] **Step 3: Run the static test**

Run from `D:\FOXD\桌宠demo\新建文件夹\avatar-web-management`:

```powershell
npx jest --runInBand src/components/__tests__/PageHeaderShell.test.ts
```

Expected: test still fails for marketplace, notifications, and settings, but `src/app/(auth)/assets/page.tsx` now has `hasImport: true` and `rendersPageHeader: true`.

---

### Task 3: Marketplace Page Header

**Files:**
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/marketplace/page.tsx`
- Test: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PageHeaderShell.test.ts`

- [ ] **Step 1: Add the import**

Add this import near the existing app imports:

```ts
import PageHeader from '@/components/layout/PageHeader';
```

- [ ] **Step 2: Replace the local title/action row**

Replace this block:

```tsx
<div className="flex items-center justify-between mb-6">
  <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
  <Button type="primary" onClick={() => router.push('/marketplace/new')} className="bg-gradient-to-r from-purple-600 to-blue-600 border-0">
    {t('listItem')}
  </Button>
</div>
```

with this block:

```tsx
<PageHeader
  title={t('title')}
  actions={
    <Button
      type="primary"
      onClick={() => router.push('/marketplace/new')}
      className="bg-gradient-to-r from-purple-600 to-blue-600 border-0"
    >
      {t('listItem')}
    </Button>
  }
/>
```

- [ ] **Step 3: Run the static test**

Run from `D:\FOXD\桌宠demo\新建文件夹\avatar-web-management`:

```powershell
npx jest --runInBand src/components/__tests__/PageHeaderShell.test.ts
```

Expected: test still fails for notifications and settings only.

---

### Task 4: Notifications Page Header

**Files:**
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/notifications/page.tsx`
- Test: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PageHeaderShell.test.ts`

- [ ] **Step 1: Add the import**

Add this import near the existing app imports:

```ts
import PageHeader from '@/components/layout/PageHeader';
```

- [ ] **Step 2: Replace the local title/action row**

Replace this block:

```tsx
<div className="flex items-center justify-between mb-6">
  <h1 className="text-2xl font-bold text-white">{t('notificationCenter')}</h1>
  <Button
    icon={<CheckOutlined />}
    onClick={handleReadAll}
    className="!border-purple-500/20 !text-purple-400 hover:!border-purple-500/40 hover:!text-purple-300"
  >
    {t('markAllRead')}
  </Button>
</div>
```

with this block:

```tsx
<PageHeader
  title={t('notificationCenter')}
  actions={
    <Button
      icon={<CheckOutlined />}
      onClick={handleReadAll}
      className="!border-purple-500/20 !text-purple-400 hover:!border-purple-500/40 hover:!text-purple-300"
    >
      {t('markAllRead')}
    </Button>
  }
/>
```

- [ ] **Step 3: Run the static test**

Run from `D:\FOXD\桌宠demo\新建文件夹\avatar-web-management`:

```powershell
npx jest --runInBand src/components/__tests__/PageHeaderShell.test.ts
```

Expected: test still fails for settings only.

---

### Task 5: Settings Page Header

**Files:**
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/settings/page.tsx`
- Test: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PageHeaderShell.test.ts`

- [ ] **Step 1: Add the import**

Add this import near the existing app imports:

```ts
import PageHeader from '@/components/layout/PageHeader';
```

- [ ] **Step 2: Replace the local title**

Replace this line:

```tsx
<h1 className="text-2xl font-bold text-white mb-6">{t('title')}</h1>
```

with this line:

```tsx
<PageHeader title={t('title')} />
```

- [ ] **Step 3: Run the static test**

Run from `D:\FOXD\桌宠demo\新建文件夹\avatar-web-management`:

```powershell
npx jest --runInBand src/components/__tests__/PageHeaderShell.test.ts
```

Expected: `1 passed, 1 total`.

---

### Task 6: Verification and Commit

**Files:**
- Test: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PageHeaderShell.test.ts`
- Verify changed pages:
  - `桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/assets/page.tsx`
  - `桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/marketplace/page.tsx`
  - `桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/notifications/page.tsx`
  - `桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/settings/page.tsx`

- [ ] **Step 1: Format only the new test file**

Run from `D:\FOXD\桌宠demo\新建文件夹\avatar-web-management`:

```powershell
npx prettier --write "src/components/__tests__/PageHeaderShell.test.ts"
```

Expected: Prettier reports the test file. Do not run broad formatting on the four existing page files because that would create unrelated formatting churn.

- [ ] **Step 2: Run focused Jest**

Run from `D:\FOXD\桌宠demo\新建文件夹\avatar-web-management`:

```powershell
npx jest --runInBand src/components/__tests__/PageHeaderShell.test.ts
```

Expected: `Test Suites: 1 passed, 1 total` and `Tests: 1 passed, 1 total`.

- [ ] **Step 3: Run typecheck**

Run from `D:\FOXD\桌宠demo\新建文件夹\avatar-web-management`:

```powershell
npm run typecheck
```

Expected: exit code 0.

- [ ] **Step 4: Run ESLint on touched files**

Run from `D:\FOXD\桌宠demo\新建文件夹\avatar-web-management`:

```powershell
npx eslint "src/components/__tests__/PageHeaderShell.test.ts" "src/app/(auth)/assets/page.tsx" "src/app/(auth)/marketplace/page.tsx" "src/app/(auth)/notifications/page.tsx" "src/app/(auth)/settings/page.tsx"
```

Expected: exit code 0. Existing warnings unrelated to the header migration may be reported; do not broaden the cleanup.

- [ ] **Step 5: Run production build**

Run from `D:\FOXD\桌宠demo\新建文件夹\avatar-web-management`:

```powershell
npm run build
```

Expected: exit code 0. Existing Turbopack NFT trace warnings involving `src/lib/auth/keys.ts` and `.well-known/jwks.json/route.ts` may still appear.

- [ ] **Step 6: Check diff health**

Run from `D:\FOXD`:

```powershell
git diff --check
git status --short --branch --untracked-files=all
git diff --stat
```

Expected: no whitespace errors; only the new test and four page files are changed.

- [ ] **Step 7: Commit implementation**

Run from `D:\FOXD`:

```powershell
git add -- "桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PageHeaderShell.test.ts" "桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/assets/page.tsx" "桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/marketplace/page.tsx" "桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/notifications/page.tsx" "桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/settings/page.tsx"
git commit -m "chore: align primary page headers"
```

Expected: one focused parent-repo commit. Do not push. Do not stage or modify `D:\FOXD\alife-service`.

- [ ] **Step 8: Final status check**

Run from `D:\FOXD`:

```powershell
git status --short --branch --untracked-files=all
git -C "D:\FOXD\alife-service" status --short --branch --untracked-files=all
```

Expected: parent repo clean; `alife-service` remains in its pre-existing state and has no new working tree changes.
