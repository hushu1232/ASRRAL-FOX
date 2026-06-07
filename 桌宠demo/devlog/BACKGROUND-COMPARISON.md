# 透明背景 vs 背景图 — 方案对比与决策

> 日期: 2026-06-07
> 决策: 保留透明背景 · 删除桌面漫游 · 保留鼠标拖拽

---

## 一、透明背景当前实现评估

### 技术方案

```
Unity Camera → RenderTexture → CPU ReadPixels → Chroma Key → DIB Section → UpdateLayeredWindow → 桌面叠加
```

这是 Windows 平台上实现逐像素透明的**工业级方案**：

| 层级 | 技术 | 说明 |
|------|------|------|
| 窗口创建 | `CreateWindowEx(WS_EX_LAYERED)` | 独立 overlay 窗口，非 Unity 原生窗口 |
| 渲染捕获 | `Camera.targetTexture = RenderTexture` | Unity 渲染到离屏 RT |
| 色键抠图 | CPU 端欧几里得距离容差比较 | 500×600=30 万像素/帧，绿幕(0,1,0) |
| Alpha 通道 | `CreateDIBSection` 32-bit BGRA | 预分配 DIB 位图 |
| 窗口合成 | `UpdateLayeredWindow(ULW_ALPHA)` | Windows 逐像素 alpha 合成 |

### 质量评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 完成度 | ⭐⭐⭐⭐⭐ | 完整的 overlay 窗口 + 色键 + DIB + UpdateLayeredWindow 管线 |
| 健壮性 | ⭐⭐⭐⭐☆ | DPI 感知 + Editor 模式检测 + 调试日志 + 错误恢复 |
| 资源管理 | ⭐⭐⭐⭐⭐ | CleanupPerPixelAlpha 正确释放所有 GDI 对象 |
| 代码规范 | ⭐⭐⭐⭐☆ | 清晰的 section 分块 + XML 注释 |
| 性能 | ⭐⭐⭐☆☆ | CPU 色键 30 万像素/帧是主要瓶颈（已通过 GPU shader 方案缓解） |

### 已验证的功能

- ✅ 品红/绿色键透明背景
- ✅ Window 桌面叠加（Always-On-Top + NoActivate）
- ✅ 容差色键（非精确匹配，支持抗锯齿边缘）
- ✅ 多位置启动（右下/左下/右上/左上/居中）
- ✅ Editor Play Mode 自动降级为普通窗口
- ✅ 透明度开关（`_disableTransparency`）
- ✅ 点击穿透/不穿透切换
- ✅ 鼠标消息转发（overlay → Unity 窗口）
- ✅ DPI 感知（Per-Monitor V2）
- ✅ 调试诊断日志文件

### 性能分析

| 指标 | 数值 |
|------|------|
| RenderTexture 大小 | 500×600, ARGB32 (~1.2 MB) |
| GPU→CPU 读取 | `ReadPixels + Apply`（强制同步） |
| CPU 像素遍历 | 120 万次数组访问/帧 |
| Marshal.Copy | 1.2 MB/帧 |
| UpdateLayeredWindow | 系统调用 |
| 预估每帧开销 | 3-5ms（已通过预分配 buffer 优化） |

### 结论：**保留**

实现达到生产级质量。色键性能是已知瓶颈但可控（500×600 窗口 + 预分配 buffer）。已有 GPU ChromaKey shader 方案可进一步优化。

---

## 二、方案对比

| 维度 | 透明背景（当前） | 背景图 | 评估 |
|------|-----------------|--------|------|
| 桌面融合感 | ★★★★★ 角色浮在桌面上 | ★★★☆☆ 独立窗口 | 透明胜 |
| 跨平台 | ❌ Windows only | ✅ 全平台 | 背景图胜 |
| 实现复杂度 | 高（~800 行 Win32 P/Invoke） | 低（Canvas/Sprite 渲染） | 背景图胜 |
| 当前代码质量 | 生产级，已验证 | 未实现 | 透明胜 |
| 性能 | 3-5ms/帧 CPU chroma key | 几乎零开销 | 背景图胜 |
| 维护成本 | 高（Win32 API 演进） | 低（标准 Unity） | 背景图胜 |
| 与桌面交互 | 点击穿透支持 | 不支持 | 透明胜 |
| 当前状态 | ✅ 已完成并验证 | ❌ 需从零实现 | 透明胜 |
| GPU 优化 | ChromaKey.shader 已完成 | N/A | — |

**关键决策因素**：透明背景已投入大量工程实现并验证通过。背景图方案虽然简单，但需要从零开始且放弃了桌面融合的核心体验。

---

## 三、功能清理决策

| 功能 | 决定 | 原因 |
|------|------|------|
| 透明背景 | ✅ 保留 | 高质量实现，核心差异化体验 |
| Per-pixel alpha | ✅ 保留 | 透明背景的核心技术 |
| Chroma key 渲染 | ✅ 保留 | 透明背景必须 |
| GPU chroma key shader | ✅ 保留 | 已实现，可优化 CPU 开销 |
| DWM overlay 窗口 | ✅ 保留 | 透明背景必须 |
| **桌面自动漫游** | ❌ 删除 | 用户不需要，简化行为模型 |
| **点击目的地移动** | ❌ 删除 | 无桌面移动场景 |
| **鼠标拖拽移动** | ✅ 保留 | 用户明确要求保留 |
| **全局热键/托盘** | ✅ 保留 | 独立于漫游功能 |
| **Always-On-Top** | ✅ 保留 | 桌宠核心需求 |
| **窗口定位** | ✅ 保留 | 启动位置/拖拽后位置 |

---

## 四、删除范围

### FoxSimpleMovement.cs 需删除

| 功能 | 涉及代码 | 状态 |
|------|---------|------|
| RoamLoop 协程 | `IEnumerator RoamLoop()` + 相关逻辑 | ❌ 删除 |
| PickNewTarget 随机漫游 | `PickNewTarget()` | ❌ 删除 |
| MoveState 自动状态机 | `MoveState.Walking/Running/Idle` 自动切换 | ❌ 删除 |
| OnDesktopClicked 点击移动 | `OnDesktopClicked()` + `_enableClickToMove` | ❌ 删除 |
| Mouse hook 线程 | `StartHookThread/StopHookThread`（仅用于点击桌面） | ❌ 删除 |
| ApproachCursor | `ApproachCursor()` + `UpdateIdleApproach()` | ❌ 删除 |
| ShowDestinationPrompt | 双击提示 | ❌ 删除 |
| ShowArrival | 到达提示 | ❌ 删除 |
| UpdateWalkAnimation | 行走动画驱动 | ❌ 删除 |

### FoxSimpleMovement.cs 保留

| 功能 | 说明 |
|------|------|
| 拖拽暂停 | `_wasDragging` → `MoveState.Paused`，确保拖拽时动画暂停 |
| 窗口位置保存/恢复 | `SaveState/LoadState` |
| 情绪调制 | `GetEmotionModulatedSpeed/GetEmotionModulatedRunChance`（可能仍有用于其他动画） |
| Update 主循环 | 简化为仅处理拖拽暂停逻辑 |

### 不变的文件

| 文件 | 原因 |
|------|------|
| TransparentWindow.cs | 全部保留 |
| NativeWindowInterop.cs | 全部保留 |
| DesktopCameraSetup.cs | 全部保留 |
| FoxInteraction.cs | 拖拽逻辑全部保留 |
| ChromaKeyRenderFeature.cs | 保留（GPU 优化可选） |
| ChromaKey.shader | 保留 |

---

## 五、实施计划

1. **写文档** ← 当前
2. **精简 FoxSimpleMovement.cs** — 删除漫游/点击移动，保留拖拽暂停
3. **清理关联字段** — `_enableClickToMove`, mouse hook 相关
4. **验证** — 确认透明背景正常工作，拖拽正常，无编译错误
