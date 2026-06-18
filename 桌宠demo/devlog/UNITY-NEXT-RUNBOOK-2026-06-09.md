# AstralFox Unity 端后续执行 Runbook

> 日期: 2026-06-09
> 目标: 重新开启 Codex/Unity 窗口后，优先推进 Unity 端桌宠可运行闭环。
> 范围约束: 暂时不推进 Web 管理平台、后端 API、网页设置页重构。仅在 Unity 编译被 `SettingsWebServer` 阻塞时做最小修复。

---

## 0. 当前状态快照

### 项目位置

```text
Unity 项目:
D:\FOXD\桌宠demo\新建文件夹\AstralFox

Unity 6 Editor:
D:\uni\Editor\Unity.exe
D:\uni\Editor\Unity.com
```

### CodeGraph

已执行:

```powershell
cd "D:\FOXD\桌宠demo\新建文件夹\AstralFox"
codegraph init -i
```

结果:

```text
Already initialized in D:\FOXD\桌宠demo\新建文件夹\AstralFox
Index is up to date
Files: 483
Nodes: 10,476
Edges: 21,358
```

重新开启窗口后建议先运行:

```powershell
cd "D:\FOXD\桌宠demo\新建文件夹\AstralFox"
codegraph status
```

如提示 pending/stale:

```powershell
codegraph sync
```

### 当前本地可用 Live2D StreamingAssets 模型

```text
Assets/StreamingAssets/Models/generated/model.model3.json
Assets/StreamingAssets/Models/Senko/senko.model3.json
```

注意: 项目当前主场景/预制体优先使用 `Assets/Live2D/Models/YouXiaoMiao/悠小喵.prefab`，而 StreamingAssets 模型列表只用于配置选择/后续加载方案。

### 当前 git 工作区里已有 Unity 端改动

以下文件已经被修改，重新开启窗口后不要随意回滚:

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

这些改动的核心目的:

1. 修正 Live2D 原生表情组件挂载位置。
2. 让 PAD/语音情绪能驱动 YouXiaoMiao `.exp3` 原生表情。
3. 让模型选择只暴露本地真实存在的 `model3.json`。
4. 避免“切换模型配置后当前桌宠消失”。
5. 减少 IMGUI 和设置服务中的运行时分配/忙等。

---

## 1. 已完成但仍需 Unity Editor 手动确认的事项

### 1.1 Live2D 表情挂载修正

已改:

```text
AstralFoxSceneSetup.cs
ExpressionHotkeys.cs
FoxEmotionController.cs
```

关键判断:

- `CubismExpressionController` 必须挂在实际 `CubismModel` 对象上。
- 不能只挂在 `Live2D_Model` 容器上。
- 原因: Live2D SDK 的 `FindCubismModel()` 不会向子对象查找。

Editor 验证:

1. 打开 Unity 项目。
2. 执行菜单:

```text
AstralFox > Setup Desktop Pet Scene
```

3. 在 Hierarchy 中找到:

```text
FoxPlaceholder
└── Live2D_Model
    └── 悠小喵 / CubismModel root
```

4. 确认以下组件在实际 CubismModel root 上:

```text
CubismUpdateController
CubismExpressionController
ExpressionHotkeys
```

5. 确认 `CubismExpressionController.ExpressionsList` 指向:

```text
Assets/Live2D/Models/YouXiaoMiao/YouXiaoMiao.expressionList.asset
```

### 1.2 表情热键

Play Mode 验证:

```text
0-9      切换前 10 个表情
F1-F8    切换第 11-18 个表情
ESC      清除当前表情
```

预期:

- 控制台出现 expression ready 日志。
- 按键后角色表情应立即可见变化。
- 若无变化，优先查 `CubismExpressionController.OnLateUpdate()` 是否被调用，以及 `CubismUpdateController.Refresh()` 后 updatable 顺序是否包含 expression controller。

### 1.3 情绪驱动原生表情

已改:

```text
FoxEmotionController.cs
```

当前默认映射:

```text
Neutral -> -1 清除表情
Happy   -> 4
Sad     -> 1
Shy     -> 9
Angry   -> 16
```

验证方式:

- 触发语音 mock 情绪或 PAD 情绪事件。
- 观察对应原生表情是否变化。
- 如果索引越界，代码会降级到最后一个可用 expression 并 warning。

---

## 2. 当前验证状态

### C# 编译状态

最近 Unity batchmode 命令:

```powershell
& "D:\uni\Editor\Unity.com" `
  -batchmode -nographics -quit `
  -projectPath "D:\FOXD\桌宠demo\新建文件夹\AstralFox" `
  -logFile "D:\FOXD\桌宠demo\新建文件夹\AstralFox\codex-unity-compile.log"
```

结果:

```text
Initialize engine version: 6000.4.10f1
Mono: successfully reloaded assembly
未发现 error CS
```

阻塞点不是 C# 编译，而是本机 Unity Licensing:

```text
Another instance of Unity.Licensing.Client is already running.
Timed-out after 60.01s, waiting for Licensing to initialize
```

重新验证时先扫日志:

```powershell
Select-String -LiteralPath "D:\FOXD\桌宠demo\新建文件夹\AstralFox\codex-unity-compile.log" `
  -Pattern "error CS|warning CS|Mono: successfully reloaded assembly|Initialize engine version|Licensing|Timed-out"
```

### 已知刚修过的编译问题

`SettingsWebServer.cs` 曾出现:

```text
CS0111: Type 'SettingsWebServer' already defines a member called 'EscapeJson'
```

处理方式:

- 已删除旧的单行 `EscapeJson`。
- 保留文件末尾更完整的 `EscapeJson(string value)`。

如果下次仍出现该错误，直接检查:

```powershell
rg -n "private static string EscapeJson|EscapeJson\(" `
  "D:\FOXD\桌宠demo\新建文件夹\AstralFox\Assets\Scripts\Runtime\Config\SettingsWebServer.cs"
```

预期只存在一个 `private static string EscapeJson` 定义。

---

## 3. 暂不推进的范围

为了先保证 Unity 端桌宠能稳定运行，以下内容暂时不要主动展开:

```text
Web 管理平台
后端 API
远程配置同步
SettingsWebServer UI 大改
在线下载模型
云端鉴权/JWT
Web 前端体验优化
```

允许的例外:

- `SettingsWebServer.cs` 阻塞 Unity 编译时，只做最小编译修复。
- Unity 运行时配置必须修正时，只改 `AppConfig` / `PetModelRegistry` / 最小保存逻辑。

---

## 4. 下一步任务执行顺序

### P0. 先恢复可验证的 Unity Editor 状态

目标: 能打开项目、执行场景 setup、进入 Play Mode，不被脚本错误阻塞。

执行:

1. 打开 Unity:

```text
D:\uni\Editor\Unity.exe
```

2. 打开项目:

```text
D:\FOXD\桌宠demo\新建文件夹\AstralFox
```

3. 等待 Unity 完成 import / compile。
4. 如 Console 有 C# error，先处理 error，不处理 warning。
5. 执行:

```text
AstralFox > Setup Desktop Pet Scene
```

6. 保存场景。

验收:

- Console 无 `error CS`。
- Hierarchy 有 `FoxPlaceholder`。
- `Live2D_Model` 下有 YouXiaoMiao/CubismModel。
- Play Mode 后桌宠可见。

### P1. 验证并修完原生表情链路

目标: 热键和情绪都能驱动 YouXiaoMiao 原生表情。

顺序:

1. Play Mode 按 `0-9/F1-F8/ESC`。
2. 如果无反应，检查实际 CubismModel 上组件:

```text
CubismUpdateController
CubismExpressionController
ExpressionHotkeys
```

3. 检查 `ExpressionList` 是否绑定。
4. 检查 `CubismUpdateController.Refresh()` 后 expression 是否参与更新。
5. 必要时在 `ExpressionHotkeys` 中加更明确日志:

```text
当前 index
expression list count
CurrentExpressionIndex
OnLateUpdate 是否调用
```

验收:

- `0-9/F1-F8` 有可见表情变化。
- `ESC` 能清除。
- 情绪事件触发时能切到对应 native expression。

### P2. 修正 Live2DAnimator / PetAnimationManager 运行时挂载边界

目标: 明确“动画适配器挂容器还是 CubismModel root”，避免组件分散导致查找和 RequireComponent 行为不稳定。

现状:

- `Live2DAnimator` 设计注释说应在 Cubism model root。
- `AstralFoxSceneSetup` 目前仍在 `Live2D_Model` 容器设置动画栈。
- 表情组件已经迁移到实际 CubismModel root。

下一步判断:

1. 确认 `CubismParameterDriver` 是否能从 `Live2D_Model` 正确找到子 CubismModel。
2. 确认 `FoxAnimationController` / `FoxEmotionController` 是否依赖同物体组件。
3. 如果运行稳定，可以先不迁移动画栈。
4. 如果参数驱动/情绪存在查找问题，再统一迁移到 CubismModel root，并让 `PetAnimationManager` 从 children 自动找到。

验收:

- `Live2DAnimator.IsReady == true`。
- `PetAnimationManager.CurrentAnimator` 非空。
- 拖拽、眨眼、呼吸、尾巴/耳朵参数仍可驱动。

### P3. Unity 端模型选择先保持“配置切换 + 重启生效”

目标: 不做完整 runtime hot-swap，避免引入大范围生命周期风险。

已做:

- `PetModelRegistry.GetAvailableModels()` 只返回真实存在的模型。
- `QuickModelSwitch` 只保存可用路径。
- `Live2DAnimator.ReloadModel()` 不再隐藏当前模型。

下一步:

1. Play Mode 右键桌宠附近。
2. 菜单应只显示:

```text
星尘 (AI生成)
Senko 仙狐 (占位)
```

3. 选择模型后确认配置保存。
4. 当前模型保持可见。
5. 提示/日志说明重启或重载场景后生效。

暂不做:

```text
Destroy old Cubism prefab
runtime import model3.json
runtime instantiate StreamingAssets Cubism model
重新绑定全部交互/动画/透明窗口
```

这些放到 P6。

### P4. 修 Unity 端非 Web 的已知小风险

按风险从高到低:

1. `AIManager.InitializeServices()` 的 `async void` 异常边界。
2. `ConfigValidator.RunAllTests()` 的 `async void` 异常边界。
3. `TransparentWindow.OnDestroy()` 添加协程停止和资源释放确认。
4. `VoiceButton` / `SettingsButton` 的 Texture2D 释放。
5. `FoxInteraction` / `FoxSimpleMovement` / GUI 按钮脚本补 `[RequireComponent]`。

验收:

- Play Mode 退出不抛对象销毁/线程/协程异常。
- 打开/关闭设置、拖拽、语音 mock 不产生明显 warning 爆发。

### P5. Unity 端体验闭环

目标: 桌宠作为桌面宠物的基础体验完整。

顺序:

1. 透明窗口:
   - 置顶。
   - 背景透明。
   - Editor 模式不误移动 Unity 窗口。

2. 交互:
   - 点击反馈。
   - 拖拽。
   - 抛掷/落地。
   - 鼠标注视。

3. 动画:
   - idle 呼吸。
   - 眨眼。
   - 耳朵/尾巴。
   - 情绪表情。

4. 退出:
   - AppLifecycle 正常停止本地服务。
   - 透明窗口资源释放。
   - 无后台线程残留。

### P6. 后续大任务: 真正运行时模型热切换

只有 P0-P5 稳定后再做。

建议设计:

1. 明确两类模型:

```text
Assets/Live2D/Models/...  Editor/imported prefab 模型
Assets/StreamingAssets/Models/...  runtime model3.json 模型
```

2. 首先支持 Editor/imported prefab 切换:

```text
Destroy old prefab instance
Instantiate selected prefab
Rebind Live2DAnimator / PetAnimationManager / FoxInteraction
Rebind expression list
Refresh CubismUpdateController
```

3. 再研究 StreamingAssets runtime Cubism load。

风险:

- Live2D Cubism SDK 的 importer 生命周期主要面向 Editor。
- 运行时直接从 `model3.json` 加载可能需要单独 loader 或预构建 prefab。

---

## 5. 推荐下次打开窗口后的第一组命令

```powershell
cd "D:\FOXD\桌宠demo\新建文件夹\AstralFox"
codegraph status
git -C "D:\FOXD" status --short
rg -n "error CS|warning CS|Mono: successfully reloaded assembly|Initialize engine version|Licensing|Timed-out" codex-unity-compile.log
```

如果需要 batchmode 编译:

```powershell
& "D:\uni\Editor\Unity.com" `
  -batchmode -nographics -quit `
  -projectPath "D:\FOXD\桌宠demo\新建文件夹\AstralFox" `
  -logFile "D:\FOXD\桌宠demo\新建文件夹\AstralFox\codex-unity-compile.log"
```

注意:

- batchmode 可能因 Unity Licensing Client 卡住。
- 只要日志有 `Mono: successfully reloaded assembly` 且无 `error CS`，脚本编译通常可认为通过。
- 真正运行体验必须用 Unity Editor Play Mode 验证。

---

## 6. 当前优先级总结

```text
P0  打开 Unity + Setup Scene + Play Mode 可见
P1  表情热键和情绪 native expression 生效
P2  明确动画栈与 CubismModel root 的挂载边界
P3  模型选择保持安全配置切换，不做热切换
P4  修 Unity 端生命周期/资源释放/async void 小风险
P5  透明窗口 + 交互 + 动画体验闭环
P6  设计并实现真正 runtime model hot-swap
```

下一窗口最建议先做:

```text
1. Unity Editor 打开项目。
2. 修所有 Console error。
3. 执行 AstralFox > Setup Desktop Pet Scene。
4. Play Mode 验证 YouXiaoMiao 可见。
5. 立刻测 0-9/F1-F8/ESC 表情。
```
