# Unity-AIChat Bridge → 星尘狐 移植分析报告

> 分析日期：2026-05-30 | 来源：Unity-AIChat v1.0 (51 C# 文件完整解析)

---

## 阶段 0：模块分析报告

### 1. Unity-AIChat 项目真实构成

| 模块 | 文件数 | 技术栈 | AstralFox 对应 |
|------|--------|--------|---------------|
| LLM 集成 | 12 | HTTP REST API（12 种云端/本地 LLM） | `LLMService.cs` (LLMUnity 进程内) |
| TTS 集成 | 9 | HTTP REST API（Azure/OpenAI/Baidu/Xunfei/GPT-SoVITS） | `TTSService.cs` (sherpa-onnx 子进程) |
| STT 集成 | 5 | HTTP REST API（Whisper/Azure/Baidu/Xunfei） | `FunASRService.cs` (FunASR 子进程) |
| 语音唤醒 | 2 | Unity Microphone + 本地引擎 | `WakeWordDetector.cs` |
| 口型同步 | 2 | OVR Lip Sync (Oculus SDK) | `LipSync.cs` |
| 表情控制 | 3 | BlendShape (眨眼 + 响度口型) | `Live2DAnimator.cs` (Live2D Cubism) |
| 对话 UI | 3 | Unity UGUI (InputField + Text + ScrollRect) | Web 管理后台 + 桌面气泡 |
| WebGL | 7 | WebGL Input/Voice 适配 | 无 |
| 模型 | 1 | **3D SkinnedMeshRenderer** (Genshin 胡桃) | Live2D / VRM / DragonBones |

### 2. 关键发现

#### ❌ 不可直接复用的部分

| 模块 | 原因 |
|------|------|
| **Live2D 控制** | Unity-AIChat 根本**不使用 Live2D**。项目使用 3D SkinnedMeshRenderer（胡桃模型），通过 BlendShape 驱动表情和口型。AstralFox 已有完整的 Live2D 管线（Live2DAnimator.cs + CubismParameterDriver.cs + FoxAnimationController.cs）。 |
| **桌面透明窗口** | Unity-AIChat 使用**标准 Unity 窗口**，无透明窗口实现。AstralFox 已有 `TransparentWindow.cs` + `NativeWindowInterop.cs`，远优于 Unity-AIChat。 |
| **进程管理** | Unity-AIChat 无子进程管理。所有服务通过 HTTP API 调用（即使是本地 Ollama/Whisper/GPT-SoVITS）。AstralFox 已有的 `LocalServiceBase.cs`（346行）提供了完整的子进程生命周期管理（启动→健康轮询→自动重启→graceful shutdown），是Unity-AIChat 完全没有的能力。 |
| **启动向导** | Unity-AIChat 无自动启动、无向导、无配置引导。仅有 Start() 中调用 Awake() 初始化。 |

#### ⚠️ 需要改造后复用的部分

| 模块 | 文件 | 改造方案 |
|------|------|---------|
| LLM 抽象基类 | `LLM.cs` ~40行 | 🔄 概念已采用（AIServiceProvider 设计）。不移植代码，保留 AstralFox 的 LLMService。 |
| TTS/STT 抽象基类 | `TTS.cs` ~20行, `STT.cs` ~15行 | 🔄 概念已采用。不移植代码，保留现有架构。 |
| 打字机效果 | `ChatSample.cs:199-220` | ✅ **已移植** → `TypewriterEffect.cs`（改进版：标点感知延迟 + Rich Text 支持） |
| AI 配置对象 | `ChatSetting.cs` ~12行 | ✅ **已移植** → `AIConfig.cs`（扩展版：5 个配置组 + 枚举 + 自动检测） |
| 语音活动指示器 | 无独立实现 | ✅ **已新建** → `VoiceActivityIndicator.cs`（四态 UI + 进度条 + 平滑动画） |

#### ✅ 可直接复用的部分（价值有限）

| 模块 | 文件 | 说明 |
|------|------|------|
| 麦克风录音 | `VoiceInputs.cs` ~30行 | AstralFox 已有 `MicrophoneCapture.cs`，功能相当 |
| WebGL 输入 | 7 个文件 | AstralFox 无 WebGL 需求，不需要 |
| Blendshape 眨眼 | `BlinkController.cs` ~40行 | 仅适用于 SkinnedMeshRenderer，Live2D 有自己的参数系统 |
| 响度口型 | `AudioMouthController.cs` ~35行 | AstralFox 已有 `LipSync.cs` |

### 3. 冲突点

| 冲突 | 说明 | 决策 |
|------|------|------|
| **角色模型格式** | Unity-AIChat 使用 3D .mesh + .mat（胡桃模型），AstralFox 使用 Live2D .moc3 + .json | **舍弃 Unity-AIChat 模型**。保留 AstralFox 的 Live2D/VRM/DragonBones 多格式支持。 |
| **通信模式** | Unity-AIChat：直接 HTTP 调用外部 API。AstralFox：子进程管理 + HTTP 健康检查 | **保留 AstralFox 模式**。Unity-AIChat 的 HTTP 直连不适用于离线场景。 |
| **UI 框架** | Unity-AIChat：Unity UGUI（InputField + Text）。AstralFox：Web 管理后台 | **保留 AstralFox Web 后台**。不移植 Unity-AIChat 的 UGUI 聊天面板。 |

### 4. 评估结论

**Unity-AIChat 对 AstralFox 的实际可移植价值低于预期。**

认知偏差修正：
- ❌ Unity-AIChat **不使用** Live2D（是 3D SkinnedMeshRenderer）
- ❌ Unity-AIChat **无** 透明窗口
- ❌ Unity-AIChat **无** 进程守护
- ❌ Unity-AIChat **无** 启动向导
- ✅ Unity-AIChat 的**策略模式插件架构**（LLM/TTS/STT 抽象基类 + ScriptableObject 配置）值得借鉴 —— 但 AstralFox 已有更好的实现（LocalServiceBase 子进程管理）
- ✅ Unity-AIChat 的**打字机效果**已移植
- ✅ Unity-AIChat 触发的**AIConfig 集中式配置**已实现

### 5. 真正需要创建的新组件（AstralFox 目前缺失）

这些组件在 Unity-AIChat 中也不存在，但根据用户需求，是 AstralFox 应该具备的：

| 序号 | 组件 | 描述 | 来源 |
|------|------|------|------|
| 1 | `ProcessGuard.cs` | 子进程健康监控 + 自动重启（最多3次） | 无参考，全新实现 |
| 2 | `Bootstrapper.cs` | 一键自动启动（解压→加载→初始化→显示） | 无参考，全新实现 |
| 3 | `StartupWizard.cs` | 首次运行三步向导 UI | 基于 AIManager 现有的日志版向导 |
| 4 | `AIChatLive2DAnimator.cs` | 实现 IPetAnimator 的 Live2D 适配器 | 不移植 Unity-AIChat（它不用 Live2D），基于现有 Live2DAnimator.cs 重命名 |
