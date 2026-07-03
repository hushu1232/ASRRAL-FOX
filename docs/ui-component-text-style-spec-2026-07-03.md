# FOXD UI Component And Text Style Specification - 2026-07-03

## Goal

Normalize FOXD Web UI/UX in small, reviewable batches without changing protocol behavior, Prisma schema, WebBridge routes, Alife source, or global design tokens during the first UI pass.

The approved local direction is **Operator Console, Polished**:

- Keep FOXD work-focused, dense enough for repeated use, and easy to scan.
- Use `/dashboard/pet` as the first reference surface because it is already sync-first and live diagnostics are read-only.
- Treat WebBridge state, asset status, forms, and repeated lists as operational evidence surfaces, not marketing pages.
- Use media-rich presentation only where users inspect an avatar, asset, product, or model.
- Prefer small, consistent improvements over a full visual reset.

This specification defines rules for upcoming UI source changes under:

```text
D:\FOXD\桌宠demo\新建文件夹\avatar-web-management\src
```

The current validated baseline before writing this spec:

```text
npm run test -- --runInBand: 93 suites, 903 tests passed
npm run typecheck: passed
npm run build: passed
```

Known baseline console warnings include existing React `act(...)` warnings and jsdom canvas/WebGL not-implemented messages in component tests. They are not introduced by this documentation-only spec.

## Reference Principles

The external visual reference reviewed for transferable principles was:

```text
https://www.insta360.com/cn/
```

Observed transferable principles:

- **Product-first composition:** the primary object or task is visible immediately, with supporting controls secondary.
- **Large clean media areas:** when the user needs to inspect a product, asset, model, or preview, give the media area stable dimensions and enough whitespace.
- **Strong contrast:** use clear black/white or high-contrast neutral surfaces before adding accents.
- **Restrained accent use:** reserve accent color for the selected state, primary call to action, or important status.
- **Clear hierarchy:** separate hero/title, section title, body copy, metadata, status, and controls by size, weight, spacing, and position.
- **Polished feedback:** loading, hover, active, disabled, empty, error, and success states should clarify what is happening without visual noise.

Do not copy Insta360 assets, copywriting, product layouts, brand marks, visual effects, or page structure. FOXD is a control plane, not a product landing page. Transfer only the discipline: prominent subject, quiet surfaces, readable hierarchy, and deliberate state feedback.

## Component Rules

Use existing local primitives before creating new ones:

- `PageHeader` for page title, subtitle, page actions, breadcrumbs, and tabs.
- `OperationPanel` for a single bounded operational surface.
- `MetricTile` for compact evidence values, versions, counters, and state facts.
- `StatusChip` for semantic state labels.
- Ant Design `Button`, `Input`, `Select`, `Table`, `Tabs`, `Descriptions`, `Steps`, `Alert`, `Modal`, `Tooltip`, and `Spin` for standard interactions.

Panel rules:

- Use `OperationPanel` for one coherent task or evidence group.
- Do not put UI cards inside other UI cards.
- Do not style full page sections as floating decorative cards.
- Keep panel radius at `var(--ds-panel-radius)` or 8px unless an existing component already enforces a smaller radius.
- Use `MetricTile` inside panels for repeated facts, but do not nest `OperationPanel` inside `OperationPanel`.
- Use stable grid tracks such as `repeat(auto-fit, minmax(var(--ds-panel-gridMinWidth), 1fr))` for metric and evidence groups.

Control rules:

- Use icon buttons for compact tool actions when the icon is standard and a tooltip or accessible label is present.
- Use icon plus text for primary commands whose label matters, such as save, export, refresh, upload, browse, attach, and open.
- Use segmented controls or paired buttons for mode switches such as grid/list view.
- Use checkboxes or switches for binary options.
- Use sliders, steppers, or numeric inputs for numeric settings.
- Use menus or selects for finite option sets.
- Disabled buttons must communicate why with tooltip text, adjacent helper text, or panel copy.

Status rules:

- Use `StatusChip` for stable semantic state. Avoid ad hoc colored `Tag` usage for sync status, package status, and connection state.
- Semantic tones should be consistent:
  - `success`: current, applied, reachable, complete.
  - `warning`: needs confirmation, pending action, stale, partial.
  - `error`: failed, blocked, invalid.
  - `processing`: checking, uploading, in progress.
  - `neutral`: unknown, inactive, not reported.
- Do not use decorative gradients for status. State must be readable without relying on color alone.

Icon rules:

- Use `@ant-design/icons` because this app already uses Ant Design icons.
- Do not hand-draw SVG icons when an Ant Design icon already matches the command.
- Provide `aria-label` for icon-only controls.
- Provide `Tooltip` for icon-only controls unless the surrounding label already makes the meaning explicit.

## Text Scale

Use a tight operational text hierarchy:

| Role | Token or class | Use |
| --- | --- | --- |
| Page title | `text-2xl font-bold` or `var(--ds-type-pageTitle-size)` | One per page in `PageHeader`. |
| Subtitle | `text-sm` with `var(--text-secondary)` | One short sentence under a page title. |
| Section title | `var(--ds-type-sectionTitle-size)` or Ant Design card title | Panel-level task or evidence group. |
| Card title / key value | `var(--ds-type-cardTitle-size)` | Metric values, next action text, repeated item title. |
| Body | `var(--ds-type-body-size)` with line height near 1.55 | Descriptions and guidance. |
| Metadata | `var(--ds-type-metadata-size)` | Labels, timestamps, raw state names, secondary evidence. |
| Code / raw evidence | Ant Design `Text code` | Commands, raw package states, versions, endpoint paths. |

Text rules:

- One H1-equivalent page title per page.
- Do not use hero-scale type inside dashboard panels, compact cards, tables, forms, or sidebars.
- Keep labels short and specific. Prefer "Applied version" over "The currently applied desktop runtime configuration version".
- Put raw state strings in code styling only when users need exact evidence.
- Use sentence case for page text and labels unless an existing i18n namespace already standardizes title case.
- Do not scale font size with viewport width.
- Letter spacing must stay `0` unless an existing compact uppercase metadata style already uses positive tracking.
- Text inside buttons must fit at mobile width. Prefer wrapping action groups over shrinking text.
- Avoid visible instructional copy about the UI itself. The page should show the workflow, not describe the design system.

## Color And Contrast Rules

Use high-contrast neutral hierarchy first:

- Primary text: `var(--text-primary)`.
- Secondary text: `var(--text-secondary)`.
- Muted metadata: `var(--text-muted)`.
- Surface: `var(--bg-card)`.
- Subtle secondary surface: `var(--bg-card-hover)` only for inset evidence tiles, selected menu states, or dense controls.
- Borders: `var(--border-subtle)` for panel edges and separators.

Accent rules:

- Reserve `var(--accent)` for primary actions, selected navigation, active tabs, and strong focus cues.
- Do not add broad purple, orange, brown, beige, or blue gradient themes during normalization.
- Do not expand the current warm palette into a one-note tan/orange interface. Where a page feels too warm, rebalance with white, black, neutral gray, and semantic colors rather than introducing a second brand system.
- Use semantic colors only for state meaning. Do not use red, green, yellow, or blue as decoration.
- Ensure status is conveyed by label and structure, not color alone.

Contrast rules:

- Body text must remain legible on all panel, table, and card surfaces.
- Fallback, helper, and metadata text must remain readable against `var(--bg-card)` and `var(--bg-card-hover)`.
- Hover and selected states must be visibly different without shifting layout.
- Do not place text over dark, blurred, or low-contrast media unless an overlay is intentionally designed for readability.

Token rule:

- Do not change global design tokens as part of Phase 3 UI batches unless a later dedicated token plan explicitly opens that scope.

## Layout Rules

Page layout:

- Use `AppLayout` content constraints and `PageHeader` as the default page shell.
- Keep dashboard pages task-first, not hero-first.
- Use full-width unframed page bands or natural page flow for page sections; use panels only for individual work surfaces.
- Do not create landing-page heroes for dashboard, admin, settings, asset library, or pet console pages.

Responsive layout:

- Use stable grid definitions for fixed-format components, especially metrics, status panels, preview areas, button groups, and repeated items.
- Page actions should wrap below the title on narrow widths.
- Main content must not horizontally overflow on mobile.
- Tables need a clear responsive strategy: horizontal scroll, reduced columns, or list fallback.
- Keep dense operational pages scannable at desktop sizes without oversized marketing spacing.

Spacing:

- Prefer 4px, 8px, 12px, 16px, 20px, 24px, and 32px increments.
- Use 16px gaps inside compact panels.
- Use 20px panel body padding by default through `OperationPanel`.
- Use 24px to 32px between major page regions.

Media and preview layout:

- Avatar, asset, model, and marketplace preview areas should show the real object or a meaningful fallback.
- Previews need stable aspect ratio or min-height so loading, error, and success states do not resize the surrounding layout.
- Media should not be dark, blurred, cropped beyond recognition, or purely atmospheric when users need to inspect it.

## Pet Dashboard Rules

`/dashboard/pet` remains the reference implementation for the first UI normalization pass.

Required order:

1. `PageHeader`
2. `PetRuntimeSummary`
3. `PetSyncStatusPanel`
4. `PetDiagnosticsSection`
5. `PetSetupReadiness`
6. `PetPreviewCard`
7. `PetConfigEditor`

Diagnostics rules:

- Diagnostics remain collapsed by default.
- Live diagnostics appear before mock/simulation diagnostics when expanded.
- `PetSyncDiagnosticsPanel` remains read-only.
- `WebBridgeMockStatusPanel` remains clearly simulation-only.
- Do not add browser UI controls that start, stop, restart, or shell out to Alife.
- Smoke commands may be rendered as text evidence only.

Sync-first rules:

- The first visible panel after the page header should answer: "What is the desktop runtime state and what should the operator do next?"
- `PetRuntimeSummary` should remain the command strip.
- `PetSyncStatusPanel` should remain the first detailed live status panel.
- Primary action language must distinguish browser actions from desktop/manual actions.
- Disabled desktop guidance controls must not look executable from the browser.

Evidence rules:

- Use `MetricTile` for versions, confirmation state, package state, and connection state.
- Use `StatusChip` for summary kind, package state, connection state, and source labels.
- Use code text for raw states such as `staged`, `applied`, `pendingActivation`, and exact WebStatus strings.
- Error surfaces must show title, recovery copy when available, error code, and technical detail when available.

## Form And Table Rules

Forms:

- Use vertical forms for configuration pages unless a compact settings table is explicitly better.
- Group related fields into tabs or sections when a form has more than one job.
- Keep form widths constrained for readability. Do not stretch text inputs across the full desktop page unless the value itself benefits from wide editing.
- Text areas need stable rows and concise hint text.
- Sliders must show units through labels, marks, helper text, or adjacent copy.
- File path inputs must preserve exact strings and avoid auto-formatting.
- Destructive or disconnect actions must be visually distinct from primary save/export commands.

Tables and lists:

- Use tables for comparison, status review, and records with multiple columns.
- Use repeated cards or grid tiles for visual assets when thumbnails matter.
- Repeated items should use the same title, metadata, status, and action order across pages.
- Keep row actions compact and icon-based only when the action is standard and labeled for accessibility.
- Avoid old page-local visual overrides such as broad purple border classes when normalizing asset and marketplace surfaces.

Asset surfaces:

- Grid view should emphasize thumbnail, filename, type/status, and primary next action.
- List view should emphasize filename, type, format, size, date, and action.
- Empty asset states should offer upload or browse actions only when those actions are available.
- Upload progress must be visible near the upload control or in the asset surface it affects.

## Loading Empty Error Success States

Loading:

- Use `Spin` with a short localized label when the operation can take longer than a moment.
- Preserve layout footprint where possible so content does not jump after loading.
- Use skeleton-like stable boxes only when the surrounding page already has enough structure to justify them.

Empty:

- Use `EmptyState` or an Ant Design empty state wrapped in a normal page surface.
- Empty copy must explain the missing object, not the application feature.
- Include one clear next action when available.

Error:

- Use `Alert` for recoverable page or panel errors.
- Error copy should include what failed, why if known, and the next recoverable action.
- Technical details and raw error codes should be visible but secondary.
- Do not hide protocol or WebBridge evidence behind purely friendly copy.

Success:

- Use message/toast feedback for completed mutations such as save, attach, upload, and export.
- Use `StatusChip` and stable panel state for durable success such as `upToDate` or `applied`.
- Do not rely on transient toasts as the only record of durable state.

Disabled:

- Disabled states must explain whether the control is blocked, read-only, awaiting desktop confirmation, or unavailable in browser UI.
- Disabled desktop guidance must not be styled as a working browser action.

## Internationalization Rules

- All user-facing strings in React components must use existing i18n patterns such as `useTranslations`.
- Do not hard-code English or Chinese strings in UI source unless the existing file is already a test-only fixture or a non-user-facing constant.
- Add translation keys in the same namespace as the owning page or component.
- Keep raw protocol identifiers untranslated when exact evidence matters, such as endpoint paths, package states, milestone names, and WebStatus strings.
- Keep labels short enough for Chinese, English, and longer translated strings to fit without overlap.
- Avoid string concatenation for localized sentences. Use parameterized translation strings.
- Tests for locale-sensitive diagnostics should assert key states, not one fragile full paragraph, unless exact copy is the behavior under test.

## Verification Checklist

Before each UI normalization batch:

- Confirm the batch has a narrow page or component group scope.
- Confirm route handlers, Prisma schema, migrations, protocol behavior, and Alife source are out of scope.
- Check that the target page follows the component and text hierarchy in this spec.
- Identify any page-local style overrides that conflict with this spec.

During implementation:

- Add or update tests before changing behavior or visible states.
- Preserve `/dashboard/pet` sync-first ordering.
- Keep diagnostics collapsed by default and read-only.
- Use `PageHeader`, `OperationPanel`, `MetricTile`, and `StatusChip` where they fit.
- Keep buttons, controls, and text from overflowing at mobile and desktop widths.
- Do not introduce nested panels, nested cards, decorative orbs, or broad gradients.
- Keep semantic colors tied to state meaning.

After each batch:

- Run `npm run test -- --runInBand`.
- Run `npm run typecheck`.
- Run `npm run build`.
- Inspect mobile and desktop layouts for text overlap, unstable grids, and unclear controls.
- Confirm no route handler or protocol file changed unless a later dedicated protocol plan opened that scope.
- Commit each verified batch separately.
