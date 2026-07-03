# Alife WebBridge Runbook Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update local FOXD documentation so the Alife .NET 9 WebBridge state matches the verified 2026-07-03 staged-to-applied smoke and `/dashboard/pet` live diagnostics work.

**Architecture:** Keep this as documentation-only work in `D:\FOXD`. Treat older dated status files as historical evidence, update the living runbook and upload rules, and create a new dated project/protocol snapshot that records the current WebBridge, Alife, and UI state without changing code or protocol behavior.

**Tech Stack:** Markdown, PowerShell verification commands, Git, FOXD WebBridge docs, Alife .NET 9, Next.js Web app verification references.

---

## File Structure

Work from the FOXD repository root:

```powershell
cd D:\FOXD
```

Create:

- `docs/project-status-2026-07-03.md`: current project status snapshot after WebBridge diagnostics and staged-to-applied smoke.
- `docs/2026-07-03-alife-webbridge-protocol-status.md`: current WebBridge protocol and live diagnostics status snapshot.

Modify:

- `docs/webbridge-alife-local-integration.md`: living runbook; update from staging-only language to current isolated staged-to-applied smoke workflow while preserving safety boundaries.
- `docs/alife-submodule-upload-rules.md`: clarify current repository model, canonical `D:\Alife` workflow, submodule pointer policy, and fallback commands when `git submodule status` is unavailable.

Do not modify:

- `D:\Alife`
- `D:\FOXD\alife-service`
- Web app source files
- Prisma schema or migrations
- WebBridge route handlers
- Unity paths or historical archive files
- Global UI design tokens

Current facts to record:

- FOXD root: `D:\FOXD`
- FOXD remote: `github git@github.com:hushu1232/ASRRAL-FOX.git`
- FOXD branch: `master`
- FOXD pushed HEAD at plan time: `c4a1726 test: strengthen pet diagnostics locale coverage`
- Alife canonical checkout: `D:\Alife`
- Alife branch/tracking at plan time: `master...alife-byastralfox/master`
- Alife recent HEAD at plan time: `b7998e71 Harden QChat diagnostics redaction for trace`
- FOXD submodule path: `D:\FOXD\alife-service`
- FOXD gitlink at plan time: `1225746bfeb74f3f8ee586414875087c9d060b2c alife-service`
- Active runtime: Alife .NET 9
- User-local .NET 9 SDK path: `C:\Users\hu shu\.dotnet\dotnet.exe`
- Unity runtime: abandoned legacy context only
- Verified smoke command:

```powershell
$env:DOTNET_EXE='C:\Users\hu shu\.dotnet\dotnet.exe'; $env:ALIFE_ROOT='D:\Alife'; npm run check:webbridge:smoke
```

- Required smoke evidence:

```text
WebStatus: staged/localConfirmationRequired/confirmInDesktop
WebStatus: applied/upToDate/none/requiresLocalConfirmation=false
```

## Task 1: Living Runbook Current Smoke Update

**Files:**

- Modify: `docs/webbridge-alife-local-integration.md`

- [ ] **Step 1: Run the failing runbook freshness check**

Run:

```powershell
Select-String -Path docs\webbridge-alife-local-integration.md -Pattern "staged-to-applied smoke passed|WebStatus: applied/upToDate/none/requiresLocalConfirmation=false|PetSyncDiagnosticsPanel|c4a1726"
```

Expected before the edit: no matches for at least one of the required current-state phrases.

- [ ] **Step 2: Replace the Purpose section**

In `docs/webbridge-alife-local-integration.md`, replace the current `## Purpose` section with:

```markdown
## Purpose

This runbook verifies the FOXD WebBridge package path against the Alife .NET 9 runtime integration code without touching the active Alife runtime state.

The current verified smoke path is isolated staged-to-applied verification:

- FOXD Web package manifest access.
- FOXD Web package file download.
- Alife .NET 9 bearer-authenticated file download.
- SHA-256 validation.
- Local package staging.
- Local catalog and config draft creation.
- Local confirmation/apply simulation inside the isolated smoke harness.
- Web sync status transition from staged/local-confirmation-required to applied/up-to-date.

The smoke must stay isolated. It must not start, stop, restart, or mutate the active Alife runtime process or its default runtime storage.
```

- [ ] **Step 3: Replace the Safety Boundary section**

In `docs/webbridge-alife-local-integration.md`, replace the current `## Safety Boundary` section with:

```markdown
## Safety Boundary

If Alife has a long-running task in progress, do not run live runtime integration against the default Alife storage.

Safe boundaries:

- Do not start, stop, or restart the active Alife runtime process.
- Do not enable live `AutoSyncEnabled` against default runtime storage.
- Do not write into the default `AlifePath.StorageFolderPath\WebBridge`.
- Do not delete `Runtime`, `Storage`, `Outputs`, or any live task directories.
- Use the smoke runner's isolated package root.
- Treat the apply step in `npm run check:webbridge:smoke` as isolated smoke evidence, not as active runtime activation.

Current observed isolated smoke output root on `master`:

```text
D:\FOXD\.worktrees\_alife-webbridge-integration\<timestamp>
```

The smoke runner creates timestamped output under that ignored local root and reports the exact files it touched.
```

- [ ] **Step 4: Add a Current Verified Smoke section**

Add this section after `## FOXD Web Preflight`:

```markdown
## Current Verified Staged-To-Applied Smoke

Run from the Web app root:

```powershell
cd "D:\FOXD\桌宠demo\新建文件夹\avatar-web-management"
$env:DOTNET_EXE='C:\Users\hu shu\.dotnet\dotnet.exe'; $env:ALIFE_ROOT='D:\Alife'; npm run check:webbridge:smoke
```

Verified on FOXD commit:

```text
c4a1726 test: strengthen pet diagnostics locale coverage
```

Expected terminal evidence:

```text
Alife WebBridge staged-to-applied smoke passed.
WebStatus: staged/localConfirmationRequired/confirmInDesktop
WebStatus: applied/upToDate/none/requiresLocalConfirmation=false
```

Expected smoke stages:

```text
InstallStatus: pendingActivation
ApplyStatus: applied
InstalledFiles: 1
```

Expected output files are reported by the smoke command:

```text
PackageRootPath
ManifestPath
ConfigDraftPath
CharacterCardPath
ActiveConfigPath
CatalogPath
```

The smoke proves the WebBridge package can move through the staged-to-applied loop in an isolated harness. It does not prove that the active desktop runtime has applied a package in its default runtime storage.
```

- [ ] **Step 5: Update the Isolated Install Smoke section**

Rename `## Isolated Install Smoke` to:

```markdown
## Historical Staging-Only Install Smoke
```

Add this note at the top of that renamed section:

```markdown
This section records the older staging-only manual smoke shape. The current recommended check is `npm run check:webbridge:smoke`, which verifies both staged and applied Web status inside an isolated harness.
```

- [ ] **Step 6: Update the Next UI Work section**

Replace `## Next UI Work After Smoke` with:

```markdown
## Current UI Status After Smoke

The FOXD Web UI now has live WebBridge diagnostics on `/dashboard/pet`:

- `PetRuntimeSummary` remains the operator command strip.
- `PetSyncStatusPanel` remains the first live status panel.
- `PetDiagnosticsSection` remains collapsed by default.
- `PetSyncDiagnosticsPanel` shows live diagnostic evidence before simulation when diagnostics is expanded.
- `WebBridgeMockStatusPanel` remains simulation-only and appears after live diagnostics.

Current verified diagnostics states include:

```text
pendingPull
localConfirmationRequired
desktopOffline
failed
upToDate
unknown
```

The next UI work should focus on component/text-style normalization and clearer local-runtime setup guidance. Do not imply that Web can execute local smoke commands from the browser.
```

- [ ] **Step 7: Verify the runbook update**

Run:

```powershell
Select-String -Path docs\webbridge-alife-local-integration.md -Pattern "staged-to-applied smoke passed|WebStatus: applied/upToDate/none/requiresLocalConfirmation=false|PetSyncDiagnosticsPanel|c4a1726"
```

Expected: all four patterns have at least one match.

Run:

```powershell
Select-String -Path docs\webbridge-alife-local-integration.md -Pattern "active Alife runtime process|not as active runtime activation|Do not start, stop, or restart"
```

Expected: each safety-boundary phrase has at least one match.

- [ ] **Step 8: Commit Task 1**

Run:

```powershell
git add docs/webbridge-alife-local-integration.md
git commit -m "docs: refresh Alife WebBridge smoke runbook"
```

Expected: commit succeeds with only the living runbook changed.

## Task 2: Current Project Status Snapshot

**Files:**

- Create: `docs/project-status-2026-07-03.md`

- [ ] **Step 1: Run the failing status snapshot check**

Run:

```powershell
Test-Path -LiteralPath docs\project-status-2026-07-03.md
```

Expected before the edit:

```text
False
```

- [ ] **Step 2: Create the project status snapshot**

Create `docs/project-status-2026-07-03.md`:

```markdown
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
```

- [ ] **Step 3: Verify the project status snapshot**

Run:

```powershell
Select-String -Path docs\project-status-2026-07-03.md -Pattern "c4a1726|Alife .NET 9|staged/localConfirmationRequired|applied/upToDate|PetSyncDiagnosticsPanel|Unity desktop pet work is abandoned"
```

Expected: each pattern has at least one match.

- [ ] **Step 4: Commit Task 2**

Run:

```powershell
git add docs/project-status-2026-07-03.md
git commit -m "docs: snapshot FOXD Alife project status"
```

Expected: commit succeeds with only the new status snapshot.

## Task 3: Protocol Status Snapshot

**Files:**

- Create: `docs/2026-07-03-alife-webbridge-protocol-status.md`

- [ ] **Step 1: Run the failing protocol snapshot check**

Run:

```powershell
Test-Path -LiteralPath docs\2026-07-03-alife-webbridge-protocol-status.md
```

Expected before the edit:

```text
False
```

- [ ] **Step 2: Create the protocol status snapshot**

Create `docs/2026-07-03-alife-webbridge-protocol-status.md`:

```markdown
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

## Open Protocol Gaps

1. The active desktop runtime apply path has not been exercised through the real running Alife desktop process.
2. Web does not yet consume Alife local management API health as a live runtime dependency.
3. Web `/api/pet/sync` POST is not yet a persisted desktop-state round trip.
4. Asset sync should stay disabled until a dedicated asset smoke is planned.
5. The parent FOXD `alife-service` gitlink is a pinning mechanism, not the canonical Alife working tree.

## Recommended Next Engineering Direction

Use the verified WebBridge status as the stable baseline for UI/spec work:

1. Draft the shared component/text-style specification.
2. Normalize dashboard and pet-console components first.
3. Add local Alife management health only after documenting its port, process ownership, and consent model.
4. Keep protocol changes separate from UI polish.
```

- [ ] **Step 3: Verify the protocol snapshot**

Run:

```powershell
Select-String -Path docs\2026-07-03-alife-webbridge-protocol-status.md -Pattern "c4a1726|InstallStatus: pendingActivation|ApplyStatus: applied|PetSyncDiagnosticsPanel|does not execute local commands|Unity is not an active runtime"
```

Expected: each pattern has at least one match.

- [ ] **Step 4: Commit Task 3**

Run:

```powershell
git add docs/2026-07-03-alife-webbridge-protocol-status.md
git commit -m "docs: record current Alife WebBridge protocol status"
```

Expected: commit succeeds with only the new protocol snapshot.

## Task 4: Upload Rules And Submodule Clarification

**Files:**

- Modify: `docs/alife-submodule-upload-rules.md`

- [ ] **Step 1: Run the failing upload-rules clarity check**

Run:

```powershell
Select-String -Path docs\alife-submodule-upload-rules.md -Pattern "git ls-files -s alife-service|submodule status command can fail|canonical local checkout remains D:\Alife|gitlink may intentionally lag"
```

Expected before the edit: no matches for at least one phrase.

- [ ] **Step 2: Update Current Repository Model**

In `docs/alife-submodule-upload-rules.md`, append this paragraph to `## Current Repository Model`:

```markdown
As of 2026-07-03, the canonical local checkout remains `D:\Alife`. The FOXD `alife-service` path is a gitlink pin in the parent repository. The gitlink may intentionally lag behind the canonical `D:\Alife` checkout when FOXD Web work does not require pinning a new Alife commit.
```

- [ ] **Step 3: Add submodule status fallback commands**

After `## Local Folder Roles`, add:

```markdown
## Submodule Inspection Fallback

If `git submodule status` fails because the local Git shell environment cannot find Unix helper tools such as `basename` or `sed`, inspect the gitlink directly from FOXD:

```powershell
git -C D:\FOXD ls-files -s alife-service
```

Expected output shape:

```text
160000 <alife-commit> 0 alife-service
```

Inspect the submodule checkout itself with:

```powershell
git -C D:\FOXD\alife-service status --short --branch
git -C D:\FOXD\alife-service rev-parse HEAD
```

These commands do not replace the upload flow. They only confirm which commit FOXD currently pins.
```

- [ ] **Step 4: Add a no-snapshot reminder**

Append this paragraph to `## Version Snapshot Policy`:

```markdown
For FOXD documentation snapshots, record commit hashes and verification output in Markdown. Do not copy Alife source into FOXD to create a version snapshot. If a parent repository checkpoint needs to include Alife, update only the `alife-service` gitlink after the Alife commit is pushed.
```

- [ ] **Step 5: Verify upload-rules clarity**

Run:

```powershell
Select-String -Path docs\alife-submodule-upload-rules.md -Pattern "git ls-files -s alife-service|canonical local checkout remains|gitlink may intentionally lag|Do not copy Alife source into FOXD"
```

Expected: each pattern has at least one match.

- [ ] **Step 6: Commit Task 4**

Run:

```powershell
git add docs/alife-submodule-upload-rules.md
git commit -m "docs: clarify Alife submodule status workflow"
```

Expected: commit succeeds with only upload-rules documentation changed.

## Task 5: Documentation Verification And Final Checks

**Files:**

- Verify only unless a command exposes a documentation defect.

- [ ] **Step 1: Verify required current-state references**

Run:

```powershell
Select-String -Path docs\webbridge-alife-local-integration.md,docs\project-status-2026-07-03.md,docs\2026-07-03-alife-webbridge-protocol-status.md,docs\alife-submodule-upload-rules.md -Pattern "Alife .NET 9|C:\Users\hu shu\.dotnet\dotnet.exe|D:\Alife|c4a1726|WebStatus: staged/localConfirmationRequired/confirmInDesktop|WebStatus: applied/upToDate/none/requiresLocalConfirmation=false"
```

Expected: every file has relevant matches; `c4a1726` appears in the new dated status/protocol docs and the runbook.

- [ ] **Step 2: Verify Unity is framed only as legacy or inactive**

Run:

```powershell
Select-String -Path docs\project-status-2026-07-03.md,docs\2026-07-03-alife-webbridge-protocol-status.md -Pattern "Unity"
```

Expected: matches only say Unity is abandoned, legacy, or not active.

- [ ] **Step 3: Verify no forbidden marker text exists in new docs**

Run:

```powershell
$unfinishedMarkers = @(
  ('TB' + 'D'),
  ('FIX' + 'ME'),
  ('PLACE' + 'HOLDER'),
  '\?\?'
)
Select-String -Path docs\project-status-2026-07-03.md,docs\2026-07-03-alife-webbridge-protocol-status.md -Pattern ($unfinishedMarkers -join '|')
```

Expected: no matches.

- [ ] **Step 4: Verify markdown file list**

Run:

```powershell
git diff --name-only HEAD~4..HEAD
```

Expected output:

```text
docs/2026-07-03-alife-webbridge-protocol-status.md
docs/alife-submodule-upload-rules.md
docs/project-status-2026-07-03.md
docs/webbridge-alife-local-integration.md
```

- [ ] **Step 5: Run whitespace check**

Run:

```powershell
git diff --check
```

Expected: no output and exit code 0.

- [ ] **Step 6: Confirm repository status**

Run:

```powershell
git status --short --branch
```

Expected: clean working tree on `master`, ahead of `github/master` by the documentation commits.

- [ ] **Step 7: Commit a correction only if verification found a defect**

If a verification command exposes an actual documentation defect, make the smallest correction and run:

```powershell
git add docs/webbridge-alife-local-integration.md docs/project-status-2026-07-03.md docs/2026-07-03-alife-webbridge-protocol-status.md docs/alife-submodule-upload-rules.md
git commit -m "docs: fix Alife WebBridge status verification notes"
```

Expected: this step is skipped when Tasks 1-4 already pass verification.

## Self-Review Checklist

Spec coverage:

- The living runbook reflects staged-to-applied smoke, not only staging-only smoke.
- New dated status docs record `c4a1726`, Alife .NET 9, `D:\Alife`, and the verified smoke evidence.
- Upload rules clarify the canonical Alife checkout and gitlink behavior without changing the submodule.
- Unity is described only as inactive legacy context.
- No code, protocol, Alife, Prisma, or UI token files are changed.

Marker scan:

- This plan contains no unfinished marker words in implementation instructions.

Type consistency:

- File paths match the current repository layout.
- Smoke command matches the command already verified on `master`.
- Web status strings match the staged-to-applied smoke output.
