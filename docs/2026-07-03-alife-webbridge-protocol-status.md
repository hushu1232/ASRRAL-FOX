# Alife WebBridge Protocol Status

Date: 2026-07-03

## Scope

This document records the current WebBridge protocol status after the FOXD `/dashboard/pet` live diagnostics work and the verified staged-to-applied smoke.

The active runtime direction is:

```text
FOXD Web Control Plane -> WebBridge HTTP contract -> Alife .NET 9 runtime integration code
```

Unity is not an active runtime for this path.

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

The smoke writes under an isolated local package root reported by the runner. It is not active desktop runtime activation.

## Protocol Matrix

| Capability | FOXD Web source | Alife source | Current status | Notes |
| --- | --- | --- | --- | --- |
| Package manifest | `GET /api/webbridge/packages/[id]/manifest` | `WebApiClient.PullPackageManifest` | Implemented and smoke-tested | Manifest remains local-confirmation guarded. |
| Package file download | `GET /api/webbridge/packages/[id]/files/[fileId]` | `WebApiClient.DownloadPackageFile` | Implemented and smoke-tested | Bearer auth and SHA-256 validation are covered. |
| Package staging | Web manifest and file bytes | WebBridge package installer | Implemented and smoke-tested | Produces staged/local-confirmation-required Web status. |
| Isolated apply | Smoke runner | Alife WebBridge apply path used by smoke | Implemented for isolated smoke | Produces applied/up-to-date Web status. |
| Sync status query/report | `GET/POST /api/pet/sync/status` | Alife milestone/status reporting | Implemented and UI-visible | UI now exposes diagnostics evidence. |
| Pet config pull | `GET/POST /api/pet/sync` | Alife config pull | Implemented | Web POST body persistence remains partial. |
| Asset manifest pull | `GET /api/pet/assets` | Alife asset manifest pull | Fixed in Alife history | Keep `SyncAssetsEnabled=false` unless a dedicated asset smoke is planned. |
| Local Alife management API | Not consumed by Web UI yet | Alife local API host | Pending Web integration | Needs consent and port/source documentation before UI dependency. |

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

1. The active desktop runtime apply path has not been exercised through the real running Alife desktop process.
2. Web local health awareness is advisory and disabled by default; it is not an active desktop runtime apply confirmation.
3. Web `/api/pet/sync` POST is not yet a persisted desktop-state round trip.
4. Asset sync should stay disabled until a dedicated asset smoke is planned.
5. The parent FOXD `alife-service` gitlink is a pinning mechanism, not the canonical Alife working tree.

## Recommended Next Engineering Direction

Use the verified WebBridge status as the stable baseline for UI/spec work:

1. Draft the shared component/text-style specification.
2. Normalize dashboard and pet-console components first.
3. Add local Alife management health only after documenting its port, process ownership, and consent model.
4. Keep protocol changes separate from UI polish.
