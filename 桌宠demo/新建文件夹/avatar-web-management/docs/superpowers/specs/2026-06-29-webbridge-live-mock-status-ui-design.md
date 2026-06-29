# WebBridge Live/Mock Status UI Design

Date: 2026-06-29
Scope: `avatar-web-management` pet dashboard WebBridge status area

## Goal

Make the WebBridge area on the desktop pet settings page clearly separate verified live status from mock/package-simulation status.

The current Alife .NET 9 integration has verified staging milestones through `/api/pet/sync/status`. It does not implement local apply/activation yet. The UI must therefore show `staged` and `localConfirmationRequired` as a real live state, while avoiding any wording or action that implies Web can apply the package directly.

## Non-Goals

- Do not redesign the whole pet dashboard.
- Do not add Web-to-Alife activation.
- Do not start or depend on a live Alife runtime from the browser.
- Do not change the WebBridge API contract in this pass.
- Do not begin the full site-wide Insta360-style component/text-system unification yet.

## UX Direction

Use the existing two-panel layout, but make each panel's data source explicit:

- The left/live panel is the authoritative state from `/api/pet/sync/status`.
- The right/mock panel is a local simulation of package install scenarios.

For the smoke-tested live state, the user should see:

- Source: live API.
- Package state: `staged`.
- Summary: local confirmation required.
- Primary next action: confirm inside Alife.
- Confirmation action is displayed as a desktop-side action, not as a Web button that performs activation.
- Milestones show the desktop-reported staging path when available.

The mock panel should stay useful for UI review and failure-state QA, but it must not look like runtime evidence. Its labels should say simulation/mock, and its isolation tile should continue to state that it does not call live Alife.

## Architecture

Keep the current component boundaries:

- `PetConfigPage` fetches `/api/pet/config` and `/api/pet/sync/status`.
- `PetRuntimeSummary` remains the compact top summary.
- `PetSyncStatusPanel` renders live status details from `DesktopSyncStatus`.
- `WebBridgeMockStatusPanel` renders static mock scenarios only.

Add small display-only enhancements instead of new data fetching:

- Live source tag in `PetSyncStatusPanel`.
- Package state, known version, and milestones in `PetSyncStatusPanel`.
- Disabled desktop-confirm action for `confirmInDesktop`.
- Mock/simulation source wording and current local smoke root in `WebBridgeMockStatusPanel`.

## Error Handling

If status is unavailable, keep the existing warning and refresh action.

If `lastError` is present, keep the existing error block. Do not hide technical details because this panel is used for local integration debugging.

If milestones are absent, show a neutral empty value instead of inventing package progress.

## Testing

Use focused component tests first:

- `PetSyncStatusPanel` should render live source, `staged`, known/applied versions, and reported milestones.
- `PetSyncStatusPanel` should show the confirm-in-desktop action as disabled/local-only, not as an active Web apply button.
- `WebBridgeMockStatusPanel` should render mock/simulation source wording and the current ignored smoke root.
- `PetConfigPage` should still fetch config first, then sync status, and should show both live and mock status areas without extra API calls.

Run focused Jest tests, then typecheck/build where feasible.

## Rollout

This is a narrow UX clarity pass. After it lands, the next UI/UX pass can expand into broader component/text-style unification across the Web platform.

This design has no open requirements.
