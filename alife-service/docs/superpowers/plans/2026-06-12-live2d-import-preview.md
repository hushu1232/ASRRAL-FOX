# Live2D Import Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first verified path for importing a local Live2D model package and previewing its expressions/motions through the existing DeskPet renderer.

**Architecture:** Keep the current WebView2 + PixiJS + pixi-live2d-display renderer. Add a manifest-based importer in `Alife.Function.DeskPet`, extend existing metadata loading to understand `alife.model.json`, and add a lightweight preview catalog path over the existing IPC bridge.

**Tech Stack:** .NET 9, NUnit, WebView2, PixiJS, pixi-live2d-display, JavaScript, JSON.

---

## Task 1: Baseline And Specs

**Files:**
- Create: `docs/superpowers/specs/2026-06-12-live2d-import-preview-design.md`
- Create: `docs/superpowers/plans/2026-06-12-live2d-import-preview.md`

- [x] **Step 1: Create isolated worktree**

Run: `git worktree add 'D:\Alife\.worktrees\live2d-import-preview' -b live2d-import-preview`

- [x] **Step 2: Restore dependencies**

Run: `& 'C:\Users\hu shu\.dotnet\dotnet.exe' restore 'D:\Alife\.worktrees\live2d-import-preview\Alife.slnx' --ignore-failed-sources`

- [x] **Step 3: Verify baseline build**

Run: `& 'C:\Users\hu shu\.dotnet\dotnet.exe' build 'D:\Alife\.worktrees\live2d-import-preview\Alife.slnx' --no-restore`

- [x] **Step 4: Save design and plan**

Create the two files listed above.

## Task 2: Manifest And Importer Core

**Files:**
- Create: `sources/Alife.Function/Alife.Function.DeskPet/Live2DModelManifest.cs`
- Create: `sources/Alife.Function/Alife.Function.DeskPet/Live2DModelImporter.cs`
- Test: `Tests/Alife.Test.DeskPet/Live2DModelImporterTests.cs`

- [x] **Step 1: Write failing importer tests**

Add tests that:
- create a temp folder with `YouXiaoMiao/悠小喵.model3.json`;
- include `exp/哭哭.exp3.json` and `exp/常规.motion3.json`;
- include ignored files such as `.meta`, `.asset`, `.prefab`, `.controller`;
- import to a temp destination;
- assert `alife.model.json` exists;
- assert manifest id is `YouXiaoMiao`, display name is `悠小喵`, model file is `悠小喵.model3.json`;
- assert expression `哭哭` and motion `常规` are discovered;
- assert ignored Unity files are not copied.

Run: `& 'C:\Users\hu shu\.dotnet\dotnet.exe' test 'Tests\Alife.Test.DeskPet\Alife.Test.DeskPet.csproj' --no-restore --filter Live2DModelImporterTests`

- [x] **Step 2: Implement manifest records**

Create records for manifest, expression entry, motion entry, action entry, motion reference, import diagnostics, and import result.

- [x] **Step 3: Implement importer**

Implement `Live2DModelImporter.Import(sourceFolder, destinationRoot, modelId)` with directory scanning, copy filtering, manifest creation, and diagnostics.

- [x] **Step 4: Run importer tests green**

Run the same filtered test command and expect pass.
Observed: `Live2DModelImporterTests` passed 1/1.

## Task 3: Metadata Loader Integration

**Files:**
- Modify: `sources/Alife.DeskPet/Alife.DeskPet.Protocol/PetModelMetadata.cs`
- Test: `Tests/Alife.Test.DeskPet/PetModelMetadataManifestTests.cs`

- [x] **Step 1: Write failing metadata tests**

Add tests that load `alife.model.json` and assert:
- `ModelPath` becomes `model/YouXiaoMiao/悠小喵.model3.json` when the manifest lives under a `wwwroot/model/YouXiaoMiao` path;
- `Expressions` contains manifest expressions;
- `Motions` maps action names to group/index pairs;
- `Interactions` contains generated action mappings.

- [x] **Step 2: Extend metadata loader**

If the supplied path is `alife.model.json`, parse the manifest. If the supplied path is `.model3.json`, preserve existing behavior.

- [x] **Step 3: Run metadata tests green**

Run: `& 'C:\Users\hu shu\.dotnet\dotnet.exe' test 'Tests\Alife.Test.DeskPet\Alife.Test.DeskPet.csproj' --no-restore --filter PetModelMetadataManifestTests`
Observed: `PetModelMetadataManifestTests` passed 1/1.

## Task 4: PetServer Model Resolution

**Files:**
- Modify: `sources/Alife.Function/Alife.Function.DeskPet/PetServer.cs`
- Test: `Tests/Alife.Test.DeskPet/PetServerModelResolutionTests.cs`

- [x] **Step 1: Write failing path resolution tests**

Add tests for a pure path resolver method:
- if `wwwroot/model/YouXiaoMiao/alife.model.json` exists, return it;
- otherwise fall back to `wwwroot/model/Mao/Mao.model3.json`.

- [x] **Step 2: Extract and use resolver**

Add a pure static resolver method and use it in `PetServer`.

- [x] **Step 3: Run resolver tests green**

Run: `& 'C:\Users\hu shu\.dotnet\dotnet.exe' test 'Tests\Alife.Test.DeskPet\Alife.Test.DeskPet.csproj' --no-restore --filter PetServerModelResolutionTests`
Observed: `PetServerModelResolutionTests` passed 2/2.

## Task 5: Preview Protocol And Frontend

**Files:**
- Modify: `sources/Alife.DeskPet/Alife.DeskPet.Protocol/PetProcess.cs`
- Modify: `sources/Alife.DeskPet/Alife.DeskPet.Client/PetBridge.cs`
- Modify: `sources/Alife.DeskPet/Alife.DeskPet.Client/wwwroot/index.html`
- Modify: `sources/Alife.DeskPet/Alife.DeskPet.Client/wwwroot/pet.js`
- Modify: `sources/Alife.DeskPet/Alife.DeskPet.Client/wwwroot/style.css`
- Test: `Tests/Alife.Test.DeskPet/PetProcessLive2DProtocolTests.cs`

- [x] **Step 1: Write failing IPC serialization test**

Assert new commands/events serialize and deserialize:
- `GetCatalogCommand`
- `CatalogEvent`
- `RendererErrorEvent`

- [x] **Step 2: Add protocol records and bridge helpers**

Add command/event records and bridge methods to request catalog and surface renderer errors.

- [x] **Step 3: Extend `pet.js` preview catalog**

Add a preview panel, catalog postback, safe expression/motion wrappers, and renderer error postbacks.

- [x] **Step 4: Run DeskPet tests green**

Run: `& 'C:\Users\hu shu\.dotnet\dotnet.exe' test 'Tests\Alife.Test.DeskPet\Alife.Test.DeskPet.csproj' --no-restore`
Observed: DeskPet automated tests passed 8/8; manual `PetFunctionTests` are marked `Explicit`.

## Task 6: Final Verification

- [x] **Step 1: Run focused DeskPet tests**

Run: `& 'C:\Users\hu shu\.dotnet\dotnet.exe' test 'Tests\Alife.Test.DeskPet\Alife.Test.DeskPet.csproj' --no-restore`
Observed: 8 passed, 0 failed.

- [x] **Step 2: Run full build**

Run: `& 'C:\Users\hu shu\.dotnet\dotnet.exe' build 'D:\Alife\.worktrees\live2d-import-preview\Alife.slnx' --no-restore`
Observed: build succeeded with 0 warnings and 0 errors.

- [x] **Step 3: Report changed files and remaining manual preview step**

Report the worktree path, tests/build result, and the command needed to import `C:\Users\hu shu\Desktop\新建文件夹\Models\YouXiaoMiao` once a CLI/demo entry is added.
Observed: added `Alife.Demo.DeskPet import <source> [modelId]` and `Alife.Demo.DeskPet model <modelId>`. Imported the real `YouXiaoMiao` model into `Outputs\Alife.DeskPet.Client\wwwroot\model\YouXiaoMiao`.

Import command used:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' run --project 'Demos\Alife.Demo.DeskPet\Alife.Demo.DeskPet.csproj' --no-build -- import 'C:\Users\hu shu\Desktop\新建文件夹\Models\YouXiaoMiao' YouXiaoMiao
```

Preview launch command:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' run --project 'Demos\Alife.Demo.DeskPet\Alife.Demo.DeskPet.csproj' --no-build -- model YouXiaoMiao
```

## Task 7: Preview Interaction Fixes

**Problem:** Manual preview showed the model, but the preview panel covered the model and expression/motion buttons did not visibly affect it.

**Files:**
- Modify: `sources/Alife.Function/Alife.Function.DeskPet/Live2DModelImporter.cs`
- Modify: `sources/Alife.DeskPet/Alife.DeskPet.Client/wwwroot/pet.js`
- Test: `Tests/Alife.Test.DeskPet/Live2DModelImporterTests.cs`
- Test: `Tests/Alife.Test.DeskPet/pet-js-live2d.test.mjs`

- [x] **Step 1: Reproduce with failing tests**

Added regression tests for:
- imported `.model3.json` containing runtime `FileReferences.Expressions` and `FileReferences.Motions`;
- `pet.js` repositioning/scaling the model after the preview catalog panel appears.

Observed before fix:
- `Live2DModelImporterTests` failed because `FileReferences.Expressions` was missing;
- `pet-js-live2d.test.mjs` failed because model `position.x` stayed at `480` instead of moving to the panel-safe center `624`.

- [x] **Step 2: Fix runtime action registration**

Updated `Live2DModelImporter.Import(...)` to rewrite the copied `.model3.json` with discovered `.exp3.json` and `.motion3.json` files so `pixi-live2d-display` can resolve `model.expression(name)` and `model.motion(group, index, ...)`.

- [x] **Step 3: Fix preview panel layout**

Updated `pet.js` so `showPreviewPanel()` triggers a layout recalculation. When the preview panel is visible, the model is centered in the remaining safe area and scaled against both available height and width.

- [x] **Step 4: Rebuild, reimport, and relaunch preview**

Run:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' build 'D:\Alife\.worktrees\live2d-import-preview\Alife.slnx' --no-restore
& 'C:\Users\hu shu\.dotnet\dotnet.exe' run --project 'Demos\Alife.Demo.DeskPet\Alife.Demo.DeskPet.csproj' --no-build -- import 'C:\Users\hu shu\Desktop\新建文件夹\Models\YouXiaoMiao' YouXiaoMiao
```

Observed:
- build succeeded with 0 warnings and 0 errors;
- imported output model now reports `expressions=16`, `motionGroups=exp`, `expMotions=1`;
- preview relaunched via `dotnet.exe Alife.DeskPet.Client.dll <alife.model.json>` as process `73008`.

- [x] **Step 5: Verify automated checks**

Run:

```powershell
node --test 'Tests\Alife.Test.DeskPet\pet-js-live2d.test.mjs'
& 'C:\Users\hu shu\.dotnet\dotnet.exe' test 'Tests\Alife.Test.DeskPet\Alife.Test.DeskPet.csproj' --no-restore
```

Observed:
- Node frontend tests: 5 passed, 0 failed;
- DeskPet automated tests: 8 passed, 0 failed;
- manual GUI `PetFunctionTests` remain explicit/manual.

## Task 8: Switch Active Imported Model To MoNv

**Source model:** `C:\Users\hu shu\Desktop\新建文件夹\魔女`

**Output model id:** `MoNv`

- [x] **Step 1: Inspect source folder**

Observed root-level Live2D web assets:
- `魔女.model3.json`
- `魔女.moc3`
- `魔女.physics3.json`
- `魔女.cdi3.json`
- `魔女.8192/*`
- 12 expression files: `cw`, `fz`, `h`, `hdj`, `ku`, `mz`, `sq`, `x`, `xx`, `yj`, `zs1`, `zs2`
- 1 motion file: `Scene1.motion3.json`

- [x] **Step 2: Import model**

Run:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' run --project 'Demos\Alife.Demo.DeskPet\Alife.Demo.DeskPet.csproj' --no-build -- import 'C:\Users\hu shu\Desktop\新建文件夹\魔女' MoNv
```

Observed:
- imported to `Outputs\Alife.DeskPet.Client\wwwroot\model\MoNv\alife.model.json`;
- ignored `魔女.vtube.json` as a non-Web Live2D asset.

- [x] **Step 3: Verify imported references**

Observed:
- `modelFile=魔女.model3.json`
- `expressions=12`
- `motions=1`
- `registeredExpressions=12`
- `motionGroups=魔女`
- `missing=` empty

- [x] **Step 4: Launch preview**

Run direct client preview using:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' 'D:\Alife\.worktrees\live2d-import-preview\Outputs\Alife.DeskPet.Client\Alife.DeskPet.Client.dll' 'D:\Alife\.worktrees\live2d-import-preview\Outputs\Alife.DeskPet.Client\wwwroot\model\MoNv\alife.model.json'
```

Observed:
- preview process started as `67948`;
- process is responding;
- `pet.log` has no error output.
