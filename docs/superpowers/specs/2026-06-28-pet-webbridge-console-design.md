# Pet WebBridge Console UI/UX Design

Date: 2026-06-28

## Status

Approved design direction:

- First implementation slice: `/dashboard/pet`.
- Experience goal: operator control-plane clarity.
- Layout direction: status-first console.
- System-level requirement: the whole FOXD Web UI component library and text styles must move toward one unified specification inspired by the current Insta360 CN site: <https://www.insta360.com/cn/>.

This document is a design spec only. It does not authorize live Alife runtime calls, local activation, or Unity-side UX work.

## Context

FOXD Web is the control plane. Alife .NET 9 is the active local runtime. Unity-side desktop pet work is deprecated.

The current `/dashboard/pet` page combines several workflows in one long component:

- page title and save/export actions
- runtime sync status
- WebBridge mock package install status
- setup wizard
- pet preview
- config editor tabs
- asset picker modal

The page already contains useful pieces, but the operational hierarchy is weak. A user can see many controls, but the page does not immediately answer:

- What is the current runtime state?
- What is the next safe action?
- Is WebBridge package validation separate from desktop runtime sync?
- Which actions are Web-only, and which require local Alife confirmation?

## Insta360-Inspired UI System Baseline

The site-wide UI direction should use Insta360 as a reference for discipline, not as a brand copy. We should not copy proprietary imagery, exact layout assets, or brand identity. The useful transferable rules are:

- restrained black/white/neutral base
- one confident accent color for primary commercial/action affordances
- large, clear product or workflow surfaces
- compact navigation and page headers
- strong title hierarchy
- generous whitespace around important decisions
- pill-shaped primary CTAs where the action is high confidence
- consistent typography scale and weight
- minimal decorative gradients
- dense but calm operational panels for product/control surfaces

Observed reference traits from the current Insta360 CN homepage:

- base body typography around 16px
- compact navigation text around 14px
- primary CTA buttons around 36px in the nav and 56px in major hero/product contexts
- heavy use of rounded pill CTAs, often with 50px to 100px border radius
- neutral text near black for light surfaces and white text on media/dark surfaces
- yellow accent used sparingly for primary purchase/action emphasis
- full-width hero/product sections and clean product cards

FOXD should adapt these as an enterprise control-plane system:

- primary accent remains mapped through FOXD tokens, not hard-coded Insta360 yellow everywhere
- buttons can use pill geometry for primary actions, but dense admin tables can keep compact rectangular controls where appropriate
- operational pages should avoid one-off purple/dark gradients and hard-coded colors
- all text should use a shared type scale instead of page-specific ad hoc sizes

## Site-Wide Component And Text Specification

This design establishes a UI baseline that future pages should follow.

### Typography

Use a shared scale:

- Display: 40-48px, weight 700, line-height 1.08, reserved for marketing or major preview pages.
- Page title: 28-32px, weight 700, line-height 1.15.
- Section title: 20-24px, weight 650-700, line-height 1.25.
- Card title: 16-18px, weight 600-650, line-height 1.35.
- Body: 14-16px, weight 400, line-height 1.55.
- Metadata: 12-13px, weight 400-500, line-height 1.4.
- Button text: 14-16px, weight 600.

Rules:

- No viewport-scaled font sizes.
- Letter spacing should stay at 0 for normal UI text.
- Use uppercase only for short labels, not paragraphs or action text.
- Page-level headings should not be used inside compact cards.

### Color And Surface Tokens

Prefer semantic tokens:

- `--text-primary`
- `--text-secondary`
- `--text-muted`
- `--bg-page`
- `--bg-card`
- `--bg-card-hover`
- `--border-subtle`
- `--accent`
- `--accent-contrast`
- status colors for success, warning, error, processing, neutral

Rules:

- Do not add new one-off purple/blue gradients for operational pages.
- Do not rely on `text-white`, `bg-[#...]`, or `border-purple-*` unless the page section explicitly requires a dark media surface.
- Cards and panels should use 8px radius unless an existing system component requires otherwise.
- Primary CTAs may use pill radius when they represent a clear top-level action.

### Components

The shared component library should converge on these primitives:

- `PageHeader`: title, subtitle, breadcrumb, actions, optional tabs.
- `StatusSummary`: high-signal state strip with current state, next action, versions, and confirmation guard.
- `OperationPanel`: card-like panel for live state, diagnostics, or validation.
- `MetricTile`: stable tile for version, count, status, or timestamp.
- `ReadinessStrip`: compact step/timeline row for setup or safety gates.
- `ConfigEditor`: form shell with predictable tabs and action placement.
- `PreviewPanel`: visual identity or product preview, not mixed with runtime status.
- `EmptyState`: short title, one-sentence body, one clear action.
- `StatusChip`: status text, color, and optional icon.

These primitives should be implemented incrementally. The first implementation slice should create or extract only the pieces required for `/dashboard/pet`.

## Pet/WebBridge Console Design

### Information Hierarchy

The `/dashboard/pet` page should become a status-first operating console:

1. `PageHeader`
   - Title: pet control plane.
   - Optional subtitle: Web prepares and validates configuration; Alife applies locally after confirmation.
   - Actions: export config, save config.

2. `PetRuntimeSummary`
   - Current state derived from `DesktopSyncStatus.summaryKind`.
   - Next action derived from `DesktopSyncStatus.primaryAction`.
   - Web config version.
   - Desktop applied version.
   - Local confirmation requirement.
   - Last sync timestamp when available.

3. Runtime and package panels
   - Left: live runtime sync status, based on existing `PetSyncStatusPanel`.
   - Right: mock-only WebBridge package validation, based on existing `WebBridgeMockStatusPanel`.
   - These must remain adjacent but visually distinct.

4. `PetSetupReadiness`
   - Compact replacement for the current long `Alert + Steps` wizard.
   - Shows readiness gates:
     - install Alife .NET runtime
     - connect/token ready
     - pull config
     - validate package
     - local confirmation
   - Can be dismissed locally.

5. Preview and editor
   - Left: `PetPreviewCard`, containing identity, model type, idle timeout, wander interval, avatar binding state.
   - Right: `PetConfigEditor`, containing current basic/model tabs and asset actions.

6. Asset picker modal
   - Keep existing modal behavior in this slice.
   - Improve only obvious spacing, empty state, and button wrapping if needed while touching the editor.

### Component Boundaries

The current `src/app/(auth)/dashboard/pet/page.tsx` should stop owning all rendering detail. It should own orchestration:

- fetch config
- fetch sync status
- save config
- export config
- open asset picker
- pass state and handlers to focused child components

New or extracted components should live under `src/components/pet/`:

- `PetRuntimeSummary.tsx`
- `PetSetupReadiness.tsx`
- `PetPreviewCard.tsx`
- `PetConfigEditor.tsx`

Existing components to preserve and lightly align:

- `PetSyncStatusPanel.tsx`
- `WebBridgeMockStatusPanel.tsx`

No new state management library should be introduced.

## Data Flow

Data sources remain unchanged:

- `GET /api/pet/config`
- `PUT /api/pet/config`
- `GET /api/pet/export`
- `GET /api/pet/sync/status`
- `GET /api/pet/assets?type=...`
- `POST /api/pet/assets`

`WebBridgeMockStatusPanel` remains local-only:

- scenario switching must not call `fetch`
- failure scenarios remain mock inspection states
- no activation/apply action is added

`PetRuntimeSummary` should derive display state from existing `DesktopSyncStatus`:

- `summaryKind`
- `desktopConnection`
- `webConfigVersion`
- `desktopAppliedVersion`
- `requiresLocalConfirmation`
- `lastSyncAt`
- `lastAppliedAt`
- `lastError`
- `primaryAction`

## Error Handling

Runtime status errors:

- Show the high-level error title first.
- Show recovery text when available.
- Keep technical code available in a subdued code chip.

Config save/export errors:

- Preserve existing message behavior.
- Do not hide errors behind the summary strip.

Package mock errors:

- Continue showing `401 package file`, `PACKAGE_HASH_MISMATCH`, and `PACKAGE_SECURITY_BLOCKED`.
- Make it explicit that these are local mock scenarios and do not invoke Alife.

## Responsive Behavior

Desktop:

- Summary strip spans full width.
- Runtime sync and package validation use a two-column grid.
- Preview and editor use a two-column grid with preview around 320-360px.

Tablet:

- Runtime/package panels may stack if content starts to compress.
- Preview may move above editor.

Mobile:

- Header actions wrap under the title.
- Summary tiles become one column or two compact columns.
- Steps/readiness labels must wrap without overlapping.
- Forms and asset buttons stack.

## Testing And Verification

Required verification for the implementation slice:

- focused tests for new/extracted pet UI components where practical
- existing WebBridge mock test that scenario switching does not call `fetch`
- `npx prettier --check` for touched files
- focused Jest tests covering touched components/routes
- `npm run build`

Recommended visual verification:

- screenshot review of `/dashboard/pet` at desktop width
- screenshot review of `/dashboard/pet` at mobile width
- confirm no text overlap, no clipped action buttons, and no layout jumps between mock scenarios

Integration guardrails:

- Do not start or restart active Alife runtime.
- Do not write default Alife Runtime/Storage.
- Do not call WebBridge activation/apply.
- Keep WebBridge package validation mock-only unless a later isolated smoke phase is explicitly started.

## Non-Goals For This Slice

- No marketplace redesign.
- No assets page redesign.
- No settings/admin redesign.
- No global Ant Design theme replacement.
- No live Alife activation UI.
- No Unity runtime UX.
- No broad lint cleanup unrelated to touched files.

## Rollout Plan

This design should be implemented in two layers:

1. Establish the site-wide UI specification in code where needed by `/dashboard/pet`:
   - typography usage
   - tokenized surfaces
   - consistent panel/card/action patterns

2. Apply the first slice to `/dashboard/pet`:
   - component extraction
   - status-first layout
   - runtime/package separation
   - readiness strip
   - responsive polish

Future UI work should use this spec as the baseline for migrating other pages toward a unified component library and text system.
