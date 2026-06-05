# AstralFox 项目对话日志

> 日期范围：2026-05-23
> 参与方：用户 (hushu) + Claude Code
> 项目：AstralFox（星尘狐）桌面 AI 宠物

---

## 2026-05-23 会话 (v2) — Phase 1 审查 + Phase 5-7 实现

### 完成内容

**Phase 1 代码审查与测试：**
- 审查 `TransparentWindow.cs`、`FoxInteraction.cs`、`DesktopCameraSetup.cs`、`AstralFoxSceneSetup.cs`
- 发现：代码结构良好，无严重 bug。`DwmExtendFrameIntoClientArea` 已声明但未在 SetupWindowStyle 中主动调用，建议在实际运行中验证透明效果
- 批量编译测试：Tuanjie batch mode 通过，场景搭建成功，FoxPlaceholder 纹理生成正常
- 编写 Phase 1 测试日志 v2

**Phase 5 实现（Lip Sync + TTS + Interrupt）：**
- `TTSPlayer.cs` — 流式 PCM16 音频播放，AudioSettings.dspTime 无缝拼接
- `LipSync.cs` — 音频振幅 → 口型映射，非对称平滑（快开慢闭），噪声门，抖动
- 更新 `VoiceManager.cs` — TTS 音频路由，打断检测（麦克风电平 > 阈值）
- 更新 `AstralFoxSceneSetup.cs` — 添加 AudioSource、TTSPlayer、LipSync 组件

**Phase 6 实现（PAD Emotion + Data Storage）：**
- `PADEmotionEngine.cs` — PAD 三维情感模型，12 种预定义事件，衰减/平滑，情绪映射
- `DataStore.cs` — JSON 文件存储（对话历史、情感记录、好感度、设置），单例模式
- `AppLifecycle.cs` — 应用生命周期管理，退出/pause 时持久化数据
- 更新 `FoxInteraction.cs` — 点击触发 Petted 事件
- 更新 `FoxAnimationController.cs` — 状态变化触发 PAD 事件
- 更新 `VoiceManager.cs` — 发送情绪上下文和对话历史到后端 LLM
- 更新 `backend/main.py` — 解析 emotion_context 和 chat_history
- 更新 `backend/llm.py` — 动态注入情绪上下文到系统提示词

**Phase 7 实现（Sound Effects + Particles）：**
- `SoundEffectManager.cs` — 14 种声音事件，3 个 AudioSource 分组，程序化占位音效生成
- `TailParticleEffect.cs` — 尾巴星光粒子，情绪驱动颜色和发射率，自动配置
- 更新 `FoxAnimationController.cs` — 状态变化播放音效
- 更新 `FoxInteraction.cs` — 点击播放摸头音效
- 更新 `AstralFoxSceneSetup.cs` — 添加 SoundEffectManager、ParticleSystem、TailParticleEffect

---

## 当前项目架构

```
AstralFox/
├── Assets/
│   └── Scripts/
│       ├── Editor/
│       │   ├── Animation/
│       │   │   └── FoxAnimatorSetup.cs        [Phase 2]
│       │   ├── AstralFoxSceneSetup.cs          [All phases]
│       │   └── AstralFoxTestRunner.cs          [Phase 1]
│       └── Runtime/
│           ├── Animation/
│           │   ├── CubismParameterDriver.cs    [Phase 2]
│           │   ├── FoxAnimationController.cs   [Phase 2, 6, 7]
│           │   ├── FoxEmotionController.cs     [Phase 2]
│           │   ├── FoxParamId.cs               [Phase 2]
│           │   ├── IFoxParameterDriver.cs      [Phase 2]
│           │   └── PADEmotionEngine.cs         [Phase 6 NEW]
│           ├── Audio/
│           │   └── SoundEffectManager.cs       [Phase 7 NEW]
│           ├── Data/
│           │   └── DataStore.cs                [Phase 6 NEW]
│           ├── VFX/
│           │   └── TailParticleEffect.cs       [Phase 7 NEW]
│           ├── Voice/
│           │   ├── BackendClient.cs            [Phase 3]
│           │   ├── LipSync.cs                  [Phase 5 NEW]
│           │   ├── MicrophoneCapture.cs        [Phase 3]
│           │   ├── MockVoicePipeline.cs        [Phase 3]
│           │   ├── TTSPlayer.cs                [Phase 5 NEW]
│           │   ├── VoiceActivityDetector.cs    [Phase 3]
│           │   ├── VoiceManager.cs             [Phase 3, 5, 6]
│           │   └── WakeWordDetector.cs          [Phase 3]
│           ├── AppLifecycle.cs                 [Phase 6 NEW]
│           ├── DesktopCameraSetup.cs           [Phase 1]
│           ├── FoxInteraction.cs               [Phase 1, 6, 7]
│           └── TransparentWindow.cs            [Phase 1]
├── backend/
│   ├── .env.example
│   ├── asr.py                                 [Phase 4]
│   ├── config.py                              [Phase 4]
│   ├── llm.py                                 [Phase 4, 6]
│   ├── main.py                                [Phase 4, 6]
│   ├── requirements.txt
│   ├── tools.py                               [Phase 4]
│   └── tts.py                                 [Phase 4]
└── devlog/
    ├── conversation-log.md                    ← 本文件
    ├── phase1-transparent-window.md           [Phase 1]
    ├── phase1-test-log.md                     [Phase 1 v1]
    ├── phase1-test-log-v2.md                  [Phase 1 v2 NEW]
    ├── phase2-live2d-animation.md             [Phase 2]
    ├── phase2-test-log.md                     [Phase 2]
    ├── phase3-voice-pipeline.md               [Phase 3]
    ├── phase3-test-log.md                     [Phase 3]
    ├── phase4-ai-services.md                  [Phase 4]
    ├── phase4-test-log.md                     [Phase 4]
    ├── phase5-lip-sync.md                     [Phase 5 NEW]
    ├── phase6-emotion-storage.md              [Phase 6 NEW]
    └── phase7-sfx-particles.md                [Phase 7 NEW]
```

---

## C# 脚本统计

| 阶段 | 新增脚本 | 修改脚本 | 累计脚本 |
|------|----------|----------|----------|
| Phase 1 | 3 | 0 | 3 |
| Phase 2 | 5 | 0 | 8 |
| Phase 3 | 7 | 0 | 16 (含2个Editor) |
| Phase 4 | 0 (backend .py) | 0 | 16 |
| Phase 5 | 2 (TTSPlayer, LipSync) | 2 (VoiceManager, SceneSetup) | 18 |
| Phase 6 | 3 (PADEngine, DataStore, Lifecycle) | 5 (AnimCtrl, Interaction, VoiceMgr, backend×2) | 21 |
| Phase 7 | 2 (SFX, TailVFX) | 3 (AnimCtrl, Interaction, SceneSetup) | 24 (含3个Editor) |

**总计：24 个 C# 脚本 + 7 个 Python 模块**

---

## 数据流总览（Phase 1-7 完整路径）

```
用户说话 → MicrophoneCapture → VAD → WakeWordDetector("小星小星")
  → VoiceManager [Listening→Recording]
  → BackendClient (WebSocket PCM16)
  → FastAPI BFF
    ├── ASR (Azure / mock)
    ├── LLM (GPT-4o + Function Calling)
    │   ← 注入: PAD情绪上下文 + 对话历史
    └── TTS (edge-tts / mock)
  → BackendClient (TTS PCM chunks)
  → VoiceManager [Recording→Processing→Speaking]
  → TTSPlayer (AudioSource streaming)
  → LipSync (amplitude → mouthOpenY)
  → FoxAnimationController.SetMouthOpen()
  → CubismParameterDriver → ParamMouthOpenY

打断: Mic level > 0.05 for 0.2s in Speaking → TTSPlayer.StopImmediate → Listening

互动: 点击狐狸 → FoxInteraction → PADEmotionEngine(Petted) + SoundEffectManager(PatHead)
  → PAD变化 → FoxEmotionController.SetEmotion() → Live2D参数混合
  → TailParticleEffect 粒子颜色/发射率更新

存储: DataStore(JSON) ← PAD值 / 聊天记录 / 好感度
  → AppLifecycle.OnApplicationQuit → DataStore.Save()
```

---

## 待解决问题

1. ~~Live2D Cubism SDK 未导入~~ ✅ 已导入，编译通过
2. Vosk 唤醒词模型未下载（42MB）
3. Python 后端未实际运行测试
4. ffmpeg 未安装 — edge-tts MP3→PCM 无法转换
5. Azure / OpenAI API keys 未配置
6. 所有代码为静态审查，实际运行时未经完整集成测试
7. 透明窗口效果需在 Play Mode 中验证
8. Audio Mixer 资源文件需在 Unity Editor 中创建
9. 真实 Live2D 模型文件（星尘狐）需导入替换占位 Sprite

---

## 下一步建议

1. **立即**: 在 Unity Editor Play Mode 中验证透明窗口效果
2. **短期**: 下载 Vosk 中文模型，配置 API keys，端到端测试
3. **中期**: 导入真实 Live2D 模型，替换占位音效为真实音频
4. **长期**: Steam 发布准备，性能优化，多语言支持
