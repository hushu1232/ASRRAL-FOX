# 语音管线

## 架构

```
MicrophoneCapture → PCM 16kHz → BackendClient (WebSocket) → BFF (Python FastAPI)
                                                                    ├── Azure ASR
                                                                    ├── GPT-4o (streaming)
                                                                    ├── Azure TTS
                                                                    └── Function Tools (天气/搜索/提醒)
                                         ← token streaming ←
                                         ← TTS WAV audio ←
                                  ↓
                          TTSPlayer (streaming AudioClip)
                                  ↓
                          LipSync (SetMouthOpen per frame)
                                  ↓
                          FoxAnimationController.Speaking state
```

## 状态机 (VoiceManager)

```
Idle → Listening (唤醒词/"小星小星") → Processing (ASR→LLM→TTS) → Speaking → Idle
  ↑                                        ↓ 超时
  └──────── OnUserNotification ────────────┘
```

## 三种后端

| 后端 | 类 | 用途 |
|------|-----|------|
| 云端 | BackendClient | 生产，需要 BFF + Azure/OpenAI API Key |
| 离线 | AIManager | 本地 AI (FunASR + Qwen + VITS)，未启用 |
| Mock | MockVoicePipeline | 测试/F12 降级，返回预设对话 |

## 并发安全

- BackendClient 连接状态机: `lock(_stateLock)`
- VoiceManager streaming 竞态: `_streamLock`
- 音频队列背压: `SemaphoreSlim`
- SetState 重入保护: `_isTransitioning`

## 可视化调试

Unity Editor 菜单: `AstralFox → WebSocket Monitor`
- 最近 50 条消息流
- 发送/接收/错误 彩色编码
- 自动滚动 + 暂停
