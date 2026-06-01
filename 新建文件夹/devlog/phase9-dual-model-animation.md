# Phase 9 实现文档 — Live2D ↔ DragonBones 双模型动画切换

> 日期：2026-05-24
> 实现：Claude Code
> 状态：完成 (22/22 测试通过)

---

## 目标

建立统一的动画抽象层，使星尘狐可以在 Live2D (Cubism) 和 DragonBones (龙骨) 两种模型之间自由切换，所有上层模块无感知。

---

## 架构设计

```
                 PetAnimationManager (单例)
                        │
                 IPetAnimator (接口)
                    /           \
        Live2DAnimator      DragonBonesAnimator
             │                    │
    FoxAnimationController    [DragonBones SDK]
    FoxEmotionController      (待 SDK 集成)
    CubismParameterDriver
```

外部模块 (FoxSimpleMovement, FoxInteraction, LipSync, VoiceManager 等) 通过 `PetAnimationManager.Instance.CurrentAnimator` 访问动画功能，完全不依赖底层 SDK 类型。

---

## Phase 1: 接口与适配器

### IPetAnimator.cs
**路径**: `Assets/Scripts/Runtime/Animation/IPetAnimator.cs`

定义 18 个成员的统一动画接口：
- **生命周期**: `IsReady`, `SetVisible(bool)`, `GetGameObject()`
- **状态机**: `CurrentState`, `SetState(PetAnimationState)` (Idle/Listening/Speaking/Sleep/Dragging)
- **事件回调**: `OnDragStart/End()`, `OnWakeWord()`, `OnSpeakingStart/End()`
- **表情**: `SetEmotion(PetEmotion)` (Neutral/Happy/Sad/Shy/Angry)
- **参数驱动**: `SetMouthOpen(value)`, `SetEyeOpen(value)`, `SetBodyPose(x,y,z)`, `SetTailWag/Swing(value)`, `SetEarPose(l,r)`
- **帧更新**: `UpdateAnimator(deltaTime)`

附带的 3 个枚举：`PetAnimationState`, `PetEmotion`, `PetModelType`

### Live2DAnimator.cs
**路径**: `Assets/Scripts/Runtime/Animation/Live2DAnimator.cs`

适配器模式：包装 `CubismParameterDriver` + `FoxAnimationController` + `FoxEmotionController`，将 IPetAnimator 调用转发到 Live2D 特定实现。包含枚举转换方法 `ConvertState()` / `ConvertEmotion()`。

### DragonBonesAnimator.cs
**路径**: `Assets/Scripts/Runtime/Animation/DragonBonesAnimator.cs`

骨架适配器，带有 `#if DRAGONBONES_SDK_PRESENT` 条件编译。当前 SDK 未集成时使用 `Dictionary<string, float>` 存储参数值作为回退模式。

### PetAnimationManager.cs
**路径**: `Assets/Scripts/Runtime/Animation/PetAnimationManager.cs`

单例管理器 (`[DefaultExecutionOrder(-100)]`)：
- 自动检测 Live2DAnimator 和 DragonBonesAnimator（从 FoxPlaceholder 子级查找）
- 延迟模型切换（排队到下一帧以避免中间帧状态损坏）
- 事件：`OnModelSwitched`

---

## Phase 2: 场景结构调整

**修改文件**: `Assets/Scripts/Editor/AstralFoxSceneSetup.cs`

FoxPlaceholder 下创建两个子节点：
```
FoxPlaceholder
├── Live2D_Model (active)
│   ├── [Cubism 模型预制体, 18 个渲染器]
│   ├── Live2DAnimator, Animator (FoxAnimator.controller)
│   ├── CubismParameterDriver, FoxAnimationController, FoxEmotionController
│   └── TailParticleEffect
└── DragonBones_Model (隐藏)
    ├── DragonBonesAnimator
    └── Animator
```

根节点保留向后兼容组件 (Animator, CubismParameterDriver, FoxAnimationController, FoxEmotionController) 以及新增 PetAnimationManager 和 FoxSimpleMovement。

测试扩展到 22 个断言（+10 个）。

---

## Phase 3: 配置系统扩展

**修改文件**: `AppConfig.cs`, `ConfigManager.cs`, `AstralFoxSettingsWindow.cs`, `SettingsWebServer.cs`

- `AppConfig.animation_model` 字段（"live2d" | "dragonbones"），默认 "live2d"
- `config_version` 从 1 升级到 2
- Editor 窗口：动画模型区域，ToggleLeft 单选 UI
- Web 设置面板：radio button 组，JS collect 函数包含 animation_model

---

## Phase 4: 模块引用更新

**修改文件**: `FoxSimpleMovement.cs`, `FoxInteraction.cs`, `LipSync.cs`, `VoiceManager.cs`, `TailParticleEffect.cs`, `MockVoicePipeline.cs`

所有外部模块从直接引用 `CubismParameterDriver` / `FoxAnimationController` 改为通过 `PetAnimationManager.Instance.CurrentAnimator` 访问动画功能：

| 模块 | 原引用 | 新引用 |
|------|--------|--------|
| FoxSimpleMovement | `_driver.SetParameter(FoxParamId.xxx)` | `animator.SetBodyPose/SetTailWag/SetTailSwing/SetEarPose()` |
| FoxSimpleMovement | `_animController.CurrentState` | `animator.CurrentState` |
| FoxInteraction | `_animController.OnDragStart/End()` | `CurrentAnimator?.OnDragStart/End()` |
| LipSync | `_animCtrl.SetMouthOpen()` | `animator.SetMouthOpen()` |
| VoiceManager | `_animCtrl.OnWakeWord/OnSpeakingStart/End/SetEmotion()` | `CurrentAnimator?.OnWakeWord/OnSpeakingStart/End/SetEmotion()` |
| TailParticleEffect | `root.GetComponent<FoxEmotionController>()` | `CurrentAnimator.GetGameObject().GetComponent<FoxEmotionController>()` |
| MockVoicePipeline | `_animCtrl.OnSpeakingStart/End/SetEmotion()` | `CurrentAnimator?.OnSpeakingStart/End/SetEmotion()` |

`VoiceManager.ParseEmotionTag` 返回类型从 `FoxEmotionController.FoxEmotion` 改为 `PetEmotion`。

---

## Phase 5: 测试

运行 `AstralFox.Editor.AstralFoxTestRunner.Run` 结果：

```
=== [AstralFox Test] Start ===
  [PASS] AstralFoxRoot exists
  [PASS] FoxPlaceholder exists
  [PASS] Live2D_Model exists under FoxPlaceholder
  [PASS] DragonBones_Model exists under FoxPlaceholder
  [PASS] CubismModel in Live2D_Model
  [PASS] CubismRenderController in Live2D_Model
  [PASS] Renderers initialized (18)
  [PASS] DrawableRenderers set (18)
  [PASS] Live2DAnimator on Live2D_Model
  [PASS] FoxAnimationController on Live2D_Model
  [PASS] FoxEmotionController on Live2D_Model
  [PASS] CubismParameterDriver on Live2D_Model
  [PASS] Animator on Live2D_Model
  [PASS] DragonBonesAnimator on DragonBones_Model
  [PASS] Animator on DragonBones_Model
  [PASS] Animator on AstralFoxRoot
  [PASS] Animator Controller assigned
  [PASS] PetAnimationManager on AstralFoxRoot
  [PASS] Main Camera exists
  [PASS] Main Camera has Camera component
  [PASS] runInBackground enabled
  [PASS] visibleInBackground enabled
=== [AstralFox Test] Done: 22 passed, 0 failed ===
```

---

## 后续

- DragonBones SDK 集成后，`DragonBonesAnimator` 的 `#if DRAGONBONES_SDK_PRESENT` 块将自动编译
- 模型切换通过在 PetAnimationManager 上调用 `SwitchModel(PetModelType.DragonBones)` 触发
- 切换是延迟的（下一帧执行），避免中间帧状态损坏
