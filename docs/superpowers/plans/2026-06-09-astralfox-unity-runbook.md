# AstralFox Unity Runtime Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the AstralFox Unity desktop pet open, set up its scene, enter Play Mode, show the YouXiaoMiao Live2D model, drive native expressions, and exit without obvious runtime lifecycle errors.

**Architecture:** Treat the Unity Editor as the source of truth for P0-P5 validation. Keep current model switching as safe configuration switching, keep runtime hot-swap out of the stabilization path, and only change code when a concrete validation step fails.

**Tech Stack:** Unity 6 `6000.4.10f1`, C#, Live2D Cubism SDK, CodeGraph, PowerShell, Unity batchmode compile logs.

---

## Source Runbook

This plan expands `D:\FOXD\桌宠demo\devlog\UNITY-NEXT-RUNBOOK-2026-06-09.md`.

Unity project:

```text
D:\FOXD\桌宠demo\新建文件夹\AstralFox
```

Unity editor:

```text
D:\uni\Editor\Unity.exe
D:\uni\Editor\Unity.com
```

Do not casually revert these already-modified Unity files:

```text
Assets/Scripts/Editor/AstralFoxSceneSetup.cs
Assets/Scripts/Runtime/Animation/FoxEmotionController.cs
Assets/Scripts/Runtime/Animation/Live2DAnimator.cs
Assets/Scripts/Runtime/Config/PetModelRegistry.cs
Assets/Scripts/Runtime/Config/SettingsWebServer.cs
Assets/Scripts/Runtime/ExpressionHotkeys.cs
Assets/Scripts/Runtime/QuickModelSwitch.cs
Assets/Scripts/Runtime/StartupWizard.cs
```

## File Map

- `Assets/Scripts/Editor/AstralFoxSceneSetup.cs`: Editor menu that creates or repairs `AstralFoxRoot`, camera, `FoxPlaceholder`, `Live2D_Model`, Live2D components, interaction scripts, and desktop pet scene wiring.
- `Assets/Scripts/Runtime/ExpressionHotkeys.cs`: Play Mode hotkey driver for `CubismExpressionController`, currently intended to live on the actual `CubismModel` object.
- `Assets/Scripts/Runtime/Animation/FoxEmotionController.cs`: PAD and voice emotion bridge into native Live2D expressions and parameter snapshots.
- `Assets/Scripts/Runtime/Animation/Live2DAnimator.cs`: Runtime animation adapter implementing `IPetAnimator`; has `[RequireComponent]` dependencies on animator, parameter driver, emotion controller, and animation controller.
- `Assets/Scripts/Runtime/Animation/PetAnimationManager.cs`: Singleton facade exposing `CurrentAnimator`, currently searches `FoxPlaceholder` children before falling back to scene-wide lookup.
- `Assets/Scripts/Runtime/Config/PetModelRegistry.cs`: Enumerates locally available models for configuration selection.
- `Assets/Scripts/Runtime/QuickModelSwitch.cs`: Runtime context menu and saved model path selection. It must not hide the current model during config-only switching.
- `Assets/Scripts/Runtime/Config/SettingsWebServer.cs`: Local settings server. Only touch for compile blockers or minimal config save behavior needed by Unity runtime.
- `Assets/Scripts/Runtime/Voice/AIManager.cs`: Voice pipeline service coordinator. Current fire-and-forget start call uses `_ = InitializeServicesAsync();`, so this needs a top-level exception boundary.
- `Assets/Scripts/Runtime/Config/ConfigValidator.cs`: Already exposes `RunAllTestsAsync(...)`; do not plan work against an old `RunAllTests()` name.
- `Assets/Scripts/Runtime/Platform/TransparentWindow.cs`: Native transparent/overlay window integration. Current `OnDestroy()` already calls `StopAllCoroutines()` and destroys the overlay window.
- `Assets/Scripts/Runtime/VoiceButton.cs`: IMGUI microphone button. Current `OnDestroy()` releases `_micTexture` but not `_dotTexture`.
- `Assets/Scripts/Runtime/SettingsButton.cs`: IMGUI settings button. Current `OnDestroy()` releases `_gearTexture`.
- `Assets/Scripts/Runtime/FoxInteraction.cs`: Interaction driver. It already has `[RequireComponent(typeof(TransparentWindow))]`, `[RequireComponent(typeof(Animation.PADEmotionEngine))]`, and `[RequireComponent(typeof(Audio.SoundEffectManager))]`.
- `Assets/Scripts/Runtime/FoxSimpleMovement.cs`: Movement driver. It already has `[RequireComponent(typeof(TransparentWindow))]` and `[RequireComponent(typeof(Animation.PADEmotionEngine))]`.

---

### Task 0: Baseline And Guardrails

**Files:**
- Read: `D:\FOXD\桌宠demo\devlog\UNITY-NEXT-RUNBOOK-2026-06-09.md`
- Read: `Assets/Scripts/Editor/AstralFoxSceneSetup.cs`
- Read: `Assets/Scripts/Runtime/ExpressionHotkeys.cs`
- Read: `Assets/Scripts/Runtime/Animation/FoxEmotionController.cs`
- Read: `Assets/Scripts/Runtime/Animation/Live2DAnimator.cs`
- Read: `Assets/Scripts/Runtime/Animation/PetAnimationManager.cs`

- [ ] **Step 1: Confirm CodeGraph freshness**

Run:

```powershell
cd "D:\FOXD\桌宠demo\新建文件夹\AstralFox"
codegraph status
```

Expected:

```text
Files indexed: 483
Total nodes: 10476
Total edges: 21358
```

If CodeGraph reports pending or stale files, run:

```powershell
codegraph sync
```

- [ ] **Step 2: Confirm workspace state before touching code**

Run:

```powershell
git -C "D:\FOXD" status --short
```

Expected: the command may list existing Unity files from the runbook. Treat them as user/current-branch work and do not revert them.

- [ ] **Step 3: Scan the last Unity compile log**

Run:

```powershell
rg -n "error CS|warning CS|Mono: successfully reloaded assembly|Initialize engine version|Licensing|Timed-out" "D:\FOXD\桌宠demo\新建文件夹\AstralFox\codex-unity-compile.log"
```

Expected passing compile signal:

```text
Initialize engine version: 6000.4.10f1
Mono: successfully reloaded assembly
```

Expected known local blocker if Unity licensing is busy:

```text
Another instance of Unity.Licensing.Client is already running.
Timed-out after 60.01s, waiting for Licensing to initialize
```

- [ ] **Step 4: If `SettingsWebServer` duplicate JSON escape returns, verify the duplicate before editing**

Run:

```powershell
rg -n "private static string EscapeJson|EscapeJson\(" "D:\FOXD\桌宠demo\新建文件夹\AstralFox\Assets\Scripts\Runtime\Config\SettingsWebServer.cs"
```

Expected: exactly one `private static string EscapeJson` definition. If two definitions appear, keep the complete `EscapeJson(string value)` implementation at the file end and remove the older single-line duplicate.

- [ ] **Step 5: Commit only if Task 0 required a compile-blocker fix**

Run:

```powershell
git -C "D:\FOXD" add "桌宠demo/新建文件夹/AstralFox/Assets/Scripts/Runtime/Config/SettingsWebServer.cs"
git -C "D:\FOXD" commit -m "fix: remove duplicate settings JSON escape helper"
```

Expected: commit succeeds only when Step 4 changed that file. If Step 4 changed nothing, do not create an empty commit.

---

### Task 1: P0 Restore Verifiable Unity Editor State

**Files:**
- Modify only on failure: `Assets/Scripts/Editor/AstralFoxSceneSetup.cs`
- Modify only on compile blocker: `Assets/Scripts/Runtime/Config/SettingsWebServer.cs`
- Verify: active Unity scene generated by `AstralFox > Setup Desktop Pet Scene`

- [ ] **Step 1: Run batchmode compile when the editor is closed**

Run:

```powershell
& "D:\uni\Editor\Unity.com" `
  -batchmode -nographics -quit `
  -projectPath "D:\FOXD\桌宠demo\新建文件夹\AstralFox" `
  -logFile "D:\FOXD\桌宠demo\新建文件夹\AstralFox\codex-unity-compile.log"
```

Expected: Unity may exit after a licensing timeout on this machine. Treat script compile as acceptable when the log contains `Mono: successfully reloaded assembly` and contains no `error CS`.

- [ ] **Step 2: Open the Unity project manually**

Open:

```text
D:\uni\Editor\Unity.exe
```

Project:

```text
D:\FOXD\桌宠demo\新建文件夹\AstralFox
```

Expected: Unity finishes import and C# compile. Fix `error CS` first. Leave warnings untouched unless they block entering Play Mode.

- [ ] **Step 3: Run scene setup**

In Unity, execute:

```text
AstralFox > Setup Desktop Pet Scene
```

Expected hierarchy:

```text
AstralFoxRoot
FoxPlaceholder
└── Live2D_Model
    └── 悠小喵 / CubismModel root
```

- [ ] **Step 4: Verify required components after setup**

Inspect the actual CubismModel root under `Live2D_Model`.

Expected components on the actual CubismModel root:

```text
CubismUpdateController
CubismExpressionController
ExpressionHotkeys
```

Expected `CubismExpressionController.ExpressionsList`:

```text
Assets/Live2D/Models/YouXiaoMiao/YouXiaoMiao.expressionList.asset
```

- [ ] **Step 5: Save the scene**

Use Unity menu:

```text
File > Save
```

Expected: scene save completes without Console `error CS`.

- [ ] **Step 6: Enter Play Mode**

Expected:

```text
FoxPlaceholder exists
Live2D_Model exists
YouXiaoMiao model is visible
Console has no error CS
```

- [ ] **Step 7: Commit only if `AstralFoxSceneSetup.cs` changed**

Run:

```powershell
git -C "D:\FOXD" add "桌宠demo/新建文件夹/AstralFox/Assets/Scripts/Editor/AstralFoxSceneSetup.cs"
git -C "D:\FOXD" commit -m "fix: repair desktop pet scene setup"
```

Expected: commit succeeds only when scene setup code changed.

---

### Task 2: P1 Verify Native Expression Hotkeys And Emotion Bridge

**Files:**
- Verify: `Assets/Scripts/Runtime/ExpressionHotkeys.cs`
- Verify: `Assets/Scripts/Runtime/Animation/FoxEmotionController.cs`
- Modify only if Play Mode validation fails: `Assets/Scripts/Runtime/ExpressionHotkeys.cs`

- [ ] **Step 1: Confirm current hotkey code path**

Current source expectations in `ExpressionHotkeys.cs`:

```csharp
private void Start()
{
    RefreshUpdateController();
    var count = _expCtrl?.ExpressionsList?.CubismExpressionObjects?.Length ?? 0;
    Debug.Log($"[ExpressionHotkeys] {count} expressions ready. 0-9/F1-F8 to play, ESC to clear.");
}
```

```csharp
private void ApplyExpressionImmediately()
{
    RefreshUpdateController();
    _expCtrl?.OnLateUpdate();
}
```

- [ ] **Step 2: Run hotkey validation in Play Mode**

Press:

```text
0 1 2 3 4 5 6 7 8 9
F1 F2 F3 F4 F5 F6 F7 F8
ESC
```

Expected:

```text
[ExpressionHotkeys] 18 expressions ready. 0-9/F1-F8 to play, ESC to clear.
[Expression] [Alpha0] ...
[Expression] [F1] ...
[Expression] Cleared
```

Expected visual behavior: each mapped key changes the model expression, and `ESC` clears the current expression.

- [ ] **Step 3: If logs appear but expression does not move, add one-frame diagnostic logs**

Modify `Assets/Scripts/Runtime/ExpressionHotkeys.cs` by replacing `ApplyExpressionImmediately()` with:

```csharp
private void ApplyExpressionImmediately()
{
    RefreshUpdateController();

    var count = _expCtrl?.ExpressionsList?.CubismExpressionObjects?.Length ?? 0;
    Debug.Log($"[ExpressionHotkeys] Applying index={_expCtrl?.CurrentExpressionIndex ?? -999}, count={count}, updateController={_updateController != null}");

    _expCtrl?.OnLateUpdate();
}
```

- [ ] **Step 4: Re-run the exact Play Mode hotkey sequence**

Expected diagnostic log for a valid key:

```text
[ExpressionHotkeys] Applying index=0, count=18, updateController=True
```

If `count=0`, assign `YouXiaoMiao.expressionList.asset` in scene setup. If `updateController=False`, add `CubismUpdateController` to the actual CubismModel root in `AstralFoxSceneSetup.cs`.

- [ ] **Step 5: Validate emotion to native expression mapping**

Trigger PAD or voice mock emotion events for:

```text
Neutral
Happy
Sad
Shy
Angry
```

Expected mapping:

```text
Neutral -> -1
Happy   -> 4
Sad     -> 1
Shy     -> 9
Angry   -> 16
```

Expected behavior: native expression changes on non-neutral emotions and clears on neutral.

- [ ] **Step 6: Commit only if diagnostics or scene setup changed**

Run:

```powershell
git -C "D:\FOXD" add `
  "桌宠demo/新建文件夹/AstralFox/Assets/Scripts/Runtime/ExpressionHotkeys.cs" `
  "桌宠demo/新建文件夹/AstralFox/Assets/Scripts/Editor/AstralFoxSceneSetup.cs"
git -C "D:\FOXD" commit -m "fix: stabilize native expression playback"
```

Expected: commit succeeds only when a source file changed.

---

### Task 3: P2 Decide Live2DAnimator Mount Boundary By Evidence

**Files:**
- Verify: `Assets/Scripts/Runtime/Animation/Live2DAnimator.cs`
- Verify: `Assets/Scripts/Runtime/Animation/PetAnimationManager.cs`
- Verify: `Assets/Scripts/Runtime/Animation/CubismParameterDriver.cs`
- Modify only on runtime lookup failure: `Assets/Scripts/Editor/AstralFoxSceneSetup.cs`

- [ ] **Step 1: Confirm current manager lookup behavior**

Current expectation in `PetAnimationManager.cs`:

```csharp
private static T FindAnimatorInChildren<T>() where T : Component
{
    var petPlaceholder = GameObject.Find("FoxPlaceholder");
    if (petPlaceholder != null)
    {
        var result = petPlaceholder.GetComponentInChildren<T>(includeInactive: true);
        if (result != null) return result;
    }

    return FindObjectOfType<T>(includeInactive: true);
}
```

- [ ] **Step 2: In Play Mode, inspect runtime state**

Use Inspector or a temporary Debug log from `PetAnimationManager.Start()`.

Expected:

```text
Live2DAnimator.IsReady == true
PetAnimationManager.CurrentAnimator != null
```

Expected Console:

```text
[PetAnimationManager] Live2D animator initialized.
```

- [ ] **Step 3: Validate parameter-driven animation before moving components**

In Play Mode, observe:

```text
idle breathing moves
blink moves
ear or tail parameter moves
drag state changes animation state
look target responds to mouse
```

Expected: all remain functional with the current mount layout.

- [ ] **Step 4: If and only if lookup fails, unify the animation stack on the actual CubismModel root**

Change `AstralFoxSceneSetup.cs` so these components are attached to the same actual CubismModel root object:

```text
Animator
CubismParameterDriver
FoxEmotionController
FoxAnimationController
Live2DAnimator
CubismUpdateController
CubismExpressionController
ExpressionHotkeys
```

When changing setup code, use `GetComponent<T>() ?? AddComponent<T>()` style and preserve existing serialized references when the component already exists.

- [ ] **Step 5: Re-run scene setup and Play Mode validation**

Run in Unity:

```text
AstralFox > Setup Desktop Pet Scene
File > Save
Play
```

Expected:

```text
Live2DAnimator.IsReady == true
PetAnimationManager.CurrentAnimator != null
native expressions still work
drag/blink/breath/tail/ear animation still works
```

- [ ] **Step 6: Commit only if the mount layout changed**

Run:

```powershell
git -C "D:\FOXD" add "桌宠demo/新建文件夹/AstralFox/Assets/Scripts/Editor/AstralFoxSceneSetup.cs"
git -C "D:\FOXD" commit -m "fix: align Live2D animation components with model root"
```

Expected: commit succeeds only when scene setup code changed.

---

### Task 4: P3 Keep Model Selection As Safe Config Switching

**Files:**
- Verify: `Assets/Scripts/Runtime/Config/PetModelRegistry.cs`
- Verify: `Assets/Scripts/Runtime/QuickModelSwitch.cs`
- Verify: `Assets/Scripts/Runtime/Animation/Live2DAnimator.cs`
- Modify only if current model disappears: `Assets/Scripts/Runtime/QuickModelSwitch.cs`

- [ ] **Step 1: Verify available model list**

In Play Mode, open the model context menu.

Expected visible options:

```text
星尘 (AI生成)
Senko 仙狐 (占位)
```

Expected local files:

```text
Assets/StreamingAssets/Models/generated/model.model3.json
Assets/StreamingAssets/Models/Senko/senko.model3.json
```

- [ ] **Step 2: Select each model option**

Expected:

```text
selected path is saved
current YouXiaoMiao prefab remains visible
log or user prompt says restart or scene reload is required for the saved model to take effect
```

- [ ] **Step 3: Confirm `Live2DAnimator.ReloadModel()` does not hide the active model**

Expected: choosing a model path does not call a path that deactivates or destroys the current visible model.

- [ ] **Step 4: If the pet disappears, patch `QuickModelSwitch` to config-only behavior**

Use this behavior in the selection handler:

```csharp
private void SelectModel(string modelPath)
{
    if (string.IsNullOrWhiteSpace(modelPath))
        return;

    if (!Config.PetModelRegistry.IsModelPathAvailable(modelPath))
    {
        Debug.LogWarning($"[QuickModelSwitch] Ignored unavailable model path: {modelPath}");
        return;
    }

    var config = Config.ConfigManager.Instance.Config;
    config.pet_model_path = modelPath;
    Config.ConfigManager.Instance.Save();

    Debug.Log($"[QuickModelSwitch] Saved model path '{modelPath}'. Restart or reload the desktop pet scene to apply it.");
}
```

If the exact config property or save API differs, use the existing `QuickModelSwitch` save path and preserve the same guard clauses and log semantics.

- [ ] **Step 5: Commit only if model switching code changed**

Run:

```powershell
git -C "D:\FOXD" add `
  "桌宠demo/新建文件夹/AstralFox/Assets/Scripts/Runtime/QuickModelSwitch.cs" `
  "桌宠demo/新建文件夹/AstralFox/Assets/Scripts/Runtime/Config/PetModelRegistry.cs" `
  "桌宠demo/新建文件夹/AstralFox/Assets/Scripts/Runtime/Animation/Live2DAnimator.cs"
git -C "D:\FOXD" commit -m "fix: keep model selection as config-only switch"
```

Expected: commit succeeds only when a source file changed.

---

### Task 5: P4 Close Small Unity Runtime Lifecycle Risks

**Files:**
- Modify: `Assets/Scripts/Runtime/Voice/AIManager.cs`
- Verify: `Assets/Scripts/Runtime/Config/ConfigValidator.cs`
- Verify: `Assets/Scripts/Runtime/Platform/TransparentWindow.cs`
- Modify: `Assets/Scripts/Runtime/VoiceButton.cs`
- Verify: `Assets/Scripts/Runtime/SettingsButton.cs`
- Verify: `Assets/Scripts/Runtime/FoxInteraction.cs`
- Verify: `Assets/Scripts/Runtime/FoxSimpleMovement.cs`

- [ ] **Step 1: Patch fire-and-forget service initialization with a logging wrapper**

In `AIManager.cs`, replace:

```csharp
if (_autoStartServices)
    _ = InitializeServicesAsync();
```

with:

```csharp
if (_autoStartServices)
    _ = InitializeServicesWithLoggingAsync();
```

Add this method in the service initialization region:

```csharp
private async Task InitializeServicesWithLoggingAsync()
{
    try
    {
        await InitializeServicesAsync();
    }
    catch (Exception ex)
    {
        Debug.LogError($"[AIManager] Service initialization failed: {ex}");
        UpdateStatus(ServiceTier.Degraded, ServiceTier.Degraded, ServiceTier.Degraded,
            "AI 服务初始化失败，已进入降级模式");
    }
}
```

Ensure `AIManager.cs` already has:

```csharp
using System;
using System.Threading.Tasks;
```

- [ ] **Step 2: Patch the reconnect/reinitialize call site in `AIManager.cs`**

Find the second fire-and-forget call:

```csharp
_ = InitializeServicesAsync();
```

Replace it with:

```csharp
_ = InitializeServicesWithLoggingAsync();
```

Expected: every fire-and-forget service initialization path logs failures and updates degraded status.

- [ ] **Step 3: Confirm `ConfigValidator` is already async Task based**

Expected source:

```csharp
public static async System.Threading.Tasks.Task RunAllTestsAsync(
    AppConfig config,
    Action<string, TestStatus> progressCallback,
    Action<AllResults> doneCallback)
```

Expected caller pattern in `AstralFoxSettingsWindow.cs`:

```csharp
_ = Config.ConfigValidator.RunAllTestsAsync(...);
```

No code change is required unless Unity Console shows an unobserved exception from this path.

- [ ] **Step 4: Confirm `TransparentWindow.OnDestroy()` has cleanup**

Expected source:

```csharp
private void OnDestroy()
{
    StopAllCoroutines();
    CleanupPerPixelAlpha();

    if (_overlayHandle != IntPtr.Zero)
    {
        NativeWindowInterop.DestroyWindow(_overlayHandle);
        _overlayHandle = IntPtr.Zero;
        Debug.Log("[TransparentWindow] Overlay window destroyed.");
    }
}
```

No code change is required unless Play Mode exit logs native handle or coroutine errors.

- [ ] **Step 5: Release both textures in `VoiceButton.OnDestroy()`**

Replace:

```csharp
private void OnDestroy()
{
    if (_micTexture != null) Destroy(_micTexture);
}
```

with:

```csharp
private void OnDestroy()
{
    if (_micTexture != null)
    {
        Destroy(_micTexture);
        _micTexture = null;
    }

    if (_dotTexture != null)
    {
        Destroy(_dotTexture);
        _dotTexture = null;
    }
}
```

- [ ] **Step 6: Confirm `SettingsButton.OnDestroy()` releases its only texture**

Expected source:

```csharp
private void OnDestroy()
{
    if (_gearTexture != null) Destroy(_gearTexture);
}
```

No code change is required unless the class gains more generated textures.

- [ ] **Step 7: Confirm `[RequireComponent]` annotations already exist**

Expected `FoxInteraction.cs`:

```csharp
[RequireComponent(typeof(TransparentWindow))]
[RequireComponent(typeof(Animation.PADEmotionEngine))]
[RequireComponent(typeof(Audio.SoundEffectManager))]
```

Expected `FoxSimpleMovement.cs`:

```csharp
[RequireComponent(typeof(TransparentWindow))]
[RequireComponent(typeof(Animation.PADEmotionEngine))]
```

No code change is required for these two files.

- [ ] **Step 8: Compile and verify Play Mode exit**

Run batchmode compile:

```powershell
& "D:\uni\Editor\Unity.com" `
  -batchmode -nographics -quit `
  -projectPath "D:\FOXD\桌宠demo\新建文件夹\AstralFox" `
  -logFile "D:\FOXD\桌宠demo\新建文件夹\AstralFox\codex-unity-compile.log"
```

Then run Play Mode manually:

```text
Play
open settings
close settings
trigger voice mock
drag pet
stop Play Mode
```

Expected:

```text
no error CS
no unhandled async exception from AIManager
no destroyed object exception on Play Mode exit
no obvious warning burst from settings, drag, or voice mock
```

- [ ] **Step 9: Commit lifecycle fixes**

Run:

```powershell
git -C "D:\FOXD" add `
  "桌宠demo/新建文件夹/AstralFox/Assets/Scripts/Runtime/Voice/AIManager.cs" `
  "桌宠demo/新建文件夹/AstralFox/Assets/Scripts/Runtime/VoiceButton.cs"
git -C "D:\FOXD" commit -m "fix: harden Unity runtime lifecycle cleanup"
```

Expected: commit includes only files that changed in this task.

---

### Task 6: P5 Verify Unity Desktop Pet Experience Closure

**Files:**
- Verify: `Assets/Scripts/Runtime/Platform/TransparentWindow.cs`
- Verify: `Assets/Scripts/Runtime/FoxInteraction.cs`
- Verify: `Assets/Scripts/Runtime/FoxSimpleMovement.cs`
- Verify: `Assets/Scripts/Runtime/Animation/Live2DAnimator.cs`
- Verify: `Assets/Scripts/Runtime/Animation/FoxAnimationController.cs`
- Verify: `Assets/Scripts/Runtime/Animation/FoxEmotionController.cs`
- Verify: `Assets/Scripts/Runtime/AppLifecycle.cs`

- [ ] **Step 1: Transparent window pass**

In Play Mode on Windows runtime build behavior, verify:

```text
window stays topmost
background is transparent
magenta camera background is not visible in final desktop overlay
Editor mode does not incorrectly move the Unity editor window
```

- [ ] **Step 2: Interaction pass**

Verify:

```text
click feedback works
drag works
throw/release works
landing or movement recovery works
mouse look target works
```

- [ ] **Step 3: Animation pass**

Verify:

```text
idle breathing works
blink works
ear movement works
tail movement works
native emotion expressions work
```

- [ ] **Step 4: Exit pass**

Verify:

```text
AppLifecycle stops local settings server
TransparentWindow restores native window style
overlay window is destroyed
no background thread remains from SettingsWebServer
```

- [ ] **Step 5: Capture acceptance notes in devlog**

Append a dated result section to:

```text
D:\FOXD\桌宠demo\devlog\UNITY-NEXT-RUNBOOK-2026-06-09.md
```

Use this exact format:

```markdown
## 执行结果 - 2026-06-09

- P0: PASS/FAIL - Unity Editor 打开、Setup Scene、Play Mode 可见。
- P1: PASS/FAIL - 0-9/F1-F8/ESC 原生表情验证。
- P2: PASS/FAIL - Live2DAnimator 与 PetAnimationManager 挂载边界验证。
- P3: PASS/FAIL - 模型选择保持配置切换且当前模型不消失。
- P4: PASS/FAIL - 生命周期、资源释放、async 初始化边界。
- P5: PASS/FAIL - 透明窗口、交互、动画、退出闭环。
- 阻塞项: 写明 Console error、Unity Licensing、或具体运行时异常。
```

- [ ] **Step 6: Commit devlog only after completing a full pass**

Run:

```powershell
git -C "D:\FOXD" add "桌宠demo/devlog/UNITY-NEXT-RUNBOOK-2026-06-09.md"
git -C "D:\FOXD" commit -m "docs: record Unity desktop pet validation pass"
```

Expected: commit is created only after Step 5 contains real PASS/FAIL values from the Unity session.

---

### Task 7: P6 Design Runtime Model Hot-Swap After Stabilization

**Files:**
- Create: `D:\FOXD\桌宠demo\devlog\UNITY-RUNTIME-MODEL-HOTSWAP-DESIGN-2026-06-09.md`
- Read: `Assets/Scripts/Runtime/Config/PetModelRegistry.cs`
- Read: `Assets/Scripts/Runtime/QuickModelSwitch.cs`
- Read: `Assets/Scripts/Runtime/Animation/Live2DAnimator.cs`
- Read: `Assets/Scripts/Runtime/Animation/PetAnimationManager.cs`
- Read: `Assets/Scripts/Editor/AstralFoxSceneSetup.cs`

- [ ] **Step 1: Start design only when P0-P5 are green**

Required state:

```text
P0 PASS
P1 PASS
P2 PASS
P3 PASS
P4 PASS
P5 PASS
```

If any item is `FAIL`, return to the failed task before designing runtime hot-swap.

- [ ] **Step 2: Document the two model classes**

Create `D:\FOXD\桌宠demo\devlog\UNITY-RUNTIME-MODEL-HOTSWAP-DESIGN-2026-06-09.md` with:

```markdown
# AstralFox Unity Runtime Model Hot-Swap Design

## Model Classes

- Editor/imported prefab models: `Assets/Live2D/Models/...`
- StreamingAssets model3.json models: `Assets/StreamingAssets/Models/...`

## First Supported Path

Support hot-swapping Editor/imported prefabs first.

## Explicitly Deferred Path

Do not load `StreamingAssets/Models/**/*.model3.json` directly at runtime until the prefab path is stable.
```

- [ ] **Step 3: Define prefab hot-swap sequence**

Append:

```markdown
## Prefab Hot-Swap Sequence

1. Pause pet interaction input.
2. Store current position, scale, facing direction, and current emotion.
3. Destroy the old prefab instance under `Live2D_Model`.
4. Instantiate the selected imported prefab under `Live2D_Model`.
5. Attach or find `CubismUpdateController`, `CubismExpressionController`, `ExpressionHotkeys`, `Animator`, `CubismParameterDriver`, `FoxEmotionController`, `FoxAnimationController`, and `Live2DAnimator` on the actual CubismModel root.
6. Bind the matching expression list.
7. Refresh `CubismUpdateController`.
8. Rebind `PetAnimationManager.CurrentAnimator`.
9. Restore position, scale, facing direction, and emotion.
10. Resume pet interaction input.
```

- [ ] **Step 4: Define acceptance criteria**

Append:

```markdown
## Acceptance Criteria

- Switching between two imported prefabs does not hide the pet for more than one frame.
- `PetAnimationManager.CurrentAnimator` is non-null after every switch.
- `Live2DAnimator.IsReady` is true after every switch.
- Hotkeys still drive native expressions after every switch.
- Drag, blink, breathing, ear, tail, and mouse look still work after every switch.
- Failed switch restores the previous model instance.
```

- [ ] **Step 5: Commit design document**

Run:

```powershell
git -C "D:\FOXD" add "桌宠demo/devlog/UNITY-RUNTIME-MODEL-HOTSWAP-DESIGN-2026-06-09.md"
git -C "D:\FOXD" commit -m "docs: design Unity runtime model hot-swap"
```

Expected: design document exists before any hot-swap implementation work begins.

---

## Self-Review

- Spec coverage: P0 through P6 from the runbook are covered by Tasks 1 through 7. Task 0 covers the required startup commands and guardrails.
- Scope boundaries: Web management platform, backend API, remote config sync, settings UI refactor, online model download, cloud auth, and web frontend improvements are excluded.
- Current-code corrections: `InitializeServices` is treated as current `InitializeServicesAsync`; `RunAllTests` is treated as current `RunAllTestsAsync`; `FoxInteraction` and `FoxSimpleMovement` `[RequireComponent]` work is marked as verification because the attributes already exist.
- Verification model: Unity Test Runner coverage is not assumed because the project currently exposes no normal test assembly under `Assets`; compile logs and Unity Editor Play Mode checks are the primary evidence.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-09-astralfox-unity-runbook.md`. Two execution options:

1. **Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach?
