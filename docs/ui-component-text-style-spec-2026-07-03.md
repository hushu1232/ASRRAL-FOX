# FOXD UI Component And Text Style Specification - 2026-07-03

## Goal

Define the first shared UI component and text-style rules for FOXD Web before broad UI normalization starts.

This specification is **dashboard-first**. It uses `/dashboard/pet` and the WebBridge pet console as the reference surface because that page now carries the most important operational story: Web configuration state, Alife desktop visibility, local confirmation, applied version evidence, advisory health, diagnostics, preview, and configuration editing.

The approved direction is:

- **Quiet high-density console:** work-focused, scannable, restrained, and suitable for repeated use.
- **Sync state first:** pages should answer current state and next action before secondary editing or preview surfaces.
- **Hard rules plus verification checklist:** this document must be useful during later page-group UI normalization, not only descriptive.
- **Small batches:** improve page groups incrementally without changing protocol behavior.

This specification applies to upcoming UI source changes under the Next.js web app, especially:

```text
avatar-web-management/src
```

Out of scope for this specification:

- Prisma schema or migration changes.
- WebBridge route, pet sync route, or protocol behavior changes.
- Alife source changes.
- Browser UI that starts, stops, restarts, shells out to, or otherwise manages local Alife processes.
- Global design token changes unless a later dedicated token plan opens that scope.
- A full marketing-site redesign.

Current verification baseline captured before updating this spec:

```text
npm run test -- --runInBand: 98 suites, 986 tests passed
npm run typecheck: passed
npm run build: passed
```

Known non-blocking baseline noise includes existing React `act(...)` warnings, jsdom canvas/WebGL not-implemented messages, Prisma build logs, and the npm `--runInBand` warning. These are not introduced by this documentation-only specification.

## Reference Principles

External references inspected at execution time:

- `https://www.insta360.com/cn/`
- `https://www.insta360.com/cn/enterprise/insta360-x5`

Local screenshots were captured for inspection on 2026-07-05 and left outside the repository under `D:\tmp`.

Transferable principles from the current Insta360 pages:

- **Subject first:** the first viewport makes the primary product or task unmistakable before secondary controls compete for attention.
- **Clear hierarchy:** product name, support copy, primary action, categories, cards, metrics, and footer navigation each have distinct scale and placement.
- **Large stable media when inspection matters:** product and industry pages reserve stable visual areas for the thing being inspected.
- **Strong neutral contrast:** black, white, and neutral surfaces carry most of the visual structure.
- **Restrained accent use:** accent color is used for active states, primary calls to action, and important focus points, not as broad decoration.
- **Metrics as evidence:** specification and comparison sections use compact numbers, labels, and tables that are easy to scan.
- **Polished state feedback:** tabs, buttons, cards, form controls, and page sections communicate state without noisy decoration.

FOXD must not copy Insta360 assets, copywriting, product layouts, brand marks, animation sequences, or page structure. FOXD is an operational web control plane, not a camera product landing page. Transfer only the discipline: make the subject obvious, keep hierarchy clean, use neutral contrast first, reserve accents for meaning, and make evidence easy to scan.

## Component Rules

Prefer existing local primitives before adding new ones:

- `PageHeader` for page title, subtitle, breadcrumbs, tabs, and page actions.
- `OperationPanel` for a single bounded operational surface.
- `MetricTile` for compact evidence values, versions, counters, and state facts.
- `StatusChip` for semantic state labels.
- Ant Design `Button`, `Input`, `Select`, `Table`, `Tabs`, `Descriptions`, `Steps`, `Alert`, `Modal`, `Tooltip`, `Spin`, and related primitives for standard interactions.

`PageHeader` rules:

- Use one page title per page.
- Subtitle explains the page task; it is not marketing copy.
- Actions sit on the right on desktop and wrap cleanly below the title on narrow screens.
- Page actions must not squeeze, overlap, or truncate the title.
- Breadcrumbs and tabs are secondary to the title and should not become the dominant visual element.

`OperationPanel` rules:

- Use one panel for one coherent operational task or evidence group.
- Keep panel radius at `var(--ds-panel-radius)` or 8 px.
- Do not put `OperationPanel` inside another `OperationPanel`.
- Do not put UI cards inside UI cards.
- Do not style entire page sections as decorative floating cards.
- Use the panel header for a short title and at most one local action group.
- Use the body for evidence, controls, and explanatory copy directly related to that panel.

`MetricTile` rules:

- Use for facts the operator compares quickly: versions, connection state, package state, counts, timestamps, and confirmation state.
- Keep label text at metadata scale.
- Keep value text at card-title scale.
- Give repeated metric groups stable grid tracks, such as `repeat(auto-fit, minmax(var(--ds-panel-gridMinWidth), 1fr))`.
- Do not allow loading text, long values, hover states, or translated labels to resize the entire grid unexpectedly.

`StatusChip` rules:

- Use for stable state labels, not as a replacement for buttons.
- Keep chip text short.
- Do not put full sentences inside chips.
- Pair chips with body text, metric evidence, or alert copy when the state requires explanation.
- Use tones consistently:
  - `success`: applied, up to date, reachable, complete.
  - `warning`: pending, stale, local confirmation required, partial.
  - `error`: failed, blocked, invalid.
  - `processing`: checking, uploading, synchronizing.
  - `neutral`: unknown, inactive, not reported.

Button and control rules:

- Use icon plus text for primary commands such as save, export, refresh, upload, attach, browse, and open.
- Use icon-only controls only when the action is standard, compactness matters, and `aria-label` plus tooltip or surrounding label makes the command clear.
- Use switches or checkboxes for binary settings.
- Use sliders, steppers, or numeric inputs for numeric values.
- Use tabs only for parallel views inside the same task, not for unrelated page navigation.
- Disabled controls must explain why through tooltip text, helper text, alert copy, or adjacent panel text.
- Disabled desktop guidance buttons must not look executable from the browser.

Icon rules:

- Use `@ant-design/icons` because the app already uses Ant Design.
- Do not hand-draw SVG icons when an Ant Design icon already matches the command.
- Do not use decorative icons where no action or state is clarified.

## Text Scale

Use a tight operational type hierarchy:

| Role | Token or local pattern | Use |
| --- | --- | --- |
| Display | `var(--ds-ui-typeScale-display-fontSize)` | Rare product or showcase surfaces only; dashboard pages should normally avoid it. |
| Page title | `text-2xl font-bold` or `var(--ds-type-pageTitle-size)` | One per page in `PageHeader`. |
| Subtitle | `text-sm` with `var(--text-secondary)` | One short sentence under a page title. |
| Section title | `var(--ds-type-sectionTitle-size)` or Ant Design card title | Panel-level task or evidence group. |
| Card title / key value | `var(--ds-type-cardTitle-size)` | Metric values, next action labels, repeated item titles. |
| Body | `var(--ds-type-body-size)` with line height near 1.55 | Explanatory copy, recovery copy, guidance. |
| Metadata | `var(--ds-type-metadata-size)` | Labels, timestamps, raw state labels, secondary evidence. |
| Code / raw evidence | Ant Design `Text code` | Commands, endpoint paths, exact versions, raw package states. |

Text rules:

- Dashboard panels must not use hero-scale type.
- Headings inside compact panels, cards, sidebars, and tables must stay compact.
- Button labels are commands, not explanations.
- Long explanation belongs in panel body text, tooltip, alert description, or diagnostics detail.
- Labels should be short and specific. Prefer "Applied version" over "The currently applied desktop runtime configuration version".
- Raw state strings should use code styling only when exact evidence matters.
- Do not scale font size with viewport width.
- Letter spacing stays `0` unless an existing compact uppercase metadata style already uses positive tracking.
- Text inside buttons, chips, metric tiles, table cells, and panel headers must fit at mobile and desktop widths.
- Prefer wrapping an action group over shrinking text.
- Avoid visible UI-design instruction copy in the app. The interface should show the workflow rather than describe its own design.

Status copy should follow this order:

1. State: what is true now.
2. Reason: why the system is in that state, if known.
3. Next action: what the operator can do next.

Examples of state categories:

- Up to date.
- Pending pull.
- Local confirmation required.
- Desktop offline.
- Failed.
- Unknown.

## Color And Contrast Rules

Use neutral hierarchy first:

- Primary text: `var(--text-primary)`.
- Secondary text: `var(--text-secondary)`.
- Muted metadata: `var(--text-muted)`.
- Main panel surface: `var(--bg-card)`.
- Inset evidence surface: `var(--bg-card-hover)`.
- Borders and separators: `var(--border-subtle)`.

Accent rules:

- Reserve `var(--accent)` for primary actions, active navigation, active tabs, focus cues, and narrow state emphasis.
- Do not broaden the current warm palette into a one-note tan, orange, beige, brown, or espresso interface.
- Do not introduce broad purple, purple-blue, blue-slate, or decorative gradient themes during this normalization pass.
- Use semantic red, green, yellow, and blue only for actual semantic state.
- Never use semantic colors as decoration.

Contrast rules:

- Text must remain readable on `var(--bg-card)` and `var(--bg-card-hover)`.
- Status must be understandable from text and structure, not color alone.
- Hover, focus, active, selected, disabled, empty, error, and success states must be visible without moving layout.
- Do not place important text over dark, blurred, cropped, or low-contrast media unless an overlay is intentionally designed for readability.

Token rule:

- Do not change global color, spacing, radius, or type tokens as part of the first UI normalization batches. If token changes become necessary, write a separate plan.

## Layout Rules

Dashboard page structure:

1. `PageHeader`: title, subtitle, page-level actions.
2. Primary state surface: current state, blocking reason, next action.
3. Evidence grid: versions, timestamps, counts, connection, package state.
4. Work surface: form, editor, upload, asset picker, table, or repeated list.
5. Diagnostics or secondary evidence: default collapsed when detailed.

Layout rules:

- Dashboard pages are task-first, not hero-first.
- Do not make dashboard, admin, settings, asset library, or pet console pages look like landing pages.
- Use panels for individual work surfaces only.
- Use natural page flow and spacing for grouping; do not create decorative page-level floating cards.
- Keep main content within the existing `AppLayout` max-width behavior.
- Use stable dimensions or responsive constraints for fixed-format UI elements such as metric grids, status rows, preview areas, toolbars, counters, and table action columns.
- Use 4 px, 8 px, 12 px, 16 px, 20 px, 24 px, and 32 px spacing increments.
- Use 16 px gaps inside dense panels.
- Use 20 px panel body padding by default through `OperationPanel`.
- Use 24 px to 32 px between major page regions.

Responsive rules:

- Page actions wrap on narrow screens.
- Main content must not horizontally overflow on mobile.
- Wide layouts may use two columns, but the primary state surface remains first in DOM order and visual order.
- Tables need an explicit responsive strategy: horizontal scroll, reduced columns, or list fallback.
- Long translated text must wrap without overlapping adjacent controls.

Media and preview rules:

- Avatar, asset, model, and marketplace preview areas should show the real object or a meaningful fallback.
- Preview areas need stable aspect ratio or min-height so loading, error, and success states do not resize surrounding layout.
- Media should not be dark, blurred, cropped beyond recognition, or purely atmospheric when users need inspection.
- Large clean media areas are appropriate for preview and asset inspection surfaces, not for every dashboard panel.

## Pet Dashboard Rules

`/dashboard/pet` is the first reference surface for this specification.

Recommended order:

1. `PageHeader`
2. `PetRuntimeSummary`
3. `AlifeLocalHealthPanel`
4. `PetSyncStatusPanel`
5. `PetDiagnosticsSection`
6. `PetSetupReadiness`
7. `PetPreviewCard`
8. `PetConfigEditor`

Sync-first rules:

- The first visible panel after `PageHeader` must answer: what is the desktop runtime state and what should the operator do next?
- `PetRuntimeSummary` is the command strip and state summary.
- `AlifeLocalHealthPanel` is advisory and read-only; it must not become a management surface.
- `PetSyncStatusPanel` is the first detailed live status panel.
- Primary action language must distinguish browser actions from desktop/manual actions.
- Disabled desktop guidance controls must not imply the browser can perform the desktop action.

Diagnostics rules:

- Diagnostics remain collapsed by default.
- Live diagnostics appear before mock or simulation diagnostics when expanded.
- `PetSyncDiagnosticsPanel` remains read-only.
- `WebBridgeMockStatusPanel` remains clearly simulation-only.
- Smoke commands may be rendered as text evidence only.
- The browser UI must not start, stop, restart, apply packages, execute PowerShell, execute shell commands, or mutate the active desktop runtime.

Evidence rules:

- Use `MetricTile` for versions, confirmation state, package state, connection state, and timestamps.
- Use `StatusChip` for summary kind, package state, connection state, and source labels.
- Use code text for raw states such as `staged`, `failed`, `applied`, `pendingActivation`, endpoint paths, and exact WebStatus strings.
- Error surfaces must include title, recovery copy when available, error code, and technical detail when available.
- Same-version `staged`, `failed`, and `applied` states must not be visually flattened into one generic "synced" state.

Pet preview and editor rules:

- `PetPreviewCard` remains important but does not outrank sync status.
- Preview should use stable dimensions and meaningful fallback states.
- `PetConfigEditor` should keep form width constrained for readability.
- Asset picker actions should read as attach/browse/select actions, not protocol actions.

## Form And Table Rules

Form rules:

- Use vertical forms for configuration pages unless a compact settings table is explicitly better.
- Group related fields into tabs or sections when a form has more than one job.
- Keep form widths constrained; do not stretch text inputs across the full desktop page unless wide editing is truly useful.
- Text areas need stable rows and concise hint or helper text.
- Sliders must show units through labels, marks, helper text, or adjacent copy.
- File path inputs must preserve exact strings and avoid auto-formatting.
- Save, export, attach, browse, and unlink actions must remain visually distinct.
- Destructive or disconnect actions must not compete with the primary save action.

Table and list rules:

- Use tables for comparison, status review, and records with multiple columns.
- Use repeated cards or grid tiles when thumbnail inspection matters.
- Repeated items should use the same order: title, metadata, status, evidence, actions.
- Row actions should be compact and icon-based only when the command is standard and accessible.
- Avoid page-local visual overrides that conflict with shared panel, metric, chip, and text rules.
- Table column titles stay short; long explanations go into tooltip or detail content.

Asset surface rules:

- Grid view emphasizes thumbnail, filename, type/status, and primary next action.
- List view emphasizes filename, type, format, size/date, status, and action.
- Empty asset states should offer upload or browse actions only when those actions are available.
- Upload progress must be visible near the upload control or the asset surface it affects.

## Loading Empty Error Success States

Loading:

- Use `Spin` with localized label text when the operation can take longer than a moment.
- Preserve layout footprint where possible so content does not jump after loading.
- Use skeleton-like stable boxes only when the surrounding page structure makes them useful.

Empty:

- Explain what object is missing.
- Explain the available next action, if any.
- Do not use vague empty copy such as only "No data".
- Do not show unavailable actions as if they were enabled.

Error:

- Use `Alert` for recoverable page or panel errors.
- Include what failed, why if known, and the next recoverable action.
- Technical details and raw error codes should be visible but secondary.
- Do not hide protocol or WebBridge evidence behind only friendly copy.

Success:

- Use message/toast feedback for completed mutations such as save, attach, upload, and export.
- Use stable panel state plus `StatusChip` for durable success such as `upToDate` or `applied`.
- Do not rely on a transient toast as the only evidence of durable state.

Disabled:

- Disabled controls must explain whether the control is blocked, read-only, awaiting desktop confirmation, unsupported in browser UI, or unavailable because data is missing.
- Disabled desktop guidance must not be styled as an executable browser action.

Diagnostics:

- Detailed evidence is allowed, but it should be ordered as summary, versions, timestamps, milestones, raw state, and errors.
- Detailed diagnostics should not obscure the primary state surface.

## Internationalization Rules

- All user-facing strings in React components must use existing i18n patterns such as `useTranslations`.
- Do not hard-code English or Chinese strings in UI source unless the file is a test-only fixture or a non-user-facing constant.
- Add translation keys in the namespace owned by the page or component.
- Avoid string concatenation for localized sentences; use parameterized translation strings.
- Keep raw protocol identifiers untranslated when exact evidence matters, including endpoint paths, package states, milestone names, error codes, and WebStatus strings.
- Button labels stay short commands.
- Chip labels stay short state names.
- Metric labels may wrap, but values must not break surrounding layout.
- Table column titles stay short; long translated explanation belongs in tooltip or detail panels.
- Locale-sensitive tests should assert key states and evidence, not one fragile full paragraph, unless exact copy is the behavior under test.

## Verification Checklist

Before each UI normalization batch:

- Confirm the batch has a narrow page or component group scope.
- Confirm route handlers, Prisma schema, migrations, protocol behavior, and Alife source are out of scope.
- Check that the target page follows the component and text hierarchy in this specification.
- Identify page-local style overrides that conflict with shared panel, metric, chip, color, and text rules.

During implementation:

- Preserve `/dashboard/pet` sync-first ordering.
- Keep `AlifeLocalHealthPanel` advisory and read-only.
- Keep diagnostics collapsed by default and read-only.
- Use `PageHeader`, `OperationPanel`, `MetricTile`, and `StatusChip` where they fit.
- Keep buttons, controls, and text from overflowing at mobile and desktop widths.
- Do not introduce nested panels, nested cards, decorative orbs, broad gradients, or marketing hero sections into dashboard pages.
- Keep semantic colors tied to state meaning.
- Do not let browser UI execute local commands or desktop management actions.

After each UI implementation batch:

- Run `npm run test -- --runInBand`.
- Run `npm run typecheck`.
- Run `npm run build`.
- Inspect mobile and desktop layouts for text overlap, unstable grids, unclear controls, and state ambiguity.
- Confirm no route handler or protocol file changed unless a later dedicated protocol plan opened that scope.
- Commit each verified batch separately.

For this specification document itself:

- Verify required anchors:

```powershell
Select-String -Path docs\ui-component-text-style-spec-2026-07-03.md -Pattern "Component Rules|Text Scale|Pet Dashboard Rules|Internationalization Rules|Verification Checklist|Insta360"
```

- Confirm there are no unfinished markers or deliberately open sections.
- Confirm the document does not require API, Prisma, protocol, Alife, or global token changes.
- Confirm Insta360 is treated only as a transferable-principles reference.
