# Active WebBridge Apply Evidence Design - 2026-07-08

## Goal

Add an opt-in verification path that proves the Alife .NET WebBridge service apply flow can move a FOXD package from staged to applied while preserving the existing safety boundary around the active desktop runtime.

## Current State

FOXD already has an isolated staged-to-applied smoke:

```powershell
$env:DOTNET_EXE='C:\Users\hu shu\.dotnet\dotnet.exe'; $env:ALIFE_ROOT='D:\Alife'; npm run check:webbridge:smoke
```

That smoke starts a local FOXD server, creates a temporary WebBridge package root, instantiates `Alife.Function.WebBridge.WebBridgeService`, installs the package, applies it, verifies `ActiveConfig`, and checks that FOXD Web status reaches:

```text
WebStatus: applied/upToDate/none/requiresLocalConfirmation=false
```

The current protocol documents correctly state that this is isolated harness evidence, not proof that a real already-running Alife desktop process applied a package in its default runtime storage.

The canonical Alife checkout at `D:\Alife` already contains the service-level apply path:

- `WebBridgeService.ApplyPackage(packageId)` calls `WebBridgePackageInstaller.ApplyPackage(...)`.
- `WebBridgePackageInstaller.ApplyPackage(...)` writes `ActiveConfig/<packageId>.json` and marks the local catalog entry `applied`.
- `WebBridgeService.ApplyPackage(...)` reports `packageApplied` back to FOXD through `/api/pet/sync/status`.
- Alife unit tests cover service-level apply and `packageApplied` milestone reporting.

## Proposed Scope

Create a separate FOXD verification path named `check:webbridge:active-apply` that records active WebBridge service apply evidence without pretending to be a live desktop process automation.

The first version verifies the active Alife WebBridge service apply path using the canonical `D:\Alife` sources and an explicit package root. It does not start, stop, restart, or remote-control the active Alife desktop runtime.

The command must be opt-in:

```powershell
$env:ALIFE_ACTIVE_APPLY_EVIDENCE='true'
$env:DOTNET_EXE='C:\Users\hu shu\.dotnet\dotnet.exe'
$env:ALIFE_ROOT='D:\Alife'
$env:WEBBRIDGE_PACKAGE_ROOT='D:\tmp\foxd-active-apply-evidence'
npm run check:webbridge:active-apply
```

If `ALIFE_ACTIVE_APPLY_EVIDENCE` is not `true`, the command exits non-zero with a clear message explaining that active apply evidence is disabled by default.

## Evidence Model

The command prints stable machine-readable evidence lines:

```text
Active WebBridge apply evidence passed.
EvidenceMode: active-service-apply
AlifeRoot: D:\Alife
PackageId: current-pet-character-bundle
InstallStatus: pendingActivation
ApplyStatus: applied
InstalledFiles: <count>
PackageRootPath: <path>
ManifestPath: <path>
ConfigDraftPath: <path>
ActiveConfigPath: <path>
CatalogPath: <path>
DefaultRuntimeStorageTouched: false
WebStatus: staged/localConfirmationRequired/confirmInDesktop
WebStatus: applied/upToDate/none/requiresLocalConfirmation=false
```

`DefaultRuntimeStorageTouched` is `false` when `WEBBRIDGE_PACKAGE_ROOT` is supplied. The first implementation requires `WEBBRIDGE_PACKAGE_ROOT` and refuses to use implicit default Alife storage.

This keeps the evidence stronger than the old isolated smoke because it is explicitly positioned as an active Alife WebBridge service apply check, but it does not overclaim that an already-running desktop process received a local user confirmation.

## Architecture

Add a second C# smoke project or reuse the existing smoke project behind a mode flag. The preferred implementation is a new project under `tools/webbridge-active-apply-evidence` so the normal isolated smoke remains stable and easy to reason about.

The new project references `D:\Alife` through the same overridable `AlifeRoot` MSBuild property used by the existing `tools/webbridge-smoke` project.

The Node runner follows the existing `check-webbridge-staged-applied.ts` pattern:

- Locate the FOXD repository root.
- Require `DOTNET_EXE`.
- Require `ALIFE_ROOT`.
- Require `ALIFE_ACTIVE_APPLY_EVIDENCE=true`.
- Require `WEBBRIDGE_PACKAGE_ROOT`.
- Start the existing local FOXD test server mode.
- Run the C# evidence project with `dotnet run`.
- Preserve and display the evidence lines from the C# process.

## Data Flow

1. FOXD local test server starts.
2. The evidence runner logs in with the existing demo credentials used by the smoke harness.
3. The runner updates the current pet config with a unique evidence marker.
4. `WebBridgeService.InstallPackage(...)` pulls the package manifest and file from FOXD.
5. Alife writes staged files, manifest, config draft, and catalog under `WEBBRIDGE_PACKAGE_ROOT`.
6. FOXD status is checked for `staged/localConfirmationRequired/confirmInDesktop`.
7. `WebBridgeService.ApplyPackage(...)` applies the staged package.
8. Alife writes `ActiveConfig/<packageId>.json`, updates catalog to `applied`, and reports `packageApplied`.
9. FOXD status is checked for `applied/upToDate/none/requiresLocalConfirmation=false`.
10. The runner prints evidence paths and status lines.

## Safety Boundaries

This work must not:

- Modify `D:\Alife` source unless a later implementation task explicitly opens an Alife change.
- Use the FOXD `alife-service` gitlink as the source of truth.
- Use implicit default `AlifePath.StorageFolderPath\WebBridge`.
- Start, stop, or restart Alife.
- Add a browser UI action.
- Add a management API apply endpoint.
- Execute PowerShell from browser code.
- Change Prisma schema or migrations.
- Change WebBridge package manifest or file route behavior.
- Enable asset sync.
- Treat local health as apply confirmation.

The command is a developer verification command only. It is not exposed through the Web UI.

## Documentation Updates

After verification passes, update:

- `docs/webbridge-alife-local-integration.md`
- `docs/2026-07-03-alife-webbridge-protocol-status.md`
- `docs/project-status-2026-07-03.md`

The documents must distinguish:

- Isolated staged-to-applied smoke.
- Active Alife WebBridge service apply evidence.
- Still-separate live already-running desktop process apply confirmation, if the project later requires it.

## Test Strategy

Use TDD.

Add Node/Jest tests that prove:

- `package.json` exposes `check:webbridge:active-apply`.
- The integration local runner accepts a `webbridge-active-apply` mode.
- The active-apply runner refuses to run unless `ALIFE_ACTIVE_APPLY_EVIDENCE=true`.
- The runner requires `WEBBRIDGE_PACKAGE_ROOT`.
- The runner invokes the dedicated C# project with the canonical Alife root property.

Add C# tests or source guardrails that prove:

- The active evidence project references `Alife.Function.WebBridge`.
- The evidence output includes `EvidenceMode: active-service-apply`.
- The evidence output includes `DefaultRuntimeStorageTouched: false`.
- The evidence project calls `WebBridgeService.ApplyPackage(...)`.

Run focused tests first, then:

```powershell
npm run test -- --runInBand
npm run test:contracts -- --runInBand
npm run typecheck
$env:JWT_SECRET='temporary-verification-secret-at-least-32-chars'; $env:DATABASE_URL='file:./dev.db'; npm run build
```

Live evidence command is opt-in and should run only when the user explicitly allows it for the current machine:

```powershell
$env:ALIFE_ACTIVE_APPLY_EVIDENCE='true'
$env:DOTNET_EXE='C:\Users\hu shu\.dotnet\dotnet.exe'
$env:ALIFE_ROOT='D:\Alife'
$env:WEBBRIDGE_PACKAGE_ROOT='D:\tmp\foxd-active-apply-evidence'
npm run check:webbridge:active-apply
```

## Acceptance Criteria

- A new opt-in command exists: `npm run check:webbridge:active-apply`.
- The command refuses to run without explicit opt-in.
- The command refuses to run without an explicit package root.
- Successful output records install, apply, local file paths, catalog path, and FOXD Web status transitions.
- Documentation records active service apply evidence without claiming live already-running desktop runtime activation.
- No browser UI, Prisma, Alife source, or gitlink changes are required for the first implementation.

## Approval

This design intentionally closes the next protocol gap one step at a time. It upgrades evidence from isolated smoke to active Alife WebBridge service apply evidence while preserving the stronger safety boundary needed before any future live desktop process automation.
