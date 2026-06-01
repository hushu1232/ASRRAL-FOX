# Phase 7 实现文档 — 音效系统与粒子特效

> 日期：2026-05-23
> 实现：Claude Code
> 状态：代码完成，待运行测试

---

## 技术思路简述

Phase 7 实现了交互音效反馈和视觉粒子特效：

### 音效系统
- 14 种预定义声音事件（情绪语音 + 交互 SFX + UI 提示音）
- 3 个独立 AudioSource（SFX / Voice / UI），可分路由至 Audio Mixer
- 程序化生成占位音效（正弦波/方波/三角波 + 噪声）
- 每次播放有随机音高变化和冷却时间防止重复触发

### 粒子特效
- 尾巴星光粒子系统（星尘拖尾效果）
- 粒子发射速率随情绪和尾巴运动速度变化
- 粒子颜色随情绪变化（开心→金色，平静→橙色，难过→蓝色）
- 自动配置粒子系统参数（生命周期、大小、噪声等）

---

## 新增文件

### 1. SoundEffectManager.cs
**路径**: `Assets/Scripts/Runtime/Audio/SoundEffectManager.cs`

**职责**: 管理所有交互音效和情绪语音片段

**声音事件定义**:
| 事件 | 类别 | 说明 |
|------|------|------|
| VoiceHappy | Voice | 开心时的语气声 |
| VoiceSad | Voice | 难过时的语气声 |
| VoiceShy | Voice | 害羞时的语气声 |
| VoiceAngry | Voice | 生气时的语气声 |
| VoiceCurious | Voice | 好奇时的语气声 |
| PatHead | SFX | 摸头音效 |
| DragStart | SFX | 开始拖拽 |
| DragEnd | SFX | 拖拽结束 |
| WakeUp | SFX | 唤醒提示音 |
| Sleep | SFX | 入睡音效 |
| Feed | SFX | 喂食音效 |
| Bounce | SFX | 弹跳音效 |
| Land | SFX | 落地音效 |
| Notification | UI | 通知提示 |
| Reminder | UI | 提醒铃音 |

**关键特性**:
- 3 个独立 AudioSource 对应 3 个 Audio Mixer 分组
- 程序化生成占位音效（正弦波/方波/三角波 + 噪声包络）
- 音高随机变化 ±5-15% 让重复播放更自然
- 每个事件 0.5s 冷却时间防止声音重叠/刷屏
- `PlayEmotionVoice()` 方法根据当前情绪自动选择语音

### 2. TailParticleEffect.cs
**路径**: `Assets/Scripts/Runtime/VFX/TailParticleEffect.cs`

**职责**: 尾巴星光粒子拖尾特效

**关键特性**:
- 粒子发射率 = 基础速率(10/s) + 尾巴运动速度 + 情绪加成
- 开心时发射率最高（基础 × 心情加成），难过时减少
- 粒子颜色随情绪变化：开心→金色，平静→暖橙，难过→蓝紫，生气→红色
- 自动配置粒子系统（球体发射、渐变消失、噪声场）
- `Burst()` 方法支持交互瞬间爆发粒子

---

## 修改文件

### FoxAnimationController.cs
- 添加 `_sfx` 引用
- `OnDragStart()` 播放 `DragStart` 音效
- `OnDragEnd()` 播放 `DragEnd` 音效
- `OnWakeWord()` 播放 `WakeUp` 音效

### FoxInteraction.cs
- 添加 `_sfx` 引用
- `OnFoxClicked()` 播放 `PatHead` 音效

### AstralFoxSceneSetup.cs
- 添加 `SoundEffectManager` 组件到 root
- 添加 `ParticleSystem` + `ParticleSystemRenderer` + `TailParticleEffect` 到 FoxPlaceholder
- 添加 using 语句: `AstralFox.Audio`, `AstralFox.VFX`
- 更新调试输出日志

---

## 音效替换指南

当前使用程序化生成的占位音效。要替换为真实音效：

1. 准备音频文件（建议格式: WAV 44.1kHz mono/stereo）
2. 放入 `Assets/Audio/` 目录
3. 在 SoundEffectManager 的 Inspector 中：
   - 展开 Sound Definitions 列表
   - 为每个 SoundEvent 拖入对应的 AudioClip
   - 调整 Volume、Pitch、Pitch Variation
4. 设置 `Use Generated Placeholders = false`

推荐免费音效资源：
- freesound.org
- zapsplat.com
- mixkit.co/free-sound-effects

---

## Unity 配置步骤

1. 运行 `AstralFox > Setup Desktop Pet Scene` 一键配置

2. 配置 Audio Mixer（可选，用于高级音频控制）:
   - 创建 Audio Mixer: Assets → Create → Audio Mixer
   - 创建 3 个子组: SFX, Voice, UI
   - 将 AudioMixer 拖入 SoundEffectManager 的 Inspector

3. 配置粒子系统（自动配置已就位）:
   - 如需自定义，调整 TailParticleEffect 的 Inspector 参数
   - Base Emission Rate: 10 (基础粒子数/秒)
   - Max Emission Rate: 30 (最大粒子数/秒)

---

## 测试要点

| 测试项 | 方法 | 预期结果 |
|--------|------|----------|
| 点击音效 | 点击狐狸身体 | 听到"啪嗒"短音效 |
| 拖拽音效 | 拖拽狐狸 | 开始/结束各播放一次 |
| 唤醒音效 | 按 F12 或说唤醒词 | 听到叮咚提示音 |
| 情绪语音 | 切换情绪后 | 播放对应声音（开心=高音, 难过=低音） |
| 粒子颜色 | 触发不同情绪 | 金色↔橙色↔蓝紫色切换 |
| 粒子数量 | 观察尾巴区域 | 随情绪和运动变化 |
| 无 Audio Mixer 时 | 删除 Mixer 引用 | 音效正常播放，直接输出 |

---

## 资产依赖

Phase 7 只使用 Unity 内置组件，无外部依赖：
- `AudioSource` (built-in)
- `ParticleSystem` (built-in)
- `ParticleSystemRenderer` (built-in)

所有音效在运行时程序化生成（AudioClip.Create），无需导入外部音频文件。
