# AstralFox 开发会话总结

> 日期: 2026-06-07 ~ 2026-06-08
> 会话主题: 性能优化、URP 迁移、渲染修复、表情系统、画质提升

---

## 一、已完成工作

### 1. 性能优化 — Phase 1~3（~40 文件）

| Phase | 核心修复 | 文件数 |
|-------|---------|--------|
| Phase 1 | sharedMaterial 合批、lookup table O(n²)→O(1)、enum 索引替代 string 字典、Camera.main 缓存 | 9 |
| Phase 2 | PAD 节流（60×）、音频缓冲区复用（0 GC）、列表预分配容量 | 3 |
| Phase 3 | AudioUtility 统一工具、事件泄漏修复、GPU ChromaKey URP 集成、接口清理 | 9 |
| 残余修复 | SoundEffectManager GC、DebugOverlay GC、LLMService Task.Run、16 项 P0-P4 | 14 |

### 2. URP 渲染管线统一

| 项目 | 说明 |
|------|------|
| Mask.shader | CGPROGRAM → HLSLPROGRAM（URP 兼容） |
| 删除 UpgradeCubismMaterials.cs | 危险脚本（Standard shader 错误替换） |
| 清除 Built-in RP 注释 | 4 文件 |
| 还原 .mat 文件 | 987 个材质恢复到正确的 URP shader |

### 3. Unity 6 渲染修复（最耗时）

**根本问题**: URP 未在 Quality Settings 中激活 → 所有 RenderGraph Pass 静默跳过 → 模型不可见。

| 修复 | 文件 |
|------|------|
| QualitySettings 添加 URP 引用 | `QualitySettings.asset` |
| CUBISM_SDK_PRESENT 定义 | `ProjectSettings.asset` |
| CubismRenderPassFeature + ChromaKeyRenderFeature 自动注册 | `ChromaKeyAutoRegister.cs` |
| `AssetDatabase.AddObjectToAsset` 子资产序列化 | `ChromaKeyAutoRegister.cs` |

**Cubism SDK Unity 6 兼容性修复**:

| 修复 | 说明 |
|------|------|
| `CommandBuffer.Blit` 替代 `Material.SetTexture` | TextureHandle 不兼容 Material API |
| Static CommandBuffer → 每帧刷新 | RenderGraph 每帧分配新 buffer |
| 直接渲染到 Camera Texture | 绕过中间纹理 Blit-back 问题 |
| `AllowPassCulling(false)` | 防止 RenderGraph 裁剪 |
| `AccessFlags.Write` | 明确声明写入（防裁剪） |
| `FilterMode.Point→Trilinear` + `anisoLevel=4` | 画质提升 |
| 中间纹理 Bilinear→Trilinear | 平滑采样 |

**NRE 守卫**（原生 drawable 数据损坏）:

| 位置 | 守卫类型 |
|------|---------|
| `CubismRenderController.OnEnable` | 整个方法 try-catch |
| `CubismRenderController.OnLateUpdate` | try-catch（无永久禁用） |
| `CubismRenderController.UpdateDrawableBlendColors` | try-catch |
| `ExecutePass` 每渲染器 `DrawObject` | try-catch |
| `TryInitialize` 整个循环 | try-catch |
| `OnAfterRenderersInitialize` | Drawable null 守卫 |
| `CubismRenderer.TryInitializeMesh` | 原生 NRE try-catch |
| `OnModelOpacityDidChange` | `_meshRenderer` null 守卫 |

### 4. 模型加载修复

| 修复 | 说明 |
|------|------|
| `BuildCompletePrefab` reimport 损坏 | `RemoveObjectFromAsset→DeleteAsset` |
| 重复 CubismRenderer | 移除手动注入，让 SDK 的 `TryInitialize` 自然创建 |
| `StartupWizard` model_path 损坏 | 修复为完整路径 |
| 静默失败诊断 | `OnEnable`/`TryInitialize`/渲染器初始化添加 Warning |
| `CatTailImporterSetup` 每帧回调 | `EditorApplication.update→delayCall` |

### 5. 透明窗口增强

| 修复 | 说明 |
|------|------|
| 色键颜色同步 | `DesktopCameraSetup` 品红→绿色（匹配 TransparentWindow） |
| Awake 重复检测修复 | `GetComponent→GetComponents` 遍历所有实例 |
| ULW 连续失败保护 | 30 帧连续失败后停止循环 |
| Editor 模式 MoveWindow 跳过 | 防止移动 Unity IDE 窗口 |
| GPU ChromaKey shader | `Graphics.Blit` + `ChromaKey.shader` 替代 CPU 色键 |
| 删除死接口 | `ITransparentWindow.cs`, `EditorMockTransparentWindow.cs` |

### 6. 交互系统

| 修复 | 说明 |
|------|------|
| FoxInteraction `IsMouseOverFox` | Collider2D 回退 → Renderer 包围盒检测 |
| 拖拽弹簧物理升级 | `Lerp→临界阻尼弹簧`（使用 `_springDamping`） |
| 拖拽状态清理 | 开始拖拽时重置 `_dragVelocity` + `_offsetFromCenter` |
| GazeTracker 平滑 | `smoothTime 0.33s→0.67s`，添加 `maxDelta` 帧率无关保护 |
| FoxSimpleMovement 精简 | 885→184 行（删除桌面漫游） |

### 7. 表情系统

| 项目 | 说明 |
|------|------|
| `CubismExpressionController` 挂载 | 场景设置中自动添加 + 绑定 expressionList.asset |
| `ExpressionHotkeys.cs` | 0-9 / F1-F8 触发 18 个原生表情，ESC 清除 |
| `CubismParameterDriver` 执行顺序 | `[DefaultExecutionOrder(250)]`（Expression 在 300） |

### 8. 静态分析与文档

| 文档 | 内容 |
|------|------|
| `PERFORMANCE-OPTIMIZATION-PLAN.md` | 12 项性能优化任务书 |
| `BACKGROUND-COMPARISON.md` | 透明背景 vs 背景图对比决策 |
| `TRANSPARENT-WINDOW-ARCHITECTURE.md` | 透明窗口架构全解（10 章） |
| `PROJECT-ENVIRONMENT.md` | 完整环境依赖全图（9 章） |
| `OPTIMIZATION-ROADMAP.md` | 模块完成度评估 + 优化路线图 |
| `NEXT-ACTIONS.md` | 40 个 bug/优化点清单 |
| `EMOTION-RESOURCE-AUDIT.md` | 悠小喵资源审计 + 情绪系统分析 |
| `EXPRESSION-INTEGRATION-PLAN.md` | 18 表情接入规划 + 快捷键 + 画质路线 |

---

## 二、当前项目状态

### 可运行

```
✅ 悠小喵模型渲染（绿色背景 + 透明窗口）
✅ 拖拽交互（弹簧物理 + 抛掷）
✅ 目光跟踪鼠标
✅ 呼吸/耳朵/尾巴空闲动画
✅ PAD 情绪引擎（5 种情绪，事件驱动 + 自然衰减）
✅ 透明窗口（Win32 逐像素 alpha）
✅ GPU ChromaKey（通过 ChromaKey.shader）
✅ 18 个原生表情热键（0-9/F1-F8，ESC 清除）
✅ URP 管线（MSAA 4× + FXAA）
✅ 纹理 8192 原生分辨率
✅ RT 1400×1800 + Trilinear + 各向异性过滤
```

### 待完成

```
⚠️ 表情热键触发后角色无反应（参数覆盖时序问题）
⚠️ 语音管线缺少外部依赖（FunASR/LLMUnity/sherpa-onnx）
⚠️ QuickModelSwitch 切换需重启
⚠️ Audio2Face 使用 RMS 幅度近似（非视位）
⚠️ VectorMemoryStore 使用 Jaccard 关键词（非 embedding）
⚠️ Microphone 999+ 警告（buffer 大小不匹配）
⚠️ TrayIcon CreateWindowEx 失败（降级为 Warning）
```

---

## 三、Git 提交历史

```
9852604 feat: native expression hotkeys + spring physics + RT 1400×1800 + Trilinear
01fe193 fix: Cubism Unity 6 rendering + FXAA + texture 8192 + NRE guards
30a73c5 fix: URP activation + Cubism Unity 6 RenderGraph compatibility
172c719 perf: Phase 1-3 性能优化 + URP 管线统一 + 透明窗口增强 + 环境文档
40536c2 feat: Unity 6 migration + AI rigging pipeline + interview demo ready
```

---

## 四、接下来要做的事

### P0 — 表情系统完成（当前受阻）

1. **排查表情不生效根因** — 确认 `CubismExpressionController.OnLateUpdate` 是否被调用
2. **如果执行顺序无效** → 在 `ExpressionHotkeys.Update` 中手动调用 `_expCtrl.OnLateUpdate()`
3. **表情→情绪自动联动** — `FoxEmotionController` 中 PAD 情绪自动触发对应表情索引

### P1 — 体验完整度

1. **下载 AI 模型** → 全离线语音管线（Qwen2.5 GGUF + FunASR + sherpa-onnx）
2. **运行时模型切换** → `QuickModelSwitch` 热切换
3. **Microphone buffer 修复** → 消除 999+ 警告
4. **表情参数调优** → fadeIn/fadeOut 时间和强度

### P2 — 工程品质

1. **GazeTracker 与 FoxEmotionController 注视统一** → 删除重复逻辑
2. **Audio2Face + LipSync 统一** → 单入口
3. **embedding 记忆** → 替换 Jaccard 关键词搜索
4. **FunctionRegistry 扩展** → 注册更多 IFoxFunction

### P3 — 长期架构

1. **JSON → SQLite** 数据存储
2. **跨平台透明窗口**（macOS/Linux）
3. **多模型共存**
4. **纹理 Mipmap 链**（根据窗口大小动态选择）
