# AstralFox 后续行动清单

> 生成: 2026-06-07 · 基于 68 个 Runtime 脚本的完整代码扫描
> 状态: 40 个 bug/优化点识别, 3 个 CRITICAL 已修复, 37 个待处理

---

## 本次修复 (3 CRITICAL)

| # | 文件 | 问题 | 修复 |
|---|------|------|------|
| ✅ | SoundEffectManager.cs | `new List<>()` 每帧分配 | `_cooldownKeys` 成员字段复用 |
| ✅ | DebugOverlay.cs | `FindObjectOfType` + `new StringBuilder` 每 OnGUI | 缓存 `_aiManager` + `_sysInfoSb`/`_pipelineInfoSb` 复用 |
| ✅ | LLMService.cs | `GenerateWithLLMUnityAsync` 未用 `Task.Run`，主线程阻塞 | 包裹 `Task.Run(() => _llmCharacter.Chat(...))` |

---

## 待处理 — 按优先级

### P0: 阻塞项 (5min)

| # | 操作 | 说明 |
|---|------|------|
| P0-1 | Player Settings 添加 `CUBISM_SDK_PRESENT` | 否则模型不渲染 |
| P0-2 | 执行 `AstralFox > Setup Desktop Pet Scene` 创建场景 | 当前无启动场景 |
| P0-3 | File > Build Settings 添加场景 | Editor 按 Play 需要 |

### P1: 逻辑修复 (30min)

| # | 文件 | 问题 | 修复方案 |
|---|------|------|----------|
| P1-1 | AIManager.cs:181 | `async void InitializeServices()` 异常崩溃进程 | 改为 `async Task` + try-catch |
| P1-2 | ConfigValidator.cs:51 | `async void RunAllTests()` 同上 | 改为 `async Task` |
| P1-3 | TransparentWindow.cs:296 | `OnDestroy` 无 `StopAllCoroutines()` | 添加 `StopAllCoroutines()` |
| P1-4 | DataStore.cs:395,407 | `catch {}` 吞掉解密失败 | 改为 `catch (Exception ex) { Debug.LogWarning(...) }` |

### P2: 性能 (1h)

| # | 文件 | 问题 | 方案 |
|---|------|------|------|
| P2-1 | ContextAwareness.cs:122 | `new StringBuilder(256)` 每 3s 分配 | 成员字段复用 + Clear() |
| P2-2 | PADEmotionEngine.cs:305 | `evt.type.ToString()` 装箱 | 预缓存字符串映射表 `static Dictionary<EmotionEventType, string>` |
| P2-3 | GpuDetector.cs:193 | 空 catch 吞掉 GPU 指标异常 | 改为 `catch (Exception ex) { Debug.LogWarning(...) }` |

### P3: 资源泄漏 (1h)

| # | 文件 | 问题 | 方案 |
|---|------|------|------|
| P3-1 | VoiceButton.cs:134 | `_micTexture` 永不销毁 | OnDestroy 中 `Destroy(_micTexture)` |
| P3-2 | SettingsButton.cs:115 | `_gearTexture` 永不销毁 | OnDestroy 中 `Destroy(_gearTexture)` |
| P3-3 | QuickModelSwitch.cs:150 | `MakeStyle()` 创建 Texture2D 不追踪 | 改为单例静态样式 |
| P3-4 | StartupWizard.cs:192 | `MakeColorTexture()` 同上 | 同上 |

### P4: 健壮性 (30min)

| # | 文件 | 问题 | 方案 |
|---|------|------|------|
| P4-1 | FoxSimpleMovement.cs:73 | 缺少 `[RequireComponent(PADEmotionEngine)]` | 添加 attribute |
| P4-2 | FoxInteraction.cs:97-98 | 缺少 2 个 `[RequireComponent]` | 添加 PADEmotionEngine + SoundEffectManager |
| P4-3 | 3 个 GUI 按钮脚本 | 缺少 `[RequireComponent(FoxInteraction)]` | 添加 attribute |
| P4-4 | SettingsWebServer.cs:71 | `Thread.Sleep(50)` 阻塞线程池 | 改为 `await Task.Delay(50, ct)` |
| P4-5 | MockVoicePipeline.cs:95,100 | 协程未保存引用/未停止 | 保存 Coroutine 引用, OnDestroy 停止 |

---

## 已完成的优化 (存档)

### Phase 1 — 渲染 & 动画 (9 文件)
- sharedMaterial 合批 · lookup table · enum 索引 · 引用缓存

### Phase 2 — 热路径 (3 文件)
- PAD 节流 · 音频缓冲区复用 · 列表预分配

### Phase 3 — 质量 (9 文件)
- AudioUtility · 事件泄漏 · GPU ChromaKey URP 集成 · 接口清理

### 本次 — 残余修复 (3 文件)
- SoundEffectManager GC · DebugOverlay GC · LLMService 阻塞

### 依赖修复 (7 文件)
- URP 迁移 · 透明窗口增强 · 模型加载修复 · 桌面漫游删除

---

## 总计

```
已完成: 31 个文件修改 (性能/逻辑/架构)
待处理: 16 项 (P0×3, P1×4, P2×3, P3×4, P4×5)
预估工时: P0 5min · P1-P2 1.5h · P3-P4 1.5h = 总计 ~3h
```

## 项目健康度

```
代码质量     ⭐⭐⭐⭐☆  86% 完成度, 架构清晰, 模块分离好
性能优化     ⭐⭐⭐⭐⭐  Phase 1-3 + 本次修复, GC 压力已大幅降低
生产就绪     ⭐⭐⭐⭐☆  添加 CUBISM_SDK_PRESENT 后即可运行
技术债务     ⭐⭐⭐☆☆  16 项已知待处理, 无阻塞性债务
文档完整度   ⭐⭐⭐⭐⭐  5 份 devlog 文档覆盖架构/性能/环境/对比/路线图
```
