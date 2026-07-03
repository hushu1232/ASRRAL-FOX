# FOXD Project Status - 2026-07-03

## Current Baseline

- Repository root: `D:\FOXD`
- Branch: `master`
- Remote: `github git@github.com:hushu1232/ASRRAL-FOX.git`
- Current pushed commit: `c4a1726 test: strengthen pet diagnostics locale coverage`
- Active product direction: FOXD Web control plane plus Alife .NET 9 local runtime.
- Unity desktop pet work is abandoned legacy context unless explicitly reopened.

## Runtime And Repository Roles

### FOXD

FOXD is the Web control plane:

- Authenticated Web platform.
- Pet/avatar/assets configuration.
- WebBridge package manifest and file endpoints.
- Pet sync status API and live diagnostics UI.
- Mock package simulation kept as a developer-only diagnostic reference.

### Alife

Canonical local Alife development checkout:

```text
D:\Alife
```

Remote:

```text
alife-byastralfox git@github.com:hushu1232/Alife-byastralfox.git
```

Current observed branch state:

```text
master...alife-byastralfox/master
```

Use the user-local .NET 9 SDK:

```powershell
& "C:\Users\hu shu\.dotnet\dotnet.exe" --version
```

### FOXD Alife Submodule

FOXD still contains an `alife-service` gitlink:

```text
160000 1225746bfeb74f3f8ee586414875087c9d060b2c 0 alife-service
```

The current operating rule is:

- Develop Alife code in `D:\Alife`.
- Push Alife to `Alife-byastralfox` first.
- Update the FOXD gitlink only when a parent-repository checkpoint explicitly needs to pin an Alife commit.
- Do not copy Alife source into FOXD as a snapshot.

## WebBridge State

Current verified flow:

```text
FOXD Web package -> Alife .NET WebBridge install -> isolated staging -> isolated apply -> FOXD sync status
```

Verified smoke command:

```powershell
$env:DOTNET_EXE='C:\Users\hu shu\.dotnet\dotnet.exe'; $env:ALIFE_ROOT='D:\Alife'; npm run check:webbridge:smoke
```

Verified smoke evidence:

```text
Alife WebBridge staged-to-applied smoke passed.
WebStatus: staged/localConfirmationRequired/confirmInDesktop
WebStatus: applied/upToDate/none/requiresLocalConfirmation=false
```

The smoke is isolated. It does not start or mutate the active Alife desktop runtime.

## Web UI State

`/dashboard/pet` is now sync-first:

1. `PageHeader`
2. `PetRuntimeSummary`
3. `PetSyncStatusPanel`
4. `PetDiagnosticsSection`
5. `PetSetupReadiness`
6. `PetPreviewCard`
7. `PetConfigEditor`

Expanded diagnostics order:

1. `PetSyncDiagnosticsPanel`
2. `WebBridgeMockStatusPanel`

`PetSyncDiagnosticsPanel` is read-only and renders:

- Integration snapshot.
- Version alignment.
- Blocking reason.
- Evidence trail.
- Smoke mapping as text only.

## Verification Snapshot

Verified after merge to `master`:

```text
UI regression: 8 suites, 42 tests passed
WebBridge package regression: 4 suites, 40 tests passed
npm run typecheck: passed
npm run build: passed
WebBridge staged-to-applied smoke: passed
D:\Alife status: clean
```

## Known Gaps

1. Web does not execute local smoke commands from the browser, by design.
2. Web still does not clearly consume Alife local management API health endpoints as a live runtime dependency.
3. Alife `PushState()` exists, but Web `/api/pet/sync` is not yet a full persisted desktop-state round trip.
4. The broader UI component/text-style normalization is pending.
5. The `alife-service` gitlink is older than the canonical `D:\Alife` checkout and should only be updated when a pinned parent checkpoint is required.

## Recommended Next Sequence

1. Update docs and runbooks to the 2026-07-03 state.
2. Draft the UI component/text-style specification using the current Pet/WebBridge console as the reference implementation.
3. Normalize shared component and text usage across the Web app in small page groups.
4. Add live Alife local management health only after the local API source, port, and user consent model are documented.
5. Keep Alife commits in `D:\Alife` and FOXD commits in `D:\FOXD`; never upload Alife as a copied source snapshot.
