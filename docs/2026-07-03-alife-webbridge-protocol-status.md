# Alife WebBridge Protocol Status

Date: 2026-07-03

## Scope

This document records the current WebBridge protocol status after the FOXD `/dashboard/pet` live diagnostics work and the verified staged-to-applied smoke.

The active runtime direction is:

```text
FOXD Web Control Plane -> WebBridge HTTP contract -> Alife .NET 9 runtime integration code
```

Unity is not an active runtime for this path.

## 2026-07-07 Checkpoint

Latest verified FOXD commit:

```text
30e6719 test: lock pet dashboard sync-first order
```

Since the 2026-07-03 baseline:

- `/dashboard/pet` sync diagnostics were normalized around the shared `EvidenceGrid` primitive.
- WebBridge mock diagnostics visible copy moved to `pet.webbridgeMock` locale keys in `en`, `zh-CN`, and `ja`.
- Advisory Alife local health remains read-only and server-mediated.
- The page order is guarded as `PetRuntimeSummary` before `AlifeLocalHealthPanel` before `PetSyncStatusPanel`.
- Browser-side diagnostics still do not call Alife directly, run PowerShell, spawn processes, or auto-apply packages.

Latest merged-master verification:

```text
npm run test -- --runInBand: 99 suites, 992 tests passed
npm run typecheck: passed
npm run build: passed with temporary JWT_SECRET and DATABASE_URL
```

Build note: production build collection requires normal env values such as `JWT_SECRET` and `DATABASE_URL`.

## Current Evidence

FOXD verified commit:

```text
c4a1726 test: strengthen pet diagnostics locale coverage
```

Verified smoke command:

```powershell
$env:DOTNET_EXE='C:\Users\hu shu\.dotnet\dotnet.exe'; $env:ALIFE_ROOT='D:\Alife'; npm run check:webbridge:smoke
```

Verified smoke output:

```text
Alife WebBridge staged-to-applied smoke passed.
InstallStatus: pendingActivation
ApplyStatus: applied
WebStatus: staged/localConfirmationRequired/confirmInDesktop
WebStatus: applied/upToDate/none/requiresLocalConfirmation=false
```

The smoke writes under an isolated local package root reported by the runner. It is not live already-running desktop process activation.

## Protocol Matrix

| Capability | FOXD Web source | Alife source | Current status | Notes |
| --- | --- | --- | --- | --- |
| Package manifest | `GET /api/webbridge/packages/[id]/manifest` | `WebApiClient.PullPackageManifest` | Implemented and smoke-tested | Manifest remains local-confirmation guarded. |
| Package file download | `GET /api/webbridge/packages/[id]/files/[fileId]` | `WebApiClient.DownloadPackageFile` | Implemented and smoke-tested | Bearer auth and SHA-256 validation are covered. |
| Package staging | Web manifest and file bytes | WebBridge package installer | Implemented and smoke-tested | Produces staged/local-confirmation-required Web status. |
| Isolated staged-to-applied smoke | `npm run check:webbridge:smoke` | Isolated harness using the Alife WebBridge apply path | Implemented and smoke-tested | Isolated harness evidence only; uses the runner-reported package root and makes no active runtime or default storage activation claim. |
| Active-service apply evidence | `npm run check:webbridge:active-apply` | `WebBridgeService.ApplyPackage(...)` and `packageApplied` milestone reporting | Implemented and evidence-tested | Opt-in via `ALIFE_ACTIVE_APPLY_EVIDENCE=true`; uses explicit `WEBBRIDGE_PACKAGE_ROOT`; verifies active-service apply evidence, not live already-running desktop process or default storage activation. |
| Live already-running desktop confirmation | `npm run check:webbridge:live-desktop-confirmation` | Already-running Alife desktop process plus local management health | Implemented as opt-in manual evidence runner | Requires `ALIFE_LIVE_DESKTOP_CONFIRMATION=true`; runner does not apply locally; success requires manual confirmation inside Alife desktop. |
| Sync status query/report | `GET/POST /api/pet/sync/status` | Alife milestone/status reporting | Implemented and UI-visible | UI now exposes diagnostics evidence. |
| Pet config pull | `GET/POST /api/pet/sync` | Alife config pull | Implemented and persisted | POST records a desktop config-pull snapshot in `PetSyncStatus`; live already-running desktop process confirmation remains separate from `/api/pet/sync`. |
| Asset manifest pull | `GET /api/pet/assets` | Alife asset manifest pull | Fixed in Alife history | Keep `SyncAssetsEnabled=false` unless a dedicated asset smoke is planned. |
| Local Alife management API | `GET /api/pet/alife/local-health` | Alife local API host | Advisory health integrated | Disabled by default, server-side only, and read-only. Broader management actions remain out of scope. |

## Web Status Mapping

The Web UI now displays the following live sync summary kinds:

```text
unknown
desktopOffline
pendingPull
localConfirmationRequired
upToDate
failed
```

The diagnostic panel maps these to:

- `pendingPull`: waiting for Alife .NET to pull the Web package.
- `localConfirmationRequired`: package staged locally; confirm inside Alife .NET.
- `desktopOffline`: Alife .NET offline or not recently reported.
- `failed`: inspect error evidence before retrying.
- `upToDate`: package applied and current.
- `unknown`: incomplete evidence.

## UI Diagnostics Boundary

`PetSyncDiagnosticsPanel` is read-only:

- It consumes `DesktopSyncStatus | null`.
- It does not fetch.
- It does not mutate state.
- It does not execute local commands.
- It does not call Alife directly.
- It renders the smoke command as text only.

Expanded diagnostics order:

```text
PetSyncDiagnosticsPanel
WebBridgeMockStatusPanel
```

## FOXD Web Local Health Adapter

FOXD now exposes an authenticated, disabled-by-default server-side adapter for Alife local management health.

- FOXD route: `GET /api/pet/alife/local-health`
- Local Alife source endpoint: `GET http://127.0.0.1:8787/api/alife/health` and `GET http://127.0.0.1:8787/api/alife/status`
- Enable flag: `FOXD_ALIFE_LOCAL_HEALTH_ENABLED=true`
- Token: `FOXD_ALIFE_LOCAL_HEALTH_TOKEN`
- Boundary: Web UI receives sanitized advisory status only. It does not read the token, call loopback directly, start Alife, stop Alife, restart Alife, apply packages, or execute shell commands.

## Open Protocol Gaps

1. Live already-running desktop confirmation has an opt-in FOXD runner (`npm run check:webbridge:live-desktop-confirmation`); real pass/fail depends on an already-running Alife desktop process exposing the staging and confirmation path.
2. Web local health awareness is advisory and disabled by default; it is not live already-running desktop process confirmation.
3. Web `/api/pet/sync` POST now persists config-pull evidence; live already-running desktop process confirmation remains separate.
4. Asset sync should stay disabled until a dedicated asset smoke is planned.
5. The parent FOXD `alife-service` gitlink is a pinning mechanism, not the canonical Alife working tree.

## Recommended Next Engineering Direction

Use the verified WebBridge status as the stable baseline. UI/spec Batch A has been completed and pushed, so the next engineering step should be exactly one protocol gap, not another mixed UI/protocol batch:

1. A successful live desktop confirmation evidence run against a real already-running Alife desktop process, or
2. Dedicated asset sync smoke.

Keep local Alife health advisory, opt-in, server-side, and documented before adding any broader management API dependency. Keep protocol changes separate from UI polish.
