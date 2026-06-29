# WebBridge Sync Status UI/UX Design

Date: 2026-06-29

## Status

Approved design direction:

- First implementation slice: focused sync status loop only.
- Runtime language: Alife .NET 9 is the active local runtime.
- Experience goal: make WebBridge status readable as a safe operator workflow.
- Primary user question: "What has Web published, what has Alife .NET staged, and what has Alife .NET applied?"

This document is a design spec only. It does not authorize live Alife runtime calls, Web-triggered local activation, database schema changes, or Unity-side UX work.

## Context

The backend smoke loop now verifies the WebBridge staged-to-applied path with Alife .NET 9. The frontend already exposes useful status data on `/dashboard/pet`, but the current UI is still too close to internal fields:

- `packageState` appears as a raw enum.
- The difference between "published", "staged", and "applied" is not obvious.
- `confirmInDesktop` can look like a disabled Web action instead of a local Alife .NET responsibility.
- The preview chip can show long state labels in a compact area.
- The mock scenario panel is useful, but it must stay visually distinct from live status.

The next slice should improve comprehension without turning this into a full pet dashboard redesign.

## Scope

In scope:

- `src/components/pet/PetRuntimeSummary.tsx`
- `src/components/pet/sync/PetSyncStatusPanel.tsx`
- `src/components/pet/sync/PetDesktopStatusChip.tsx`
- `src/components/pet/sync/WebBridgeMockStatusPanel.tsx`
- `/dashboard/pet` sync-state copy and status usage in `src/app/(auth)/dashboard/pet/page.tsx`
- Translation keys needed by these components.
- Focused component regression tests.

Out of scope:

- No Alife code changes.
- No Unity references or Unity-side cleanup.
- No live desktop activation from Web.
- No database migrations.
- No full page redesign of the config editor, preview card, asset picker, or setup wizard.
- No site-wide component-library refactor in this slice.

## UX Principles

The UI should read like an operational control surface:

- Prefer current state and next action over raw implementation detail.
- Make the responsible side explicit: Web publishes; Alife .NET pulls, stages, and applies.
- Keep local confirmation as a safety boundary, not as a Web button that looks broken.
- Keep diagnostic codes available, but demote them below operator-facing labels.
- Preserve dense, scannable panel layouts.
- Keep visual language aligned with the existing Insta360-inspired baseline: restrained hierarchy, clean surfaces, consistent text scale, and no decorative gradients.

## State Model

The frontend should present the current `DesktopSyncStatus` states as an operator lifecycle:

1. Web published
2. Alife .NET staged
3. Alife .NET applied

State mapping:

- `pendingPull`: Web has a newer version waiting for Alife .NET to pull.
- `localConfirmationRequired`: Alife .NET has pulled or staged the package and needs local confirmation before apply.
- `upToDate`: Alife .NET applied the current Web version.
- `failed`: the sync loop failed; show recovery guidance and diagnostic detail.
- `desktopOffline`: Alife .NET has not recently reported status; show last known values and a refresh action.
- `unknown`: status is incomplete; show a neutral fallback and a refresh action.

## Component Design

### PetRuntimeSummary

`PetRuntimeSummary` should become the top-level answer to "what is happening now?"

It should show:

- A concise state label from `summaryKind`.
- A one-sentence next action that names the responsible side.
- Web version, Alife known version, Alife applied version, and local confirmation state.
- A refresh action only for states where checking again is meaningful.

Recommended copy examples:

- `pendingPull`: "Waiting for Alife .NET to pull the Web update."
- `localConfirmationRequired`: "Package staged locally. Confirm it in Alife .NET."
- `upToDate`: "Alife .NET is running the current Web version."
- `desktopOffline`: "Alife .NET is offline or has not reported recently."
- `failed`: "Review the sync error before retrying."

### PetSyncStatusPanel

`PetSyncStatusPanel` should become the detailed status panel.

It should show:

- A three-step lifecycle rail: `Web published`, `Alife staged`, `Applied`.
- The business label for package state.
- The raw package state code as secondary detail, not the primary value.
- Connection, versions, timestamps, and milestones in a compact diagnostic area.
- Error guidance with clear hierarchy:
  - title
  - recovery guidance
  - error code
  - technical detail

`confirmInDesktop` should render as a clear local-action notice:

- It may use an icon and disabled affordance, but copy must explain that confirmation happens in Alife .NET.
- It must not imply Web can directly apply the package.

### PetDesktopStatusChip

`PetDesktopStatusChip` should stay compact for preview surfaces.

Recommended visible labels:

- `upToDate`: "Synced"
- `pendingPull`: "Pending pull"
- `localConfirmationRequired`: "Confirm locally"
- `failed`: "Sync failed"
- `desktopOffline`: "Offline"
- `unknown`: "Unknown"

Tooltips can use fuller copy, but the chip itself should remain short to avoid narrow-layout overflow.

### WebBridgeMockStatusPanel

`WebBridgeMockStatusPanel` should remain on `/dashboard/pet`, but it must be unmistakably a simulation.

It should show:

- Title: "WebBridge package simulation" or equivalent localized text.
- Runtime: `Alife .NET 9`.
- Isolation: `No live Alife calls`.
- Scenario labels that use Alife .NET language instead of generic desktop wording.

The panel can keep the current scenario selector, metrics, steps, and failure-state chips. The improvement is copy, hierarchy, and clearer separation from live sync status.

## Copy Rules

Use these terms consistently:

- "Alife .NET" for the active runtime in live status copy.
- "Alife .NET 9" when naming the runtime version.
- "WebBridge" for the package/sync protocol.
- "local confirmation" for the apply safety boundary.

Do not use:

- Unity as an active runtime.
- "desktop" alone when it would be clearer to say Alife .NET.
- Raw enum names as primary user-facing copy.
- Copy that suggests Web can apply locally staged packages by itself.

## Testing

Use test-first implementation.

Focused tests should cover:

- `pendingPull` shows that Web has an update waiting for Alife .NET.
- `localConfirmationRequired` shows that the package is staged and needs Alife .NET local confirmation.
- `upToDate` shows that Alife .NET applied the current version.
- `failed` shows recovery guidance, error code, and technical detail.
- `PetDesktopStatusChip` uses compact labels for the preview surface.
- `WebBridgeMockStatusPanel` clearly identifies itself as simulation and still shows `Alife .NET 9` plus `No live Alife calls`.
- `/dashboard/pet` still renders the runtime summary, sync panel, and mock simulation panel.

Verification commands:

- Focused Jest for the pet sync components.
- `npm run typecheck`.
- `npm run build`.
- `npm run check:webbridge:smoke` when feasible, with `DOTNET_EXE` and `ALIFE_ROOT` set as in the existing smoke workflow.

## Self-Review

- No placeholders remain.
- Scope is limited to the first frontend sync-status UI/UX slice.
- Runtime language consistently uses Alife .NET / Alife .NET 9.
- Unity is explicitly out of scope and not treated as active.
- The design preserves the existing WebBridge safety boundary: Web can publish; Alife .NET applies only after local confirmation.
