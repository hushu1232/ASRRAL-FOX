# Live2D Viewer Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the current DeskPet Live2D preview from a basic expression/motion launcher into a practical Live2D Viewer-style workbench for inspecting parameters, testing motions, adjusting view layout, and diagnosing imported models.

**Architecture:** Keep the current WPF WebView2 host, PixiJS renderer, and `pixi-live2d-display` runtime. Implement the viewer workbench mostly in `pet.js/index.html/style.css`, reuse existing IPC commands for parameters and renderer errors, and only extend C# when the capability needs import-time diagnostics or external protocol coverage.

**Tech Stack:** .NET 9, NUnit, WebView2, PixiJS, pixi-live2d-display, JavaScript, Node test runner, JSON.

---

## File Structure

**Existing files to modify:**
- `sources/Alife.DeskPet/Alife.DeskPet.Client/wwwroot/index.html`  
  Add workbench sections for parameters, viewport controls, playback state, and diagnostics.
- `sources/Alife.DeskPet/Alife.DeskPet.Client/wwwroot/style.css`  
  Convert the preview panel into a denser workbench panel with tabs/sections, parameter rows, diagnostics list, and view-control buttons.
- `sources/Alife.DeskPet/Alife.DeskPet.Client/wwwroot/pet.js`  
  Add parameter inspector rendering, parameter slider writes, expression reset, viewport controls, background toggle, renderer diagnostics, and stable workbench state.
- `Tests/Alife.Test.DeskPet/pet-js-live2d.test.mjs`  
  Add Node tests for parameter sliders, expression reset, viewport controls, background toggle, and diagnostics rendering.
- `sources/Alife.Function/Alife.Function.DeskPet/Live2DModelImporter.cs`  
  Add import-time diagnostics for missing referenced files and root-level motion grouping.
- `Tests/Alife.Test.DeskPet/Live2DModelImporterTests.cs`  
  Add tests for import diagnostics and root-level motion group naming.
- `docs/superpowers/plans/2026-06-12-live2d-viewer-workbench.md`  
  Track this plan and mark task completion.

**No new runtime package is required for this phase.**  
`pixi-live2d-display` already provides model loading, expressions, motions, hit testing, focus, and core parameter access. This phase should improve tooling around it before adding a new plugin.

---

## Task 1: Parameter Inspector

**Files:**
- Modify: `sources/Alife.DeskPet/Alife.DeskPet.Client/wwwroot/index.html`
- Modify: `sources/Alife.DeskPet/Alife.DeskPet.Client/wwwroot/pet.js`
- Modify: `sources/Alife.DeskPet/Alife.DeskPet.Client/wwwroot/style.css`
- Test: `Tests/Alife.Test.DeskPet/pet-js-live2d.test.mjs`

- [x] **Step 1: Add failing test for parameter rows**

Append this test to `Tests/Alife.Test.DeskPet/pet-js-live2d.test.mjs`:

```javascript
test("pet.js renders parameter sliders and writes values to the core model", async () => {
    const pet = createPetHarness();

    await pet.send({ type: "load", url: "model.model3.json" });
    await pet.send({ type: "catalog", expressions: [], motions: [] });

    const paramsList = pet.elements.get("preview-params");
    assert.ok(paramsList.children.length >= 3);

    const angleRow = paramsList.children.find(row => row.dataset?.paramId === "ParamAngleX");
    assert.ok(angleRow, "ParamAngleX row should exist");

    const slider = angleRow.children.find(child => child.tagName === "INPUT");
    assert.ok(slider, "ParamAngleX slider should exist");

    slider.value = "12";
    slider.oninput({ target: slider });

    assert.equal(pet.parameterValues.get("ParamAngleX"), 12);
});
```

- [x] **Step 2: Run test and verify it fails**

Run:

```powershell
node --test 'Tests\Alife.Test.DeskPet\pet-js-live2d.test.mjs'
```

Expected: fail because `preview-params` does not exist or no parameter rows are rendered.

- [x] **Step 3: Add parameter section HTML**

In `sources/Alife.DeskPet/Alife.DeskPet.Client/wwwroot/index.html`, add this section inside `#preview-panel`, after the `Motions` section and before `Events`:

```html
<div class="preview-section">
    <div class="preview-label">Parameters</div>
    <div id="preview-params" class="preview-params"></div>
</div>
```

- [x] **Step 4: Add parameter UI code**

In `sources/Alife.DeskPet/Alife.DeskPet.Client/wwwroot/pet.js`, add `previewParams` to the `ui` object:

```javascript
previewParams: document.getElementById("preview-params"),
```

Add this function after `getParameterMetadata()`:

```javascript
function renderParameterInspector() {
    if (!ui.previewParams) return;

    const parameters = getParameterMetadata();
    ui.previewParams.replaceChildren();

    for (const [id, info] of Object.entries(parameters)) {
        const row = document.createElement("div");
        row.classList.add("param-row");
        row.dataset.paramId = id;

        const label = document.createElement("label");
        label.classList.add("param-name");
        label.textContent = id;

        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = String(info.min);
        slider.max = String(info.max);
        slider.step = "0.01";
        slider.value = String(info.value);
        slider.oninput = event => {
            const value = Number(event.target.value);
            setParameterValue(id, value);
            valueLabel.textContent = value.toFixed(2);
        };

        const valueLabel = document.createElement("span");
        valueLabel.classList.add("param-value");
        valueLabel.textContent = Number(info.value).toFixed(2);

        row.append(label, slider, valueLabel);
        ui.previewParams.appendChild(row);
    }
}
```

Call `renderParameterInspector()` at the end of `renderCatalog(catalog)`:

```javascript
renderParameterInspector();
```

Call it after `startIdleCycle();` in `loadModel(url)`:

```javascript
renderParameterInspector();
```

- [x] **Step 5: Add parameter styles**

In `sources/Alife.DeskPet/Alife.DeskPet.Client/wwwroot/style.css`, append:

```css
.preview-params {
    display: grid;
    gap: 7px;
    max-height: 220px;
    overflow: auto;
    padding-right: 4px;
}

.param-row {
    display: grid;
    grid-template-columns: minmax(96px, 1fr) 96px 42px;
    align-items: center;
    gap: 8px;
}

.param-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.82);
}

.param-row input[type="range"] {
    width: 96px;
}

.param-value {
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.68);
}
```

- [x] **Step 6: Run parameter test green**

Run:

```powershell
node --test 'Tests\Alife.Test.DeskPet\pet-js-live2d.test.mjs'
```

Expected: all frontend tests pass.

---

## Task 2: Expression Reset And Playback Feedback

**Files:**
- Modify: `sources/Alife.DeskPet/Alife.DeskPet.Client/wwwroot/index.html`
- Modify: `sources/Alife.DeskPet/Alife.DeskPet.Client/wwwroot/pet.js`
- Modify: `sources/Alife.DeskPet/Alife.DeskPet.Client/wwwroot/style.css`
- Test: `Tests/Alife.Test.DeskPet/pet-js-live2d.test.mjs`

- [x] **Step 1: Add failing test for reset expression button**

Append this test:

```javascript
test("pet.js renders an expression reset button", async () => {
    const pet = createPetHarness();

    await pet.send({ type: "load", url: "model.model3.json" });
    await pet.send({
        type: "catalog",
        expressions: [{ name: "cry", file: "exp/cry.exp3.json" }],
        motions: []
    });

    const expressionList = pet.elements.get("preview-expressions");
    const resetButton = expressionList.children.find(button => button.dataset?.expressionId === "");
    assert.ok(resetButton, "reset expression button should exist");

    resetButton.onclick();

    assert.deepEqual(pet.expressionCalls, [null]);
});
```

- [x] **Step 2: Run test and verify it fails**

Run:

```powershell
node --test 'Tests\Alife.Test.DeskPet\pet-js-live2d.test.mjs'
```

Expected: fail because no reset button exists.

- [x] **Step 3: Add reset button in `renderCatalog`**

In `renderCatalog(catalog)`, before the loop that creates expression buttons, insert:

```javascript
const resetButton = document.createElement("button");
resetButton.classList.add("preview-action", "secondary");
resetButton.textContent = "Reset";
resetButton.innerText = "Reset";
resetButton.dataset.expressionId = "";
resetButton.onclick = () => safeExpression(null);
ui.previewExpressions?.appendChild(resetButton);
```

Inside the expression loop, set the dataset:

```javascript
button.dataset.expressionId = expression.name;
```

- [x] **Step 4: Add active button feedback**

At file scope in `pet.js`, add:

```javascript
let activeExpression = null;
let activeMotion = null;
```

In `safeExpression(id)`, after `model?.expression(id);`, add:

```javascript
activeExpression = id;
syncPreviewActionStates();
```

In `safeMotion(group, index)`, after `model?.motion(...)`, add:

```javascript
activeMotion = `${group}/${index}`;
syncPreviewActionStates();
```

Add this function:

```javascript
function syncPreviewActionStates() {
    for (const button of ui.previewExpressions?.children ?? []) {
        button.classList.toggle("active", button.dataset.expressionId === (activeExpression ?? ""));
    }

    for (const button of ui.previewMotions?.children ?? []) {
        button.classList.toggle("active", button.dataset.motionId === activeMotion);
    }
}
```

Inside the motion loop, set:

```javascript
button.dataset.motionId = `${motion.group}/${motion.index}`;
```

Call `syncPreviewActionStates()` at the end of `renderCatalog(catalog)`.

- [x] **Step 5: Add active style**

In `style.css`, append:

```css
.preview-action.secondary {
    color: rgba(255, 255, 255, 0.78);
    background: rgba(255, 255, 255, 0.08);
}

.preview-action.active {
    color: #1d1d1d;
    background: #f6d365;
    border-color: rgba(246, 211, 101, 0.9);
}
```

- [x] **Step 6: Run frontend tests green**

Run:

```powershell
node --test 'Tests\Alife.Test.DeskPet\pet-js-live2d.test.mjs'
```

Expected: all frontend tests pass.

---

## Task 3: View Controls And Background Toggle

**Files:**
- Modify: `sources/Alife.DeskPet/Alife.DeskPet.Client/wwwroot/index.html`
- Modify: `sources/Alife.DeskPet/Alife.DeskPet.Client/wwwroot/pet.js`
- Modify: `sources/Alife.DeskPet/Alife.DeskPet.Client/wwwroot/style.css`
- Test: `Tests/Alife.Test.DeskPet/pet-js-live2d.test.mjs`

- [x] **Step 1: Add failing test for fit/reset view**

Append:

```javascript
test("pet.js supports preview view scale reset", async () => {
    const pet = createPetHarness();

    await pet.send({ type: "load", url: "model.model3.json" });
    await pet.send({ type: "catalog", expressions: [], motions: [] });

    const scaleInput = pet.elements.get("preview-scale");
    const resetButton = pet.elements.get("preview-reset-view");
    assert.ok(scaleInput, "scale input should exist");
    assert.ok(resetButton, "reset view button should exist");

    scaleInput.value = "0.5";
    scaleInput.oninput({ target: scaleInput });
    assert.ok(pet.live2dModel.scale.y < 0.3);

    resetButton.onclick();
    assert.ok(pet.live2dModel.scale.y > 0.3);
});
```

- [x] **Step 2: Add failing test for checkerboard background**

Append:

```javascript
test("pet.js toggles checkerboard preview background", async () => {
    const pet = createPetHarness();

    await pet.send({ type: "load", url: "model.model3.json" });
    await pet.send({ type: "catalog", expressions: [], motions: [] });

    const backgroundToggle = pet.elements.get("preview-bg-toggle");
    assert.ok(backgroundToggle, "background toggle should exist");

    backgroundToggle.onclick();
    assert.equal(pet.documentBody.classList.contains("checkerboard"), true);

    backgroundToggle.onclick();
    assert.equal(pet.documentBody.classList.contains("checkerboard"), false);
});
```

Update `createPetHarness()` so the returned object exposes `documentBody` and the fake `document` has:

```javascript
body: createElement("BODY"),
```

- [x] **Step 3: Run tests and verify they fail**

Run:

```powershell
node --test 'Tests\Alife.Test.DeskPet\pet-js-live2d.test.mjs'
```

Expected: fail because `preview-scale`, `preview-reset-view`, and `preview-bg-toggle` do not exist.

- [x] **Step 4: Add view controls HTML**

In `index.html`, add this section after `Live2D Preview` title:

```html
<div class="preview-section">
    <div class="preview-label">View</div>
    <div class="view-controls">
        <button id="preview-reset-view" class="preview-action">Fit</button>
        <button id="preview-bg-toggle" class="preview-action">Grid</button>
        <input id="preview-scale" type="range" min="0.5" max="1.5" step="0.01" value="1">
    </div>
</div>
```

- [x] **Step 5: Add view-control state**

In `pet.js`, add to `ui`:

```javascript
previewResetView: document.getElementById("preview-reset-view"),
previewBgToggle: document.getElementById("preview-bg-toggle"),
previewScale: document.getElementById("preview-scale"),
```

At file scope, add:

```javascript
let viewScaleMultiplier = 1;
```

In `updateModelLayout`, replace:

```javascript
model.scale.set(scale);
```

with:

```javascript
model.scale.set(scale * viewScaleMultiplier);
```

After the input/send handlers are assigned near the bottom of `pet.js`, add:

```javascript
ui.previewScale.oninput = event => {
    viewScaleMultiplier = Number(event.target.value);
    if (!Number.isFinite(viewScaleMultiplier)) viewScaleMultiplier = 1;
    updateModelLayout();
};

ui.previewResetView.onclick = () => {
    viewScaleMultiplier = 1;
    ui.previewScale.value = "1";
    updateModelLayout();
    logPreviewEvent("view: fit");
};

ui.previewBgToggle.onclick = () => {
    document.body.classList.toggle("checkerboard");
    logPreviewEvent(`background: ${document.body.classList.contains("checkerboard") ? "grid" : "transparent"}`);
};
```

- [x] **Step 6: Add view-control styles**

Append:

```css
.view-controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
}

.view-controls input[type="range"] {
    grid-column: 1 / -1;
    width: 100%;
}

body.checkerboard {
    background-color: transparent;
    background-image:
        linear-gradient(45deg, rgba(255,255,255,0.14) 25%, transparent 25%),
        linear-gradient(-45deg, rgba(255,255,255,0.14) 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.14) 75%),
        linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.14) 75%);
    background-size: 20px 20px;
    background-position: 0 0, 0 10px, 10px -10px, -10px 0;
}
```

- [x] **Step 7: Run frontend tests green**

Run:

```powershell
node --test 'Tests\Alife.Test.DeskPet\pet-js-live2d.test.mjs'
```

Expected: all frontend tests pass.

---

## Task 4: Import Diagnostics For Production Models

**Files:**
- Modify: `sources/Alife.Function/Alife.Function.DeskPet/Live2DModelImporter.cs`
- Test: `Tests/Alife.Test.DeskPet/Live2DModelImporterTests.cs`

- [x] **Step 1: Add failing test for missing referenced assets**

Append this NUnit test:

```csharp
[Test]
public void ImportReportsMissingReferencedAssets()
{
    string tempRoot = Path.Combine(Path.GetTempPath(), "alife-live2d-import-tests", Guid.NewGuid().ToString("N"));
    string sourceRoot = Path.Combine(tempRoot, "source", "BrokenModel");
    string destinationRoot = Path.Combine(tempRoot, "dest");
    Directory.CreateDirectory(sourceRoot);
    try
    {
        File.WriteAllText(
            Path.Combine(sourceRoot, "Broken.model3.json"),
            """
            {
              "Version": 3,
              "FileReferences": {
                "Moc": "missing.moc3",
                "Textures": ["texture_00.png"],
                "Physics": "missing.physics3.json"
              }
            }
            """);
        File.WriteAllText(Path.Combine(sourceRoot, "texture_00.png"), "png");

        Live2DModelImportResult result = Live2DModelImporter.Import(sourceRoot, destinationRoot, "BrokenModel");

        Assert.That(result.Diagnostics.Any(d => d.Level == "warning" && d.Path == "missing.moc3"), Is.True);
        Assert.That(result.Diagnostics.Any(d => d.Level == "warning" && d.Path == "missing.physics3.json"), Is.True);
    }
    finally
    {
        if (Directory.Exists(tempRoot))
            Directory.Delete(tempRoot, recursive: true);
    }
}
```

- [x] **Step 2: Run test and verify it fails**

Run:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' test 'Tests\Alife.Test.DeskPet\Alife.Test.DeskPet.csproj' --no-restore --filter Live2DModelImporterTests
```

Expected: fail because missing references are not reported.

- [x] **Step 3: Add model reference validation**

In `Live2DModelImporter.cs`, add this method:

```csharp
static void ValidateModelReferences(string sourceFolder, string modelFile, List<Live2DModelImportDiagnostic> diagnostics)
{
    try
    {
        using JsonDocument jsonDocument = JsonDocument.Parse(File.ReadAllText(modelFile));
        if (jsonDocument.RootElement.TryGetProperty("FileReferences", out JsonElement refs) == false)
            return;

        List<string> paths = new();
        AddReference(paths, refs, "Moc");
        AddReference(paths, refs, "Physics");
        AddReference(paths, refs, "DisplayInfo");

        if (refs.TryGetProperty("Textures", out JsonElement textures))
        {
            foreach (JsonElement texture in textures.EnumerateArray())
                if (texture.GetString() is { Length: > 0 } path)
                    paths.Add(path);
        }

        foreach (string path in paths.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            string fullPath = Path.Combine(sourceFolder, path.Replace('/', Path.DirectorySeparatorChar));
            if (File.Exists(fullPath) == false)
                diagnostics.Add(new Live2DModelImportDiagnostic("warning", "Referenced Live2D asset was not found.", path));
        }
    }
    catch (JsonException e)
    {
        diagnostics.Add(new Live2DModelImportDiagnostic("warning", $"Unable to parse model references: {e.Message}", Path.GetFileName(modelFile)));
    }
}

static void AddReference(List<string> paths, JsonElement refs, string propertyName)
{
    if (refs.TryGetProperty(propertyName, out JsonElement property)
        && property.GetString() is { Length: > 0 } path)
        paths.Add(path);
}
```

In `Import(...)`, after `List<Live2DModelImportDiagnostic> diagnostics = new();`, call:

```csharp
ValidateModelReferences(sourceFolder, modelFile, diagnostics);
```

- [x] **Step 4: Run importer tests green**

Run:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' test 'Tests\Alife.Test.DeskPet\Alife.Test.DeskPet.csproj' --no-restore --filter Live2DModelImporterTests
```

Expected: importer tests pass.

---

## Task 5: Root-Level Motion Group Normalization

**Files:**
- Modify: `sources/Alife.Function/Alife.Function.DeskPet/Live2DModelImporter.cs`
- Test: `Tests/Alife.Test.DeskPet/Live2DModelImporterTests.cs`

- [x] **Step 1: Add failing test for root-level motion group**

Append:

```csharp
[Test]
public void ImportUsesDefaultGroupForRootLevelMotions()
{
    string tempRoot = Path.Combine(Path.GetTempPath(), "alife-live2d-import-tests", Guid.NewGuid().ToString("N"));
    string sourceRoot = Path.Combine(tempRoot, "source", "RootMotionModel");
    string destinationRoot = Path.Combine(tempRoot, "dest");
    Directory.CreateDirectory(sourceRoot);
    try
    {
        File.WriteAllText(
            Path.Combine(sourceRoot, "Root.model3.json"),
            """
            {
              "Version": 3,
              "FileReferences": {
                "Moc": "Root.moc3",
                "Textures": []
              }
            }
            """);
        File.WriteAllText(Path.Combine(sourceRoot, "Root.moc3"), "moc");
        File.WriteAllText(Path.Combine(sourceRoot, "Scene1.motion3.json"), """{ "Version": 3, "Meta": { "Loop": true } }""");

        Live2DModelImportResult result = Live2DModelImporter.Import(sourceRoot, destinationRoot, "RootMotionModel");

        Assert.That(result.Manifest.Motions.Single().Group, Is.EqualTo("default"));
    }
    finally
    {
        if (Directory.Exists(tempRoot))
            Directory.Delete(tempRoot, recursive: true);
    }
}
```

- [x] **Step 2: Run test and verify it fails**

Run:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' test 'Tests\Alife.Test.DeskPet\Alife.Test.DeskPet.csproj' --no-restore --filter Live2DModelImporterTests
```

Expected: fail because root-level motions currently use the source folder name as the group, such as `魔女`.

- [x] **Step 3: Normalize root-level group**

In `DiscoverMotions(string sourceFolder)`, replace:

```csharp
string group = Path.GetFileName(Path.GetDirectoryName(path)) ?? "default";
```

with:

```csharp
string? parent = Path.GetDirectoryName(path);
string group = string.Equals(
    Path.GetFullPath(parent ?? string.Empty).TrimEnd(Path.DirectorySeparatorChar),
    Path.GetFullPath(sourceFolder).TrimEnd(Path.DirectorySeparatorChar),
    StringComparison.OrdinalIgnoreCase)
    ? "default"
    : Path.GetFileName(parent) ?? "default";
```

- [x] **Step 4: Run importer tests green**

Run:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' test 'Tests\Alife.Test.DeskPet\Alife.Test.DeskPet.csproj' --no-restore --filter Live2DModelImporterTests
```

Expected: importer tests pass.

- [x] **Step 5: Reimport MoNv after normalization**

Run:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' run --project 'Demos\Alife.Demo.DeskPet\Alife.Demo.DeskPet.csproj' --no-build -- import 'C:\Users\hu shu\Desktop\新建文件夹\魔女' MoNv
```

Expected: `Scene1` motion appears as `default/0` instead of `魔女/0`.

---

## Task 6: Model Diagnostics Panel

**Files:**
- Modify: `sources/Alife.DeskPet/Alife.DeskPet.Client/wwwroot/index.html`
- Modify: `sources/Alife.DeskPet/Alife.DeskPet.Client/wwwroot/pet.js`
- Modify: `sources/Alife.DeskPet/Alife.DeskPet.Client/wwwroot/style.css`
- Test: `Tests/Alife.Test.DeskPet/pet-js-live2d.test.mjs`

- [x] **Step 1: Add failing diagnostics rendering test**

Append:

```javascript
test("pet.js displays renderer diagnostics", async () => {
    const pet = createPetHarness();

    await pet.send({ type: "load", url: "model.model3.json" });
    await pet.send({ type: "catalog", expressions: [], motions: [] });
    await pet.send({ type: "diagnostic", level: "warning", message: "Missing texture_99.png" });

    const diagnostics = pet.elements.get("preview-diagnostics");
    assert.equal(diagnostics.children.length, 1);
    assert.equal(diagnostics.children[0].innerText, "warning: Missing texture_99.png");
});
```

- [x] **Step 2: Run test and verify it fails**

Run:

```powershell
node --test 'Tests\Alife.Test.DeskPet\pet-js-live2d.test.mjs'
```

Expected: fail because `diagnostic` messages are not handled.

- [x] **Step 3: Add diagnostics HTML**

In `index.html`, add this section before `Events`:

```html
<div class="preview-section">
    <div class="preview-label">Diagnostics</div>
    <div id="preview-diagnostics" class="preview-diagnostics"></div>
</div>
```

- [x] **Step 4: Add diagnostics rendering**

In `pet.js`, add to `ui`:

```javascript
previewDiagnostics: document.getElementById("preview-diagnostics"),
```

Add:

```javascript
function addDiagnostic(level, message) {
    if (!ui.previewDiagnostics) return;
    const row = document.createElement("div");
    row.classList.add("diagnostic-row", level);
    row.innerText = `${level}: ${message}`;
    ui.previewDiagnostics.appendChild(row);
}
```

In `postRendererError(operation, error)`, after `logPreviewEvent(...)`, add:

```javascript
addDiagnostic("error", `${operation}: ${message}`);
```

In the message switch, add:

```javascript
case "diagnostic":
    addDiagnostic(msg.level ?? "info", msg.message ?? "");
    break;
```

- [x] **Step 5: Add diagnostics styles**

Append:

```css
.preview-diagnostics {
    display: grid;
    gap: 5px;
    max-height: 100px;
    overflow: auto;
}

.diagnostic-row {
    padding: 5px 7px;
    border-radius: 5px;
    font-size: 11px;
    line-height: 1.35;
    background: rgba(255, 255, 255, 0.08);
}

.diagnostic-row.warning {
    color: #ffd166;
}

.diagnostic-row.error {
    color: #ff8a8a;
}
```

- [x] **Step 6: Run frontend tests green**

Run:

```powershell
node --test 'Tests\Alife.Test.DeskPet\pet-js-live2d.test.mjs'
```

Expected: all frontend tests pass.

---

## Task 7: Verification And Manual Preview

**Files:**
- Modify: `docs/superpowers/plans/2026-06-12-live2d-viewer-workbench.md`

- [x] **Step 1: Run full DeskPet test suite**

Run:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' test 'Tests\Alife.Test.DeskPet\Alife.Test.DeskPet.csproj' --no-restore
```

Expected:

```text
已通过! - 失败: 0
```

- [x] **Step 2: Run frontend tests**

Run:

```powershell
node --test 'Tests\Alife.Test.DeskPet\pet-js-live2d.test.mjs'
```

Expected:

```text
fail 0
```

- [x] **Step 3: Run full build**

Run:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' build 'D:\Alife\.worktrees\live2d-import-preview\Alife.slnx' --no-restore
```

Expected:

```text
已成功生成。
0 个警告
0 个错误
```

- [x] **Step 4: Reimport active model**

Run:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' run --project 'Demos\Alife.Demo.DeskPet\Alife.Demo.DeskPet.csproj' --no-build -- import 'C:\Users\hu shu\Desktop\新建文件夹\魔女' MoNv
```

Expected:

```text
Imported Live2D model 'MoNv'
```

- [x] **Step 5: Launch direct preview**

Run:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' 'D:\Alife\.worktrees\live2d-import-preview\Outputs\Alife.DeskPet.Client\Alife.DeskPet.Client.dll' 'D:\Alife\.worktrees\live2d-import-preview\Outputs\Alife.DeskPet.Client\wwwroot\model\MoNv\alife.model.json'
```

Manual checks:
- model appears and is not covered by the workbench panel;
- expression buttons change visible parts;
- `Scene1` motion plays;
- parameter sliders visibly move the model when changing common params such as `ParamAngleX`, `ParamAngleY`, `ParamMouthOpenY`;
- `Fit` resets model scale;
- `Grid` toggles checkerboard background;
- diagnostics panel remains empty unless a renderer error occurs.

- [x] **Step 6: Mark plan items complete**

After verification, update this plan file by changing completed task checkboxes from `- [ ]` to `- [x]` and add observed command outputs under Task 7.

Observed final verification:
- DeskPet automated tests: `失败: 0，通过: 10，总计: 10`.
- Frontend Node tests: `tests 10`, `pass 10`, `fail 0`.
- Full solution build: succeeded with `0 个警告`, `0 个错误`.
- Active model reimported from `C:\Users\hu shu\Desktop\新建文件夹\魔女` as `MoNv`; ignored only `魔女.vtube.json`.
- Imported `Scene1` motion is `default/0`.
- Direct preview process started as `71996`; process is responding; `pet.log` has no error output.

---

## Self-Review

**Spec coverage:** The plan covers the next practical gap after successful model import: parameter inspection, playback feedback, view controls, import diagnostics, normalized root-level motion groups, and final manual preview.

**Placeholder scan:** No step uses `TBD`, `TODO`, or an unspecified implementation instruction.

**Type consistency:** The plan uses existing names from the current codebase: `Live2DModelImporter`, `Live2DModelImportDiagnostic`, `PetProcess.JsonOptions`, `ParamInfo`, `getParameterMetadata()`, `setParameterValue()`, `renderCatalog()`, `safeExpression()`, `safeMotion()`, and `updateModelLayout`.
