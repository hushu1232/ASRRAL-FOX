# DeskPet Runtime Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the verified `MoNv` Live2D preview into the project's real DeskPet runtime path so AI/function calls can trigger semantic actions reliably.

**Architecture:** Keep `Alife.DeskPet.Client` as the renderer and `PetServer` as the process/IPC controller. Add a small action-profile layer on top of imported manifests, make `MoNv` the default model, add a direct runtime smoke-test CLI path that does not require an `ILanguageModel`, and harden client process startup by supporting `dotnet Alife.DeskPet.Client.dll` when the generated `.exe` apphost fails in the local runtime.

**Tech Stack:** .NET 9, NUnit, WebView2, PixiJS, pixi-live2d-display, JSON, PowerShell.

---

## Current Baseline

The current branch already provides:
- import command: `Alife.Demo.DeskPet import <source> [modelId]`;
- direct client preview via `Alife.DeskPet.Client.dll <alife.model.json>`;
- imported active model: `MoNv` from `C:\Users\hu shu\Desktop\新建文件夹\魔女`;
- model manifest: `Outputs\Alife.DeskPet.Client\wwwroot\model\MoNv\alife.model.json`;
- expressions: `cw`, `fz`, `h`, `hdj`, `ku`, `mz`, `sq`, `x`, `xx`, `yj`, `zs1`, `zs2`;
- motion: `Scene1:default/0`;
- preview workbench: parameters, Reset, Fit, Grid, diagnostics;
- verification: DeskPet tests `10/10`, Node tests `10/10`, full build `0 warnings, 0 errors`.

Known risk:
- `PetServer` still launches `Alife.DeskPet.Client.exe`; in this environment direct `.exe` launch previously failed, while `dotnet Alife.DeskPet.Client.dll <manifest>` works.
- `DeskPetServiceConfig.ModelName` still defaults to `Mao`.
- `DeskPetService.Expression()` / `Motion()` expose raw imported names; `MoNv` expression names are short cryptic IDs, not AI-friendly semantic actions.

---

## File Structure

**Existing files to modify:**
- `sources/Alife.Function/Alife.Function.DeskPet/DeskPetServiceConfig.cs`  
  Change default model to `MoNv`; add configurable action profile name if needed.
- `sources/Alife.Function/Alife.Function.DeskPet/PetServer.cs`  
  Add a testable client process start-info resolver with `.dll` fallback; expose supported semantic actions.
- `sources/Alife.Function/Alife.Function.DeskPet/DeskPetService.cs`  
  Add AI-facing semantic `Action(...)` function and improve prompt option text.
- `sources/Alife.DeskPet/Alife.DeskPet.Protocol/PetModelMetadata.cs`  
  Load semantic action aliases from `alife.actions.json` next to `alife.model.json`.
- `sources/Alife.DeskPet/Alife.DeskPet.Protocol/Live2DModelManifest.cs`  
  Add action-profile records if they belong in protocol.
- `sources/Alife.Function/Alife.Function.DeskPet/Live2DModelImporter.cs`  
  Optionally write a starter `alife.actions.json` for imported models.
- `Demos/Alife.Demo.DeskPet/Program.cs`  
  Add a `runtime-smoke <modelId>` command that launches `PetServer`, triggers actions, requests params/catalog, and exits without `ILanguageModel`.

**Tests to modify/create:**
- `Tests/Alife.Test.DeskPet/PetServerProcessStartTests.cs`
- `Tests/Alife.Test.DeskPet/PetModelActionProfileTests.cs`
- `Tests/Alife.Test.DeskPet/DeskPetServiceConfigTests.cs`
- `Tests/Alife.Test.DeskPet/PetServerSemanticActionTests.cs`

**Model-side generated file:**
- `Outputs\Alife.DeskPet.Client\wwwroot\model\MoNv\alife.actions.json`

---

## Task 1: Make MoNv The Default DeskPet Model

**Files:**
- Modify: `sources/Alife.Function/Alife.Function.DeskPet/DeskPetServiceConfig.cs`
- Modify: `sources/Alife.Function/Alife.Function.DeskPet/DeskPetService.cs`
- Test: `Tests/Alife.Test.DeskPet/DeskPetServiceConfigTests.cs`

- [x] **Step 1: Create failing default-config test**

Create `Tests/Alife.Test.DeskPet/DeskPetServiceConfigTests.cs`:

```csharp
using Alife.Function.DeskPet;

namespace Alife.Test.DeskPet;

public class DeskPetServiceConfigTests
{
    [Test]
    public void DefaultModelNameIsMoNv()
    {
        DeskPetServiceConfig config = new();

        Assert.That(config.ModelName, Is.EqualTo("MoNv"));
    }
}
```

- [x] **Step 2: Run test and verify it fails**

Run:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' test 'Tests\Alife.Test.DeskPet\Alife.Test.DeskPet.csproj' --no-restore --filter DeskPetServiceConfigTests
```

Expected: fail because the current default is `Mao`.

- [x] **Step 3: Change config default**

In `sources/Alife.Function/Alife.Function.DeskPet/DeskPetServiceConfig.cs`, change:

```csharp
public string ModelName { get; set; } = "Mao";
```

to:

```csharp
public string ModelName { get; set; } = "MoNv";
```

- [x] **Step 4: Remove hardcoded Mao fallback**

In `DeskPetService.AwakeAsync(...)`, replace:

```csharp
if (string.IsNullOrWhiteSpace(modelName))
    modelName = "Mao";
```

with:

```csharp
if (string.IsNullOrWhiteSpace(modelName))
    modelName = new DeskPetServiceConfig().ModelName;
```

- [x] **Step 5: Run default-config test green**

Run:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' test 'Tests\Alife.Test.DeskPet\Alife.Test.DeskPet.csproj' --no-restore --filter DeskPetServiceConfigTests
```

Expected: pass.

---

## Task 2: Harden Pet Client Process Startup

**Files:**
- Modify: `sources/Alife.Function/Alife.Function.DeskPet/PetServer.cs`
- Test: `Tests/Alife.Test.DeskPet/PetServerProcessStartTests.cs`

- [x] **Step 1: Create failing start-info resolver tests**

Create `Tests/Alife.Test.DeskPet/PetServerProcessStartTests.cs`:

```csharp
using Alife.Function.DeskPet;

namespace Alife.Test.DeskPet;

public class PetServerProcessStartTests
{
    [Test]
    public void ResolveClientStartInfoUsesDllWhenExeIsUnavailable()
    {
        string tempRoot = Path.Combine(Path.GetTempPath(), "alife-pet-start-tests", Guid.NewGuid().ToString("N"));
        string clientRoot = Path.Combine(tempRoot, "Alife.DeskPet.Client");
        Directory.CreateDirectory(clientRoot);
        string dll = Path.Combine(clientRoot, "Alife.DeskPet.Client.dll");
        File.WriteAllText(dll, "dll");
        string modelJson = Path.Combine(clientRoot, "wwwroot", "model", "MoNv", "alife.model.json");

        try
        {
            PetClientStartInfo info = PetServer.ResolveClientStartInfo(tempRoot, modelJson, dotnetPath: "dotnet");

            Assert.That(info.FileName, Is.EqualTo("dotnet"));
            Assert.That(info.Arguments, Does.Contain("Alife.DeskPet.Client.dll"));
            Assert.That(info.Arguments, Does.Contain(modelJson));
            Assert.That(info.WorkingDirectory, Is.EqualTo(clientRoot));
        }
        finally
        {
            if (Directory.Exists(tempRoot))
                Directory.Delete(tempRoot, recursive: true);
        }
    }

    [Test]
    public void ResolveClientStartInfoUsesExeWhenExeExists()
    {
        string tempRoot = Path.Combine(Path.GetTempPath(), "alife-pet-start-tests", Guid.NewGuid().ToString("N"));
        string clientRoot = Path.Combine(tempRoot, "Alife.DeskPet.Client");
        Directory.CreateDirectory(clientRoot);
        string exe = Path.Combine(clientRoot, "Alife.DeskPet.Client.exe");
        File.WriteAllText(exe, "exe");
        string modelJson = Path.Combine(clientRoot, "wwwroot", "model", "MoNv", "alife.model.json");

        try
        {
            PetClientStartInfo info = PetServer.ResolveClientStartInfo(tempRoot, modelJson, dotnetPath: "dotnet");

            Assert.That(info.FileName, Is.EqualTo(exe));
            Assert.That(info.Arguments, Is.EqualTo(modelJson));
            Assert.That(info.WorkingDirectory, Is.EqualTo(clientRoot));
        }
        finally
        {
            if (Directory.Exists(tempRoot))
                Directory.Delete(tempRoot, recursive: true);
        }
    }
}
```

- [x] **Step 2: Run test and verify it fails**

Run:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' test 'Tests\Alife.Test.DeskPet\Alife.Test.DeskPet.csproj' --no-restore --filter PetServerProcessStartTests
```

Expected: compile fails because `PetClientStartInfo` and `ResolveClientStartInfo(...)` do not exist.

- [x] **Step 3: Add start-info record and resolver**

In `PetServer.cs`, add near the top-level namespace:

```csharp
public record PetClientStartInfo(string FileName, string Arguments, string WorkingDirectory);
```

Add this method inside `PetServer`:

```csharp
public static PetClientStartInfo ResolveClientStartInfo(
    string outputsFolderPath,
    string modelJsonPath,
    string? dotnetPath = null)
{
    string clientFolder = Path.Combine(outputsFolderPath, "Alife.DeskPet.Client");
    string exePath = Path.Combine(clientFolder, "Alife.DeskPet.Client.exe");
    if (File.Exists(exePath))
        return new PetClientStartInfo(exePath, modelJsonPath, clientFolder);

    string dllPath = Path.Combine(clientFolder, "Alife.DeskPet.Client.dll");
    if (File.Exists(dllPath) == false)
        throw new FileNotFoundException($"Cannot find DeskPet client executable or dll in {clientFolder}");

    dotnetPath ??= Environment.ProcessPath ?? "dotnet";
    return new PetClientStartInfo(dotnetPath, $"\"{dllPath}\" \"{modelJsonPath}\"", clientFolder);
}
```

- [x] **Step 4: Use resolver in constructor**

In the `PetServer` constructor, replace the hardcoded `petExePath` block with:

```csharp
PetClientStartInfo clientStartInfo = ResolveClientStartInfo(AlifePath.OutputsFolderPath, modelJsonPath);
nativeProcess = new Process {
    StartInfo = new ProcessStartInfo {
        FileName = clientStartInfo.FileName,
        Arguments = clientStartInfo.Arguments,
        UseShellExecute = false,
        RedirectStandardInput = true,
        RedirectStandardOutput = true,
        RedirectStandardError = true,
        StandardInputEncoding = new UTF8Encoding(false),
        StandardOutputEncoding = new UTF8Encoding(false),
        CreateNoWindow = true,
        WorkingDirectory = clientStartInfo.WorkingDirectory
    }
};
```

- [x] **Step 5: Run start-info tests green**

Run:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' test 'Tests\Alife.Test.DeskPet\Alife.Test.DeskPet.csproj' --no-restore --filter PetServerProcessStartTests
```

Expected: pass.

---

## Task 3: Add Model Action Profile Loading

**Files:**
- Modify: `sources/Alife.DeskPet/Alife.DeskPet.Protocol/Live2DModelManifest.cs`
- Modify: `sources/Alife.DeskPet/Alife.DeskPet.Protocol/PetModelMetadata.cs`
- Test: `Tests/Alife.Test.DeskPet/PetModelActionProfileTests.cs`

- [x] **Step 1: Create failing action-profile test**

Create `Tests/Alife.Test.DeskPet/PetModelActionProfileTests.cs`:

```csharp
using System.Text.Json;
using Alife.Function.DeskPet;

namespace Alife.Test.DeskPet;

public class PetModelActionProfileTests
{
    [Test]
    public void LoadManifestReadsSemanticActionProfile()
    {
        string tempRoot = Path.Combine(Path.GetTempPath(), "alife-action-profile-tests", Guid.NewGuid().ToString("N"));
        string modelRoot = Path.Combine(tempRoot, "wwwroot", "model", "MoNv");
        Directory.CreateDirectory(modelRoot);
        try
        {
            File.WriteAllText(Path.Combine(modelRoot, "alife.model.json"), JsonSerializer.Serialize(new Live2DModelManifest
            {
                Id = "MoNv",
                DisplayName = "MoNv",
                ModelFile = "MoNv.model3.json",
                Expressions =
                [
                    new Live2DModelExpressionEntry { Name = "ku", File = "ku.exp3.json" },
                    new Live2DModelExpressionEntry { Name = "mz", File = "mz.exp3.json" },
                ],
                Motions =
                [
                    new Live2DModelMotionEntry { Name = "Scene1", Group = "default", Index = 0, File = "Scene1.motion3.json", Loop = true },
                ],
            }));
            File.WriteAllText(Path.Combine(modelRoot, "alife.actions.json"),
                """
                {
                  "Actions": [
                    { "Name": "cry", "Expression": "ku" },
                    { "Name": "idle", "Motion": { "Group": "default", "Index": 0 } },
                    { "Name": "shy", "Expression": "mz", "Motion": { "Group": "default", "Index": 0 } }
                  ]
                }
                """);

            PetModelMetadata metadata = PetModelMetadata.Load(Path.Combine(modelRoot, "alife.model.json"));

            Assert.That(metadata.Interactions["cry"].Single().Exp, Is.EqualTo("ku"));
            Assert.That(metadata.Interactions["idle"].Single().Mtn, Is.EqualTo(new MotionRef("default", 0)));
            Assert.That(metadata.Interactions["shy"].Single().Exp, Is.EqualTo("mz"));
            Assert.That(metadata.Interactions["shy"].Single().Mtn, Is.EqualTo(new MotionRef("default", 0)));
        }
        finally
        {
            if (Directory.Exists(tempRoot))
                Directory.Delete(tempRoot, recursive: true);
        }
    }
}
```

- [x] **Step 2: Run test and verify it fails**

Run:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' test 'Tests\Alife.Test.DeskPet\Alife.Test.DeskPet.csproj' --no-restore --filter PetModelActionProfileTests
```

Expected: fail because `alife.actions.json` is ignored.

- [x] **Step 3: Add action-profile records**

In `Live2DModelManifest.cs`, add:

```csharp
public record Live2DActionProfile
{
    public List<Live2DModelActionEntry> Actions { get; init; } = new();
}
```

- [x] **Step 4: Load profile from `PetModelMetadata.LoadManifest(...)`**

In `PetModelMetadata.LoadManifest(...)`, after manifest actions are loaded, add:

```csharp
string profilePath = Path.Combine(Path.GetDirectoryName(manifestPath)!, "alife.actions.json");
if (File.Exists(profilePath))
{
    Live2DActionProfile? profile = JsonSerializer.Deserialize<Live2DActionProfile>(
        File.ReadAllText(profilePath),
        PetProcess.JsonOptions);
    if (profile != null)
        AddActions(metadata, profile.Actions);
}
```

Extract the existing action loop into:

```csharp
static void AddActions(PetModelMetadata metadata, IEnumerable<Live2DModelActionEntry> actions)
{
    foreach (Live2DModelActionEntry action in actions)
    {
        if (string.IsNullOrWhiteSpace(action.Name))
            continue;

        InteractionItem item = new()
        {
            Exp = action.Expression,
            Mtn = action.Motion == null
                ? null
                : new MotionRef(action.Motion.Group, action.Motion.Index),
        };
        metadata.Interactions[action.Name] = [item];
    }
}
```

- [x] **Step 5: Run action-profile tests green**

Run:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' test 'Tests\Alife.Test.DeskPet\Alife.Test.DeskPet.csproj' --no-restore --filter PetModelActionProfileTests
```

Expected: pass.

---

## Task 4: Generate Starter Action Profile For MoNv

**Files:**
- Modify: `sources/Alife.Function/Alife.Function.DeskPet/Live2DModelImporter.cs`
- Test: `Tests/Alife.Test.DeskPet/Live2DModelImporterTests.cs`

- [x] **Step 1: Add failing importer test for starter action profile**

Append this test to `Live2DModelImporterTests.cs`:

```csharp
[Test]
public void ImportWritesStarterActionProfileForKnownShortExpressionNames()
{
    string tempRoot = Path.Combine(Path.GetTempPath(), "alife-live2d-import-tests", Guid.NewGuid().ToString("N"));
    string sourceRoot = Path.Combine(tempRoot, "source", "MoNv");
    string destinationRoot = Path.Combine(tempRoot, "dest");
    Directory.CreateDirectory(sourceRoot);
    try
    {
        File.WriteAllText(Path.Combine(sourceRoot, "MoNv.model3.json"), """{ "Version": 3, "FileReferences": { "Moc": "MoNv.moc3", "Textures": [] } }""");
        File.WriteAllText(Path.Combine(sourceRoot, "MoNv.moc3"), "moc");
        File.WriteAllText(Path.Combine(sourceRoot, "ku.exp3.json"), "{}");
        File.WriteAllText(Path.Combine(sourceRoot, "mz.exp3.json"), "{}");
        File.WriteAllText(Path.Combine(sourceRoot, "Scene1.motion3.json"), """{ "Version": 3, "Meta": { "Loop": true } }""");

        Live2DModelImporter.Import(sourceRoot, destinationRoot, "MoNv");

        string profilePath = Path.Combine(destinationRoot, "MoNv", "alife.actions.json");
        Assert.That(File.Exists(profilePath), Is.True);
        string profileJson = File.ReadAllText(profilePath);
        Assert.That(profileJson, Does.Contain("\"cry\""));
        Assert.That(profileJson, Does.Contain("\"ku\""));
        Assert.That(profileJson, Does.Contain("\"shy\""));
        Assert.That(profileJson, Does.Contain("\"mz\""));
        Assert.That(profileJson, Does.Contain("\"idle\""));
        Assert.That(profileJson, Does.Contain("\"default\""));
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
& 'C:\Users\hu shu\.dotnet\dotnet.exe' test 'Tests\Alife.Test.DeskPet\Alife.Test.DeskPet.csproj' --no-restore --filter ImportWritesStarterActionProfileForKnownShortExpressionNames
```

Expected: fail because `alife.actions.json` is not written.

- [x] **Step 3: Add starter profile generation**

In `Live2DModelImporter.Import(...)`, after writing `alife.model.json`, call:

```csharp
WriteStarterActionProfile(importedRoot, expressions, motions);
```

Add:

```csharp
static void WriteStarterActionProfile(
    string importedRoot,
    IReadOnlyCollection<Live2DModelExpressionEntry> expressions,
    IReadOnlyList<Live2DModelMotionEntry> motions)
{
    Dictionary<string, string> expressionNames = expressions.ToDictionary(
        expression => expression.Name,
        expression => expression.Name,
        StringComparer.OrdinalIgnoreCase);

    List<Live2DModelActionEntry> actions = new();
    AddExpressionAction(actions, expressionNames, "cry", "ku");
    AddExpressionAction(actions, expressionNames, "shy", "mz");
    AddExpressionAction(actions, expressionNames, "surprised", "sq");
    AddExpressionAction(actions, expressionNames, "dizzy", "yj");
    AddExpressionAction(actions, expressionNames, "happy", "x");
    AddExpressionAction(actions, expressionNames, "sad", "xx");

    Live2DModelMotionEntry? firstMotion = motions.FirstOrDefault();
    if (firstMotion != null)
    {
        actions.Add(new Live2DModelActionEntry
        {
            Name = "idle",
            Motion = new Live2DModelMotionRef { Group = firstMotion.Group, Index = firstMotion.Index },
        });
    }

    if (actions.Count == 0)
        return;

    Live2DActionProfile profile = new() { Actions = actions };
    File.WriteAllText(
        Path.Combine(importedRoot, "alife.actions.json"),
        JsonSerializer.Serialize(profile, new JsonSerializerOptions { WriteIndented = true }));
}

static void AddExpressionAction(
    List<Live2DModelActionEntry> actions,
    IReadOnlyDictionary<string, string> expressionNames,
    string actionName,
    string expressionName)
{
    if (expressionNames.TryGetValue(expressionName, out string? expression))
        actions.Add(new Live2DModelActionEntry { Name = actionName, Expression = expression });
}
```

- [x] **Step 4: Run importer profile test green**

Run:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' test 'Tests\Alife.Test.DeskPet\Alife.Test.DeskPet.csproj' --no-restore --filter ImportWritesStarterActionProfileForKnownShortExpressionNames
```

Expected: pass.

---

## Task 5: Add Semantic Action Function To DeskPetService

**Files:**
- Modify: `sources/Alife.Function/Alife.Function.DeskPet/DeskPetService.cs`
- Modify: `sources/Alife.Function/Alife.Function.DeskPet/PetServer.cs`
- Test: `Tests/Alife.Test.DeskPet/PetServerSemanticActionTests.cs`

- [x] **Step 1: Create failing PetServer semantic-action test**

Create `Tests/Alife.Test.DeskPet/PetServerSemanticActionTests.cs`:

```csharp
using Alife.Function.DeskPet;

namespace Alife.Test.DeskPet;

public class PetServerSemanticActionTests
{
    [Test]
    public void MetadataExposesSemanticActionNames()
    {
        PetModelMetadata metadata = new();
        metadata.Interactions["cry"] =
        [
            new InteractionItem { Exp = "ku" }
        ];
        metadata.Interactions["idle"] =
        [
            new InteractionItem { Mtn = new MotionRef("default", 0) }
        ];

        string[] names = PetServer.GetSupportedActionNames(metadata).ToArray();

        Assert.That(names, Is.EquivalentTo(new[] { "cry", "idle" }));
    }
}
```

- [x] **Step 2: Run test and verify it fails**

Run:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' test 'Tests\Alife.Test.DeskPet\Alife.Test.DeskPet.csproj' --no-restore --filter PetServerSemanticActionTests
```

Expected: compile fails because `GetSupportedActionNames(...)` does not exist.

- [x] **Step 3: Add supported action accessor**

In `PetServer.cs`, add:

```csharp
public IEnumerable<string> SupportedActions => GetSupportedActionNames(metadata);

public static IEnumerable<string> GetSupportedActionNames(PetModelMetadata metadata)
{
    return metadata.Interactions.Keys.OrderBy(name => name, StringComparer.OrdinalIgnoreCase);
}
```

- [x] **Step 4: Add semantic action function**

In `DeskPetService.cs`, add:

```csharp
[XmlFunction(FunctionMode.OneShot)]
[Description("Perform a semantic Live2D action by name, such as idle, cry, shy, surprised, happy, sad.")]
public void Action(string option)
{
    option = option.Trim();
    if (string.IsNullOrWhiteSpace(option))
        return;
    if (client!.TryPlayInteraction(option) == false)
        throw new Exception("Action option does not exist.");
}
```

In `PetServer.cs`, add:

```csharp
public bool TryPlayInteraction(string actionName)
{
    if (metadata.Interactions.TryGetValue(actionName, out List<InteractionItem>? pool) == false || pool.Count == 0)
        return false;

    InteractionItem item = pool[Random.Shared.Next(pool.Count)];
    if (string.IsNullOrWhiteSpace(item.Exp) == false)
        PlayExpression(item.Exp);
    if (item.Mtn != null)
        PlayMotion(item.Mtn.Group, item.Mtn.Index);
    if (string.IsNullOrWhiteSpace(item.Text) == false)
        ShowBubble(item.Text);
    return true;
}
```

- [x] **Step 5: Update prompt option list**

In `DeskPetService.AwakeAsync(...)`, add:

```csharp
string supportedActionsDescription = string.Join(", ", client.SupportedActions);
if (string.IsNullOrEmpty(supportedActionsDescription))
    supportedActionsDescription = $"current model does not support {nameof(Action)} options";
```

Add this line to the prompt option section:

```text
- Supported Action options: {supportedActionsDescription}
```

- [x] **Step 6: Run semantic-action test green**

Run:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' test 'Tests\Alife.Test.DeskPet\Alife.Test.DeskPet.csproj' --no-restore --filter PetServerSemanticActionTests
```

Expected: pass.

---

## Task 6: Add Runtime Smoke Command Without Language Model

**Files:**
- Modify: `Demos/Alife.Demo.DeskPet/Program.cs`

- [x] **Step 1: Add command parsing branch**

In `Demos/Alife.Demo.DeskPet/Program.cs`, after the `import` branch and before the full AI demo branch, add:

```csharp
if (args.Length >= 2 && args[0].Equals("runtime-smoke", StringComparison.OrdinalIgnoreCase))
{
    string modelId = args[1];
    await using PetServer server = new(modelId);
    server.OnRendererError += error => AlifeTerminal.LogError($"{error.Operation}: {error.Message}");
    await server.WaitReadyAsync();
    AlifeTerminal.LogInfo($"DeskPet runtime ready for model '{modelId}'.");
    server.ShowBubble("Runtime smoke test");
    await Task.Delay(800);
    server.PlayMotion("default", 0);
    await Task.Delay(800);
    server.TryPlayInteraction("cry");
    await Task.Delay(800);
    server.HideBubble();
    AlifeTerminal.LogInfo("DeskPet runtime smoke completed.");
    return;
}
```

- [x] **Step 2: Build**

Run:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' build 'D:\Alife\.worktrees\live2d-import-preview\Alife.slnx' --no-restore
```

Expected: build succeeds with `0 个错误`.

- [x] **Step 3: Run runtime smoke command**

Run:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' run --project 'Demos\Alife.Demo.DeskPet\Alife.Demo.DeskPet.csproj' --no-build -- runtime-smoke MoNv
```

Expected:
- a DeskPet window opens;
- terminal logs `DeskPet runtime ready for model 'MoNv'.`;
- bubble appears briefly;
- `Scene1` motion plays;
- `cry` semantic action triggers expression `ku`;
- command exits without requiring `ILanguageModel`.

---

## Task 7: Reimport MoNv And Verify Real Runtime

**Files:**
- Modify: `docs/superpowers/plans/2026-06-12-deskpet-runtime-integration.md`

- [x] **Step 1: Reimport active model**

Run:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' run --project 'Demos\Alife.Demo.DeskPet\Alife.Demo.DeskPet.csproj' --no-build -- import 'C:\Users\hu shu\Desktop\新建文件夹\魔女' MoNv
```

Expected:
- `alife.actions.json` exists in `Outputs\Alife.DeskPet.Client\wwwroot\model\MoNv`;
- `Scene1` remains `default/0`;
- semantic actions include at least `cry`, `shy`, and `idle`.

- [x] **Step 2: Run full DeskPet tests**

Run:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' test 'Tests\Alife.Test.DeskPet\Alife.Test.DeskPet.csproj' --no-restore
```

Expected: `失败: 0`.

- [x] **Step 3: Run frontend tests**

Run:

```powershell
node --test 'Tests\Alife.Test.DeskPet\pet-js-live2d.test.mjs'
```

Expected: `fail 0`.

- [x] **Step 4: Run full build**

Run:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' build 'D:\Alife\.worktrees\live2d-import-preview\Alife.slnx' --no-restore
```

Expected: `0 个警告`, `0 个错误`.

- [x] **Step 5: Run runtime smoke**

Run:

```powershell
& 'C:\Users\hu shu\.dotnet\dotnet.exe' run --project 'Demos\Alife.Demo.DeskPet\Alife.Demo.DeskPet.csproj' --no-build -- runtime-smoke MoNv
```

Expected: runtime smoke completes and exits without `ILanguageModel` error.

- [x] **Step 6: Mark observed results**

Update this plan file with observed command outputs and mark completed steps.

### Observed Results

- Reimport command completed for `MoNv` from `C:\Users\hu shu\Desktop\新建文件夹\魔女`; importer reported the `.vtube.json` file as a non-Web Live2D asset and ignored it.
- Generated `Outputs\Alife.DeskPet.Client\wwwroot\model\MoNv\alife.actions.json`.
- Generated semantic actions: `cry`, `shy`, `surprised`, `dizzy`, `happy`, `sad`, `idle`.
- Generated motion catalog includes `Scene1` as `default/0`.
- Full DeskPet test command completed with `失败: 0，通过: 17，总计: 17`.
- Frontend Live2D Node test command completed with `tests 10, pass 10, fail 0`.
- Full solution build completed with `0 warnings, 0 errors`.
- Runtime smoke command logged `DeskPet runtime ready for model 'MoNv'.` and `DeskPet runtime smoke completed.`.
- Runtime smoke IPC log contained `bubble`, `motion default/0`, `expression ku`, and `hide-bubble`.
- Runtime smoke exited without the previous `ILanguageModel` error.

---

## Self-Review

**Spec coverage:** This plan covers the concrete next step after the preview workbench: default model selection, robust runtime launch, semantic action mapping, AI-facing action function, and real runtime smoke verification without the language-model dependency that previously blocked the demo.

**Placeholder scan:** No `TBD`, `TODO`, or intentionally vague implementation step is present.

**Type consistency:** New types and methods are defined before use: `PetClientStartInfo`, `ResolveClientStartInfo(...)`, `Live2DActionProfile`, `GetSupportedActionNames(...)`, `SupportedActions`, and `TryPlayInteraction(...)`.
