# Page Header Consistency Design

Date: 2026-06-28

## Context

FOXD Web already has a shared `PageHeader` component at `src/components/layout/PageHeader.tsx`. It is used by `/dashboard` and `/admin`, but several high-traffic authenticated pages still hand-roll title and action rows with page-local markup. This creates inconsistent spacing, title color, action placement, breadcrumb behavior, and keyboard scan flow.

Alife .NET 9 is the active local runtime. This UI slice is frontend-only and must not call live Alife, start WebBridge integration, or modify the `alife-service` submodule.

## Goal

Make the first batch of high-traffic authenticated pages use the shared `PageHeader` page shell while preserving existing page behavior.

## In Scope

Migrate these pages to `PageHeader`:

- `/assets` via `src/app/(auth)/assets/page.tsx`
- `/marketplace` via `src/app/(auth)/marketplace/page.tsx`
- `/notifications` via `src/app/(auth)/notifications/page.tsx`
- `/settings` via `src/app/(auth)/settings/page.tsx`

For each page:

- Replace the hand-written title/action row with `PageHeader`.
- Move primary page actions into `PageHeader.actions`.
- Keep existing data fetching, filters, tabs, pagination, cards, and navigation behavior unchanged.
- Keep the visual scope small; do not perform broad theme migration in this slice.

## Out of Scope

- No Alife changes.
- No live WebBridge or package install integration.
- No `/dashboard/pet` refactor; that page combines sync status, mock install state, setup wizard, preview, and form workflows and should be handled as its own component-split slice.
- No marketplace category-tab URL persistence change.
- No sweeping dark/purple theme cleanup.
- No lint-warning cleanup beyond issues directly caused by this change.

## Recommended Approach

Use the existing `PageHeader` component directly rather than creating a new wrapper. This keeps the migration aligned with `/dashboard` and `/admin`, avoids another page-shell abstraction, and limits risk.

Page-specific behavior:

- `assets`: render `PageHeader` with the translated page title and move the upload button into `actions`; retain the hidden file input, search/filter row, and grid/list controls below the header.
- `marketplace`: render `PageHeader` with the translated page title and move the list-item button into `actions`; keep marketplace category `Tabs` in the page body because the active tab currently drives fetch params and page reset state.
- `notifications`: render `PageHeader` with the notification center title and move "mark all read" into `actions`; keep list rendering and optimistic read behavior unchanged.
- `settings`: render `PageHeader` with the settings title above existing settings tabs; do not migrate tabs into `PageHeader` in this pass because the current `Tabs` are local-only and render large tab bodies.

## Alternatives Considered

1. **Migrate every page with a hand-rolled title row now.**
   This would improve consistency faster, but it increases review size and risks mixing unrelated layouts such as seller, community, rigging, pet config, and marketplace detail pages.

2. **Create a new `OperationalPageShell` wrapper.**
   This might centralize layout further, but the codebase already has `PageHeader`. A second abstraction would be premature until repeated post-header shell patterns are clear.

3. **Move all page tabs into `PageHeader`.**
   `PageHeader` supports URL-persisted tabs, but marketplace and settings tabs currently carry page-local state and content assumptions. Moving them now would be a behavior change, not a page-shell-only cleanup.

## Testing

Use a small static regression test before production edits:

- Add a test that asserts the four scoped page files import and render `PageHeader`.
- Run it before implementation to confirm it fails on the current pages.
- Implement the smallest changes needed to make it pass.

Verification commands:

- Focused Jest test for the new static regression.
- Existing related page/component tests when present.
- `npm run typecheck`.
- ESLint on touched files.
- `npm run build` if feasible.
- `git diff --check`.

Existing lint warnings unrelated to this migration should be reported, not swept into this change.

## Acceptance Criteria

- The four scoped pages render `PageHeader`.
- Existing primary actions still work from the header action slot.
- Existing filters, tabs, pagination, navigation, and API paths remain unchanged.
- No Alife or WebBridge live integration is touched.
- Parent repo contains one focused commit for this spec and, after implementation approval, one focused implementation commit.

## Risks

- `PageHeader` auto-generates breadcrumbs from the current pathname. This may add breadcrumbs to pages that did not previously show them. This is acceptable because `/dashboard` and `/admin` already use the component, and the goal is consistent page shell behavior.
- Some target pages use older dark/purple classes below the title row. Those remain for a separate theme migration slice.
- Page-specific tests may be sparse, so the static regression test should be paired with typecheck/build.
