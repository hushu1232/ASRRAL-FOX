# 阶段 3 测试验证日志

> 测试日期：2026-05-23
> 测试类型：静态代码审查
> 审查文件：8 个新文件（6 C# + 2 Python），约 1100 行代码

---

## 一、审查文件清单

| # | 文件 | 类型 | 行数 |
|---|------|------|------|
| 1 | `MicrophoneCapture.cs` | Unity 麦克风采集 | ~150 |
| 2 | `VoiceActivityDetector.cs` | 能量 VAD 状态机 | ~150 |
| 3 | `WakeWordDetector.cs` | Vosk + Mock 唤醒词 | ~220 |
| 4 | `BackendClient.cs` | WebSocket 客户端 | ~240 |
| 5 | `VoiceManager.cs` | 管线总控 | ~260 |
| 6 | `MockVoicePipeline.cs` | 离线模拟器 | ~150 |
| 7 | `backend/main.py` | FastAPI 桩 | ~120 |
| 8 | `backend/requirements.txt` | Python 依赖 | ~5 |

---

## 二、发现的问题

### Bug #1 (Medium) — MicrophoneCapture 环回时的采样丢失

- **文件**：`MicrophoneCapture.cs:138-150`
- **描述**：当麦克风缓冲区环回（`currentPos < _lastSamplePos`）时，读取范围横跨缓冲区末尾和开头。当前代码只从 `_lastSamplePos` 读取到末尾 (`_micClip.samples - _lastSamplePos` 个样本)，没有处理"从开头到 currentPos"的部分。
- **影响**：缓冲区环回时丢失后半段音频数据。在 1 秒 clip 时长下，每秒发生一次环回。每次环回，从 0 到 currentPos 的样本被跳过。对于 1 秒 clip × 16000Hz，最多丢失 1 秒音频。
- **修复**：需要两次 `GetData` 调用，或使用更大的 clip 避免环回。建议将 `_clipDuration` 设为 5 秒并提高 `_processInterval` 确保在环回前处理。

### Bug #2 (Low) — WakeWordDetector 在 Vosk 模式下 JSON 解析脆弱

- **文件**：`WakeWordDetector.cs:188-203`
- **描述**：`ExtractText()` 使用硬编码字符串搜索解析 Vosk JSON。Vosk 的实际 JSON 格式为 `{"partial" : "text"}`（注意 key 和 value 之间有空格），但 Vosk 版本之间格式可能有细微差异（如 Unicode 转义）。
- **影响**：如果 Vosk 输出的 JSON 格式变化（如 key 不带空格），唤醒词检测静默失败。
- **建议**：使用 `JsonUtility` 或 `MiniJSON` 进行稳健解析。

### Bug #3 (Medium) — 后台音频队列在连接断开时堆积

- **文件**：`BackendClient.cs:122-130` + `SendAudio()`
- **描述**：`SendAudio()` 在 `!IsConnected` 时 return，但在录制状态下 VoiceManager 持续调用。如果连接断开，音频被静默丢弃。但队列 `_audioOutQueue` 的 `_maxQueueSize` 检查是在连接检查之后。如果某帧连接瞬间恢复又断开，音频可能在队列中堆积但不被发送。
- **影响**：录制期间连接断开时，发送的音频可能被堆积到队列中，但在 `FlushAudioAsync` 调用前不会被清除。
- **建议**：连接断开时清空待发送队列。

### Bug #4 (Low) — VoiceManager 和 MockVoicePipeline 的重复标签解析

- **文件**：`VoiceManager.cs:289-310` + `MockVoicePipeline.cs:135-160`
- **描述**：标签解析逻辑（`ParseResponseTags` / `ParseTags`）在两处重复。且使用的正则表达式 `\[(happy|sad|shy|angry|neutral)\]` 要求完全小写，如果 LLM 返回 `[Happy]` 就不会匹配。
- **影响**：大小写不一致时标签解析失败。
- **修复**：提取到共享工具类，正则添加 `RegexOptions.IgnoreCase`。

### Bug #5 (Medium) — VAD 在 Idle/Listening 状态持续运行

- **文件**：`VoiceManager.cs:133-137`
- **描述**：`OnMicAudioData` 在所有状态下都调用 `_vad.ProcessAudio(samples)`。VAD 状态机会在 Idle 状态下因环境噪声误触发 `OnSpeechStart`，但 `OnVadSpeechStart` 只在 Listening 状态才会进入 Recording。
- **影响**：功能上无问题（只在 Listening 状态处理 VAD 事件），但 VAD 状态机在 Idle 时无意义运行消耗 CPU。
- **状态**：⚠️ 可优化但非阻塞性 bug。

---

## 三、架构审查

### 3.1 事件驱动依赖图

```
MicrophoneCapture.OnAudioData
  ├──→ VoiceActivityDetector.ProcessAudio()
  └──→ WakeWordDetector.ProcessAudio() (Idle)
  └──→ BackendClient.SendAudio() (Recording)

WakeWordDetector.OnWakeWordDetected
  └──→ VoiceManager.OnWakeWord() → SetState(Listening)

VoiceActivityDetector.OnSpeechStart
  └──→ VoiceManager.OnVadSpeechStart() → SetState(Recording)

VoiceActivityDetector.OnSpeechEnd
  └──→ VoiceManager.OnVadSpeechEnd() → EndRecording() → SetState(Processing)

BackendClient.OnLLMResponse
  └──→ VoiceManager.OnBackendLLMResponse() → ParseTags → animCtrl

VoiceManager.OnStateChanged
  └──→ MockVoicePipeline (intercepts Processing/Speaking)
```

依赖方向清晰，无循环。✅

### 3.2 线程安全

- `MicrophoneCapture`: Unity 主线程，`OnAudioData` 回调在 Update 中触发 ✅
- `VAD`: 同步处理，主线程 ✅
- `BackendClient`: WebSocket 异步（`async/await`），但 `SendAudio` 使用 `ConcurrentQueue` 线程安全 ✅
- `VoiceManager`: 主线程 + 异步回调。`OnLLMResponse` 在 WebSocket 回调线程触发但操作是设置状态 + 触发事件，无复杂状态共享 ✅

### 3.3 状态机完备性

VoiceManager 状态机：

| 状态 | 允许的转换 | 超时处理 |
|------|-----------|---------|
| Idle | → Listening (wake word) | - |
| Listening | → Idle (timeout 8s), → Recording (VAD) | ✅ 8s |
| Recording | → Processing (end of speech), → Idle? | ✅ 15s max |
| Processing | → Speaking (response received) | ❌ 无超时 |
| Speaking | → Idle (TTS done), → Listening (interrupt) | ❌ 无超时 |

**缺失**：
- Processing 状态无超时：如果后端永不返回，会卡在此状态。应添加 30 秒超时退回 Idle。
- Speaking 状态无超时：如果 TTS 永不结束，会卡住。应添加 TTS 长度上限。

### 3.4 Mock 模式覆盖度

| 功能 | Mock 支持 | 说明 |
|------|----------|------|
| 麦克风输入 | ✅ | 真实麦克风，Unity Microphone API |
| VAD 检测 | ✅ | 真实 VAD 状态机 |
| 唤醒词 | ⚠️ | F12 键模拟，非语音 |
| 语音识别 | ⚠️ | 预设文本，非真实转写 |
| LLM 回复 | ⚠️ | 预设回复列表 |
| TTS 音频 | ❌ | 静默等待，无真实音频 |
| 情绪标签 | ✅ | 预设回复含 [happy]/[sad] 等标签 |

Mock 模式覆盖了管线控制流和动画状态切换，但无法验证音频处理、网络传输、和真实 AI 服务质量。

---

## 四、WebSocket 协议审查

### 消息格式

上行（Client → Server）：
```json
// 音频以二进制帧发送（WebSocketMessageType.Binary）
// 文本控制消息
{"type": "end_of_speech"}
{"type": "ping"}
```

下行（Server → Client）：
```json
{"type": "partial_transcript", "text": "..."}
{"type": "final_transcript", "text": "..."}
{"type": "llm_response", "text": "[happy]你好!"}
{"type": "tts_audio", "index": 0, "data": "<hex>"}
{"type": "tts_done"}
{"type": "error", "message": "..."}
```

### 协议问题

1. **TTS data 格式不一致**：Python 后端使用 `.hex()` 编码，而 Unity `BackendClient.ProcessMessage` 使用 `Convert.FromBase64String()`。格式不匹配！**需要统一**。
2. **音频帧边界**：二进制 PCM 帧在接收端如何知道一个语音片段的边界？当前靠 `end_of_speech` 文本消息标记。但 `end_of_speech` 可能与最后一个音频帧到达顺序不一致（WebSocket 全双工但消息有序）。

---

## 五、测试结论

### 通过项 ✅

- 音频管线架构清晰，6 组件职责分离
- 事件驱动设计降低耦合
- VAD 状态机完备（5 状态 + 回退保护）
- Mock 模式使离线开发测试成为可能
- WebSocket 客户端支持自动重连
- 标签解析支持情绪 + 动作双标签

### 已修复 ✅

- MicrophoneCapture 环回采样丢失 (Bug #1) — 两段式 GetData + Array.Copy
- TTS data hex/base64 格式不一致 — 统一使用 base64
- Processing 和 Speaking 状态缺少超时 — 添加 30s 超时退回 Idle
- 标签解析正则不区分大小写 — 添加 RegexOptions.IgnoreCase
- 重复代码：标签解析逻辑 — MockVoicePipeline 复用 VoiceManager.ParseResponseTags
- BackendClient 断连时音频队列堆积 — 添加 ClearAudioQueue() 在 Disconnect/ReceiveLoop finally 中调用

### 无法验证 ⚠️

- Vosk 模型加载和实时识别（无模型文件）
- WebSocket 连接真实后端（无运行中的后端）
- 音频流式传输延迟
- TTS 音频播放（阶段 5 实现）
