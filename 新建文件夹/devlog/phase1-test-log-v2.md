# Phase 1 测试日志 (v2 — 2026-05-23)

> 测试执行：Claude Code
> 测试范围：透明窗口 + 交互系统
> 测试类型：静态代码审查 + 批量编译测试

---

## 测试摘要

| 项目 | 结果 |
|------|------|
| 代码编译 | 通过（批量模式验证） |
| Win32 API 声明 | 正确 |
| 窗口样式设置 | 正确 |
| Chroma Key 透明 | 逻辑正确，需实际运行验证 |
| 点击穿透切换 | 逻辑正确 |
| 拖拽移动 | 逻辑正确 |
| 占位狐狸 Sprite | 生成成功 |
| 场景一键搭建 | 通过（批量模式验证） |

---

## 1. TransparentWindow.cs 审查

**文件**: `Assets/Scripts/Runtime/TransparentWindow.cs`

### Win32 API 声明检查
- `GetActiveWindow` — 正确
- `SetWindowLong` / `GetWindowLong` — 正确（GWL_STYLE + GWL_EXSTYLE）
- `SetWindowPos` — 正确（HWND_TOPMOST 置顶）
- `SetLayeredWindowAttributes` — 正确（LWA_COLORKEY 品红透明）
- `DwmExtendFrameIntoClientArea` — 已声明但未在 SetupWindowStyle 中调用
- `SetProcessDPIAwareness` / `SetProcessDPIAware` — 正确（DPI 感知）

### 窗口样式设置
- 移除 `WS_CAPTION | WS_SYSMENU | WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX` → 正确
- 添加 `WS_POPUP | WS_VISIBLE | WS_CLIPCHILDREN | WS_CLIPSIBLINGS` → 正确
- 扩展样式 `WS_EX_LAYERED | WS_EX_TOPMOST | WS_EX_NOACTIVATE | WS_EX_APPWINDOW` → 正确

### Chroma Key
- 颜色从 Unity Color (0-1) 转换为 Windows COLORREF (0x00BBGGRR) → 正确
- `LWA_COLORKEY` flag 应用颜色键 → 正确

### 窗口定位
- 5 个预设位置(右下/左下/右上/左上/居中) + 自定义 → 正确
- `MonitorFromWindow` + `GetMonitorInfo` 获取工作区 → 正确
- 注意：工作区排除了任务栏

### 点击穿透
- `EnableClickThrough()`: 添加 `WS_EX_TRANSPARENT` → 正确
- `DisableClickThrough()`: 移除 `WS_EX_TRANSPARENT` → 正确
- `SetTransparentState()`: 组合控制 → 正确

### 发现的问题
**无严重问题。** 有一个小注意点：
- `DwmExtendFrameIntoClientArea` 已声明但未在 `SetupWindowStyle()` 中主动调用。在某些 Windows 版本上，仅靠 `SetLayeredWindowAttributes` 可能不够，需要配合 DWM 帧扩展。建议在实际运行测试时验证透明效果，如果品红色边框残留，则需添加 `DwmExtendFrameIntoClientArea` 调用。

---

## 2. FoxInteraction.cs 审查

**文件**: `Assets/Scripts/Runtime/FoxInteraction.cs`

### 鼠标轮询
- 使用 `GetCursorPos` (Win32) 而非 `Input.mousePosition` → 正确，因为当 `WS_EX_TRANSPARENT` 激活时 Unity 的 Input 不会收到鼠标事件
- 轮询间隔 `_pollInterval = 0.05s` (20Hz) → 合理
- 屏幕坐标转换：`screenRect.bottom - screenPos.y` → 正确处理 Y 轴翻转

### 拖拽逻辑
- 死区 `_dragDeadzone = 3f` 像素 → 合理（防止微小抖动触发拖拽）
- 拖拽中使用 `_dragStartMouseScreen` 和 `_dragStartWindowPos` 作为基准 → 正确
- 拖拽开始/结束调用 `_animController?.OnDragStart()` / `OnDragEnd()` → 正确

### 点击检测
- `IsMouseOverFox()` 使用 `Collider2D.OverlapPoint()` → 正确
- 注意：需要 fox 对象有 Collider2D 组件，场景搭建脚本已配置

### 发现的问题
**无问题。**

---

## 3. DesktopCameraSetup.cs 审查

**文件**: `Assets/Scripts/Runtime/DesktopCameraSetup.cs`

### 相机配置
- `clearFlags = SolidColor`, `backgroundColor = chromaKeyColor` → 正确
- `orthographic = true`, `orthographicSize = 5` → 正确（2D 桌面宠物）
- URP `renderPostProcessing = false` → 正确（品红色保持纯净）

### 发现的问题
**无问题。**

---

## 4. AstralFoxSceneSetup.cs 审查

**文件**: `Assets/Scripts/Editor/AstralFoxSceneSetup.cs`

### 场景搭建
- 创建 `AstralFoxRoot` + `Main Camera` + `FoxPlaceholder` → 正确
- 添加所有 Phase 1-3 组件 → 正确
- FoxPlaceholder 位置 `(0, -3, 0)` → 注意：在 ortho size=5 时，这会将狐狸放在画面下方，符合"站在任务栏上方"的设计

### 占位 Sprite 生成
- 程序化生成 256x256 狐狸形状纹理 → 正确
- 保存到 `Assets/Textures/FoxPlaceholder.png` → 正确
- 设置 TextureImporter 为 Sprite → 正确

### 发现的问题
**无严重问题。** 一个小注意点：
- `CreatePlaceholderSprite()` 保存路径使用 `System.IO.File.WriteAllBytes`，在编辑器外运行可能失败。仅在 Editor 脚本中使用，所以无问题。

---

## 5. 批量编译测试

**命令**:
```
Tuanjie.exe -batchmode -quit -nographics -projectPath ".../AstralFox" -executeMethod AstralFox.Editor.AstralFoxTestRunner.Run
```

### 测试输出

```
=== [AstralFox Test] Start ===
[Test] Created new scene
[Test] Scene:  ()
[Test] SetupScene complete
```

输出文件: `devlog/batch-test-20260523-224635.log`

### 结果
- 脚本编译成功（无 CS 错误）
- 场景创建成功
- `SetupScene()` 执行成功
- 资产导入正常（FoxPlaceholder.png 生成成功）
- 许可相关的错误是批量模式下正常的行为（离线无许可）

**结论：Phase 1 代码编译通过，场景搭建逻辑正确。**

---

## 未覆盖的测试

以下测试需要在实际运行环境中执行（需要显示器 + 交互）：

| 测试项 | 状态 | 说明 |
|--------|------|------|
| 透明窗口视觉效果 | 未测试 | 需要实际屏幕渲染和品红色背景的透明效果验证 |
| 点击穿透 | 未测试 | 需要验证非狐狸区域鼠标能穿透到下方窗口 |
| 拖拽移动 | 未测试 | 需要实际鼠标拖拽测试 |
| 多显示器支持 | 未测试 | 需要多显示器环境 |
| DPI 缩放 | 未测试 | 需要高 DPI 显示器 |
| 与 Live2D 模型集成 | 未测试 | 需要 Cubism SDK 和模型文件 |

---

## Phase 1 结论

**评级**: 通过
Phase 1 的所有核心代码均已实现且编译通过。透明窗口、交互、场景搭建的基础设施就位。实际透明效果需要在 Unity Editor Play Mode 中验证。
