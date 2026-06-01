# Phase 5 实现文档 — 口型同步与打断机制

> 日期：2026-05-23
> 实现：Claude Code
> 状态：代码完成，待运行测试

---

## 技术思路简述

Phase 5 实现三个核心功能：
1. **TTS 流式播放** — 接收后端 PCM16 音频块，通过 Unity AudioSource 播放
2. **口型同步** — 根据音频振幅驱动 Live2D `ParamMouthOpenY`
3. **打断机制** — TTS 播放期间检测用户语音，超过阈值则中断播放并开始倾听

### 音频播放架构

```
BackendClient.OnTTSAudio (byte[] PCM16)
  → VoiceManager.OnTTSAudioChunk()
    → TTSPlayer.AddPCMChunk()
      → 转换为 float[] 样本
      → 累积到缓冲区
      → 达到最小块时长 (0.3s) 后开始流式播放
        → AudioClip.Create() + PlayScheduled()
        → AudioSource 播放

BackendClient.OnTTSDone
  → VoiceManager.OnBackendTTSDone()
    → TTSPlayer.OnTTSDataComplete()
      → 播放剩余音频
      → 全部播完后触发 OnPlaybackComplete
        → VoiceManager → Idle
```

### 口型同步

```
TTSPlayer (AudioSource)
  → LipSync.Update()
    → AudioSource.GetOutputData() → 计算 RMS 振幅
    → 噪声门过滤 (0.01 阈值)
    → 灵敏度曲线映射
    → 非对称平滑 (快速开口 0.04s, 慢速闭口 0.08s)
    → 抖动添加 (Perlin noise)
    → FoxAnimationController.SetMouthOpen()
      → CubismParameterDriver.SetParameter("ParamMouthOpenY")
```

### 打断机制

```
Speaking 状态时:
  → MicrophoneCapture.CurrentLevel 持续监测
  → 冷却期 1s (防止刚说完就打断自己)
  → 麦克风电平 > 阈值 0.05 持续 0.2s
  → 触发打断: TTSPlayer.StopImmediate()
  → 回到 Listening 状态
```

---

## 新增文件

### 1. TTSPlayer.cs

**路径**: `Assets/Scripts/Runtime/Voice/TTSPlayer.cs`

**职责**: 接收 PCM16 流式 TTS 音频，通过 AudioSource 播放

**关键特性**:
- 自动累积音频块，达到 0.3s 后开始流式播放
- 使用 `AudioSettings.dspTime` + `PlayScheduled()` 无缝拼接音频块
- 支持中途打断 (`StopImmediate()`)
- 通过 `GetOutputData()` 提供实时振幅用于口型同步
- `PlaybackProgress` 属性追踪播放进度
- 事件: `OnPlaybackStarted`, `OnPlaybackComplete`, `OnAudioChunkPlayed`

### 2. LipSync.cs

**路径**: `Assets/Scripts/Runtime/Voice/LipSync.cs`

**职责**: 将音频振幅映射为 Live2D 口型参数

**关键特性**:
- 从 AudioSource.GetOutputData() 获取实时振幅
- 可配置的 `AnimationCurve` 映射振幅到口型
- 非对称平滑时间（快开 0.04s / 慢闭 0.08s），模拟真实说话
- 噪声门过滤低音量噪声
- Perlin 噪声抖动，让口型更自然
- 口型目标在 0-1 范围（对应 ParamMouthOpenY）

---

## 修改文件

### VoiceManager.cs

**修改内容**:
1. 添加 `[RequireComponent(typeof(TTSPlayer))]`
2. 新增 Inspector 字段: `_interruptMicThreshold`, `_interruptHoldTime`, `_interruptCooldown`
3. 新增字段: `_ttsPlayer`, `_interruptTimer`, `_interruptCooldownTimer`
4. 新增方法:
   - `OnTTSAudioChunk(int, byte[])` — 接收 TTS 音频块
   - `OnTTSPlaybackComplete()` — TTS 播放完成回调
   - `UpdateInterruptDetection()` — 打断检测逻辑
   - `DoInterrupt()` — 执行打断
5. 修改 `OnBackendLLMResponse` — 不再直接进入 Speaking，等待 TTS 音频到达
6. 修改 Speaking 状态 mic 监测 — 调用 `UpdateInterruptDetection()`
7. 更新 `OnDestroy` — 添加 `_ttsPlayer.OnPlaybackComplete` 取消订阅

### AstralFoxSceneSetup.cs

**修改内容**:
1. 场景搭建时添加 `AudioSource` 组件（设置 2D 音频参数）
2. 场景搭建时添加 `TTSPlayer` 组件
3. 场景搭建时添加 `LipSync` 组件
4. 更新调试日志输出

---

## 数据流路径

```
Phase 5 完整路径:

User speaks → Microphone → VAD → WakeWord → BackendClient (audio stream)
  → FastAPI BFF (ASR → LLM → TTS)
  → BackendClient (TTS PCM16 chunks)
  → VoiceManager.OnTTSAudioChunk
  → TTSPlayer.AddPCMChunk
  → AudioSource.PlayScheduled (streaming)
  → LipSync.Update (amplitude → mouth open)
  → FoxAnimationController.SetMouthOpen
  → IFoxParameterDriver → ParamMouthOpenY

Interrupt:
  Mic → MicrophoneCapture.CurrentLevel → VoiceManager.UpdateInterruptDetection
  → TTSPlayer.StopImmediate → LipSync.ResetMouth → State → Listening
```

---

## Unity 配置步骤

1. 确保 `AstralFoxRoot` 上有 `AudioSource` 组件:
   - Play On Awake: false
   - Loop: false
   - Spatial Blend: 0 (2D)
   - Bypass Effects: true

2. 运行 `AstralFox > Setup Desktop Pet Scene` 一键配置所有组件

3. TTSPlayer 配置:
   - Sample Rate: 16000
   - Min Chunk Duration: 0.3 (累积 0.3s 音频后开始播放)
   - Volume: 1.0

4. LipSync 配置:
   - Amplitude To Mouth Curve: Linear (可替换为自定义曲线)
   - Sensitivity: 1.5
   - Smooth Up Time: 0.04
   - Smooth Down Time: 0.08
   - Noise Gate: 0.01

5. VoiceManager 打断配置:
   - Interrupt Mic Threshold: 0.05
   - Interrupt Hold Time: 0.2
   - Interrupt Cooldown: 1.0

---

## 测试要点

| 测试项 | 方法 | 预期结果 |
|--------|------|----------|
| TTS 流式播放 | 模拟后端发送 TTS 音频 | AudioSource 播放，无卡顿 |
| 口型同步 | 播放 TTS 音频时观察 mouthOpen 值 | 振幅 → 口型映射流畅 |
| 打断 | TTS 播放时说话 | TTS 停止，切到 Listening |
| 打断冷却 | TTS 开始后 1s 内说话 | 不触发打断 |
| 噪声门 | 环境安静时 | 口型为 0 |
| 播放完成 | TTS 播完 | 切到 Idle 状态 |
