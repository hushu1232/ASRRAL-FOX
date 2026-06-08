# AstralFox 项目优化路线图

> 视角: 高级游戏工程师
> 基准: 深度代码审查 (2026-06-07)
> 引擎: Unity 6000.4.10f1 · Cubism SDK 5-r.5 (Core 6) · URP 17.4.0
> 项目完成度: ~86%

---

## 一、悠小喵模型兼容性

### 模型信息

```
来源:  【免费版】悠小喵.zip (31 MB, 30 文件)
格式:  Cubism 3 (model3.json Version: 3)
Moc:   悠小喵.moc3 (6.6 MB)
纹理:  8192×8192 × 2张 (texture_00.png 15.4MB + texture_01.png 11.7MB)
Drawables: 236
表达式: 18 个 (.exp3.json)  + 1 个 motion (.motion3.json)
物理:  悠小喵.physics3.json (73 KB)
```

### 兼容性评估

| 维度 | 状态 | 说明 |
|------|------|------|
| Cubism SDK 版本 | ✅ | SDK 5-r.5 (Core 6) 完全兼容 Cubism 3 格式 |
| .moc3 二进制 | ✅ | 6.6 MB，Core 6 原生支持 |
| 纹理分辨率 | ⚠️ | 8192 纹理需要 GPU 支持（大多数现代 GPU 支持） |
| 纹理格式 | ✅ | PNG，Unity 自动压缩 |
| 表达式 | ⚠️ | 18 个 .exp3.json 已导入但项目中未全部驱动 |
| 物理 | ✅ | .physics3.json 已导入，SDK 自动应用 |
| 项目已有版本 | ✅ | `Assets/Live2D/Models/YouXiaoMiao/` 已导入，prefab 已生成 |
| 路径兼容 | ✅ | 中文文件名 `悠小喵.model3.json` 在 Windows 上正常 |

**结论: 兼容。** 悠小喵是 Cubism 3 格式模型，Core 6 原生支持。项目中已有导入版本。唯一注意点是 8192 纹理在移动端/低端 GPU 上可能需要降采样。

### 项目中悠小喵的使用

```
Assets/Live2D/Models/YouXiaoMiao/
├── 悠小喵.model3.json        ← 模型定义
├── 悠小喵.moc3               ← 二进制网格数据
├── 悠小喵.prefab              ← Unity prefab (已生成)
├── 悠小喵.8192/              ← 8192 纹理
│   ├── texture_00.png (15MB)
│   └── texture_01.png (12MB)
├── exp/                      ← 18 个表情
├── 悠小喵.physics3.json      ← 物理
└── 悠小喵.vtube.json         ← VTube Studio 配置
```

---

## 二、模块完成度总览

```
模块         完成度   关键差距
────────────────────────────────────────────────────
动画         92%     Audio2Face 幅度近似, 注视重复
平台         90%     _usePerPixelAlpha 未使用
行为         93%     管线集成待完善
Core         95%     仅 TimeFunction 注册
诊断         87%     StatusLabel 缺失 Initializing
数据/配置    96%     NeedsFirstTimeSetup 恒 false
交互         83%     QuickModelSwitch 需重启
AI           90%     Jaccard 相似度而非嵌入
Voice        78%     唤醒词/LLM/ASR/TTS 需外部依赖
────────────────────────────────────────────────────
总体         86%
```

---

## 三、性能状态 (已完成优化)

| Phase | 内容 | 状态 |
|-------|------|------|
| Phase 1 | sharedMaterial 合批 · lookup table · enum 索引 · 引用缓存 | ✅ |
| Phase 2 | PAD 节流 · 音频缓冲区复用 · 列表预分配 | ✅ |
| Phase 3 | AudioUtility · 事件泄漏修复 · GPU ChromaKey URP 集成 | ✅ |
| URP 迁移 | Mask.shader · 注释清理 · 死代码删除 | ✅ |
| 透明窗口 | 色键同步 · ULW 保护 · 接口清理 | ✅ |
| 桌面漫游 | FoxSimpleMovement 885→184 行 | ✅ |

---

## 四、优化路线图 — 下一步

### P0 — 阻塞项 (模型无法正常使用)

| # | 问题 | 修复方案 | 工时 |
|---|------|---------|------|
| P0-1 | 无启动场景 (EditorBuildSettings 指向已删除的 SampleScene) | 执行 `AstralFox > Setup Desktop Pet Scene` 创建场景并添加到 Build Settings | 5min |
| P0-2 | CUBISM_SDK_PRESENT 未设置 | Project Settings > Player > Scripting Define Symbols 添加 `CUBISM_SDK_PRESENT` | 2min |
| P0-3 | YouXiaoMiao prefab 可能缺少 CubismUpdateController | 通过场景设置补加，或在 prefab 上手动添加 | 5min |
| P0-4 | ChromaKeyRenderFeature 需注册到 URP Renderer | 编辑器重启后自动注册 (ChromaKeyAutoRegister)，或手动 `AstralFox > ChromaKey > Register` | 0min (自动) |

### P1 — 体验完整度 (优先)

| # | 问题 | 当前状态 | 修复方案 | 工时 |
|---|------|---------|---------|------|
| P1-1 | Voice 管线的外部依赖缺失 | WakeWordDetector(F12模拟) · LLMService(关键词回退) · ASR/TTS(需exe) | 选项A: 下载模型实现全离线 · 选项B: 对接在线 BFF 后端 | 2-4h |
| P1-2 | QuickModelSwitch 切换需重启 | 保存配置→需要重启才生效 | 实现运行时 Destroy→Instantiate 新模型 | 3h |
| P1-3 | 18 个悠小喵表情仅部分驱动 | .exp3.json 已导入，C# 侧未全部映射 | 在 FoxAnimationController 中映射表情触发 | 2h |
| P1-4 | NeedsFirstTimeSetup 恒返回 false | StartupWizard 从不弹出 | 修复检测逻辑或移除向导 | 30min |

### P2 — 工程品质 (建议)

| # | 问题 | 修复方案 | 工时 |
|---|------|---------|------|
| P2-1 | GazeTracker 与 FoxEmotionController 注视重复 | 统一点为 GazeTracker，删除 FoxEmotionController 中的 UpdateEyeTracking | 1h |
| P2-2 | VectorMemoryStore 用 Jaccard 而非嵌入 | 替换为 embedding-based 搜索 (sentence-transformers 或 OpenAI embeddings) | 4h |
| P2-3 | Audio2Face + LipSync 双份幅度近似 | 统一为单入口，或接入真实视位数据 (Azure Viseme / Rhubarb Lip Sync) | 3h |
| P2-4 | DebugOverlay StatusLabel 缺失 Initializing 分支 | 添加 `ServiceTier.Initializing → "Initializing"` | 5min |
| P2-5 | FunctionRegistry 中只有 TimeFunction | 将 VoiceManager 命令 (set_personality, clear_memory) 注册为 IFoxFunction | 1h |

### P3 — 长期架构 (可选)

| # | 问题 | 方案 |
|---|------|------|
| P3-1 | JSON 文件存储 → SQLite | DataStore 设计时已预留 SQLite 接口，实现 IDataStore 即可 |
| P3-2 | 仅 Windows → 跨平台 | 抽象 Platform 层，macOS 用 NSWindow 透明 · Linux 用 X11 |
| P3-3 | 8192 纹理 → Mipmap 链 | 生成多级纹理，根据窗口大小动态选择 |
| P3-4 | 单模型 → 多模型共存 | PetAnimationManager 扩展为多实例管理器 |

---

## 五、技术债务登记

| 债务 | 位置 | 影响 | 清理难度 |
|------|------|------|---------|
| `lock(this)` → `_saveLock` (已修) | DataStore.cs | 无 | ✅ |
| async void 未保护 (已修) | BackendClient, LLMService | 无 | ✅ |
| ITransparentWindow 死接口 (已删) | Platform/ | 无 | ✅ |
| 四套路径格式共存 | AppConfig/PetModelRegistry/QuickModelSwitch/SettingsWebServer | 模型切换失败 | 中 |
| Audio2Face 硬编码字符串 | Audio2Face.cs | 不影响运行 | 低 |
| TransparentWindow `_usePerPixelAlpha` 未用 | TransparentWindow.cs | 不影响运行 | 低 |
| 色键颜色不一致 (已修) | DesktopCameraSetup vs TransparentWindow | 无 | ✅ |
| 注释中的 Built-in RP 残留 (已修) | 多处 | 无 | ✅ |

---

## 六、即刻可用的最小验证流程

```
1. 打开 Unity 6000.4.10f1, 加载项目
2. Project Settings > Player > Scripting Define Symbols:
   添加 CUBISM_SDK_PRESENT
3. 菜单: AstralFox > Setup Desktop Pet Scene
4. 菜单: File > Build Settings > 添加当前场景
5. 按 Play
6. 预期: 绿色背景 + 悠小喵模型渲染 + 透明窗口 (Standalone) 或 绿色背景窗口 (Editor)
7. 验证: Console 中 [ChromaKey] ✓ Registered
8. 拖拽角色 → 应该跟随鼠标 + 弹簧物理
```

---

## 七、当前项目定位

```
                   架构设计    代码实现    性能优化    生产就绪
                   ────────    ────────    ────────    ────────
动画系统            ⭐⭐⭐⭐⭐   ⭐⭐⭐⭐⭐   ⭐⭐⭐⭐⭐   ✅
透明窗口            ⭐⭐⭐⭐⭐   ⭐⭐⭐⭐☆   ⭐⭐⭐⭐☆   ✅
数据持久化          ⭐⭐⭐⭐⭐   ⭐⭐⭐⭐⭐   ⭐⭐⭐⭐⭐   ✅
配置加密            ⭐⭐⭐⭐⭐   ⭐⭐⭐⭐⭐   ⭐⭐⭐⭐⭐   ✅
语音管线架构        ⭐⭐⭐⭐⭐   ⭐⭐⭐⭐☆   ⭐⭐⭐⭐☆   ⚠️ 需外部依赖
AI 记忆/上下文      ⭐⭐⭐⭐☆   ⭐⭐⭐⭐☆   ⭐⭐⭐☆☆   ⚠️ 关键词→嵌入待升级
模型导入/切换       ⭐⭐⭐☆☆   ⭐⭐⭐☆☆   ⭐⭐⭐⭐☆   ⚠️ 需重启
```

**总结**: 项目架构设计出色（模块分离、接口抽象、数据驱动）。核心系统（动画+透明窗口+数据）已达生产级别。语音和 AI 管线架构完整但依赖外部 SDK/模型。模型切换和表情驱动是体验完整度的主要短板。
