# AstralFox 星尘狐 — 工程项目图

## 架构总览

```
┌─────────────────────────────────┐
│        Unity (Tuanjie 1.6)      │
│                                 │
│  ┌──────────┐  ┌─────────────┐  │
│  │ Live2D   │  │ Voice        │  │
│  │ Cubism   │  │ Pipeline     │  │
│  │ SDK 5.3  │  │ (mic→BFF→   │  │
│  │          │  │  TTS→spkr)  │  │
│  └────┬─────┘  └──────┬──────┘  │
│       │               │         │
│  ┌────┴───────────────┴──────┐  │
│  │   PetAnimationManager     │  │
│  │   (state machine bridge)  │  │
│  └────────────┬──────────────┘  │
│               │                 │
│  ┌────────────┴──────────────┐  │
│  │   FoxSimpleMovement       │  │
│  │   (desktop roaming)       │  │
│  └───────────────────────────┘  │
│                                 │
│  Render Pipeline: Built-in RP   │
│  Shaders: CGPROGRAM (converted) │
└────────────┬────────────────────┘
             │ WebSocket (ws://localhost:8765)
┌────────────┴────────────────────┐
│        Python BFF (FastAPI)     │
│  - ASR: Azure / mock            │
│  - LLM: OpenAI / mock           │
│  - TTS: edge-tts / Azure        │
└─────────────────────────────────┘
```

## 渲染管线 (关键修复)

```
Editor Setup                  Play Mode
─────────────                ──────────
CubismRenderController       CubismRenderer
.OnEnable()                  .TryInitializeMeshRenderer()
  │                            │
  ├─ SetupPickingMaterial()    ├─ [NonSerialized] _isInitialized
  │   材质→TransparentPicking  │   = false → 执行初始化
  │   (ColorMask 0)            │
  │                            └─ SetMaterialFromPicker()
  └─ TryInitialize()               材质→CompatibleBlend
       _isInitialized=true         (CGPROGRAM, 直接声明)

Shader 转换: HLSLPROGRAM + CBUFFER + URP Core.hlsl
                    ↓
            CGPROGRAM + 直接声明 + UnityCG.cginc
```

## 语音管线

```
F12/语音唤醒词
      │
      ▼
WakeWordDetector ──→ VoiceManager
                        │
                  State: Idle → Listening
                        │
                        ▼
                  MicrophoneCapture
                  (16000Hz mono)
                        │
                  VAD检测到语音
                        │
                  State: Recording
                        │
                  max duration / silence
                        │
                  State: Processing
                        │
                  ▼
              BackendClient
           ws://localhost:8765
                  │
                  ▼
              Python BFF
           main.py /ws/chat
        ┌─────────┼─────────┐
        ▼         ▼         ▼
      ASR       LLM       TTS
   (mock/     (mock/   (edge-tts/
    azure)    openai)   azure)
        └─────────┼─────────┘
                  │
                  ▼
         Response JSON
    {text, audio_chunks[]}
                  │
                  ▼
              TTSPlayer
         AudioClip.Create()
         AudioSource.Play()
                  │
                  ▼
         State: Speaking → Idle
```

## 项目文件结构

```
桌宠demo/
├── AstralFox/                          # Unity 项目
│   ├── Assets/
│   │   ├── Live2D/
│   │   │   ├── Cubism/                # Cubism SDK 5.3
│   │   │   │   └── Rendering/
│   │   │   │       ├── CubismRenderer.cs          [修改] SetMaterialFromPicker 强制替换
│   │   │   │       ├── CubismRenderController.cs  [修改] [NonSerialized] _isInitialized
│   │   │   │       ├── CubismCompatStubs.cs       [修改] 警告抑制
│   │   │   │       └── Resources/Live2D/Cubism/Shaders/
│   │   │   │           ├── Mask.shader            (CGPROGRAM, Built-in 兼容)
│   │   │   │           ├── CubismCG.cginc         (公共头文件)
│   │   │   │           └── BlendMode/
│   │   │   │               ├── CompatibleBlend.shader   [转换] CGPROGRAM
│   │   │   │               ├── BlendImage.shader       [转换] CGPROGRAM
│   │   │   │               ├── Blit.shader             [转换] CGPROGRAM
│   │   │   │               ├── OffscreenBlend.shader   [转换] CGPROGRAM
│   │   │   │               ├── OffscreenCompatibleBlend.shader [转换]
│   │   │   │               ├── OffscreenMask.shader    [转换] CGPROGRAM
│   │   │   │               ├── AlphaBlendVariants.cginc
│   │   │   │               ├── ColorBlendVariants.cginc
│   │   │   │               └── CubismVariants.cginc
│   │   │   └── Models/
│   │   │       ├── CatTail/cattail.prefab      # 猫尾模型 ★推荐桌宠
│   │   │       ├── AzurLane/                   # 舰娘模型 (不适合桌宠)
│   │   │       └── GirlsFrontline/             # 人形模型 (不适合桌宠)
│   │   ├── Scripts/
│   │   │   ├── Runtime/
│   │   │   │   ├── DesktopCameraSetup.cs      [修改] URP 反射安全访问
│   │   │   │   ├── TransparentWindow.cs        [修改] #else 修复
│   │   │   │   ├── FoxSimpleMovement.cs        [修改] 桌面漫游系统
│   │   │   │   ├── FoxInteraction.cs
│   │   │   │   ├── AppLifecycle.cs
│   │   │   │   ├── Diagnostics/
│   │   │   │   │   ├── ModelVisibilityDebug.cs  [新增] 渲染/音频诊断
│   │   │   │   │   ├── DebugOverlay.cs
│   │   │   │   │   └── BuildDiagnostics.cs
│   │   │   │   ├── Animation/
│   │   │   │   │   ├── Live2DAnimator.cs        [新增] Live2D 适配器
│   │   │   │   │   ├── PetAnimationManager.cs   [新增] 动画状态管理
│   │   │   │   │   ├── IPetAnimator.cs          [新增] 动画接口
│   │   │   │   │   ├── FoxAnimationController.cs
│   │   │   │   │   ├── FoxEmotionController.cs
│   │   │   │   │   ├── CubismParameterDriver.cs
│   │   │   │   │   ├── FoxParamId.cs
│   │   │   │   │   └── PADEmotionEngine.cs
│   │   │   │   ├── Voice/
│   │   │   │   │   ├── VoiceManager.cs          [修改] 语音管线主控
│   │   │   │   │   ├── MicrophoneCapture.cs     [修改] 麦克风采集
│   │   │   │   │   ├── BackendClient.cs         [修改] WebSocket + ConcurrentQueue
│   │   │   │   │   ├── TTSPlayer.cs             [修改] PCM16→AudioClip
│   │   │   │   │   ├── WakeWordDetector.cs      [修改] 静音抑制
│   │   │   │   │   ├── VoiceActivityDetector.cs
│   │   │   │   │   ├── LipSync.cs
│   │   │   │   │   └── MockVoicePipeline.cs
│   │   │   │   ├── Config/
│   │   │   │   │   ├── ConfigManager.cs
│   │   │   │   │   ├── AppConfig.cs
│   │   │   │   │   ├── CommandLineArgs.cs
│   │   │   │   │   ├── GlobalHotkeyManager.cs
│   │   │   │   │   ├── SettingsWebServer.cs
│   │   │   │   │   ├── TrayIconManager.cs
│   │   │   │   │   └── PetApiClient.cs          [新增]
│   │   │   │   ├── Audio/
│   │   │   │   │   └── SoundEffectManager.cs
│   │   │   │   ├── VFX/
│   │   │   │   │   └── TailParticleEffect.cs
│   │   │   │   ├── Data/
│   │   │   │   │   └── DataStore.cs
│   │   │   │   └── NativeWindowInterop.cs       [新增]
│   │   │   └── Editor/
│   │   │       ├── AstralFoxSceneSetup.cs       [修改] 反射URP+方向光
│   │   │       ├── AstralFoxSettingsWindow.cs
│   │   │       ├── AstralFoxTestRunner.cs
│   │   │       ├── BatchBuild.cs
│   │   │       ├── Animation/
│   │   │       │   └── FoxAnimatorSetup.cs
│   │   │       ├── Voice/
│   │   │       │   └── VoiceManagerTestSetup.cs  [新增] E2E测试场景
│   │   │       └── CatTailImporterSetup.cs       [新增]
│   │   ├── Animations/
│   │   │   └── AstralFox_DefaultPose.anim
│   │   ├── Resources/
│   │   │   └── FoxAnimator.controller
│   │   ├── Scenes/
│   │   │   ├── SampleScene.scene
│   │   │   └── VoiceE2ETestScene.unity          [新增]
│   │   ├── Plugins/
│   │   ├── Settings/                            (旧URP配置,保留)
│   │   └── StreamingAssets/
│   │       ├── settings.html
│   │       └── Models/
│   ├── ProjectSettings/
│   │   ├── GraphicsSettings.asset               [修改] URP关闭
│   │   ├── AudioManager.asset                   [修改]
│   │   └── ...
│   └── Packages/
│       └── manifest.json                        (URP 14.1.0 已安装)
├── backend/                                     # Python BFF
│   ├── main.py                                  [修改] WebSocket /ws/chat
│   ├── config.py                                [修改] 多后端配置
│   ├── tts.py                                   [修改] edge-tts集成
│   ├── llm.py                                   [修改] 多LLM后端
│   └── .env.example
├── devlog/                                      # 开发日志
│   ├── fix-20260525-urp-audio.md               # URP修复日志
│   ├── project-structure.md                    # 本文档
│   ├── project-status-20260525.md              # 完成度状态
│   └── ...
└── avatar-web-management/                       # Web管理端 (Phase 1)
```

## 关键技术决策

| 决策 | 原因 |
|------|------|
| URP→Built-in RP | Cubism URP shader 被 `UNITY_6000` 条件编译屏蔽 |
| HLSL→CG shader 转换 | CBUFFER 在 Built-in RP 下材质属性不绑定 (=全零=透明) |
| [NonSerialized] _isInitialized | Editor 序列化导致 Play Mode 跳过初始化 |
| ConcurrentQueue 消息分发 | WebSocket 回调在非主线程，Unity API 只能在主线程调用 |
| edge-tts (免费) | 无需 API Key，利用 Microsoft Edge TTS 引擎 |
| 反射访问 URP API | Built-in RP 下 URP 类型不存在，避免编译错误 |
