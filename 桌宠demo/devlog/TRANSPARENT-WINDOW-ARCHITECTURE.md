# 透明窗口系统架构文档

> 作者视角: 高级图形工程师
> 日期: 2026-06-07
> 系统: AstralFox Transparent Window (5 文件, ~1700 行)

---

## 一、架构概览

```
┌─────────────────────────────────────────────────────────────────────┐
│                     透明窗口渲染管线                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────┐               │
│  │  Unity   │    │  Desktop     │    │ Transparent │               │
│  │  Camera  │───▶│  Camera      │───▶│   Window    │               │
│  │          │    │  Setup       │    │             │               │
│  └──────────┘    └──────────────┘    └──────┬──────┘               │
│      │                                       │                      │
│      │ RenderTexture                         │ CreateOverlayWindow  │
│      │ (绿色背景)                              │ SetupPerPixelAlpha   │
│      ▼                                       ▼                      │
│  ┌──────────┐                        ┌──────────────┐              │
│  │  GPU →   │  ReadPixels            │  Overlay     │              │
│  │  CPU     │◀───────────────────────│  Window      │              │
│  │ Readback │  (每帧)                 │  WS_EX_LAYERED│             │
│  └────┬─────┘                        └──────┬───────┘              │
│       │                                      │                      │
│       │ BGRA 像素数组                         │ DIB Section          │
│       ▼                                      ▼                      │
│  ┌──────────────┐                    ┌──────────────┐              │
│  │  Chroma Key  │──── Marshal.Copy ─▶│  Update      │              │
│  │  (CPU loop)  │                    │  Layered     │              │
│  │  30万像素/帧  │                    │  Window      │              │
│  └──────────────┘                    └──────┬───────┘              │
│                                             │                       │
│                                             ▼                       │
│                                      ┌──────────────┐              │
│                                      │   Desktop    │              │
│                                      │   Screen     │              │
│                                      └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

### 数据流

```
Camera.render (Unity)
  → RenderTexture (GPU, ARGB32, 500×600)
    → ReadPixels + Apply (GPU→CPU 同步点, ~1-2ms)
      → GetRawTextureData<byte> (BGRA32, 1.2 MB)
        → CPU Chroma Key Loop (300K iterations, ~1-3ms)
          → Marshal.Copy → DIB Section (1.2 MB memcpy)
            → UpdateLayeredWindow(ULW_ALPHA) (系统调用)
              → Desktop compositor
```

---

## 二、文件清单与职责

| 文件 | 行数 | 角色 | 关键度 |
|------|------|------|--------|
| `TransparentWindow.cs` | ~810 | 窗口生命周期 · overlay 创建 · 色键管线 · 位置管理 | 🔴 核心 |
| `NativeWindowInterop.cs` | ~380 | 所有 Win32 P/Invoke · 结构体 · 常量 | 🔴 核心 |
| `DesktopCameraSetup.cs` | ~95 | 相机正交投影 · 色键背景色 · URP 配置 | 🟡 配置 |
| `FoxInteraction.cs` | ~376 | 拖拽交互 · 弹簧物理 · 抛掷/重力/弹跳 | 🟡 交互 |
| `ITransparentWindow.cs` | ~36 | 接口定义（未完全实现，待整合） | 🟢 规划 |
| `EditorMockTransparentWindow.cs` | ~50 | 编辑器 Mock | 🟢 辅助 |

---

## 三、核心技术决策

### 3.1 为什么用独立 Overlay 窗口而非 DWM 扩展玻璃？

```
方案 A: DwmExtendFrameIntoClientArea + SetLayeredWindowAttributes(LWA_COLORKEY)
  问题: Unity 2022+ 在 DX12/Vulkan 下 DWM 玻璃帧缓冲行为不一致
  结果: 某些 GPU/驱动组合下色键区域的像素不清零 → 残影

方案 B: 独立 Overlay 窗口 + UpdateLayeredWindow (当前方案) ✅
  原理: 创建独立的 WS_EX_LAYERED 窗口，与 Unity 主窗口分离
  优势: 不依赖 DWM 玻璃帧缓冲语义，像素 alpha 由我们完全控制
  代价: 需要 DIB Section + Marshal.Copy + ULW 系统调用
```

### 3.2 为什么绿色而非品红？

```
品红 (1,0,1): Live2D 模型常含粉色/红色系（皮肤、腮红、嘴唇）→ 色键误判
绿色 (0,1,0): 角色设计中极少使用纯绿色 → 误判率极低
```

**⚠️ 已验证的 Bug (已修复):** `DesktopCameraSetup._chromaKeyColor` 默认品红，但 `TransparentWindow._chromaKeyColor` 默认绿色。若两者不一致，相机清屏颜色与色键抠图颜色不匹配 → 透明区域出现绿色/品红边缘。现已统一为绿色。

### 3.3 色键容差：欧几里得距离

```csharp
// 非精确 RGB 匹配 — 平方欧几里得距离 + 容差阈值
// 处理抗锯齿边缘的渐变色
IsChromaKey(r, g, b, ckR, ckG, ckB):
    dr = r - ckR; dg = g - ckG; db = b - ckB
    return (dr² + dg² + db²) ≤ tolerance²
```

默认 `_chromaKeyTolerance = 80`，对应 RGB 空间 ~9 个单位偏差。配合 `TextureFormat.BGRA32`（无压缩），保证 RT ReadPixels 的颜色精度。

---

## 四、性能热路径分析

### 4.1 PerPixelAlphaLoop — 每帧开销 (500×600 窗口)

| 操作 | 类型 | 预估耗时 | 可优化性 |
|------|------|---------|---------|
| `RenderTexture.active = _renderTex` | GPU 状态切换 | ~0.05ms | ❌ |
| `ReadPixels + Apply` | GPU→CPU 同步读取 | ~1-2ms | ⚠️ 受 GPU 管线深度影响 |
| `GetRawTextureData<byte>` | 零拷贝引用 | ~0ms | ✅ 已最优 |
| Chroma key loop (120 万次数组访问) | CPU 纯计算 | ~1-3ms | ⚠️ 可移至 GPU shader |
| `Marshal.Copy` (1.2 MB) | 托管→非托管内存拷贝 | ~0.2-0.5ms | ❌ 必须 |
| `UpdateLayeredWindow` | 系统调用 + DWM 合成 | ~0.5-1ms | ❌ 必须 |
| **总计** | | **~3-7ms/帧** | |

### 4.2 优化建议

| 优先级 | 优化 | 收益 | 备注 |
|--------|------|------|------|
| P1 | GPU Chroma Key (ChromaKey.shader 已完成) | CPU loop 3ms→0 | 需 RenderFeature 注册到 URP Renderer |
| P2 | 脏帧检测（仅模型动画变化时重传） | 静态帧跳过全部 CPU 开销 | 需要帧比较哈希 |
| P3 | 降低窗口分辨率 | 像素量平方级降低 | 500×600 已是最优平衡 |

---

## 五、错误处理与韧性

### 5.1 窗口句柄查找三层回退

```
1. GetActiveWindow() → PID 验证
2. FindWindow("UnityWndClass", null)
3. EnumWindows(全窗口枚举) → PID 匹配
4. Process.MainWindowHandle (轮询 3 秒)
```

### 5.2 UpdateLayeredWindow 连续失败保护 (已修复)

原代码：ULW 失败仅记录日志，循环无限继续。
现代码：连续失败 30 帧（~0.5 秒）后自动停止 `PerPixelAlphaLoop`，输出 Error 日志。

### 5.3 GDI 资源清理

`CleanupPerPixelAlpha()` 严格按照创建逆序释放：
```
SelectObject(memDC, oldBitmap)  → 恢复原 GDI 位图
DeleteObject(hBitmap)           → 删除 DIB
DeleteDC(memDC)                 → 删除内存 DC
ReleaseDC(screenDC)             → 释放屏幕 DC
DestroyWindow(overlayHandle)    → 销毁 overlay 窗口
RenderTexture.Release()         → 释放 GPU RT
```

---

## 六、接口一致性分析

### 6.1 `ITransparentWindow` 接口

当前状态：**接口已定义但 TransparentWindow 未显式实现它**。方法签名不匹配：

| 接口方法 | TransparentWindow 对应 | 匹配？ |
|---------|----------------------|--------|
| `IsActive { get; }` | `IsTransparent { get; }` | ❌ 名称不同 |
| `SetActive(bool)` | 无直接对应 | ❌ |
| `SetClickThrough(bool)` | `EnableClickThrough/DisableClickThrough()` | ❌ 分为两个方法 |
| `SetAlwaysOnTop(bool)` | `SetAlwaysOnTop()` (无参数) | ❌ 无参数 |
| `GetPosition()` | `GetWindowScreenPosition()` | ❌ 名称不同 |
| `SetPosition(int, int)` | `MoveWindow(int, int)` | ⚠️ 语义相近 |
| `GetSize()` | `GetClientSize()` | ⚠️ 语义相近 |
| `OnWindowMoved` 事件 | 无 | ❌ |

**建议**: 要么删除接口（因为目前只有一个平台实现），要么将 TransparentWindow 重构为实现该接口。当前倾向于前者——Windows-only 不需要抽象层。

### 6.2 `EditorMockTransparentWindow`

当前 `FoxSimpleMovement` 和其他组件直接引用 `TransparentWindow`（具体类），而非 `ITransparentWindow`（接口）。Mock 类在当前架构中不可用。

---

## 七、FoxInteraction 拖拽物理

这是一个意外的高质量实现——弹簧物理 + 抛掷 + 重力弹跳：

### 弹簧跟随（拖拽中）
```
offsetFromCenter = lerp(offset, target, 1 - e^(-stiffness × dt))
```
一阶指数衰减跟随，产生自然的"弹性延迟"感。

### 抛掷物理（松手时）
```
if velocity > 100px/s:
    isThrowing = true
    velocity *= 1.5 (抛掷倍率)
    
重力: velocity.y -= 200 × dt
弹跳: 碰到底部时 velocity.y *= -0.5
停止: |velocity.y| < 30 时停止抛掷
```

### Squash & Stretch（拖拽形变）
```
targetSquash = 1 - clamp(speed / 500, 0, 1) × 0.15
通过 SmoothDamp 平滑过渡
```

---

## 八、已知限制与改进方向

| 限制 | 影响 | 改进方案 |
|------|------|---------|
| CPU 色键 30 万像素/帧 | 低端机器 3-7ms 开销 | GPU ChromaKey.shader（已完成）→ 需注册 RenderFeature |
| 单显示器 work area 检测 | 多显示器时位置可能偏移 | 使用 `MonitorFromWindow` + 目标显示器 work area |
| DPI 变化不重建 DIB | 窗口移动到不同 DPI 显示器时像素尺寸不对 | 监听 `WM_DPICHANGED` |
| DWM 服务停止 | 透明失效但无提示 | 已在 ULW 连续失败保护中处理 |
| `_firstFrame` 标志的保护不足 | 多帧同时进入可能性低但代码路径不防护 | 当前单协程模式天然互斥 |
| 色键颜色不一致 Bug | ✅ 已修复：统一为绿色 (0,1,0) | |
| Awake 重复检测 | ✅ 已修复：正确遍历所有实例 | |
| ULW 永久失败 | ✅ 已修复：30 帧连续失败后停止 | |

---

## 九、配置清单 — 正确部署检查

在场景中正确配置透明窗口需要以下步骤全部正确：

```
□ Camera.clearFlags = SolidColor
□ Camera.backgroundColor = (0, 1, 0, 1)  ← 绿色，必须与色键颜色一致
□ Camera.orthographic = true
□ TransparentWindow._chromaKeyColor = (0, 1, 0, 1)  ← 必须与相机背景色一致
□ TransparentWindow._usePerPixelAlpha = true (Standalone) / 自动 (Editor)
□ TransparentWindow._disableTransparency = false
□ 场景中存在 MainCamera 标签
□ 场景中只有一个 TransparentWindow 组件
□ URP 管线已配置 (PC_RPAsset)
□ (可选) ChromaKeyRenderFeature 已注册到 PC_Renderer
```

---

## 十、代码质量评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 架构正确性 | ⭐⭐⭐⭐⭐ | Overlay 窗口 + UpdateLayeredWindow 是 Windows 桌面覆盖的正确方案 |
| 错误处理 | ⭐⭐⭐⭐☆ | 三层窗口查找回退 · ULW 连续失败保护 · GDI 资源正确释放 |
| 性能 | ⭐⭐⭐☆☆ | CPU 色键是瓶颈，GPU 替代方案已完成但未集成 |
| 可维护性 | ⭐⭐⭐⭐☆ | 清晰的 section 分块 · 诊断日志 · 常量集中管理 |
| 跨平台性 | ⭐⭐☆☆☆ | Windows-only · 接口层已定义但未使用 |
| 测试覆盖 | ⭐⭐☆☆☆ | Editor 模式有自动降级 · 无自动化测试 |

**总体**: 生产级实现。核心管线正确。主要待办项是 GPU ChromaKey 集成和接口清理。
