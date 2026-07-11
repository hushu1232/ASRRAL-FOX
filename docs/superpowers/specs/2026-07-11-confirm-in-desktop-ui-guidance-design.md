# Confirm-In-Desktop UI Guidance Design - 2026-07-11

## Goal

Improve the `/dashboard/pet` operator experience when WebBridge status is `localConfirmationRequired` / `primaryAction=confirmInDesktop`, without weakening the protocol boundary that confirmation happens only inside an already-running Alife desktop process.

This is a **UI/UX guidance batch**, not a new evidence mode. CLI evidence remains:

- `check:webbridge:smoke` — isolated harness
- `check:webbridge:active-apply` — active-service apply
- `check:webbridge:live-desktop-confirmation` — already-running desktop + manual confirm

## Why Now

The live-desktop evidence runner is implemented and pushed. The related Web UI already:

- Shows a disabled primary “confirm in Alife” control
- Explains that Web does not perform local activation
- Surfaces local health only as advisory diagnostics

Operators still lack:

1. A clear secondary refresh path while the primary confirm action is intentionally disabled
2. A short, ordered “what to do next” callout in the confirm state
3. One-line linkage between confirm state and local health reachability
4. Diagnostics copy that distinguishes live-desktop evidence from smoke / active-apply

## Scope

### In scope (Batch A + B)

**Batch A — confirm-state actionability**

1. When `primaryAction === 'confirmInDesktop'`, keep the primary confirm control **disabled**.
2. Always show a usable secondary **重新检查 / Check again** control next to it (runtime summary + sync status panel).
3. Replace the single-line confirm Alert with a compact **3-step callout**:
   1. Open / focus Alife desktop
   2. Confirm the staged package inside Alife
   3. Return to Web and recheck
4. When local health view is available, show **one guidance sentence** under the callout:
   - `reachable` → desktop process appears reachable; confirm in Alife
   - `unreachable` / `authRequired` / `error` → start or fix Alife before confirming
   - `notConfigured` → local health not configured; confirmation still only happens in Alife
5. Do **not** invent new apply/confirm APIs or browser loopback calls.

**Batch B — diagnostics evidence catalog**

1. In diagnostics smoke/read-only section, document three evidence commands as text only:
   - smoke
   - active-apply
   - live-desktop-confirmation
2. Each entry must state purpose and that Web UI does not execute them.
3. Live-desktop entry must state opt-in env `ALIFE_LIVE_DESKTOP_CONFIRMATION=true` and manual desktop confirmation requirement.

### Out of scope (later batches)

- Light polling while staged / confirmInDesktop
- Applied-success celebration banner
- Full information-density refactor of summary vs panel duplication
- Renaming all “Alife .NET” strings to “Alife 桌面” across locales
- Any browser start/stop/apply/confirm
- Frontend direct calls to `127.0.0.1:8787` or `child_process`
- Turning CLI evidence commands into executable page buttons

## Non-Goals

Same protocol boundary as live-desktop evidence design:

- No Web apply/confirm route
- No browser-side local management control
- No shell execution from frontend
- No treating local health as apply confirmation
- No relabeling smoke or active-apply as live-desktop evidence

## UX Model

### Confirm state composition

```text
[Status chip: 等待本地确认]
[One-line runtime detail]

[Steps: published ✓ → staged (current) → applied]

[Callout: 3 steps to confirm in Alife desktop]
[Optional one-liner from local health]

[Actions]
  Primary (disabled): 在 Alife 桌面中确认
  Secondary (enabled): 重新检查

[Details / metrics remain below or unchanged]
```

### Local health sentence mapping

| Local health state | Guidance tone | Message intent |
| --- | --- | --- |
| reachable | positive/info | Desktop local API reachable; confirm inside Alife |
| unreachable | warning | Desktop local API unreachable; start Alife first |
| authRequired | warning | Local health token/auth issue; confirmation still only in Alife |
| invalidResponse / error | warning | Local health check failed; do not assume desktop ready |
| notConfigured | neutral | Local health not configured; still confirm only in Alife |
| null / loading | omit or loading | Do not invent reachability |

Local health remains **advisory**. It never becomes an apply gate that Web can satisfy.

### Diagnostics catalog copy shape

```text
Evidence (read-only reference)
1) Isolated smoke — check:webbridge:smoke
2) Active-service apply — check:webbridge:active-apply
3) Live desktop manual confirmation — check:webbridge:live-desktop-confirmation
   Requires already-running desktop + ALIFE_LIVE_DESKTOP_CONFIRMATION=true
   Web does not run this command.
```

## Component Touchpoints

Expected files (implementation plan may refine):

- `src/components/pet/PetRuntimeSummary.tsx`
  - confirmInDesktop: disabled primary + enabled secondary recheck
- `src/components/pet/sync/PetSyncStatusPanel.tsx`
  - same action pair
  - 3-step callout instead of single-line Alert
  - optional local-health one-liner prop
- `src/app/(auth)/dashboard/pet/page.tsx`
  - pass `alifeLocalHealth` (or derived guidance key) into sync status panel if needed
- `src/components/pet/sync/PetSyncDiagnosticsPanel.tsx` (and/or i18n keys it already uses)
  - evidence catalog entries for three commands
- `messages/en.json`, `messages/zh-CN.json`, `messages/ja.json`
  - new keys for steps, health guidance, diagnostics catalog
- unit tests under `src/components/__tests__` / existing pet sync panel tests

## Acceptance Criteria

### Batch A

1. In `confirmInDesktop`, primary confirm control remains disabled and still explains Web cannot activate locally.
2. Secondary recheck is visible, enabled, and calls the existing refresh handler.
3. Confirm-state callout shows exactly three ordered steps (i18n, not hardcoded Chinese only).
4. When local health is present, exactly one guidance sentence is shown; when absent, no fake reachability claim.
5. No new browser network targets beyond existing `/api/pet/sync/status` and `/api/pet/alife/local-health`.

### Batch B

1. Diagnostics read-only section lists smoke, active-apply, and live-desktop-confirmation.
2. Copy distinguishes isolated harness vs active-service apply vs live desktop manual confirmation.
3. No executable button/link that runs those npm commands from the browser.

### Shared

1. Existing unit tests for sync presentation still pass; new/updated tests cover confirm-state actions and diagnostics catalog keys.
2. Typecheck and focused pet sync UI tests pass.
3. Guardrails still forbid frontend `child_process` and direct Alife loopback strings in app/component product code.

## Risks

1. **Over-promising local health** — mitigate by “advisory only” wording and never enabling a confirm button from health.
2. **Locale drift** — require en / zh-CN / ja keys in the same PR.
3. **Visual noise** — keep callout compact; do not expand full diagnostics into the main confirm path.

## Recommended Delivery

1. Write this design (done in this file).
2. Write an implementation plan with TDD steps for Batch A then Batch B.
3. Implement on a branch separate from the already-pushed live-desktop evidence runner branch (or stacked after that PR merges).
4. Keep protocol runner PR focused; land UI guidance as its own PR.

## Decision Log

- 2026-07-11: User confirmed UI/UX recommendation direction after live-desktop evidence implementation and push.
- Primary confirm control stays disabled by design.
- Secondary recheck + 3-step callout + health one-liner + diagnostics catalog are the approved Batch A/B scope.
