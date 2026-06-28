# FOXD Project Status - 2026-06-28

## Current Baseline

- Repository root: `D:\FOXD`
- Current branch: `master`
- Current commit: `270e56b fix: refresh current desktop sync reports`
- Main product direction: FOXD Web control plane + Alife .NET local Agent runtime.
- Unity desktop pet is no longer the main runtime direction. Treat Unity work as abandoned legacy validation material unless explicitly reopened.

## Repository Layout

Active or relevant roots:

- `alife-service/`
  - Git submodule configured in `.gitmodules`.
  - Remote: `git@github.com:hushu1232/Alife-byastralfox.git`
  - Branch: `master`
  - Local `.git` pointer confirms it is attached as a submodule: `gitdir: ../.git/modules/alife-service`
  - Current role: Alife .NET Agent runtime and WebBridge execution side.

- `桌宠demo/新建文件夹/avatar-web-management/`
  - Current role: FOXD Web platform / Web control plane.
  - Contains WebBridge package API, pet config, sync status API, sync status UI, tests, Prisma schema and migrations.

- `桌宠demo/新建文件夹/backend/`
  - Legacy or auxiliary backend service area. Needs separate review before deciding whether it is still part of the current product.

- `桌宠demo/新建文件夹/gpt-sovits-service/`
  - Voice service integration area. It is not Unity-specific by itself.

- `桌宠demo/新建文件夹/live2d-widget/`
  - Web/Live2D widget area. It may remain useful for web preview or runtime visualization and should not be treated as Unity residue just because it is Live2D-related.

- `桌宠demo/新建文件夹/astralfox-rigging/`
  - Active rigging/model tooling service retained.
  - Deployment/runtime wording has been moved to Alife/runtime semantics.

Suspicious or cleanup-review roots:

- `.alife-service-residual-20260627-182230/`
  - Looks like a previous residual/backup folder. Review before deletion.

- `妗屽疇demo/`
  - Looks like a mojibake duplicate or encoding-corrupted folder name. Review contents before deletion.

- `.claude/` folders
  - Currently untracked. They are tool-local files, not product code.

## WebBridge State

The current architecture should be described as:

```text
FOXD Web Control Plane
  -> exposes current desired pet/agent configuration and WebBridge package APIs
  -> shows Alife sync state

Alife .NET Agent Runtime
  -> pulls WebBridge manifest/files
  -> verifies hashes
  -> stages and applies local runtime configuration
  -> reports sync milestones back to FOXD
```

Canonical version flow:

```text
PetConfig.updatedAt.getTime()
 -> pet export version
 -> WebBridge manifest.version
 -> Alife packageVersion
 -> POST /api/pet/sync/status packageVersion
 -> Web compares with webConfigVersion
```

Alife must not invent a local package version. It should report the exact `version` from the WebBridge manifest.

Current Web-side sync status contract:

- `GET /api/pet/sync/status`
- `POST /api/pet/sync/status`

Supported milestones:

- `manifestFetched`
- `filesDownloaded`
- `hashValidated`
- `packageStaged`
- `confirmationRequested`
- `packageApplied`
- `packageFailed`

Supported error codes:

- `WEBBRIDGE_OFFLINE`
- `PACKAGE_HASH_MISMATCH`
- `LOCAL_CONFIRMATION_REQUIRED`
- `PACKAGE_APPLY_FAILED`
- `PACKAGE_DOWNLOAD_FAILED`
- `PACKAGE_SECURITY_BLOCKED`

Expected Alife-side next implementation area:

- `alife-service/sources/Alife.Function/Alife.Function.WebBridge/WebApiClient.cs`
- `alife-service/sources/Alife.Function/Alife.Function.WebBridge/WebBridgeService.cs`
- `alife-service/sources/Alife.Function/Alife.Function.WebBridge/WebAssetSync.cs`
- `alife-service/Tests/Alife.Test.Framework/WebBridgeServiceTests.cs`

## Unity Residue Check

Unity residue has been reduced in two cleanup passes. The active Web `src/tests` and Alife `sources/Tests` areas are clean for the checked Unity patterns. The old Unity project, Unity MCP tooling, and historical devlog were removed from the working tree.

Large Unity areas removed in the second cleanup pass:

- `桌宠demo/新建文件夹/AstralFox/`
  - Git-tracked files removed: 5646
  - Remaining physical directory after cleanup: no

- `桌宠demo/新建文件夹/unity-mcp/`
  - Git-tracked files removed: 1834
  - Remaining physical directory after cleanup: no

- `桌宠demo/新建文件夹/devlog/`
  - Historical Unity-era project logs removed.
  - Remaining physical directory after cleanup: no

- `桌宠demo/devlog/`
  - Historical Unity-era project logs removed.
  - Remaining physical directory after cleanup: no

- `astralfox-rigging/`
  - Removed as an older duplicate rigging service copy.
  - Remaining physical directory after cleanup: no

Old Unity docs/plans removed:

- `docs/superpowers/plans/2026-06-09-astralfox-unity-runbook.md`
  - Old Unity runtime closure plan.
  - Status: removed.

- `桌宠demo/新建文件夹/avatar-web-management/docs/superpowers/specs/2026-05-30-unity-aichat-reference-analysis.md`
  - Old Unity AI chat reference analysis under the Web project.
  - Status: removed.

Additional non-active or legacy Unity references found after the first cleanup pass:

- `桌宠demo/新建文件夹/gpt-sovits-service/DEPLOYMENT.md`
  - Still describes a Unity desktop client and Unity fallback behavior.
  - Status: documentation should be rewritten for Alife runtime if this voice service remains in the current architecture.

- `桌宠demo/新建文件夹/backend/`
  - Unity/Tuanjie helper scripts were removed:
    - `extract_all.py`
    - `extract_dlls.py`
    - `launch_tuanjie.py`
    - `monitor_mcp.py`
    - `restart_tuanjie.py`
  - Remaining ASR/TTS/LLM gateway files were kept and comments were updated to Alife/runtime semantics.

- `桌宠demo/新建文件夹/gpt-sovits-service/DEPLOYMENT.md`
  - Updated from Unity desktop client wording to Alife runtime wording.

Unity references in active Web code/tests were cleaned in the first low-risk pass:

- `桌宠demo/新建文件夹/avatar-web-management/tests/schemas/pet-export-schema.json`
  - Now describes the pet export contract as consumed by the Alife WebBridge client.

- `桌宠demo/新建文件夹/avatar-web-management/tests/contract/pet-export-schema.test.ts`
  - Test name/comments now describe this as an Alife WebBridge client contract.

- `桌宠demo/新建文件夹/avatar-web-management/src/lib/behavior/time-awareness.ts`
  - Comment now says the algorithm is shared by Web and Alife runtime.

- `桌宠demo/新建文件夹/avatar-web-management/src/lib/openapi.json`
  - API summaries/descriptions now mention Alife WebBridge client and Alife desktop runtime sessions.

- `桌宠demo/新建文件夹/avatar-web-management/src/lib/services/petService.ts`
  - Comment now references Alife WebBridge runtime config.

- `桌宠demo/新建文件夹/avatar-web-management/src/app/api/rigging/deploy/route.ts`
  - Comment now says rigging deployment goes to Alife desktop runtime.

Verification after this cleanup:

- No Unity-specific matches were found in active Web `src` or `tests` for the checked patterns:
  - `unity`
  - `UnityEngine`
  - `MonoBehaviour`
  - `ScriptableObject`
  - `.unity`
  - `.prefab`
  - `asmdef`

Alife active code check:

- No Unity-specific matches were found in `alife-service/sources` or `alife-service/Tests` for the checked patterns:
  - `unity`
  - `UnityEngine`
  - `MonoBehaviour`
  - `ScriptableObject`
  - `.unity`
  - `.prefab`
  - `asmdef`

Alife documentation still has some Unity examples under `alife-service/开发规范/`, but those are coding guideline examples rather than active runtime code.

## Cleanup Recommendation

Do not mix Unity cleanup with Alife WebBridge implementation in one commit unless the goal is explicitly repository cleanup.

Recommended cleanup order:

1. Completed: update active Web code comments, OpenAPI descriptions, and test descriptions from "Unity client" to "Alife/WebBridge client" where the API is still current.
2. Completed: delete old Unity docs/plans that conflicted with the current Alife .NET runtime framing.
3. Completed: remove the large Unity runtime/tooling roots:
   - `桌宠demo/新建文件夹/AstralFox/`
   - `桌宠demo/新建文件夹/unity-mcp/`
4. Completed: remove historical Unity-era devlog:
   - `桌宠demo/新建文件夹/devlog/`
   - `桌宠demo/devlog/`
5. Completed: remove Unity/Tuanjie helper scripts from `桌宠demo/新建文件夹/backend/` and update retained backend comments to Alife/runtime semantics.
6. Completed: update `桌宠demo/新建文件夹/gpt-sovits-service/DEPLOYMENT.md` to Alife runtime wording.
7. Completed: remove duplicate root `astralfox-rigging/`; retain and update `桌宠demo/新建文件夹/astralfox-rigging/`.
8. Review `.alife-service-residual-20260627-182230/` and `妗屽疇demo/` before deletion.
9. Keep `live2d-widget/` unless it is proven unused. Live2D itself is not the same as Unity residue.

## Immediate Next Step

The next engineering step should be Alife .NET WebBridge client implementation:

- Add or confirm DTOs for manifest, files, hash metadata, and sync status report.
- Add `ReportSyncStatusAsync(...)` in Alife's Web API client.
- Wire milestone reporting into the Alife sync flow.
- Preserve hash validation and path traversal protection in local staging.
- Add focused Alife tests for success, hash mismatch, path traversal, and failure reporting.

Frontend UI/UX optimization should start after Alife can produce real sync states. Before that, UI changes should be limited to renaming Unity-facing labels and making the existing sync status panel describe Alife/WebBridge accurately.
