# FOXD Web Frontend UI/UX Audit

Date: 2026-06-28

## Current Direction

FOXD Web is the control plane. Alife .NET 9 is the active local runtime. Unity-side desktop pet work is deprecated. The WebBridge UI should make that split obvious: Web can prepare, validate, and publish package state, while activation stays guarded by local confirmation.

This audit intentionally avoids live Alife calls because Alife has a separate long-running task in progress. The current UI work uses mock state only.

## Completed In This Pass

- Upgraded the WebBridge package install mock panel from a static card into a mock scenario workbench.
- Added local-only scenario switching for:
  - `pendingActivation`
  - `401 package file`
  - `PACKAGE_HASH_MISMATCH`
  - `PACKAGE_SECURITY_BLOCKED`
- Kept the isolation contract visible with `No live Alife calls`.
- Tokenized the WebBridge mock panel surface so it follows the current warm light theme variables.
- Tokenized the pet dashboard title, setup wizard, preview card, config card, and empty asset state to reduce old dark-purple visual drift.
- Added tests proving scenario switching does not call `fetch`.

## High-Value Optimization Points

1. Theme consistency

   Many pages still mix old dark-purple classes such as `text-white`, `border-purple-500/10`, `bg-[#09090F]`, and purple-to-blue gradients with the newer warm token system in `globals.css`. This is the largest visual consistency gap.

2. Page shell consistency

   `PageHeader` exists and is used by dashboard/admin, but many high-traffic pages still hand-roll title/action rows. Migrating pages like assets, marketplace, settings, notifications, and pet config to the same header pattern would improve scanability and keyboard flow.

3. Ant Design 6 deprecation cleanup

   Remaining known deprecated usages include:
   - `Space direction="vertical"` in `VoiceCloningWizard`, `ModelPreview`, and `RiggingUpload`
   - `Alert message=` in seller payment

   These should be changed to `orientation` and `title` to keep test output clean.

4. Pet dashboard density

   The pet config page still contains several unrelated workflows in one long component: sync status, mock install workbench, setup wizard, preview, config form, and asset picker. Splitting these into focused components would make future UI changes safer.

5. WebBridge information architecture

   The current WebBridge mock is useful for inspection, but the next user-facing step should separate "runtime sync status" from "package install validation" as two related but distinct sections. This prevents users from confusing online/offline desktop state with package integrity state.

6. Accessibility and responsive review

   Several card grids and tables should be checked at mobile widths for text wrapping, action overflow, and focus order. The WebBridge mock panel now uses stable grid tracks, but marketplace/assets/admin surfaces still need a pass.

7. React lint warning cleanup

   `npm run lint` currently exits successfully but reports hundreds of warnings, including repeated `react-hooks/set-state-in-effect` patterns in admin/assets/pet pages and many unused imports/variables in tests and scripts. These are not blocking the current UI slice, but they reduce signal during frontend work.

## Recommended Next UI/UX Slices

1. Pet/WebBridge polish

   Extract the pet setup wizard and preview card into small components, then align them with the same tokenized surface treatment as the mock workbench.

2. AntD 6 cleanup

   Remove the remaining deprecated props and run the affected focused tests. This is low-risk and should reduce warning noise before bigger visual changes.

3. Theme migration

   Start with authenticated operational pages: assets, marketplace list/detail, settings, notifications. Replace hard-coded dark/purple classes with CSS variables or shared layout components.

4. Visual verification

   Add a Playwright screenshot pass for `/dashboard/pet` once authentication/test session setup is reliable. Verify desktop and mobile widths before broadening the visual migration.

5. Lint signal cleanup

   Start with touched/high-traffic UI files and remove unused imports, then decide whether the React hook warnings should be fixed or configured differently. Avoid sweeping auto-fix commits that mix UI changes with behavior changes.

## Guardrails

- Do not call live Alife while the current Alife task is running.
- Keep WebBridge mock controls local-only until isolated smoke testing is explicitly started.
- Use `D:\tmp\alife-webbridge-integration` only for later isolated smoke tests.
- Do not revive Unity-side runtime UX.
