# Alife WebBridge Protocol Status

Date: 2026-06-29

This document records the current local WebBridge status between FOXD Web and the active Alife .NET 9 runtime.

## Scope

The initial audit was read-only for `D:\Alife`. Follow-up fixes were made in the canonical Alife checkout and published as:

- `89023518 Fix WebBridge asset envelope parsing`
- `3884f38d feat: report WebBridge package milestones`

- No Alife runtime was started.
- The Alife source changes were limited to WebBridge HTTP contract handling, package install milestone reporting, and focused WebBridge tests.
- No live Alife long task was interrupted.
- No Unity workflow was used. Unity is treated as legacy/deprecated context only.
- Staging-only `InstallPackage` smokes were run against the local FOXD Web server with isolated package roots under `D:\FOXD\.worktrees`.

The current runtime direction is:

```text
FOXD Web Control Plane -> WebBridge HTTP contract -> Alife .NET 9 runtime
```

## Local Repository State

### FOXD

```text
Path: D:\FOXD
Branch: master
Tracking: github/master
State before this document: clean
Default remote: github git@github.com:hushu1232/ASRRAL-FOX.git
```

### Alife

```text
Path: D:\Alife
Branch: master
Tracking: alife-byastralfox/master
State during this audit: clean
Default upload remote: alife-byastralfox git@github.com:hushu1232/Alife-byastralfox.git
```

`D:\Alife` is the canonical Alife source checkout. Old references to `D:\FOXD\alife-service` are historical unless a future task explicitly restores the submodule workflow.

## .NET SDK Finding

The system `dotnet` currently resolves to SDK 8:

```text
C:\Program Files\dotnet\dotnet.exe
dotnet --version -> 8.0.422
dotnet --list-sdks -> 8.0.422 [C:\Program Files\dotnet\sdk]
```

Alife targets .NET 9:

```xml
<TargetFramework>net9.0-windows10.0.19041.0</TargetFramework>
```

Use the user-local .NET 9 SDK for Alife:

```powershell
& "C:\Users\hu shu\.dotnet\dotnet.exe" --version
& "C:\Users\hu shu\.dotnet\dotnet.exe" --list-sdks
```

Observed result:

```text
9.0.314
9.0.314 [C:\Users\hu shu\.dotnet\sdk]
```

## Source Inputs

This status is based on:

- Current FOXD Web code under `D:\FOXD\桌宠demo\新建文件夹\avatar-web-management`.
- Current Alife code under `D:\Alife`.
- `D:\Alife\AGENTS.md`.
- `D:\Alife\docs\alife-upload-rules.md`.
- Existing FOXD runbook `D:\FOXD\docs\webbridge-alife-local-integration.md`.
- Interview docs under `C:\Users\hu shu\Desktop\介绍\`:
  - `FOXD-Web平台面试项目介绍.md`
  - `FOXD_Web平台与微服务_面试视角企业级对比.md`
  - `FOXD_架构创新与技术含金量总结.md`

Important correction: the interview docs still discuss the old `alife-service` subtree in places. Current source-of-truth for Alife upload and verification is `D:\Alife`.

## Current Architecture Interpretation

FOXD Web is the Web control plane:

- User/auth/workspace/API envelope.
- Pet/avatar/assets configuration.
- WebBridge package manifest and file download.
- Sync status display and reporting API.
- Mock-based UI states until isolated Alife smoke is explicitly run.

Alife .NET 9 is the local runtime:

- `Alife.Function.WebBridge` is an Alife module.
- It pulls config/package data from FOXD Web through HTTP.
- It stages package files locally.
- It writes manifest/config draft/catalog output.
- It does not currently auto-apply packages.

The WebBridge direction is mostly pull-based:

```text
Alife -> FOXD Web: pull config, pull package manifest, download package files
Alife -> FOXD Web: optional push state / set avatar / package status milestones
FOXD Web -> Alife local API: not yet wired in Web UI as a live dependency
```

## Protocol Matrix

| Capability | FOXD Web endpoint/source | Alife .NET 9 source | Current status | Notes |
| --- | --- | --- | --- | --- |
| Package manifest | `GET /api/webbridge/packages/[id]/manifest`, `src/lib/webbridge/package-service.ts` | `WebApiClient.PullPackageManifest`, `WebBridgePackageManifest.cs`, `WebBridgePackageInstaller.Install` | Implemented and contract-tested | Web returns `{ success, data }`; Alife unwraps `data`. Manifest is install-only and requires local confirmation. |
| Package file download | `GET /api/webbridge/packages/[id]/files/[fileId]` | `WebApiClient.DownloadPackageFile`, `WebBridgePackageInstaller.Install` | Implemented | Alife uses `CreateRequest`, so bearer auth is applied to file URLs too. Hash is validated before staging. |
| Package staging | Web manifest + file bytes | `WebBridgePackageInstaller.cs`, `WebBridgeInstallModels.cs` | Implemented in Alife | Writes under package root, manifest, config draft, and catalog; returns `pendingActivation`. |
| Pet config pull | `GET/POST /api/pet/sync` | `WebApiClient.PullConfig`, `WebBridgeService.PullConfig` | Implemented and contract-tested | Alife sends client metadata; Web currently returns exported pet config. |
| Pet state push | `POST /api/pet/sync` | `WebApiClient.PushState`, `WebBridgeService.PushState` | Partial | Alife can POST a `WebAvatarConfig`, but Web route currently ignores request body and returns current export. This is not a true state round trip yet. |
| Set avatar | `POST /api/pet/set-avatar` | `WebApiClient.SetAvatar`, `WebBridgeService.SetAvatar` | Implemented | Web requires `{ avatarId }` and calls `petService.setAvatarAsPet`. |
| Asset manifest pull | `GET /api/pet/assets` | `WebApiClient.PullAssets`, `WebAssetManifest.cs`, `WebAssetSync.cs` | Fixed in Alife commit `89023518` | Web returns the standard success envelope around asset data. Alife now unwraps `data` with `DeserializeEnvelope<WebAssetManifest>()`. Run isolated smoke before enabling live asset sync. |
| Sync status query/report | `GET/POST /api/pet/sync/status`, `petSyncStatusService.ts`, `sync-status.ts` | `WebApiClient.ReportSyncMilestone`, `WebBridgeService.InstallPackage`, `WebBridgePackageInstaller.Install` | Implemented in Alife commit `3884f38d` and smoke-tested locally | Alife posts `manifestFetched`, `filesDownloaded`, `hashValidated`, `packageStaged`, and `confirmationRequested` during staging-only install. `packageFailed` is posted on install failure. Live activation still does not post `packageApplied` because activation/apply is not implemented. |
| Local Alife management API | Not clearly consumed by Web app yet | `AlifeManagementApiHost.cs`, `AlifeManagementApiService.cs` | Implemented in Alife, Web consumption pending | Alife exposes `/api/alife/health`, `/api/alife/status`, `/api/alife/qchat/status`, `/api/alife/vision/status`, `/api/alife/tts/status` on `127.0.0.1:8787` when enabled. |

## Manifest Contract

FOXD Web generates:

```ts
interface WebBridgePackageManifest {
  schemaVersion: 1;
  packageId: string;
  packageType: 'characterBundle';
  displayName: string;
  version: string;
  files: WebBridgePackageFileEntry[];
  configDraft: WebBridgeConfigDraft;
  activationPolicy: WebBridgeActivationPolicy;
}
```

Alife consumes:

```csharp
public sealed class WebBridgePackageManifest
{
    public int SchemaVersion { get; set; } = 1;
    public string PackageId { get; set; } = string.Empty;
    public string PackageType { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Version { get; set; } = string.Empty;
    public List<WebBridgePackageFile> Files { get; set; } = new();
    public WebBridgeConfigDraft ConfigDraft { get; set; } = new();
    public WebBridgeActivationPolicy ActivationPolicy { get; set; } = new();
}
```

Field compatibility is good:

- Web camelCase matches Alife `JsonNamingPolicy.CamelCase`.
- Web `live2DModelPath` maps to Alife `Live2DModelPath`.
- Web file entry has `id`; Alife ignores unknown JSON fields and consumes `kind`, `url`, `relativePath`, `sha256`, `size`.
- Web `activationPolicy.autoApply=false` and `requiresLocalConfirmation=true` matches Alife's install-only safety model.

Current fixed package ID:

```text
current-pet-character-bundle
```

Current fixed file ID:

```text
character-card
```

## Safety Model

The current package install path has the right safety direction:

- Web package endpoints require auth through `withAuth`.
- Alife `WebApiClient` applies bearer auth when `ApiToken` is configured.
- Alife package installer rejects path traversal by resolving full paths under the package root.
- Alife package installer validates SHA-256 when `sha256` is present.
- Package install result is `pendingActivation`.
- Web preflight rejects manifest shapes that allow auto-apply or omit hash metadata.

This supports a safe isolated smoke test:

```text
Pull manifest -> download file -> validate hash -> stage files -> write config draft/catalog -> stop
```

It does not support live activation yet.

## Initial Isolated Smoke Result

The staging-only smoke was run after the Alife asset-envelope fix and FOXD runbook update.

Runtime boundaries:

- FOXD Web server was started by the local integration runner and stopped after the smoke.
- Alife runtime was not started.
- Alife default storage was not used.
- Output stayed under an ignored local root:

```text
D:\FOXD\.worktrees\_alife-webbridge-integration\20260629045125
```

Smoke command path:

```text
FOXD local server -> login -> WebBridgeService.InstallPackage("current-pet-character-bundle")
```

Observed result:

```text
PackageId: current-pet-character-bundle
Status: pendingActivation
InstalledFiles: 1
```

Observed files:

```text
D:\FOXD\.worktrees\_alife-webbridge-integration\20260629045125\Packages\current-pet-character-bundle
D:\FOXD\.worktrees\_alife-webbridge-integration\20260629045125\Manifests\current-pet-character-bundle.json
D:\FOXD\.worktrees\_alife-webbridge-integration\20260629045125\ConfigDrafts\current-pet-character-bundle.json
D:\FOXD\.worktrees\_alife-webbridge-integration\20260629045125\catalog.json
```

Catalog status was confirmed as:

```json
{
  "packageId": "current-pet-character-bundle",
  "status": "pendingActivation"
}
```

## Milestone Smoke Result

After Alife commit `3884f38d`, a second staging-only smoke was run with the same safety boundaries:

- FOXD Web server was started by the local integration runner and stopped after the smoke.
- Alife runtime was not started.
- Alife default storage was not used.
- Output stayed under an ignored local root:

```text
D:\FOXD\.worktrees\_alife-webbridge-integration\20260629051431
```

Observed install result:

```text
PackageId: current-pet-character-bundle
Status: pendingActivation
InstalledFiles: 1
```

Observed Web status after Alife milestone posts:

```text
packageState: staged
summaryKind: localConfirmationRequired
primaryAction: confirmInDesktop
```

Two local Web prerequisites were required before this smoke could pass:

```powershell
npm run prisma:generate
npm run prisma:push
npm run build
```

Root cause of the failed first milestone smoke: local generated Prisma client and local PostgreSQL schema were behind the committed `PetSyncStatus` Prisma model/migration. `npm run prisma:generate` restored the `petSyncStatus` client delegate, and `npm run prisma:push` created the missing local `pet_sync_statuses` table.

## Important Gaps

1. `docs/webbridge-alife-local-integration.md` has been updated to use the current canonical Alife path `D:\Alife`. Any remaining `D:\FOXD\alife-service` mention should be treated as historical context, not the active workflow.

2. `GET /api/pet/assets` and Alife `PullAssets()` were misaligned:

   ```text
   Web: returns success envelope
   Previous Alife behavior: expected raw WebAssetManifest
   Current local Alife behavior: unwraps success envelope data
   ```

   This is fixed in Alife commit `89023518 Fix WebBridge asset envelope parsing`, and `alife-byastralfox/master` has been confirmed at that commit. The first staging-only smoke kept `SyncAssetsEnabled=false` and completed with `pendingActivation`.

3. Alife `PushState()` exists, but Web `/api/pet/sync` currently ignores POST body. This means "push desktop state back to Web" is not a real persisted state update yet.

4. Package milestone reporting is now implemented and smoke-tested. The local Web database must be in sync with Prisma schema before running this path; otherwise `/api/pet/sync/status` fails because `pet_sync_statuses` is missing.

5. Alife local management API exists, but Web does not yet clearly consume `/api/alife/*` as a real live status source. Current Web UI should continue to present mock/local-only states unless live integration is explicitly started.

6. Live activation is still intentionally not implemented or exercised. The smoke only proved package staging, not local activation/apply.

## Recommended Next Sequence

### Phase 1: Contract Cleanup Without Starting Alife

Completed:

- `89023518` records the tested WebBridge asset-envelope fix.
- `3884f38d` records tested WebBridge package milestone reporting.
- The package install path remains staging-only.

### Phase 2: Isolated Package Install Smoke

Completed once locally with no active Alife runtime start.

Use:

```text
PackageRootPath = D:\tmp\alife-webbridge-integration
AutoSyncEnabled = false
SyncAssetsEnabled = false
```

Call only:

```csharp
await service.InstallPackage("current-pet-character-bundle", CancellationToken.None);
```

Expected state:

```text
pendingActivation
```

Do not call any activation/apply step.

### Phase 3: Milestone Reporting

Completed for staging-only package install:

```text
manifestFetched
filesDownloaded
hashValidated
packageStaged
confirmationRequested
packageFailed
```

`packageApplied` remains pending because local confirmation/apply is not implemented yet.

### Phase 4: UI/UX Live-State Upgrade

Phase 2 and staging milestone reporting now have evidence. The next UI/UX work should:

- Replace mock-only WebBridge status with explicit mock/live modes.
- Show Alife local management health when available.
- Show package manifest/hash/staging status.
- Keep "requires local confirmation" visually distinct from "failed".
- Start the broader component/text-style unification work under the Insta360-style visual spec.

## Current Recommendation

The milestone gap is now clarified for staging-only install. Broad UI/UX work can start, but it should keep live activation clearly separate from staged/local-confirmation states.

The best next engineering task is:

```text
Expose the live/mock distinction in FOXD Web UI, using the smoke-tested `staged/localConfirmationRequired` status as the first real live state.
```
