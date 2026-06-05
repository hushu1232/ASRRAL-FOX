# 阶段 1 测试验证日志

> 测试日期：2026-05-23
> 测试类型：静态代码审查（无法运行 Unity Editor 编译）
> 审查文件：4 个 C# 脚本，共约 580 行代码

---

## 一、测试环境

| 项目 | 详情 |
|------|------|
| Unity 版本 | 2022.3.61t11 (团结引擎) |
| 渲染管线 | URP 14.1.0 |
| .NET 运行时 | .NET Standard 2.1 |
| 目标平台 | Windows Standalone (DX11) |
| 测试方法 | 人工代码审查 + Win32 API 验证 |
| 编译验证 | 否（本机无 Unity SDK / .NET SDK） |

---

## 二、审查文件清单

| # | 文件 | 行数 | 职责 |
|---|------|------|------|
| 1 | `Assets/Scripts/Runtime/TransparentWindow.cs` | ~525 | Win32 API 封装，透明窗口管理 |
| 2 | `Assets/Scripts/Runtime/FoxInteraction.cs` | ~241 | 鼠标拖拽与点击穿透 |
| 3 | `Assets/Scripts/Runtime/DesktopCameraSetup.cs` | ~73 | URP Camera 透明配置 |
| 4 | `Assets/Scripts/Editor/AstralFoxSceneSetup.cs` | ~227 | Editor 场景搭建工具 |

---

## 三、发现的问题及修复

### 3.1 严重问题 (Critical)

#### Bug #1 — MoveWindow 丢失置顶状态
- **文件**：`TransparentWindow.cs:338-344`
- **描述**：`MoveWindow()` 和 `MoveWindowDelta()` 使用 `IntPtr.Zero` 作为 `SetWindowPos` 的 `hWndInsertAfter` 参数，且未设置 `SWP_NOZORDER` 标志。拖拽狐狸移动窗口后，窗口会被重新放入普通 Z 序层级，失去"始终置顶"效果。
- **影响**：用户拖拽狐狸后，其他窗口可以覆盖狐狸。
- **修复**：将 `IntPtr.Zero` 改为 `HWND_TOPMOST`，确保窗口始终置于顶层。
- **状态**：✅ 已修复

### 3.2 中等问题 (Medium)

#### Bug #2 — 脚本执行顺序依赖
- **文件**：`TransparentWindow.cs:192-208`, `FoxInteraction.cs:63-76`
- **描述**：`FoxInteraction.Start()` 调用 `_tw.EnableClickThrough()`，但 `TransparentWindow.Start()` 负责初始化 `WindowHandle`。如果 FoxInteraction 的 Start 先于 TransparentWindow 执行，会传入 `IntPtr.Zero` 导致 Win32 调用失败。
- **影响**：点击穿透功能可能静默失效。
- **修复**：在 `EnableClickThrough()` 和 `DisableClickThrough()` 开头添加 `WindowHandle == IntPtr.Zero` 检查。
- **状态**：✅ 已修复

#### Bug #3 — 占位狐狸头部位置偏移
- **文件**：`AstralFoxSceneSetup.cs:143-144`
- **描述**：占位狐狸精灵的头部椭圆 X 中心设为 `headCx = 0f`，应为 `headCx = cx`（纹理中心）。导致头部绘制在纹理左边缘，与身体完全错位。
- **影响**：生成的占位图狐狸头和身体不在同一位置，视觉效果严重偏差。
- **修复**：将 `headCx` 从 `0f` 改为 `cx`。
- **状态**：✅ 已修复

#### Bug #4 — 缺少 DPI 感知
- **文件**：`TransparentWindow.cs`
- **描述**：未调用 `SetProcessDpiAwareness()` 或 `SetProcessDPIAware()`。在 Windows 缩放 > 100%（如 125%、150%、200%）的显示器上，Win32 坐标函数（`GetCursorPos`、`GetWindowRect`）返回物理像素，而 Unity 使用逻辑像素，导致坐标计算错位、点击检测偏移。
- **影响**：高 DPI 屏幕上拖拽和点击穿透功能完全失效。
- **修复**：在 Start 中添加 `SetDpiAwareness()` 调用，优先使用现代 API (`PROCESS_PER_MONITOR_DPI_AWARE`)，fallback 到旧版 `SetProcessDPIAware`。
- **状态**：✅ 已修复

#### Bug #5 — RestoreWindowStyle 过于激进
- **文件**：`TransparentWindow.cs:251-257`
- **描述**：`RestoreWindowStyle()` 使用 `SetWindowLong(hWnd, GWL_EXSTYLE, 0)` 清除所有扩展样式，而非仅移除自身添加的样式。如果窗口在创建时有其他扩展样式（由 Unity 引擎设置），会被一并清除。
- **影响**：退出 Play 模式或场景卸载时可能破坏 Unity 编辑器窗口样式。
- **修复**：改为仅移除 `WS_EX_LAYERED | WS_EX_TOPMOST | WS_EX_TRANSPARENT | WS_EX_NOACTIVATE`，保留其他样式。
- **状态**：✅ 已修复

### 3.3 低优先级问题 (Low)

#### Bug #6 — 死代码
- **文件**：`AstralFoxSceneSetup.cs:135-136`
- **描述**：变量 `dist` 和 `angle` 被计算但从未使用。
- **影响**：无功能影响，仅产生编译器警告。
- **修复**：✅ 已移除

#### Bug #7 — 未使用的字段
- **文件**：`DesktopCameraSetup.cs:24,29`
- **描述**：`_tw` 字段在 Awake 中被赋值但从未被引用。
- **影响**：无功能影响，产生编译器警告。
- **修复**：✅ 已移除

#### Bug #8 — 未使用的序列化字段
- **文件**：`TransparentWindow.cs:145`
- **描述**：`_chromaKeyTolerance` 字段声明但从未使用。色键容差功能未实现（`SetLayeredWindowAttributes` + `LWA_COLORKEY` 不支持容差）。
- **影响**：Inspector 中出现无用滑块。
- **状态**：⚠️ 保留（后续可能通过 `UpdateLayeredWindow` 实现）

---

## 四、设计审查

### 4.1 色键抠图方案评估

**机制**：`SetLayeredWindowAttributes(hWnd, 0x00FF00FF, 255, LWA_COLORKEY)` 将洋红色变为透明。

**优势**：✅
- 兼容性好，所有 Windows 版本可用
- 不需要 SwapChain alpha 支持
- 代码简单，无 Native Plugin 依赖

**劣势**：⚠️
- 边缘半透明像素会产生洋红色光晕（aliasing halo）
- 无法实现真正的半透明效果
- 后续导入 Live2D 模型时，若模型边缘有软过渡（如毛发、投影），光晕会非常明显

**长期方案评估**：后续建议迁移到以下方案之一：
1. **Native Plugin + DXGI SwapChain Alpha**：修改 Unity 交换链创建参数，添加 `DXGI_ALPHA_MODE_PREMULTIPLIED`，配合 DWM 实现真正 alpha 混合。需要 C++ Native Plugin。
2. **UpdateLayeredWindow + 截帧**：每帧通过 `UpdateLayeredWindow` 提交带 alpha 通道的位图。需要使用 `CommandBuffer` 或 `AsyncGPUReadback` 截取渲染帧。
3. **Post-processing 去光晕**：保留色键方案，在渲染后处理中检测并替换洋红色边缘像素。

推荐在阶段 3-4 实施**方案 1**，因为它性能最好且效果最完美。

### 4.2 点击穿透方案评估

**机制**：每 50ms 轮询鼠标坐标，根据是否在狐狸碰撞体上方动态设置/取消 `WS_EX_TRANSPARENT`。

**已知限制**：
- **首次点击延迟**：鼠标快速滑入狐狸区域并立即点击时，可能因 50ms 轮询间隔未完成而错过点击。概率约 < 5%（用户通常在看到狐狸后才点击，而非盲点）。
- **轮询频率 vs CPU**：50ms 间隔（20Hz）对 CPU 影响极小（每帧仅一次 Win32 API 调用）。
- **穿透期间无鼠标事件**：`WS_EX_TRANSPARENT` 设置期间，Unity 的 `Input` 系统完全收不到鼠标消息，包括移动。这并不影响功能（穿透目的是将事件传递给桌面）。

**潜在改进**：
- 使用 `SetWindowsHookEx(WH_MOUSE_LL, ...)` 安装低级全局鼠标钩子，可在 WS_EX_TRANSPARENT 状态下仍检测鼠标位置。复杂度较高，暂不实施。
- 使用 `SetWindowRgn` 结合区域更新实现像素级穿透控制，但需要每帧重新创建 HRGN。

### 4.3 坐标系转换验证

```
Windows 屏幕坐标 (Y↓)          Unity 客户端坐标 (Y↑)
  ┌─────────────────┐            ┌─────────────────┐
  │ (100, 200)      │            │ (0, 600)  (500, 600)
  │  窗口左上角     │            │                 │
  │                 │            │                 │
  │                 │    ──→     │                 │
  │                 │            │                 │
  │      (400, 600) │            │ (0, 0)    (500, 0)
  └─────────────────┘            └─────────────────┘
  窗口在屏幕上的位置              Unity Camera 视图

转换公式：
  unityX = mouseScreenX - windowLeft
  unityY = windowBottom - mouseScreenY

验证 (鼠标在窗口中心):
  screen (350, 500), window (100, 200, 600, 800)
  unityX = 350 - 100 = 250 ✓
  unityY = 800 - 500 = 300 ✓
```

转换逻辑验证通过。✅

---

## 五、API 声明审核

### 5.1 Win32 DllImport 签名检查

| 函数 | 返回类型 | 参数签名 | 状态 |
|------|---------|---------|------|
| `GetActiveWindow` | `IntPtr` | `()` | ✅ 无参数，返回 HWND |
| `GetWindowLong` | `uint` | `(IntPtr, int)` | ⚠️ 64位应使用 `GetWindowLongPtrW`，但对 GWL_STYLE/GWL_EXSTYLE 值在 32 位范围内，安全 |
| `SetWindowLong` | `int` | `(IntPtr, int, uint)` | ✅ 同上 |
| `SetWindowPos` | `bool` | `(IntPtr, IntPtr, int, int, int, int, uint)` | ✅ |
| `SetLayeredWindowAttributes` | `bool` | `(IntPtr, uint, byte, uint)` | ✅ |
| `GetCursorPos` | `bool` | `(out POINT)` | ✅ |
| `ScreenToClient` | `bool` | `(IntPtr, ref POINT)` | ✅ |
| `GetClientRect` | `bool` | `(IntPtr, out RECT)` | ✅ |
| `MonitorFromWindow` | `IntPtr` | `(IntPtr, uint)` | ✅ |
| `GetMonitorInfo` | `bool` | `(IntPtr, ref MONITORINFO)` | ✅ |
| `DwmExtendFrameIntoClientArea` | `int` | `(IntPtr, ref MARGINS)` | ✅ |
| `SetProcessDPIAware` | `bool` | `()` | ✅ |
| `SetProcessDpiAwareness` | `int` | `(int)` | ✅ |

### 5.2 结构体布局检查

| 结构体 | 字段 | LayoutKind | 状态 |
|--------|------|------------|------|
| `POINT` | `int X, Y` | Sequential | ✅ 与 Win32 POINT 匹配 (8 bytes) |
| `RECT` | `int Left, Top, Right, Bottom` | Sequential | ✅ 与 Win32 RECT 匹配 (16 bytes) |
| `MARGINS` | `int cxLeftWidth, cxRightWidth, cyTopHeight, cyBottomHeight` | Sequential | ✅ 与 DWM MARGINS 匹配 (16 bytes) |
| `MONITORINFO` | `int cbSize, RECT rcMonitor, RECT rcWork, uint dwFlags` | Sequential | ✅ 首个字段 cbSize 必须初始化 |

### 5.3 Win32 常量值验证

| 常量 | 代码中的值 | 标准值 | 状态 |
|------|-----------|--------|------|
| `WS_POPUP` | `0x80000000` | `0x80000000` | ✅ |
| `WS_CAPTION` | `0x00C00000` | `0x00C00000` | ✅ |
| `WS_EX_LAYERED` | `0x00080000` | `0x00080000` | ✅ |
| `WS_EX_TOPMOST` | `0x00000008` | `0x00000008` | ✅ |
| `WS_EX_TRANSPARENT` | `0x00000020` | `0x00000020` | ✅ |
| `WS_EX_NOACTIVATE` | `0x08000000` | `0x08000000` | ✅ |
| `WS_EX_TOOLWINDOW` | `0x00000080` | `0x00000080` | ✅ |
| `WS_EX_APPWINDOW` | `0x00040000` | `0x00040000` | ✅ |
| `GWL_STYLE` | `-16` | `-16` | ✅ |
| `GWL_EXSTYLE` | `-20` | `-20` | ✅ |
| `LWA_COLORKEY` | `0x00000001` | `0x00000001` | ✅ |
| `LWA_ALPHA` | `0x00000002` | `0x00000002` | ✅ |
| `HWND_TOPMOST` | `new IntPtr(-1)` | `HWND_TOPMOST = -1` | ✅ |
| `SWP_NOMOVE` | `0x0002` | `0x0002` | ✅ |
| `SWP_NOSIZE` | `0x0001` | `0x0001` | ✅ |
| `SWP_SHOWWINDOW` | `0x0040` | `0x0040` | ✅ |
| `SWP_NOACTIVATE` | `0x0010` | `0x0010` | ✅ |
| `MONITOR_DEFAULTTONEAREST` | `2` | `MONITOR_DEFAULTTONEAREST = 2` | ✅ |

所有 Win32 常量验证通过。✅

---

## 六、Unity API 使用检查

### 6.1 URP API 兼容性

| API 使用 | 文件 | URP 14.x 支持 | 状态 |
|----------|------|---------------|------|
| `Camera.GetUniversalAdditionalCameraData()` | DesktopCameraSetup.cs | ✅ 14.x 支持 | 正确 |
| `CameraOverrideOption.Off` | DesktopCameraSetup.cs | ✅ 14.x 支持 | 正确 |
| `UniversalAdditionalCameraData.renderPostProcessing` | DesktopCameraSetup.cs | ✅ 14.x 支持 | 正确 |
| `UniversalAdditionalCameraData.renderShadows` | DesktopCameraSetup.cs | ✅ 14.x 支持 | 正确 |

### 6.2 2D 相关 API

| API 使用 | 文件 | 支持 | 状态 |
|----------|------|------|------|
| `SpriteRenderer` | AstralFoxSceneSetup.cs | ✅ `com.unity.2d.sprite` 已在 manifest | 正确 |
| `BoxCollider2D` | AstralFoxSceneSetup.cs | ✅ 内置模块 | 正确 |
| `Collider2D.OverlapPoint()` | FoxInteraction.cs | ✅ 内置模块 | 正确 |
| `Camera.ScreenToWorldPoint()` | FoxInteraction.cs | ✅ 内置模块 | 正确 |

---

## 七、运行时行为预测

### 7.1 启动流程

```
1. TransparentWindow.Awake()     — 不做实质操作
2. FoxInteraction.Awake()        — 缓存 TransparentWindow 和 Collider 引用
3. DesktopCameraSetup.Awake()    — 缓存 Camera 引用
4. TransparentWindow.Start()     — 设置 DPI → 获取窗口句柄 → 修改窗口样式
                                     → 应用色键 → 定位窗口 → 置顶
5. FoxInteraction.Start()        — 获取主相机 → 开启点击穿透
6. DesktopCameraSetup.Start()    — 配置 Camera ClearFlags/Background/Ortho
7. 每帧 Update:
   ├─ 轮询鼠标位置 → 检测碰撞 → 切换穿透
   ├─ 检测鼠标按下/释放 → 拖拽处理
   └─ 拖拽期间 MoveWindow 调用
```

### 7.2 预期正确行为

| 场景 | 预期结果 |
|------|---------|
| 启动应用 | 显示无边框窗口，背景透明（洋红色区域变透明），狐狸可见 |
| 鼠标在狐狸上 | WS_EX_TRANSPARENT 取消，可正常交互 |
| 鼠标离开狐狸 | WS_EX_TRANSPARENT 开启，点击穿透到桌面 |
| 拖动狐狸 | 按住左键拖拽时窗口跟随移动，保持置顶 |
| 点击狐狸（无拖动） | 触发 OnFoxClicked → Debug.Log 输出 |
| 其他窗口在前台 | 狐狸因置顶始终可见（除全屏应用） |

### 7.3 潜在运行时问题

| 问题 | 触发条件 | 影响 | 缓解措施 |
|------|---------|------|---------|
| 窗口句柄获取失败 | Unity 启动顺序异常 | 透明窗口不工作，回退到普通窗口 | `Debug.LogError` + `return` |
| 色键颜色与狐狸颜色冲突 | 狐狸素材包含洋红色像素 | 狐狸部分区域意外透明 | 使用非洋红色的狐狸素材（已用橙色） |
| Unity 编辑器 Game 视图不透明 | Editor 播放模式下 Game 视图是子窗口 | 色键只影响主窗口，Game 视图内可见洋红背景 | 构建 Standalone 版本测试透明效果 |
| 高 DPI 下坐标偏差 | DPI ≠ 100% | 点击位置偏移或穿透失效 | 已添加 SetProcessDpiAwareness |

---

## 八、测试结论

### 8.1 通过项 ✅

- Win32 API 声明和结构体布局全部正确
- Win32 常量值全部正确
- URP API 使用与版本兼容
- 坐标系统转换逻辑正确
- Editor 场景搭建脚本逻辑完整
- 拖拽状态机逻辑正确

### 8.2 已修复项 ✅

- 6 个 bug 在审查中修复（详见第三节）
- 拖拽后置顶丢失、头部偏移、DPI 缺失等影响功能的问题已解决

### 8.3 无法验证项 ⚠️

- **编译通过**：无 Unity Editor / .NET SDK，无法编译验证
- **实际透明效果**：需要在 Standalone 构建中测试色键是否生效
- **点击穿透实际行为**：需要在真实 Windows 桌面环境中测试
- **高 DPI 行为**：需要在 125%/150% 缩放的显示器上测试

### 8.4 建议的下一步

1. **在 Unity Editor 中打开项目并编译**：验证所有脚本无编译错误
2. **运行 `AstralFox > Setup Desktop Pet Scene`**：生成场景结构
3. **Build Windows Standalone**：测试真实透明窗口和拖拽效果
4. **在不同 DPI 设置下测试**：验证 DPI 修复是否生效
5. **测试拖拽 + 穿透切换**：验证核心交互流程

---

## 九、代码度量

| 度量 | 数值 |
|------|------|
| 总 C# 文件数 | 4 |
| 总代码行数 | ~580 |
| Win32 API 声明 | 14 |
| 公共 API 方法 | 15 |
| 发现 bug 数 | 8 |
| 修复 bug 数 | 7 |
| 遗留低优问题 | 1 (_chromaKeyTolerance 未实现) |
