# Pet Console Sync-First UI/UX Design

> Date: 2026-06-30
> Scope: `/dashboard/pet`
> Runtime language: Alife .NET 9
> Reference style: Insta360 China official site, adapted for an operations console

## 1. Goal

Make `/dashboard/pet` a sync-first control surface. When a user opens the page, the first screen should answer four questions without requiring interpretation:

1. Is the current web pet configuration published?
2. Has the WebBridge package reached Alife .NET?
3. Is local confirmation required inside Alife .NET?
4. Is the package applied and up to date?

The page should still support previewing and editing the pet configuration, but those workflows should come after the sync status and next action are clear.

## 2. Non-Goals

- Do not redesign the full site.
- Do not migrate the global design-token palette in this pass.
- Do not change `/dashboard/pet/voice`.
- Do not change WebBridge package protocol behavior.
- Do not change Alife .NET implementation.
- Do not revive or reference Unity as an active runtime.
- Do not remove the mock/simulation panel entirely; keep it available for diagnostics and demos.

## 3. Design Principles

### Sync First

The top of the page must present the real WebBridge/Alife .NET sync state before preview, configuration editing, or simulation content. The user should not have to compare multiple panels to understand whether the current pet config is active in Alife .NET.

### Product-Calm Visual Style

Use the Insta360 site as a style reference, not as a page-layout copy. The adapted console style should emphasize:

- White and light gray surfaces.
- Clear black/dark text hierarchy.
- Strong primary call to action.
- Restrained secondary actions.
- Dense but breathable grids.
- Product-like confidence without turning the console into a marketing landing page.

The current warm amber palette can remain for now, but the `/dashboard/pet` page should avoid becoming amber-dominant. Use neutral surfaces and reserve color for action and state.

### Real Before Simulated

The live `PetSyncStatusPanel` must be visually dominant over `WebBridgeMockStatusPanel`. Simulation content belongs in a default-collapsed diagnostics area with explicit labels:

- "Simulation only"
- "No live Alife calls"
- "Diagnostics"

### Runtime Accuracy

All user-facing copy should refer to Alife .NET or Alife .NET 9. The active runtime is not Unity.

## 4. Current Page Problems

The current page already has the right pieces, but their hierarchy is not yet ideal:

- `PetRuntimeSummary` is informative, but it reads like a metric block rather than a command surface.
- `PetSyncStatusPanel` and `WebBridgeMockStatusPanel` appear side by side, which makes live status and simulation status compete for attention.
- Preview and configuration editing appear after sync status, which is directionally correct, but the sync area needs a stronger top-level story.
- The page has several useful chips and metrics, but the next action should be the clearest element in the sync area.

## 5. Proposed Page Structure

### 5.1 Page Header

Keep the existing `PageHeader`, but tune copy and action hierarchy.

Header content:

- Title: existing localized pet console title.
- Subtitle: make the WebBridge/Alife .NET relationship explicit.
- Primary action: save configuration.
- Secondary action: export configuration.

The header should remain compact. It should not become a hero section.

### 5.2 Sync Command Strip

Upgrade the top summary area into a command strip. This can be implemented by evolving `PetRuntimeSummary` rather than creating a large new system.

Required content:

- Current state chip.
- One-sentence status explanation.
- Next action label and value.
- Primary sync action, based on `DesktopPrimaryAction`.
- Four compact metrics:
  - Web version.
  - Alife known version.
  - Alife applied version.
  - Local confirmation.

Hierarchy:

- The next action should be more prominent than version metadata.
- Version metadata should be scannable but secondary.
- The local confirmation state should be visually easy to spot.

Expected primary action mapping:

- `refresh`: refresh status.
- `openDesktop`: guide user to open Alife .NET.
- `confirmInDesktop`: guide user to confirm inside Alife .NET.
- `none`: show no heavy CTA; keep refresh available.

### 5.3 Live Sync Lifecycle Panel

Keep `PetSyncStatusPanel` as the live details area, but make it feel like a lifecycle/checklist panel rather than a raw status dump.

Required lifecycle stages:

1. Web published.
2. Alife .NET staged.
3. Applied.

Required details:

- Connection status.
- Package state business label.
- Package state description.
- Raw package state as secondary code.
- Web version.
- Alife known version.
- Alife applied version.
- Last sync time, if available and useful.
- Error text, if present.

Important behavior:

- `pendingPull` must not make "Alife .NET staged" look complete.
- `localConfirmationRequired` must not make "Applied" look complete.
- `notPublished` should keep all lifecycle stages idle.
- Failed states should be visually clear without claiming progress.

### 5.4 Diagnostics and Simulation

Move `WebBridgeMockStatusPanel` into a default-collapsed diagnostics section below the live sync panels.

Section label:

- "Diagnostics and package simulation"

Default state:

- Collapsed.

Expanded content:

- Existing `WebBridgeMockStatusPanel`.
- Existing simulation scenario selector.
- Existing "Simulation only" and "No live Alife calls" labels.

This preserves interview/demo usefulness while preventing simulation data from competing with live status.

### 5.5 Preview and Configuration

Keep the existing preview and editor layout below the sync-first area:

- `PetPreviewCard` remains the left visual anchor on wide screens.
- `PetConfigEditor` remains the main editing surface.
- On mobile, sync status appears first, then preview, then editor.

No deep form redesign is part of this pass.

## 6. Component Responsibilities

### `src/app/(auth)/dashboard/pet/page.tsx`

Owns page-level information architecture:

- Header.
- Sync command strip.
- Live sync details.
- Diagnostics collapse.
- Preview/editor grid.

It should not contain business logic for lifecycle state interpretation. That logic remains in sync presentation helpers and child components.

### `src/components/pet/PetRuntimeSummary.tsx`

Owns the sync command strip:

- Current state.
- Next action.
- Sync action button.
- Compact metrics.

Keep the existing component name in this pass to reduce blast radius.

### `src/components/pet/sync/PetSyncStatusPanel.tsx`

Owns live WebBridge/Alife .NET status details:

- Lifecycle rail.
- Connection/package detail rows.
- Warning and error messaging.

### `src/components/pet/sync/WebBridgeMockStatusPanel.tsx`

Owns simulation content only. It should not appear as a peer of live sync status on the first screen.

### `src/components/pet/sync/syncStatusPresentation.ts`

Remains the single source for sync presentation mapping:

- Summary tones.
- Package-state tones.
- Lifecycle steps.
- Locale-key helpers.

## 7. Copy Requirements

All copy must be localized in:

- `messages/en.json`
- `messages/zh-CN.json`
- `messages/ja.json`

Required copy concepts:

- Sync command strip title.
- Next action emphasis.
- Diagnostics section title.
- Diagnostics section description.
- Live status vs simulation distinction.

All runtime-specific copy must say Alife .NET or Alife .NET 9.

## 8. Visual Specification

### Surfaces

- Prefer white cards on a quiet page background.
- Avoid heavy nested cards.
- Do not place a card inside another card unless the inner card is a repeated metric tile or a tool frame.
- Keep card radius at 8px or below unless the existing shared component requires otherwise.

### Typography

- Use compact dashboard typography.
- Page title can remain large.
- Panel titles should stay close to existing card-title scale.
- Metadata should be small and secondary.
- Do not use viewport-based font sizing.
- Do not use negative letter spacing.

### Actions

- Save remains the primary action.
- Refresh/open/confirm actions should be clear and icon-supported.
- Avoid text-only action clusters where icons already exist.
- Disabled actions need tooltip or explanatory text.

### State Color

- Success: applied/up to date.
- Warning: local confirmation required, staged waiting for human action.
- Processing: pending pull or active sync.
- Error: failed sync.
- Neutral: not published or unknown.

State color should support comprehension, not dominate the page.

## 9. Responsive Behavior

### Mobile

Order:

1. Header.
2. Sync command strip.
3. Live lifecycle panel.
4. Diagnostics collapsed.
5. Preview.
6. Config editor.

Requirements:

- No horizontal overflow.
- Button labels must fit or wrap cleanly.
- Metrics should use a one-column or two-column grid depending on available width.

### Desktop

Order:

1. Header.
2. Sync command strip.
3. Live lifecycle panel.
4. Diagnostics collapsed.
5. Preview/editor grid.

The sync area can use two-column layout if it improves scanability, but live status must remain more prominent than simulation content.

## 10. Testing Strategy

### Unit and Component Tests

Update focused tests:

- `PetRuntimeSummary.test.tsx`
- `PetSyncStatusPanel.test.tsx`
- `WebBridgeMockStatusPanel.test.tsx`
- `PetConfigPageSync.test.tsx`
- `syncStatusPresentation.test.ts`
- `PetSyncLocaleCopy.test.ts`

Test expectations:

- Live status appears before simulation.
- Diagnostics section is present and default-collapsed.
- Simulation labels remain visible after expanding diagnostics.
- Alife .NET wording is preserved.
- Next action remains visible for `confirmInDesktop`, `openDesktop`, and `refresh`.

### Regression Commands

Focused UI tests:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetRuntimeSummary.test.tsx src/components/__tests__/PetSyncStatusPanel.test.tsx src/components/__tests__/WebBridgeMockStatusPanel.test.tsx src/components/__tests__/PetConfigPageSync.test.tsx src/components/__tests__/syncStatusPresentation.test.ts src/components/__tests__/PetSyncLocaleCopy.test.ts
```

Existing WebBridge tests:

```powershell
npx jest --verbose --runInBand tests/unit/pet-service.test.ts tests/unit/test-integration-local.test.ts tests/unit/package-scripts.test.ts tests/unit/webbridge-package-service.test.ts
```

Typecheck:

```powershell
npm run typecheck
```

Build:

```powershell
$env:JWT_SECRET='local-build-only-pet-console-sync-first-uiux-secret'; $env:DATABASE_PATH='database/data.db'; npm run build
```

WebBridge staged-to-applied smoke, if `D:\Alife` is clean:

```powershell
$env:DOTNET_EXE='C:\Users\hu shu\.dotnet\dotnet.exe'; $env:ALIFE_ROOT='D:\Alife'; npm run check:webbridge:smoke
```

## 11. Success Criteria

The design is successful when:

- The first screen clearly prioritizes real WebBridge/Alife .NET sync status.
- The next action is obvious without reading raw state.
- Simulation content is available but not competing with live status.
- The page still supports preview and editing without extra navigation.
- The page reads closer to a clean product control surface: neutral, precise, high-confidence, and not visually dominated by warm amber tones.
- Focused UI tests, WebBridge regression tests, typecheck, build, and smoke verification pass where feasible.

## 12. Implementation Boundary

This spec should produce one focused implementation plan for `/dashboard/pet`.

Allowed files:

- `/dashboard/pet` page component.
- Pet sync UI components.
- Shared UI components only where required by this page.
- Pet sync locale messages.
- Focused tests for the affected page and components.

Excluded files:

- Alife .NET source.
- WebBridge protocol handlers unless a UI test reveals a presentation-contract bug.
- Prisma schema and migrations.
- Global site redesign files unless a tiny page-scoped token/helper is required.
