# DevLog: Live2D Model Import & Test Suite — 2026-05-24

## 概述
成功导入猫尾草 Live2D 模型到 AstralFox 项目，修复 Cubism SDK 5.3 在 Tuanjie 2022.3 上的渲染兼容性问题，并建立自动化测试。

## 环境
- **引擎**: Tuanjie 2022.3.61t11 (Unity 2022.3 等效)
- **Cubism SDK**: 5.3-r.5
- **渲染管线**: URP 14.1.0
- **模型**: 猫尾草 (Cat Tail Grass) from libre2d v1.0.0

## 问题与解决

### 核心问题: TryInitializeRenderers 空桩
Cubism SDK 5.3 将真正的 `TryInitializeRenderers` 实现在 `CubismRenderControllerUsingBlendMode.cs` 中，由 `#if UNITY_6000_0_OR_NEWER` 守卫。在 Tuanjie 2022.3 上，编译的是 `CubismCompatStubs.cs` 中的空桩方法，导致 `rc.TryInitialize()` 无法创建任何渲染器。

### 解决方案
在 `CatTailImporterSetup.BuildCompletePrefab()` 中手动创建渲染器：
1. 通过 `drawables.AddComponentEach<CubismRenderer>()` 附加组件
2. 调用每个渲染器的 `TryInitialize(rc)` 设置 MeshRenderer/MeshFilter
3. 通过 `CubismBuiltinPickers` 设置材质和纹理
4. 通过反射设置 `_renderers` 私有字段 (Renderers 属性有 private setter)
5. 添加 `EditorApplication.isCompiling` 守卫防止过早执行

### 文件变更
| 文件 | 变更 |
|------|------|
| `Assets/Scripts/Editor/CatTailImporterSetup.cs` | 手动创建渲染器、添加 Animator Controller 生成、添加 `-executeMethod` 入口点 |
| `Assets/Scripts/Editor/AstralFoxTestRunner.cs` | 重写为纯编辑模式验证、跳过 Play 模式以适应批处理 |
| `Assets/Live2D/Cubism/Rendering/CubismCompatStubs.cs` | 未修改 (保留原始 SDK) |

## 测试结果

```
=== [AstralFox Test] Done: 12 passed, 0 failed ===
```

| 测试 | 状态 |
|------|------|
| AstralFoxRoot exists | PASS |
| FoxPlaceholder exists | PASS |
| CubismModel in FoxPlaceholder | PASS |
| CubismRenderController in FoxPlaceholder | PASS |
| Renderers initialized (18) | PASS |
| DrawableRenderers set (18) | PASS |
| Animator on AstralFoxRoot | PASS |
| Animator Controller assigned | PASS |
| Main Camera exists | PASS |
| Main Camera has Camera component | PASS |
| runInBackground enabled | PASS |
| visibleInBackground enabled | PASS |

## 运行测试
```bash
Tuanjie.exe -batchmode -quit \
  -projectPath "C:\Users\hu shu\Desktop\桌宠demo\新建文件夹\AstralFox" \
  -executeMethod AstralFox.Editor.AstralFoxTestRunner.Run \
  -logFile test-runner.log
```

## 模型状态
- `cattail.prefab` — 18 drawables, 每个含 CubismRenderer + MeshRenderer + 材质 + 纹理
- `cattail.asset` — CubismMoc 资源
- `FoxAnimator.controller` — 5 状态 (Idle/Listening/Speaking/Sleep/Dragging) + BlendTree 混合
- Scene 包含 AstralFoxRoot + FoxPlaceholder + Cubism 模型 + 全组件
