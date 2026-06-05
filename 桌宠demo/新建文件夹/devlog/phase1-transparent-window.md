# 阶段 1 开发日志：项目搭建与透明窗口

> 日期：2026-05-23
> 项目：星尘狐（AstralFox）
> Unity 版本：2022.3.61t11（团结引擎）
> 渲染管线：URP 14.1.0

---

## 1. 技术思路

### 1.1 透明窗口方案选型

在 Windows 桌面宠物透明窗口的实现上，有以下几种主流方案：

| 方案 | 原理 | 优点 | 缺点 |
|------|------|------|------|
| **色键抠图 (Chroma Key)** | `SetLayeredWindowAttributes` + `LWA_COLORKEY` 将指定颜色变透明 | 兼容性好，所有 Unity 版本可用 | 边缘有彩色光晕 |
| **DWM 玻璃扩展** | `DwmExtendFrameIntoClientArea` 延伸 Aero Glass 效果 | 真正的 alpha 混合 | 需要交换链支持 alpha |
| **UpdateLayeredWindow** | 每帧通过 `UpdateLayeredWindow` 提交带 alpha 的位图 | 完美的逐像素 alpha | 需要 Native Plugin 截帧 |

**阶段 1 选型：色键抠图 (Magenta Key)**

选择理由：
- MVP 阶段优先保证稳定性
- 不需要额外的 Native Plugin 或 SwapChain hack
- 洋红色 (#FF00FF) 在角色美术中极少出现，不会误抠
- 边缘光晕问题可在后续阶段通过以下方式缓解：
  - Live2D 模型边缘做硬过渡（卡通风格天然适合）
  - 后期使用自定义 RenderPass 替换背景色

### 1.2 点击穿透方案

采用 **定时轮询鼠标位置 + 动态切换 WS_EX_TRANSPARENT** 的策略：

```
Update 循环 (每 0.05s):
  ├─ 获取鼠标屏幕坐标 (GetCursorPos)
  ├─ 转换为 Unity 世界坐标
  ├─ 检测是否在 Fox Collider 范围内
  │   ├─ 是 → DisableClickThrough()  (移除 WS_EX_TRANSPARENT)
  │   └─ 否 → EnableClickThrough()   (添加 WS_EX_TRANSPARENT)
  └─ 更新 _isHovering 状态
```

已知限制：
- 鼠标快速移动到狐狸上时，可能有 1 帧延迟（~50ms）才能响应点击
- 拖拽时锁定为非穿透模式，防止拖拽中断

### 1.3 坐标系统

Windows 屏幕坐标 vs Unity 客户端坐标的转换：

```
Windows 屏幕坐标: (0,0) = 主显示器左上角, Y 轴向下
Unity 客户端坐标: (0,0) = 窗口左下角, Y 轴向上

转换公式:
  unityX = screenX - windowRect.Left
  unityY = windowRect.Bottom - screenY
```

---

## 2. 文件清单

| 文件 | 路径 | 职责 |
|------|------|------|
| `TransparentWindow.cs` | `Assets/Scripts/Runtime/` | Win32 API 封装，窗口透明/置顶/色键管理 |
| `FoxInteraction.cs` | `Assets/Scripts/Runtime/` | 鼠标交互：拖拽移动、点击穿透检测 |
| `DesktopCameraSetup.cs` | `Assets/Scripts/Runtime/` | 自动配置 URP Camera 用于透明渲染 |
| `AstralFoxSceneSetup.cs` | `Assets/Scripts/Editor/` | Editor 菜单一键搭建场景 |

---

## 3. 关键 API 说明

### 3.1 TransparentWindow 核心 API

```csharp
// 窗口样式
SetWindowLong(hWnd, GWL_STYLE, WS_POPUP)          // 无边框
SetWindowLong(hWnd, GWL_EXSTYLE, WS_EX_LAYERED |   // 支持分层
                                  WS_EX_TOPMOST |   // 置顶
                                  WS_EX_NOACTIVATE) // 不抢焦点

// 色键抠图
SetLayeredWindowAttributes(hWnd, 0x00FF00FF, 255, LWA_COLORKEY)
// 0x00FF00FF = Magenta in COLORREF (0x00BBGGRR)

// 穿透切换
SetWindowLong(hWnd, GWL_EXSTYLE, exStyle | WS_EX_TRANSPARENT)  // 开
SetWindowLong(hWnd, GWL_EXSTYLE, exStyle & ~WS_EX_TRANSPARENT) // 关

// 置顶
SetWindowPos(hWnd, HWND_TOPMOST, 0,0,0,0, SWP_NOMOVE|SWP_NOSIZE)
```

### 3.2 注意事项

- `WS_EX_NOACTIVATE`：防止窗口在点击时抢走焦点（桌面宠物的关键特性）
- `WS_EX_TOOLWINDOW` vs `WS_EX_APPWINDOW`：当前使用 APPWINDOW，让窗口在 Alt+Tab 中可见，便于调试。正式版可改为 TOOLWINDOW
- DWM 开启时，`DwmExtendFrameIntoClientArea` 已被调用但主要作为辅助，真正的透明度由色键实现

---

## 4. Unity 配置步骤

### 4.1 场景搭建（方法 A：使用 Editor 菜单）

1. 打开 `Assets/Scenes/SampleScene.scene`
2. 删除场景中所有默认物体
3. 点击菜单栏 `AstralFox > Setup Desktop Pet Scene`
4. 自动创建以下层级：
   ```
   AstralFoxRoot (TransparentWindow + FoxInteraction)
   ├── Main Camera (Camera + DesktopCameraSetup)
   └── FoxPlaceholder (SpriteRenderer + BoxCollider2D)
   ```
5. 脚本会自动生成占位狐狸精灵图（`Assets/Textures/FoxPlaceholder.png`）

### 4.2 场景搭建（方法 B：手动配置）

1. 创建空 GameObject，命名为 `AstralFoxRoot`
2. 挂载脚本：`TransparentWindow`, `FoxInteraction`
3. 创建 Camera，设置：
   - Clear Flags: Solid Color
   - Background: #FF00FF（洋红色）
   - Projection: Orthographic, Size: 5
   - Tag: MainCamera
4. 给 Camera 挂载 `DesktopCameraSetup`
5. 创建子 GameObject `FoxPlaceholder`，挂载 `SpriteRenderer`
6. 给 FoxPlaceholder 添加 `BoxCollider2D`，调整大小至覆盖狐狸

### 4.3 Player Settings 确认

- `Run In Background`: ✓
- `Visible In Background`: ✓
- `Fullscreen Mode`: Windowed
- `Resizable Window`: ✗
- `Use DX11`: ✓ (默认)

---

## 5. 待解决问题

1. **色键边缘光晕**：Live2D 模型导入后若边缘有半透明像素，会出现洋红色光晕
   - 临时方案：在 Sprite 导入设置中使用 `Alpha Is Transparency`
   - 长期方案：通过 Native Plugin 实现真正的 SwapChain Alpha

2. **多显示器支持**：当前 `MonitorFromWindow` + `MONITOR_DEFAULTTONEAREST` 已支持，但拖拽跨屏时可能有问题，需要测试

3. **高 DPI 缩放**：未处理 Windows 缩放 > 100% 的情况，`GetCursorPos` 返回物理像素，但 Unity 窗口可能是逻辑像素。需要 `SetProcessDpiAwareness`。

4. **点击穿透的延迟**：50ms 的轮询间隔可能导致快速从桌面划入狐狸区域时，第一次点击不被识别。后续可通过全局鼠标钩子 (`SetWindowsHookEx`) 改善。

---

## 6. 下一步

阶段 2 将集成 Live2D Cubism SDK，导入模型并编写 `FoxAnimationController` 管理待机、倾听、说话、睡觉、拖拽等动画状态。

届时需要用真实的 Live2D 模型替换当前的占位 Sprite。
