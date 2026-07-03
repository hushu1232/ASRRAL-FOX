# Dashboard Shell UI Normalization Batch B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize the shared authenticated dashboard shell, page header, sidebar navigation states, and shared empty state surface according to the 2026-07-03 FOXD UI component/text style specification.

**Architecture:** Keep this as a presentation-only batch under the existing Next.js app shell. Add source-level and component tests that pin layout guardrails, then make minimal TSX/SCSS edits to shared shell primitives without changing route handlers, protocol behavior, stores, Prisma schema, or Alife source.

**Tech Stack:** Next.js React components, TypeScript, SCSS modules imported globally by components, Ant Design, Jest, Testing Library, PowerShell verification commands.

---

## File Structure

- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PetConsoleResponsive.test.ts`
  - Adds shell/navigation source guardrails for PageHeader, AppLayout, and Sidebar style rules.
- Create: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/EmptyState.test.tsx`
  - Verifies the shared empty state has stable layout, explicit copy, and no hard-coded English default.
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/components/layout/PageHeader.tsx`
  - Makes the page header shell addressable and shrink-safe without changing breadcrumbs, tabs, or routing.
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/components/layout/AppLayout/style.scss`
  - Adds shrink-safe main/content constraints so nested operational surfaces cannot force mobile overflow.
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/components/layout/Sidebar/style.scss`
  - Replaces the broad new-avatar gradient with restrained accent styling and adds a non-shifting selected nav indicator.
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/components/ui/EmptyState.tsx`
  - Removes the stale TODO/default English copy and gives the shared empty surface a stable footprint.

## Boundaries

- Do not edit API routes, Prisma files, protocol behavior, or Alife files.
- Do not change global design tokens.
- Do not rewrite business logic, routing, auth, sidebar visibility, or tab URL behavior.
- Do not commit the untracked roadmap file `docs/superpowers/plans/2026-07-03-foxd-next-roadmap.md`.

## Task 1: Add Shell And Navigation Guardrail Tests

**Files:**

- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PetConsoleResponsive.test.ts`

- [ ] **Step 1: Update the PageHeader mobile actions guardrail**

Replace the existing PageHeader actions assertion:

```ts
expect(source).toContain('flex flex-wrap items-center gap-2 w-full sm:w-auto');
```

with:

```ts
expect(source).toContain(
  'className="flex min-w-0 flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end"',
);
```

- [ ] **Step 2: Add a PageHeader shell guardrail**

Add this test inside `describe('pet console responsive guardrails', () => { ... })`:

```ts
it('keeps the shared page header shell shrink-safe and addressable', () => {
  const source = readSource('src/components/layout/PageHeader.tsx');

  expect(source).toContain('data-testid="page-header-shell"');
  expect(source).toContain('className="mb-6 min-w-0"');
  expect(source).toContain(
    'className="flex min-w-0 flex-wrap items-start justify-between gap-4 mb-2"',
  );
  expect(source).toContain('className="min-w-0 flex-1"');
});
```

- [ ] **Step 3: Add an AppLayout shrink guardrail**

Add this test:

```ts
it('keeps the authenticated shell content shrink-safe inside the viewport', () => {
  const source = readSource('src/components/layout/AppLayout/style.scss');

  expect(source).toContain('&__main {');
  expect(source).toContain('min-width: 0;');
  expect(source).toContain('&__content {');
});
```

- [ ] **Step 4: Add a Sidebar active state guardrail**

Add this test:

```ts
it('uses restrained sidebar active states without broad decorative gradients', () => {
  const source = readSource('src/components/layout/Sidebar/style.scss');

  expect(source).not.toContain('linear-gradient(90deg, var(--accent), var(--info))');
  expect(source).toContain('background: var(--accent);');
  expect(source).toContain('background: var(--bg-card-hover);');
  expect(source).toContain('box-shadow: inset 3px 0 0 var(--accent);');
});
```

- [ ] **Step 5: Run the focused source guardrail tests and observe RED**

Run from `桌宠demo/新建文件夹/avatar-web-management`:

```powershell
npm run test -- src/components/__tests__/PetConsoleResponsive.test.ts --runInBand
```

Expected: FAIL because PageHeader lacks the test id/shrink-safe classes, AppLayout content is not fully shrink-safe, and Sidebar still uses the gradient active pattern.

## Task 2: Add EmptyState Component Tests

**Files:**

- Create: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/EmptyState.test.tsx`

- [ ] **Step 1: Create the failing EmptyState tests**

Create the file with:

```tsx
/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import EmptyState from '@/components/ui/EmptyState';

describe('EmptyState', () => {
  it('renders a stable shared empty surface with explicit copy and action', () => {
    const onAction = jest.fn();

    render(<EmptyState description="No assets yet" actionLabel="Upload" onAction={onAction} />);

    const shell = screen.getByTestId('empty-state');
    expect(shell.className).toContain('min-h-[160px]');
    expect(screen.getByText('No assets yet')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('does not inject a hard-coded English default message', () => {
    render(<EmptyState />);

    expect(screen.getByTestId('empty-state')).toBeDefined();
    expect(screen.queryByText('No data available')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the focused EmptyState test and observe RED**

Run from `桌宠demo/新建文件夹/avatar-web-management`:

```powershell
npm run test -- src/components/__tests__/EmptyState.test.tsx --runInBand
```

Expected: FAIL because `EmptyState` does not expose `data-testid="empty-state"` and still injects `No data available`.

## Task 3: Implement Shared Shell Normalization

**Files:**

- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/components/layout/PageHeader.tsx`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/components/layout/AppLayout/style.scss`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/components/layout/Sidebar/style.scss`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/components/ui/EmptyState.tsx`

- [ ] **Step 1: Make PageHeader shrink-safe**

Change the root and title/action row to:

```tsx
<div data-testid="page-header-shell" className="mb-6 min-w-0">
```

```tsx
<div className="flex min-w-0 flex-wrap items-start justify-between gap-4 mb-2">
  <div className="min-w-0 flex-1">
```

```tsx
<div className="flex min-w-0 flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end">
```

- [ ] **Step 2: Make AppLayout main/content shrink-safe**

Add `min-width: 0;` to `&__main` and `&__content`:

```scss
&__main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  background: var(--bg-deep);
  transition: margin-left var.$transition-normal;
}
```

```scss
&__content {
  flex: 1;
  min-width: 0;
  padding: var.$spacing-3;
  min-height: calc(100vh - #{var.$header-height});
  max-width: 1440px;
  margin: 0 auto;
  width: 100%;
}
```

- [ ] **Step 3: Normalize Sidebar restrained active states**

Replace the new-avatar button gradient with a solid accent:

```scss
background: var(--accent);
border: none;
color: #fff;
transition:
  background var.$transition-fast,
  box-shadow var.$transition-fast,
  transform var.$transition-fast;

&:hover {
  background: var(--accent);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.14);
  transform: translateY(-1px);
}
```

Add a non-shifting selected menu state:

```scss
&__menu .ant-menu-item-selected {
  color: var(--text-primary);
  background: var(--bg-card-hover);
  box-shadow: inset 3px 0 0 var(--accent);
}
```

- [ ] **Step 4: Normalize EmptyState**

Update `EmptyState.tsx` so it has no default English copy, exposes a test id, and uses stable compact/default heights:

```tsx
import { Empty, Button } from 'antd';
import type { ReactNode } from 'react';

interface Props {
  description?: ReactNode;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'default' | 'compact';
}

export default function EmptyState({
  description,
  icon,
  actionLabel,
  onAction,
  variant = 'default',
}: Props) {
  const densityClass = variant === 'compact' ? 'min-h-[120px] py-8' : 'min-h-[160px] py-16';
  const resolvedDescription = description ? (
    <span style={{ color: 'var(--text-secondary)' }}>{description}</span>
  ) : false;

  return (
    <div
      data-testid="empty-state"
      className={`flex min-w-0 items-center justify-center ${densityClass}`}
    >
      <Empty image={icon || Empty.PRESENTED_IMAGE_SIMPLE} description={resolvedDescription}>
        {actionLabel && onAction && (
          <Button type="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </Empty>
    </div>
  );
}
```

## Task 4: Verify And Commit

**Files:**

- Test: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PetConsoleResponsive.test.ts`
- Test: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/EmptyState.test.tsx`
- Modify: shell/navigation/empty state files listed above
- Add: this plan file

- [ ] **Step 1: Run focused tests and observe GREEN**

Run from `桌宠demo/新建文件夹/avatar-web-management`:

```powershell
npm run test -- src/components/__tests__/PetConsoleResponsive.test.ts src/components/__tests__/EmptyState.test.tsx --runInBand
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

- Jest exits 0. Known existing console noise may include React `act(...)` warnings and jsdom canvas/WebGL not implemented messages.
- Typecheck exits 0.
- Build exits 0.

- [ ] **Step 3: Check repository diff hygiene**

Run from `D:\FOXD`:

```powershell
git diff --check
git diff --name-only HEAD
git status --short --branch
```

Expected:

- `git diff --check` exits 0.
- Changed files are limited to this Batch B plan, shell/navigation/empty-state components, and focused tests.
- The roadmap file remains untracked unless the user explicitly asks to commit it.

- [ ] **Step 4: Commit Batch B**

Run from `D:\FOXD`:

```powershell
git add docs/superpowers/plans/2026-07-03-dashboard-shell-ui-normalization-batch-b.md
git add "桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/PetConsoleResponsive.test.ts"
git add "桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/EmptyState.test.tsx"
git add "桌宠demo/新建文件夹/avatar-web-management/src/components/layout/PageHeader.tsx"
git add "桌宠demo/新建文件夹/avatar-web-management/src/components/layout/AppLayout/style.scss"
git add "桌宠demo/新建文件夹/avatar-web-management/src/components/layout/Sidebar/style.scss"
git add "桌宠demo/新建文件夹/avatar-web-management/src/components/ui/EmptyState.tsx"
git commit -m "style: normalize dashboard shell UI"
```

Expected: one focused Batch B commit.

## Self-Review

Spec coverage:

- Dashboard page shell is covered by `AppLayout/style.scss`.
- Shared page header behavior is covered by `PageHeader.tsx` guardrails without touching breadcrumb or tab logic.
- Navigation spacing and active states are covered by `Sidebar/style.scss`.
- Empty state consistency is covered by `EmptyState.tsx` and a focused component test.
- Loading and error state broad page work remains out of scope for this small shared-shell batch.

Marker scan:

- This plan contains no intentionally unfinished implementation markers.

Type consistency:

- Test file names, component paths, class strings, and commit message match the planned implementation.
