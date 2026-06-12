# Live2D Import And Preview Design

## Goal

Import `C:\Users\hu shu\Desktop\新建文件夹\Models\YouXiaoMiao` into the DeskPet runtime, preserve its Web-usable Live2D resources, expose its expressions and motions as stable action metadata, and add the first preview-grade control surface needed to validate model behavior.

## Current State

The project already renders Live2D through `Alife.DeskPet.Client` using WebView2, PixiJS, `pixi-live2d-display`, `live2d.min.js`, and `live2dcubismcore.min.js`. The renderer accepts commands for model load, expression, motion, bubble, focus, status, parameter updates, lip sync, idle cycle, and parameter listing.

The current model loader assumes a model name maps to `wwwroot/model/{modelName}/{modelName}.model3.json`. The target model breaks that assumption because the folder is `YouXiaoMiao` while the model file is `悠小喵.model3.json`. The model directory also contains Unity and VTuber assets that are not directly useful for the Web renderer.

## Architecture

Add a DeskPet model import layer in `Alife.Function.DeskPet`. It scans an external model folder, copies Web-usable assets into the DeskPet `wwwroot/model` tree, and writes an `alife.model.json` manifest with the normalized model id, display name, model file path, expressions, motions, and semantic action mappings.

Extend `PetModelMetadata` to load from either the existing `.model3.json` layout or the new `alife.model.json` manifest. Extend `PetServer` so a configured model can resolve through the manifest instead of assuming `{modelName}.model3.json`.

Extend the WebView renderer protocol so the host can ask the renderer for preview data and motion lifecycle events. The first preview surface will be a developer-oriented overlay inside `index.html`, not a full separate application.

## First Increment Scope

This increment will implement:

- Model manifest records and importer.
- Tests using a temporary model fixture with mismatched folder/model file names and expressions/motions under `exp/`.
- `PetModelMetadata` support for `alife.model.json`.
- `PetServer` path resolution through a manifest file when present.
- IPC command/event records for preview catalog requests.
- Frontend `pet.js` support for catalog and motion result events.
- A lightweight preview panel with expression and motion buttons.

This increment will not parse Unity `.asset`, `.prefab`, `.controller`, or `.vtube.json` files. It will ignore those assets during import and rely on `.exp3.json` and `.motion3.json` files for Web preview.

## Model Import Rules

Input folder:

```text
C:\Users\hu shu\Desktop\新建文件夹\Models\YouXiaoMiao
```

Import destination:

```text
Outputs\Alife.DeskPet.Client\wwwroot\model\YouXiaoMiao
```

The importer will:

- Use the first `.model3.json` in the root folder as the primary model file.
- Copy `.model3.json`, `.moc3`, `.physics3.json`, `.pose3.json`, `.cdi3.json`, `.exp3.json`, `.motion3.json`, and image files under referenced or discovered subdirectories.
- Ignore `.meta`, `.asset`, `.prefab`, `.controller`, `.mat`, and `.vtube.json`.
- Keep relative folder names intact for compatibility with existing model references.
- Discover expressions from `**/*.exp3.json`.
- Discover motions from `**/*.motion3.json`.
- Group discovered motions by their containing folder name. For `exp/常规.motion3.json`, the group is `exp` and the action name is `常规`.
- Write `alife.model.json` with stable fields.

## Manifest Shape

```json
{
  "id": "YouXiaoMiao",
  "displayName": "悠小喵",
  "modelFile": "悠小喵.model3.json",
  "expressions": [
    { "name": "哭哭", "file": "exp/哭哭.exp3.json" }
  ],
  "motions": [
    { "name": "常规", "group": "exp", "index": 0, "file": "exp/常规.motion3.json", "loop": true }
  ],
  "actions": [
    { "name": "哭哭", "expression": "哭哭" },
    { "name": "常规", "motion": { "group": "exp", "index": 0 } }
  ]
}
```

## Preview Behavior

The preview panel will be visible only when the page receives a `preview` command or when the URL contains `?preview=1`. It will show:

- loaded model id and file;
- expression buttons;
- motion buttons grouped by group name;
- a parameter refresh button using the existing `get-params` path;
- recent renderer events.

Buttons call existing renderer methods first: `model.expression(id)` and `model.motion(group, index, FORCE)`.

## Error Handling

The importer reports diagnostics instead of silently skipping core failures. Missing `.model3.json`, unreadable JSON, or missing referenced `.moc3` are errors. Ignored Unity/VTuber assets are informational diagnostics.

The renderer posts `load-error`, `motion-error`, and `expression-error` events when operations throw. It does not crash the preview page.

## Verification

Run:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' test 'Tests\Alife.Test.DeskPet\Alife.Test.DeskPet.csproj' --no-restore
& 'C:\Users\hu shu\.dotnet\dotnet.exe' build 'D:\Alife\.worktrees\live2d-import-preview\Alife.slnx' --no-restore
```

Manual preview check after implementation:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' build 'D:\Alife\.worktrees\live2d-import-preview\Alife.slnx' --no-restore
```

Then launch DeskPet with model id `YouXiaoMiao` after importing the external folder.
