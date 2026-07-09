# Live Desktop Manual Confirmation Evidence Design - 2026-07-09

## Goal

Add a separate opt-in evidence path that proves an already-running Alife desktop process participates in the WebBridge local confirmation flow.

This closes the next protocol gap after `check:webbridge:active-apply`. The existing active-service evidence proves that the canonical Alife WebBridge service can apply a package through `WebBridgeService.ApplyPackage(...)` and report `packageApplied`. It does not prove that a live desktop process, already running before the evidence command starts, surfaced the confirmation request and completed the apply after a human confirmed it inside Alife.

The new evidence mode is named:

```text
live-desktop-manual-confirmation
```

It should be deliberately manual. The runner can stage the package and observe status, but the confirmation action must happen in the already-running Alife desktop process.

## Current Evidence Baseline

FOXD currently has two verified WebBridge evidence levels:

1. `npm run check:webbridge:smoke`

   Verifies staged-to-applied behavior in an isolated harness. It uses a runner-reported temporary package root and must not be described as active desktop evidence.

2. `npm run check:webbridge:active-apply`

   Verifies the canonical Alife WebBridge service apply path with explicit opt-in:

   ```powershell
   $env:ALIFE_ACTIVE_APPLY_EVIDENCE='true'
   $env:DOTNET_EXE='C:\Users\hu shu\.dotnet\dotnet.exe'
   $env:ALIFE_ROOT='D:\Alife'
   $env:WEBBRIDGE_PACKAGE_ROOT='D:\tmp\foxd-active-apply-evidence'
   npm run check:webbridge:active-apply
   ```

   Verified evidence includes:

   ```text
   EvidenceMode: active-service-apply
   InstallStatus: pendingActivation
   ApplyStatus: applied
   DefaultRuntimeStorageTouched: false
   WebStatus: staged/localConfirmationRequired/confirmInDesktop
   WebStatus: applied/upToDate/none/requiresLocalConfirmation=false
   ```

The new work must not weaken or relabel either baseline. It must add a third, separately named evidence level.

## Non-Goals

This task does not add general remote control of Alife from FOXD.

It must not:

- Add browser UI start, stop, restart, apply, or confirm buttons.
- Let browser-side code call loopback Alife endpoints directly.
- Let browser-side code run PowerShell, `child_process`, or any local shell command.
- Expose local apply as a FOXD Web UI action.
- Add a management API apply endpoint unless a later Alife design explicitly approves it.
- Enable asset sync.
- Treat local health as apply confirmation.
- Modify `D:\Alife` source in this first FOXD-side design unless a later implementation plan explicitly opens Alife changes.
- Touch default Alife runtime storage silently.
- Delete or clean user runtime data automatically.

## Evidence Model

The command should be opt-in and should fail closed unless the user explicitly chooses live desktop confirmation:

```powershell
$env:ALIFE_LIVE_DESKTOP_CONFIRMATION='true'
$env:DOTNET_EXE='C:\Users\hu shu\.dotnet\dotnet.exe'
$env:ALIFE_ROOT='D:\Alife'
npm run check:webbridge:live-desktop-confirmation
```

The successful output should include stable evidence lines:

```text
Live desktop confirmation evidence passed.
EvidenceMode: live-desktop-manual-confirmation
AlifeRoot: D:\Alife
AlifeProcessReachable: true
ManualActionRequired: confirmInDesktop
WebStatusBefore: staged/localConfirmationRequired/confirmInDesktop
WebStatusAfter: applied/upToDate/none/requiresLocalConfirmation=false
BrowserControlUsed: false
LocalApiApplyEndpointUsed: false
DefaultRuntimeStorageTouched: <true|false>
TouchedPath: <path>
```

If default runtime storage is not touched, `DefaultRuntimeStorageTouched` should be `false`, and `TouchedPath` should point at the explicit evidence package root.

If the design later requires default runtime storage to prove live desktop participation, the command must add stricter evidence:

```text
DefaultRuntimeStorageTouched: true
DefaultRuntimeStorageSnapshotBefore: <path-or-hash-summary>
DefaultRuntimeStorageSnapshotAfter: <path-or-hash-summary>
ChangedPath: <path>
CleanupPolicy: manual-review-required
```

Default runtime storage evidence is acceptable only with explicit user opt-in, before and after snapshots, changed-path evidence, and a cleanup policy that does not automatically delete user runtime data.

## Manual Confirmation Flow

The intended flow is:

1. The user starts Alife desktop manually before running the FOXD evidence command.
2. The runner checks that Alife is reachable through the existing local management API:

   ```text
   GET http://127.0.0.1:8787/api/alife/health
   GET http://127.0.0.1:8787/api/alife/status
   ```

3. The runner starts the FOXD local test server in the same style as the existing WebBridge evidence commands.
4. The runner stages the current WebBridge package through the normal FOXD package manifest and file routes.
5. The runner waits until FOXD reports:

   ```text
   staged/localConfirmationRequired/confirmInDesktop
   ```

6. The runner prints a blocking manual prompt:

   ```text
   ManualActionRequired: confirm package inside the already-running Alife desktop process.
   ```

7. The user confirms the package inside Alife desktop.
8. The runner polls FOXD sync status until it observes:

   ```text
   applied/upToDate/none/requiresLocalConfirmation=false
   ```

9. The runner prints the evidence lines and exits zero.

The runner must not perform the confirmation itself. Its job is to stage, wait, observe, and report.

## Storage And Cleanup Boundaries

There are two possible storage modes, and the implementation plan must choose one explicitly.

Recommended first mode:

- Use an explicit evidence package root.
- Require the live desktop process to be configured to use that root for the test, if Alife supports that configuration without source changes.
- Print `DefaultRuntimeStorageTouched: false`.
- Cleanup can be limited to the explicit evidence root, but deletion should still be opt-in or documented as local test artifact cleanup.

Stronger later mode:

- Use default Alife runtime storage only after explicit confirmation from the user.
- Snapshot relevant WebBridge files before staging.
- Snapshot relevant WebBridge files after confirmation.
- Print the changed paths.
- Do not automatically delete default runtime data.
- If rollback is needed, require a separate explicit user confirmation and a path-specific rollback plan.

The first implementation should prefer the explicit package root if that still proves the already-running desktop process is the actor that confirms the package. If Alife cannot route a live desktop process to an explicit evidence root, the implementation plan must call out that default storage is unavoidable and must use the stricter snapshot rules.

## Local Health Role

Local health is only reachability evidence.

The runner may use:

```text
GET /api/alife/health
GET /api/alife/status
```

to prove there is an already-running Alife process responding before staging begins. This proves process reachability and status observability. It does not prove package confirmation, apply, or activation.

The apply proof is the combination of:

- Alife was reachable before staging.
- FOXD reached `staged/localConfirmationRequired/confirmInDesktop`.
- The runner did not call local apply or browser control paths.
- A human confirmed in the desktop process.
- FOXD later reached `applied/upToDate/none/requiresLocalConfirmation=false`.

The evidence text must keep this distinction visible.

## Timeout And Error States

The command should fail with clear, stable messages for:

- Missing `ALIFE_LIVE_DESKTOP_CONFIRMATION=true`.
- Missing `DOTNET_EXE`.
- Missing `ALIFE_ROOT`.
- Alife local management API unreachable before staging.
- Alife process becomes unreachable while waiting.
- Staging never reaches `confirmInDesktop`.
- Manual confirmation times out.
- FOXD reports `failed` after staging.
- FOXD reaches `upToDate` without first observing `confirmInDesktop`.
- Runner detects a forbidden local apply path was used.

Timeouts should be long enough for manual action, for example 5 minutes by default. A later implementation can add an environment variable such as `ALIFE_LIVE_DESKTOP_CONFIRMATION_TIMEOUT_MS`, but the default should remain conservative and documented.

## Security Boundaries

The command is developer evidence only. It is not a browser feature.

Security invariants:

- The browser never sees local health tokens.
- The browser never calls `127.0.0.1:8787` directly.
- FOXD server-side local health remains disabled by default unless explicitly enabled.
- The evidence runner may call loopback for health checks from the developer machine, not from browser code.
- No Web route is added that can trigger local package apply.
- No shell execution is exposed to frontend code.
- Any token used for the local management API is read only by the server-side runner path.

## Candidate Implementation Shape

The implementation should add a new command:

```text
npm run check:webbridge:live-desktop-confirmation
```

Likely FOXD-side files:

- `package.json`
- `scripts/check-webbridge-live-desktop-confirmation.ts`
- `scripts/test-integration-local.ts`
- focused tests near the existing WebBridge integration runner tests
- documentation updates in the WebBridge protocol and runbook docs

The runner should follow the same local server pattern as the existing smoke and active-apply commands. It should reuse existing WebBridge status polling helpers where practical, but keep the live desktop evidence command separate from `active-service-apply` so the output cannot be confused.

If the implementation needs a small C# helper, it should be limited to staging or evidence observation. It must not call `WebBridgeService.ApplyPackage(...)` for this command, because that would collapse the evidence back into active-service apply.

If Alife currently has no desktop-visible confirmation path that can be observed by this command, the implementation should stop at a failing but truthful evidence runner and document the missing Alife capability instead of faking confirmation from FOXD.

## Test Strategy

Use TDD for the implementation plan.

Node tests should prove:

- `package.json` exposes `check:webbridge:live-desktop-confirmation`.
- The command refuses to run unless `ALIFE_LIVE_DESKTOP_CONFIRMATION=true`.
- The command requires `DOTNET_EXE` and `ALIFE_ROOT`.
- The command records `EvidenceMode: live-desktop-manual-confirmation`.
- The command records `BrowserControlUsed: false`.
- The command records `LocalApiApplyEndpointUsed: false`.
- The command distinguishes `AlifeProcessReachable` from apply confirmation.
- The command times out with a clear message when manual confirmation is not observed.

Contract or static guard tests should prove:

- No frontend route or component exposes an apply or confirm button.
- No browser-side code imports `child_process`.
- No Web route is added that shells out for local confirmation.
- The live desktop command does not call the active-service evidence apply helper.

Manual evidence run should be opt-in and should be executed only after the user confirms Alife desktop is already running:

```powershell
$env:ALIFE_LIVE_DESKTOP_CONFIRMATION='true'
$env:DOTNET_EXE='C:\Users\hu shu\.dotnet\dotnet.exe'
$env:ALIFE_ROOT='D:\Alife'
npm run check:webbridge:live-desktop-confirmation
```

Full verification after implementation should include focused tests, full Jest suite, contract tests, typecheck, and production build with the normal temporary local build environment values.

## Acceptance Criteria

- A design and later plan preserve the distinction between isolated smoke, active-service apply, and live desktop manual confirmation.
- The future command is opt-in and named separately from `check:webbridge:active-apply`.
- The future command proves an already-running Alife process was reachable before staging.
- The future command reaches `staged/localConfirmationRequired/confirmInDesktop` before asking for manual action.
- The future command requires manual confirmation inside Alife desktop.
- The future command observes `applied/upToDate/none/requiresLocalConfirmation=false` after manual confirmation.
- The future command prints stable evidence lines.
- The future command does not expose local apply through browser UI or Web routes.
- Storage mode is explicit, snapshot-backed if default runtime storage is used, and never silently cleans user runtime data.

## Open Questions For The Implementation Plan

1. Can an already-running Alife desktop process be directed to an explicit evidence package root without changing Alife source?
2. Does the current Alife desktop UI already surface a confirm action for `confirmInDesktop`, or is an Alife-side UI/task needed first?
3. Does the local management status endpoint expose enough identity to prove the same already-running process remains alive during the manual wait?
4. Should the first implementation fail truthfully when no desktop confirmation path exists, or should it include a minimal Alife-side change in a separate branch and repository?

These questions do not block the FOXD design. They should be answered before writing the implementation plan, because they decide whether the first implementation can stay entirely in FOXD or needs a coordinated Alife task.
