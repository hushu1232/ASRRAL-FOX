# FOXD Dashboard Shell States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten FOXD dashboard navigation active-state behavior without touching Alife, WebBridge protocol, Prisma, or runtime APIs.

**Architecture:** Keep this as a FOXD-only UI shell batch. Fix the shared sidebar selected-key resolver so nested routes select the most specific navigation item, then lock the behavior with a pure unit test and the existing Sidebar render tests.

**Tech Stack:** Next.js, React, TypeScript, Ant Design Menu, Jest, Testing Library.

---

### Task 1: Sidebar Active State

**Files:**
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/components/layout/Sidebar/index.tsx`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/src/components/__tests__/Sidebar.test.tsx`

- [x] **Step 1: Add tests for exact and nested selected keys**

Add tests that prove:

```text
/dashboard selects /dashboard
/dashboard/pet selects /dashboard/pet
/dashboard/pet/voice selects /dashboard/pet
/marketplace/new selects /marketplace
/marketplace-extra does not accidentally select /marketplace
```

- [x] **Step 2: Add a pure selected-key helper**

Implement `resolveSelectedSidebarKey(pathname, itemKeys)` in `Sidebar/index.tsx`. It should sort candidate keys by descending length, then match exact paths or slash-bound nested paths.

- [x] **Step 3: Use the helper in Sidebar**

Replace the current first-prefix match with the new helper.

- [x] **Step 4: Verify**

Run from `桌宠demo/新建文件夹/avatar-web-management`:

```powershell
npm run test -- Sidebar.test.tsx --runInBand
npm run typecheck
npm run build
```

Expected: tests, typecheck, and build pass. Build may require the existing temporary production env values if the repo demands them.
