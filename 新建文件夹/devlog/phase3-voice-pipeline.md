# 阶段 3 开发日志：本地唤醒与语音链路

> 日期：2026-05-23

---

## 1. 技术思路

### 1.1 音频管线架构

```
┌──────────────────────────────────────────────────────────┐
│          MicrophoneCapture                               │
│          Unity Microphone API → float[] PCM              │
│          16kHz, 16bit, mono                              │
└──────────────────┬───────────────────────────────────────┘
                   │ OnAudioData(float[], sampleRate, channels)
                   ▼
┌──────────────────────────────────────────────────────────┐
│          VoiceActivityDetector (VAD)                     │
│          Energy-based RMS threshold state machine        │
│          States: Silence → Onset → Speaking → Trailing   │
└──────────────────┬───────────────────────────────────────┘
                   │ OnSpeechStart / OnSpeechEnd
                   ▼
┌──────────────────────────────────────────────────────────┐
│          WakeWordDetector                                │
│          [Vosk model] or [Mock: F12 key]                 │
│          Wake word: "小星小星"                           │
│          Streaming recognition → partial text match      │
└──────────────────┬───────────────────────────────────────┘
                   │ OnWakeWordDetected
                   ▼
┌──────────────────────────────────────────────────────────┐
│          VoiceManager (Pipeline Controller)              │
│          State: Idle → Listening → Recording →           │
│                 Processing → Speaking                    │
└──────┬──────────────────────────────┬────────────────────┘
       │ audio stream (Recording)     │ text response (Processing)
       ▼                              ▼
┌──────────────────┐    ┌──────────────────────────────────┐
│   BackendClient  │    │   FoxAnimationController         │
│   WebSocket →    │    │   OnWakeWord / OnSpeakingStart   │
│   Backend BFF    │    │   SetEmotion / SetMouthOpen      │
└──────────────────┘    └──────────────────────────────────┘
```

### 1.2 VAD 状态机

```
            RMS > threshold
  SILENCE ──────────────────→ ONSET
     ↑                          │
     │ RMS < threshold          │ hold > onsetTime
     │ (false trigger)          │
     └──────────────────────────┘
                                ↓
                             SPEAKING ←──────────┐
                                │                  │
                                │ RMS < threshold  │ RMS > threshold
                                ↓                  │ (resumed)
                             TRAILING ────────────┘
                                │
                                │ silence > timeout
                                ↓
                           [SPEECH END]
```

- **Onset time**: 150ms（防止短暂噪声误触发）
- **Silence timeout**: 800ms（用户停顿后判定说话结束）
- **Min speech duration**: 300ms（忽略极短的杂音）
- **RMS smoothing**: 0.9 指数移动平均

### 1.3 唤醒词方案对比

| 方案 | 延迟 | 准确率 | 离线 | 模型大小 |
|------|------|--------|------|---------|
| **Vosk** (small-cn-0.22) | ~200ms | 中 | ✅ | 42MB |
| **whisper.cpp** (tiny) | ~500ms | 高 | ✅ | 78MB |
| **Porcupine** | <50ms | 高 | ✅ | 1-3MB |
| **Snowboy** (已停止维护) | <50ms | 中 | ✅ | 1MB |

**当前选择**: Vosk（流式识别 `vosk-model-small-cn-0.22`）

Vosk 的优势是同时支持唤醒词检测和语音识别，一个模型完成两个任务。缺点是延迟较高（~200ms），模型体积较大。

后续可考虑替换为 Porcupine（低延迟专用唤醒词引擎）。

### 1.4 WebSocket 协议

```
Client (Unity)                          Server (FastAPI BFF)
     │                                        │
     │── binary PCM audio chunks ────────────→│  (持续流式发送)
     │── {"type":"end_of_speech"} ───────────→│
     │                                        │  (ASR 转写)
     │←─ {"type":"final_transcript","text":"…"}│
     │                                        │  (LLM 生成)
     │←─ {"type":"llm_response","text":"…"} ──│  (含情绪/动作标签)
     │                                        │  (TTS 合成)
     │←─ {"type":"tts_audio","index":0,…} ───│  (PCM base64)
     │←─ {"type":"tts_audio","index":1,…} ───│
     │←─ {"type":"tts_done"} ────────────────│
     │                                        │
```

### 1.5 Mock 模式设计

在没有 Vosk 模型和后端服务的情况下，系统可以在 Mock 模式下运行：

| 组件 | Mock 行为 |
|------|----------|
| **WakeWordDetector** | 按 F12 键触发唤醒（长按 0.3s 防误触） |
| **BackendClient** | 不连接服务器（连接失败自动重试） |
| **MockVoicePipeline** | 拦截 Processing/Speaking 状态，返回预设的中文回复 |
| **MicrophoneCapture** | 正常工作（真实麦克风输入） |
| **VoiceActivityDetector** | 正常工作（真实 VAD） |

Mock 模式流程：
1. 用户按 F12 → 模拟唤醒
2. 对麦克风说话 → VAD 检测语音
3. 停止说话 → VAD 检测结束
4. MockVoicePipeline 随机选择一条预设回复
5. 设置情绪、触发 Speaking 动画
6. 等待模拟 TTS 时长 → 回到 Idle

---

## 2. 文件清单

### Unity C# 脚本

| 文件 | 职责 |
|------|------|
| `Runtime/Voice/MicrophoneCapture.cs` | Unity 麦克风采集，float[] PCM 输出 |
| `Runtime/Voice/VoiceActivityDetector.cs` | 能量 RMS VAD，Silence→Onset→Speaking→Trailing 状态机 |
| `Runtime/Voice/WakeWordDetector.cs` | Vosk 离线唤醒词 + F12 模拟模式 |
| `Runtime/Voice/BackendClient.cs` | System.Net.WebSockets 客户端，音频上行/文本下行 |
| `Runtime/Voice/VoiceManager.cs` | 管线总控：Idle→Listening→Recording→Processing→Speaking |
| `Runtime/Voice/MockVoicePipeline.cs` | 离线测试模拟器，预设中文回复 |

### Python 后端

| 文件 | 职责 |
|------|------|
| `backend/main.py` | FastAPI `/ws/chat` 端点，Phase 3 桩（模拟 ASR/LLM/TTS） |
| `backend/requirements.txt` | Python 依赖 |

### 已更新文件

| 文件 | 变更 |
|------|------|
| `Editor/AstralFoxSceneSetup.cs` | 添加 6 个语音组件挂载 |

---

## 3. 配置步骤

### 3.1 安装 Vosk（可选）

1. 下载 `vosk-model-small-cn-0.22` 从 [alphacephei.com/vosk/models](https://alphacephei.com/vosk/models)
2. 解压到 `Assets/StreamingAssets/vosk-model/`
3. 导入 Vosk C# 绑定 DLL 到 `Assets/Plugins/`
4. `PlayerSettings → Scripting Define Symbols` 添加 `VOSK_PRESENT`

### 3.2 启动后端

```bash
cd backend
pip install -r requirements.txt
python main.py
# → ws://localhost:8765/ws/chat
```

### 3.3 测试全链路（Mock 模式）

1. Unity Editor 中 Play
2. 按 F12 模拟唤醒词
3. 对麦克风说话（或在控制台观察 `[VoiceManager]` 日志）
4. 等待 VAD 检测结束
5. MockVoicePipeline 自动返回预设回复
6. 观察动画状态切换：Idle → Listening → Recording → Processing → Speaking → Idle

---

## 4. 下一步（阶段 4）

- FastAPI 集成 Azure ASR 实时流式语音识别
- 集成 OpenAI GPT-4o（Function Calling：天气、搜索、提醒）
- 集成 Azure TTS 或 edge-tts 流式合成
- 真实 PCM 音频传输替代当前 mock silence 帧
