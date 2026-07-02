# Pet WebBridge Diagnostics Experience Design

> Date: 2026-07-02
> Scope: `/dashboard/pet`
> Runtime: Alife .NET 9
> Status: Design spec

## 1. Goal

Improve the WebBridge integration diagnostics experience on `/dashboard/pet` without changing the WebBridge protocol, Alife .NET, or backend persistence.

The page is already sync-first. This follow-up should make the real integration state easier to diagnose during local Alife .NET integration testing while preserving the clean first-screen operator experience.

The user should be able to answer two different levels of questions:

1. Operator view: What is the current state, and what should I do next?
2. Developer diagnostics view: What evidence explains why the package is waiting, applied, offline, or failed?

## 2. Non-Goals

- Do not change WebBridge route handlers or package protocol behavior.
- Do not change Alife .NET source code.
- Do not add Prisma schema changes or migrations.
- Do not revive, mention, or depend on Unity as an active runtime.
- Do not add one-click local command execution from the browser.
- Do not add a real Alife .NET heartbeat probe unless it already exists in the current `DesktopSyncStatus` payload.
- Do not add a manifest network preflight probe in this pass.
- Do not redesign the full website or global UI system.

## 3. Product Direction

Use a two-layer experience:

1. The first screen stays operator-focused.
2. The default-collapsed diagnostics section becomes developer-focused.

This keeps the recently completed sync-first hierarchy intact:

1. `PageHeader`
2. `PetRuntimeSummary`
3. `PetSyncStatusPanel`
4. `PetDiagnosticsSection`
5. `PetSetupReadiness`
6. `PetPreviewCard` and `PetConfigEditor`

The live status remains first. Simulation remains available, but it should never appear before live diagnostic evidence when diagnostics is expanded.

## 4. Component Model

### `PetRuntimeSummary`

This remains the operator command strip.

Responsibilities:

- Current high-level state.
- Next action.
- Desktop-only action guidance.
- Compact version/local-confirmation metrics.

It should not show raw state dumps, technical error details, smoke command text, or manifest/debug evidence.

### `PetSyncStatusPanel`

This remains the live status and lifecycle panel.

Responsibilities:

- Live WebBridge status source.
- Lifecycle rail.
- Operator-readable state explanation.
- Current package state label and description.
- Warning/error notices when user action is required.

It can become slightly clearer, but it should not become the full developer diagnostic surface.

### New `PetSyncDiagnosticsPanel`

Create a new diagnostics-only component inside `PetDiagnosticsSection`.

Responsibilities:

- Consume `DesktopSyncStatus | null` and `loading`.
- Render read-only diagnostic evidence.
- Explain the current blocking reason.
- Map live status to the staged-to-applied smoke expectation.
- Show errors, milestones, timestamps, and version differences.

It must not:

- Fetch data.
- Mutate state.
- Trigger package apply/confirm.
- Execute local shell commands.
- Call Alife .NET directly.

### `PetDiagnosticsSection`

This remains the default-collapsed container.

Expanded order:

1. `PetSyncDiagnosticsPanel`
2. `WebBridgeMockStatusPanel`

This keeps live evidence before simulation even inside diagnostics.

### `WebBridgeMockStatusPanel`

This remains simulation-only.

It should continue to signal:

- Simulation only.
- No live Alife calls.
- Alife .NET 9 context.

## 5. Diagnostics Content

### 5.1 Integration Snapshot

Show a compact grid of current live values:

- Web package version.
- Alife known version.
- Alife applied version.
- Package state.
- Desktop connection.
- Local confirmation.

Add a short version-alignment interpretation derived from existing values:

- Web newer than known/applied: Alife .NET has not pulled the newest package.
- Known equals Web but applied lags: Alife .NET knows or staged the package but has not applied it.
- Applied equals Web and status is up to date: package is current.
- Missing desktop versions: Alife .NET has not reported enough version evidence yet.

The component should not invent values that are not present in `DesktopSyncStatus`.

### 5.2 Blocking Reason

Translate `summaryKind` and `primaryAction` into a developer-readable reason.

Expected mappings:

- `pendingPull`: waiting for Alife .NET to pull the Web package.
- `localConfirmationRequired`: package is staged locally and must be confirmed inside Alife .NET.
- `desktopOffline`: Alife .NET is offline or has not reported recently.
- `failed`: package sync failed; inspect error details before retrying.
- `upToDate`: applied and current; no blocking reason.
- `unknown`: status is incomplete; wait for Alife .NET to report again.

This should be shown as an `Alert` or similarly prominent status row, using existing state tones.

### 5.3 Evidence Trail

Render the evidence already available in `DesktopSyncStatus`:

- `lastSyncAt`
- `lastAppliedAt`
- `milestones`
- `lastError.code`
- `lastError.message`
- `lastError.technicalDetail`
- `errorMessage.title`
- `errorMessage.recovery`

Empty states:

- If there are no milestones: "No milestones reported yet."
- If there is no live error: "No live error reported."
- If timestamps are missing or invalid: use the existing "never" style copy.

The UI should not hide technical error information inside failed states; failed states are exactly when the diagnostic panel should be useful.

### 5.4 Smoke Mapping

Show a read-only reference that links page states to the local staged-to-applied smoke verification.

Expected staged state:

```text
WebStatus: staged/localConfirmationRequired/confirmInDesktop
```

Expected applied state:

```text
WebStatus: applied/upToDate/none/requiresLocalConfirmation=false
```

Recommended local command text:

```powershell
$env:DOTNET_EXE='C:\Users\hu shu\.dotnet\dotnet.exe'; $env:ALIFE_ROOT='D:\Alife'; npm run check:webbridge:smoke
```

This command must be displayed as text only. Do not add a browser button that executes it.

## 6. Visual Design

Use the existing product-calm dashboard style:

- White/light-gray surfaces.
- Clear dark text hierarchy.
- Compact dashboard typography.
- No marketing hero.
- No decorative graphics.
- No nested card stacks.

Suggested structure:

- `OperationPanel` title: "Live WebBridge diagnostics".
- A "Live data" chip in the title area or header line.
- `Integration snapshot`: compact `MetricTile` grid.
- `Blocking reason`: `Alert`.
- `Evidence trail`: `Descriptions` and `Tag` rows.
- `Smoke mapping`: short code/text blocks.

Use existing shared UI primitives where possible:

- `OperationPanel`
- `MetricTile`
- `StatusChip`
- Ant Design `Alert`, `Descriptions`, `Space`, `Tag`, `Typography`

Do not add a new design system or global token migration.

## 7. Copy And Localization

All new user-facing copy must exist in:

- `messages/en.json`
- `messages/zh-CN.json`
- `messages/ja.json`

All runtime-specific copy must say:

- Alife .NET
- Alife .NET 9

Do not refer to Unity as an active runtime.

Suggested copy namespaces:

- `pet.syncDiagnostics.title`
- `pet.syncDiagnostics.liveData`
- `pet.syncDiagnostics.integrationSnapshot`
- `pet.syncDiagnostics.blockingReason`
- `pet.syncDiagnostics.evidenceTrail`
- `pet.syncDiagnostics.smokeMapping`
- `pet.syncDiagnostics.noMilestones`
- `pet.syncDiagnostics.noLiveError`
- `pet.syncDiagnostics.versionAlignment.*`
- `pet.syncDiagnostics.blocking.*`
- `pet.syncDiagnostics.smoke.*`

The exact key shape can be refined in the implementation plan, but the namespace should stay under `pet` and should not reuse simulation copy.

## 8. Testing Strategy

Add focused component coverage for the new diagnostics panel:

- `PetSyncDiagnosticsPanel.test.tsx`

Test cases:

- `pendingPull` shows waiting-for-Alife-pull blocking reason.
- `localConfirmationRequired` shows local Alife .NET confirmation blocking reason.
- `failed` shows error code, recovery, and technical detail.
- `upToDate` shows no blocking reason and applied/current interpretation.
- Missing milestones show "No milestones reported yet."
- Missing error shows "No live error reported."
- Smoke mapping text and command are rendered as read-only text.

Update page-level coverage:

- `PetConfigPageSync.test.tsx`

Expectations:

- Diagnostics remain default-collapsed.
- After expanding diagnostics, live diagnostics appear before simulation.
- Simulation labels remain visible after expansion.

Update locale coverage:

- `PetSyncLocaleCopy.test.ts`

Expectations:

- Required diagnostics copy exists in English, Simplified Chinese, and Japanese.
- Runtime naming stays Alife .NET / Alife .NET 9.

Regression commands should include:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetSyncDiagnosticsPanel.test.tsx src/components/__tests__/PetConfigPageSync.test.tsx src/components/__tests__/PetSyncLocaleCopy.test.ts
```

Full focused UI regression should still include:

```powershell
npx jest --verbose --runInBand src/components/__tests__/PetRuntimeSummary.test.tsx src/components/__tests__/PetSyncStatusPanel.test.tsx src/components/__tests__/WebBridgeMockStatusPanel.test.tsx src/components/__tests__/PetConfigPageSync.test.tsx src/components/__tests__/PetDiagnosticsSection.test.tsx src/components/__tests__/PetSyncDiagnosticsPanel.test.tsx src/components/__tests__/syncStatusPresentation.test.ts src/components/__tests__/PetSyncLocaleCopy.test.ts
```

Keep the existing WebBridge regression, typecheck, build, and smoke verification sequence after implementation.

## 9. Success Criteria

The work is successful when:

- `/dashboard/pet` still keeps live sync state before diagnostics, preview, and editing.
- Diagnostics remain default-collapsed.
- Expanded diagnostics show live diagnostic evidence before package simulation.
- Developers can see why a package is pending, awaiting local confirmation, applied, offline, failed, or unknown.
- Failed states expose useful error evidence without requiring source-code inspection.
- The smoke staged/applied expectations are visible as read-only reference text.
- No browser action executes local commands.
- No protocol, Alife .NET, Prisma, Unity, or WebBridge handler changes are required.
- Focused Jest, WebBridge regression Jest, typecheck, build, and feasible smoke verification pass.

## 10. Implementation Boundary

Allowed files:

- `src/app/(auth)/dashboard/pet/page.tsx`
- `src/components/pet/sync/PetSyncDiagnosticsPanel.tsx`
- `src/components/pet/sync/PetDiagnosticsSection.tsx` only if container spacing/order needs a small adjustment.
- `src/components/pet/sync/PetSyncStatusPanel.tsx` only for small copy/placement refinements.
- `src/components/__tests__/PetSyncDiagnosticsPanel.test.tsx`
- `src/components/__tests__/PetConfigPageSync.test.tsx`
- `src/components/__tests__/PetSyncLocaleCopy.test.ts`
- `messages/en.json`
- `messages/zh-CN.json`
- `messages/ja.json`
- Optional docs/runbook updates if the implementation plan includes them.

Excluded files:

- `D:\Alife`
- `D:\FOXD\alife-service`
- Prisma schema or migrations
- WebBridge protocol handlers
- Unity-related paths
- Global design token files
