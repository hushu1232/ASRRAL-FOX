# Desktop Pet Sync Experience Design

Date: 2026-06-27
Scope: `avatar-web-management` and the Alife WebBridge contract

## Goal

Make the desktop pet sync journey understandable and recoverable for a user:

1. The user edits pet settings in the Web management app.
2. The Web app saves the configuration.
3. The desktop client discovers or pulls the latest WebBridge package.
4. The desktop client validates the package and stages it for local confirmation.
5. The user confirms locally, and both sides show that the desktop pet is running the latest applied version.

The current implementation already has the package manifest, file endpoint, pet config persistence, and sync route. This design adds the user-facing state layer that explains what happened after a save or sync action.

## Non-Goals

- Do not redesign the whole dashboard.
- Do not change marketplace, payment, community, or seller workflows.
- Do not auto-apply packages silently. The current manifest policy requires local confirmation, and this remains intentional.
- Do not require a public cloud push channel in this pass. Polling and explicit refresh are acceptable for the first implementation.

## User Experience

### Pet Settings Status Panel

Add a compact status panel near the top of the pet settings page. It should show:

- Desktop connection state: online, offline, checking, unknown.
- Web config save state: saved, saving, failed.
- Package state: latest package version, pending desktop pull, pending local confirmation, applied.
- Last desktop sync time.
- Last applied version on desktop.
- One primary action based on the current state.

Example states:

- "Desktop online. Version 12 is waiting for local confirmation."
- "Desktop offline. Last sync was 18 minutes ago."
- "Web config saved, but the desktop has not pulled this version yet."
- "Package validation failed. Open details for repair steps."

The panel should separate "saved on Web" from "applied on desktop". A successful save must not imply that the live desktop pet changed.

### First-Run Wizard

Convert the existing static setup wizard into state-aware steps:

1. Detect desktop client.
2. Connect or refresh WebBridge credentials.
3. Choose character, model, and voice basics.
4. Save and publish the current package.
5. Confirm locally in Alife.
6. Verify applied desktop version.

Each step should have a clear done, active, blocked, or skipped state. The wizard can remain dismissible, but dismissing it should not hide the persistent status panel.

### Error Details

User-facing errors should include:

- Short explanation: what failed.
- Recovery action: what to try next.
- Technical detail: error code, request id, hash mismatch detail, or route name.

Examples:

- `WEBBRIDGE_OFFLINE`: "Desktop client is not reachable. Start Alife and click Check again."
- `PACKAGE_HASH_MISMATCH`: "The downloaded package did not match the manifest. Re-download the package."
- `LOCAL_CONFIRMATION_REQUIRED`: "The desktop has staged the update. Confirm it in Alife to apply."
- `PACKAGE_APPLY_FAILED`: "Alife could not apply the staged package. Open desktop logs for details."

## Architecture

### Web App State

Introduce a small WebBridge sync status model in the Web app. It should represent status from the user's perspective rather than leaking internal installer steps.

Suggested fields:

- `desktopConnection`: `unknown | checking | online | offline`
- `webConfigVersion`: string or number
- `desktopKnownVersion`: string or number or null
- `desktopAppliedVersion`: string or number or null
- `packageState`: `notPublished | published | pulled | staged | applied | failed`
- `requiresLocalConfirmation`: boolean
- `lastSyncAt`: ISO timestamp or null
- `lastAppliedAt`: ISO timestamp or null
- `lastError`: structured error object or null

The Web app can initially derive part of this state from existing config/package data. Desktop-reported fields require a small WebBridge callback or status endpoint.

### Web API Surface

Add or reserve a status route for the Web UI:

- `GET /api/pet/sync/status`: returns the current user-facing sync status.

Add or reserve a desktop reporting route:

- `POST /api/pet/sync/status`: accepts desktop-reported pull/stage/apply status for the authenticated desktop session.

If the desktop client cannot authenticate to the Web app yet, the first implementation can keep this behind the existing auth path and use a dev-only/manual contract test. The model should still be shaped so a desktop token can be added without changing the UI.

Existing routes remain:

- `GET /api/pet/sync`
- `POST /api/pet/sync`
- `GET /api/webbridge/packages/:id/manifest`
- `GET /api/webbridge/packages/:id/files/:fileId`

### Desktop Contract

The Alife WebBridge installer should report these milestones:

- Manifest fetched.
- Files downloaded.
- Hash validation passed or failed.
- Package staged.
- Local confirmation requested.
- Package applied.
- Package rejected or failed.

The current package manifest keeps:

- `autoApply: false`
- `requiresLocalConfirmation: true`

The Web UI must reflect that policy rather than showing a generic "synced" success too early.

## Data Flow

### Save And Publish

1. User saves pet config.
2. Web API persists config and increments or exposes the current config version.
3. Web UI refreshes sync status.
4. Status panel shows Web saved and desktop pending pull if the desktop has not reported the version.

### Desktop Pull

1. Desktop requests the current package manifest.
2. Desktop downloads files.
3. Desktop validates hashes.
4. Desktop stages the package.
5. Desktop reports staged status to Web.
6. Web UI shows local confirmation required.

### Local Confirmation

1. User confirms in Alife.
2. Desktop applies the staged package.
3. Desktop reports applied version and timestamp.
4. Web UI shows desktop applied and up to date.

## UI Placement

The first pass should touch only the pet-related path:

- Pet settings page: primary sync status panel and wizard improvements.
- Pet preview page: small note or status chip distinguishing Web preview from desktop-applied state.
- Optional global indicator: only show critical desktop sync problems, not every background state.

This keeps the experience close to where users make changes.

## Failure Handling

Required recovery paths:

- Desktop offline: show last successful sync and a Check again button.
- Manifest unavailable: show retry and route-level error details.
- File download failed: show retry and package id/file id.
- Hash mismatch: require re-download and do not stage.
- Path traversal or invalid package: show blocked security error and do not offer apply.
- Local confirmation pending: show that the update is waiting in Alife.
- Apply failed: show desktop error details if reported; otherwise show a generic desktop failure with log guidance.

## Testing

### Unit Tests

- Sync status model maps raw Web/Desktop states to user-facing panel states.
- Error codes map to user-facing messages and recovery actions.
- Package policy with `requiresLocalConfirmation` displays staged/pending confirmation rather than applied.

### Contract Tests

- `GET /api/pet/sync/status` returns stable status shape.
- `POST /api/pet/sync/status` accepts known desktop milestones and rejects invalid transitions.
- Existing package manifest tests continue to verify hash, file URL, and activation policy.

### UI Tests

- Pet settings page shows desktop offline state.
- After save, UI shows Web saved but desktop pending pull.
- Staged package shows local confirmation required.
- Applied version shows up to date.
- Failure state exposes retry and technical details without overflowing the layout.

### Manual Runtime Check

Run a real chain once the desktop endpoint exists:

1. Start Web management app.
2. Start Alife desktop client.
3. Save a pet config.
4. Confirm desktop pulls and stages the package.
5. Confirm local apply in Alife.
6. Confirm Web UI shows applied version and timestamp.

## Rollout Plan

1. Implement the Web status model and UI panel with mocked/derived status.
2. Add API route contract for sync status.
3. Wire desktop reporting when the Alife side is ready.
4. Upgrade the setup wizard to use real status.
5. Add browser tests around the pet settings states.

This order gives immediate UX clarity without blocking on the full desktop callback implementation.

## Open Decisions

The following decisions are fixed for this pass:

- The desktop still requires local confirmation before applying.
- The first UI surface is the pet settings page.
- The Web preview does not claim desktop parity unless desktop applied status confirms it.
- A polling/status route is sufficient for the first implementation.

No unresolved placeholder requirements remain in this design.
