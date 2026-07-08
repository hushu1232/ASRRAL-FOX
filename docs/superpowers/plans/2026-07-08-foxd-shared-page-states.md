# FOXD Shared Page States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make high-traffic FOXD pages use the same lightweight loading and empty-state surfaces without changing API behavior.

**Architecture:** Add one small shared `LoadingState` UI primitive next to the existing `EmptyState`. Use it on `/assets`, `/marketplace`, and `/notifications`; use existing `OperationPanel` + `EmptyState` for marketplace and notifications empty states.

**Tech Stack:** Next.js, React, Ant Design, Jest, Testing Library.

---

### Task 1: Shared Loading Surface

**Files:**
- Create: `桌宠demo/新建文件夹/avatar-web-management/src/components/ui/LoadingState.tsx`
- Create: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/LoadingState.test.tsx`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/assets/page.tsx`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/marketplace/page.tsx`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/notifications/page.tsx`

- [x] **Step 1: Write failing `LoadingState` tests**

Assert that the shared loading surface renders `data-testid="loading-state"` and uses the same stable minimum height for page loading.

- [x] **Step 2: Implement `LoadingState`**

Create a tiny component around Ant Design `Spin`, with default `min-h-[220px]`.

- [x] **Step 3: Replace duplicated page spinners**

Replace direct `<div className="flex justify-center py-20"><Spin size="large" /></div>` style loading blocks on the three scoped pages with `<LoadingState />`.

### Task 2: Marketplace And Notifications Empty States

**Files:**
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/marketplace/page.tsx`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/app/(auth)/notifications/page.tsx`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/MarketplaceAssets.test.tsx`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/FormsAssetsUiGuardrails.test.ts`

- [x] **Step 1: Write failing empty-state tests**

Assert that marketplace and notifications empty states render shared `EmptyState` inside stable page panels with `data-testid="marketplace-empty-panel"` and `data-testid="notifications-empty-panel"`.

- [x] **Step 2: Implement marketplace empty state**

Replace direct Ant Design `Empty` usage with `OperationPanel` + `EmptyState`.

- [x] **Step 3: Implement notifications empty state**

Replace direct Ant Design `Empty` card usage with `OperationPanel` + `EmptyState`.

- [x] **Step 4: Verify**

Run:

```powershell
npx jest src/components/__tests__/LoadingState.test.tsx src/components/__tests__/MarketplaceAssets.test.tsx src/components/__tests__/FormsAssetsUiGuardrails.test.ts --runInBand --verbose
npm run typecheck
npm run test -- --runInBand
$env:JWT_SECRET='temporary-verification-secret-at-least-32-chars'; $env:DATABASE_URL='file:./dev.db'; npm run build
```
