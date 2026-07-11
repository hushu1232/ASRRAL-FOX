# Confirm-In-Desktop UI Batch C Design - 2026-07-11

## Goal

Close the confirm→applied feedback loop on `/dashboard/pet` after Batch A/B:

1. Light polling while WebBridge status is waiting on desktop confirmation
2. One-shot success banner when status first becomes `upToDate` after a confirm wait
3. Mild density reduction in the confirm path without a full layout rewrite

Protocol boundary is unchanged: Web still does not confirm/apply packages.

## Why Now

Batch A/B shipped:

- disabled confirm + enabled recheck
- 3-step callout
- local-health one-liner
- diagnostics evidence catalog

Operators still must manually refresh after confirming in Alife, and there is no celebratory/clear transition when apply succeeds. That is the largest remaining UX gap on this path.

## Scope

### In scope (Batch C)

1. **Confirm-state light polling**
   - When `syncStatus.primaryAction === 'confirmInDesktop'` (or equivalently `summaryKind === 'localConfirmationRequired'`), poll `/api/pet/sync/status` every **8 seconds**.
   - Also poll `/api/pet/alife/local-health` on the same cadence while confirm-waiting (advisory only).
   - Stop polling when status leaves confirm-wait, on unmount, or when the tab is hidden (`document.visibilityState !== 'visible'`).
   - Manual recheck remains available and resets the poll timer by sharing the same fetch functions.
   - Polling must not invent apply/confirm actions and must not call loopback from the browser.

2. **Applied success banner**
   - Track previous summary/primary action.
   - When transition is from confirm-wait → `summaryKind === 'upToDate'` (or `primaryAction === 'none'` with applied/upToDate package), show a dismissible success Alert once:
     - en: `Desktop applied the current package.`
     - zh-CN: `桌面已应用当前包。`
     - ja: equivalent
   - Banner auto-clears after 12s or on dismiss; do not re-show until another confirm-wait cycle occurs.

3. **Mild confirm-path density**
   - In `confirmInDesktop`, keep RuntimeSummary as command strip.
   - Keep SyncStatusPanel callout + steps + metrics.
   - Do **not** remove Descriptions/raw state in this batch (too large); only avoid adding more duplicated long copy.
   - Prefer reusing existing detail text; do not introduce a second long paragraph in the success banner.

### Out of scope

- Full summary vs panel information-architecture rewrite
- Global rename Alife .NET → Alife 桌面
- Browser apply/confirm
- Frontend loopback / shell
- Asset sync smoke
- Manual live-desktop CLI evidence run (environment-dependent)

## UX Model

```text
confirm wait:
  [existing A/B UI]
  background: poll status (+ local health) every 8s while tab visible

transition to applied:
  [Success Alert] Desktop applied the current package.  [dismiss]
  stop polling
  existing upToDate presentation remains
```

## Implementation Touchpoints

- `src/app/(auth)/dashboard/pet/page.tsx`
  - confirm-wait polling effect
  - previous-status ref + success banner state
- optional helper: `src/components/pet/sync/confirmInDesktopPolling.ts`
  - pure helpers: `isConfirmWaitStatus`, `shouldShowAppliedSuccess`, interval constants
- `PetRuntimeSummary` / `PetSyncStatusPanel` only if a small “auto-checking…” hint is needed (prefer page-level banner only)
- i18n: `pet.syncStatus.appliedSuccess` (or `pet.runtimeSummary.appliedSuccess`) in en / zh-CN / ja
- tests:
  - pure helper unit tests
  - page-level behavior tests if practical; otherwise helper + panel i18n coverage

## Acceptance Criteria

1. While `confirmInDesktop`, status is refetched about every 8s when tab is visible.
2. Polling stops when not confirm-waiting, tab hidden, or unmounted.
3. Leaving confirm-wait for `upToDate` shows success banner once.
4. Banner dismissible; does not loop-spam.
5. No new network targets beyond existing authenticated FOXD APIs.
6. Focused unit tests + typecheck pass.
7. Guardrails still forbid browser loopback/shell/apply.

## Risks

1. **Aggressive polling load** — 8s interval, pause when hidden, only in confirm-wait.
2. **False success** — only fire on transition from confirm-wait, not on initial page load already upToDate.
3. **Stale closure in intervals** — use refs for latest fetch functions / status predicates.

## Decision Log

- 2026-07-11: Continue after A/B merge to master; implement deferred Batch C (polling + applied success).
- Interval chosen: 8 seconds (between plan’s 5–10s guidance).
