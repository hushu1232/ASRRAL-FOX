# Unity-AIChat 可参考点整合 — 星尘狐任务文档

> 分析日期：2026-05-30 | 来源：Unity-AIChat Toolkit (gitee.com/JerrryWong/unity-AI-Chat-Toolkit)
> 覆盖范围：38 个 C# 源文件完整解析

---

## 1. 总评

| 维度 | 评分 | 可借鉴程度 |
|------|------|-----------|
| 架构设计（策略模式插件化） | 8/10 | 🔥 高 — 直接参考 |
| LLM/TTS/STT 抽象基类 | 7/10 | 🔥 高 — 参考后改进 |
| Unity Inspector 配置流 | 6/10 | 🟡 中 — 部分参考 |
| 打字机效果 (typewriter) | 5/10 | 🟢 直接复用 |
| 表现力（动画/音效/物理/UI） | 2/10 | ❌ 不参考 |

---

## 2. 🔥 高优先级：策略模式插件架构

### 2.1 当前 AstralFox 的问题

AstralFox 的 Unity 客户端中，LLM/TTS/STT 通过 Next.js BFF 中转，Unity 端通过 REST + WebSocket 通信。当前可能存在：
- LLM/TTS/STT 实现与具体服务强耦合
- 切换 AI 引擎需要修改多处代码
- 缺少统一的抽象接口

### 2.2 Unity-AIChat 的做法

```
LLM (抽象类 MonoBehaviour)
├── PostMsg(string, Action<string>)    // 发送消息，回调返回文本
├── Request(string, Action<string>)    // HTTP 请求协程 (virtual, 子类重写)
└── CheckHistory()                     // 自动裁剪历史长度

TTS (抽象类 MonoBehaviour)
├── Speak(string, Action<AudioClip>)             // 合成语音
└── Speak(string, Action<AudioClip, string>)     // 合成语音 + 文本

STT (抽象类 MonoBehaviour)
├── SpeechToText(AudioClip, Action<string>)      // 音频 → 文本
└── SpeechToText(byte[], Action<string>)         // 字节 → 文本
```

配置方式：
```csharp
// ChatSetting.cs — ScriptableObject 松耦合配置
[Serializable]
public class ChatSetting {
    public LLM m_ChatModel;        // Inspector 拖入任意 LLM 实现
    public TTS m_TextToSpeech;     // Inspector 拖入任意 TTS 实现
    public STT m_SpeechToText;     // Inspector 拖入任意 STT 实现
}
```

### 2.3 建议：为 AstralFox Unity 客户端创建抽象层

**创建文件：** `Assets/Scripts/Core/AIServiceProvider.cs`

```csharp
// 统一的 AI 服务抽象 — 支持本地引擎 (LLMUnity/FunASR/sherpa-onnx) 和远端 API
public abstract class AIServiceProvider : MonoBehaviour
{
    // --- LLM ---
    public abstract void Chat(string message, Action<string> onResponse, Action<string> onError);
    
    // --- TTS ---
    public abstract void Synthesize(string text, Action<AudioClip> onComplete, Action<string> onError);
    
    // --- STT ---
    public abstract void Recognize(AudioClip audio, Action<string> onResult, Action<string> onError);
}
```

```
AIServiceProvider (抽象)
├── LocalAIProvider         ← LLMUnity + FunASR + sherpa-onnx (当前方案)
├── RemoteAIProvider        ← 通过 BFF HTTP API (备用/调试)
├── OllamaProvider          ← 直接 HTTP 到 Ollama (第三方)
└── MockAIProvider          ← 测试用
```

**任务清单：**
- [ ] 创建 `AIServiceProvider.cs` 抽象基类
- [ ] 重构现有 LLM/TTS/STT 调用为 `LocalAIProvider` 实现
- [ ] 创建 `RemoteAIProvider` 通过 BFF API 通信
- [ ] 创建 `AIServiceConfig` ScriptableObject 集中管理配置
- [ ] Inspector 可拖拽切换实现

---

## 3. 🟡 中优先级：Unity Inspector 配置流

### 3.1 当前问题

AstralFox 的 AI 服务配置分散在：
- Web 管理后台 (petService.ts / Prisma)
- Unity 客户端的硬编码或 JSON 配置
- 环境变量 (.env)

缺少 Unity Inspector 层面的可视化配置。

### 3.2 Unity-AIChat 的做法

每种 LLM 实现的参数直接在 Inspector 中暴露：
```csharp
public class ChatOllama : LLM {
    [Header("AI 设定")] public string m_SystemSetting;
    [Header("选择模型")] public ModelType m_GptModel;  // 枚举下拉
}

public class GPTSoVITSTextToSpeech : TTS {
    [Header("参考音频")] public AudioClip m_ReferenceClip;
    [Header("参考文本")] public string m_ReferenceText;
    [Header("语言")] public Language m_ReferenceTextLan;   // 枚举下拉
    [SerializeField] private float m_Temperature = 1;
}
```

### 3.3 建议：为 AstralFox 创建 AI 配置 ScriptableObject

**创建文件：** `Assets/Settings/AIConfig.asset`

```csharp
[CreateAssetMenu(menuName = "AstralFox/AI Configuration")]
public class AIConfig : ScriptableObject
{
    [Header("LLM")]
    public LLMProvider llmProvider = LLMProvider.Local;
    public string ollamaUrl = "http://localhost:11434";
    public string ollamaModel = "qwen2.5:7b";
    
    [Header("TTS")]
    public TTSProvider ttsProvider = TTSProvider.Local;
    public string sovitsUrl = "http://localhost:9880";
    public AudioClip referenceClip;  // 声音克隆参考音频
    public string referenceText;     // 参考文本
    
    [Header("STT")]
    public STTProvider sttProvider = STTProvider.Local;
    public string whisperUrl = "http://localhost:9000";
    
    [Header("Voice Wake")]
    public bool enableWakeWord = true;
    public string wakeWord = "小星";
    
    public enum LLMProvider { Local, Ollama, BFF }
    public enum TTSProvider { Local, SoVITS, BFF }
    public enum STTProvider { Local, Whisper, BFF }
}
```

**任务清单：**
- [ ] 创建 `AIConfig.cs` ScriptableObject
- [ ] 在 Unity Editor 中创建 `AIConfig.asset` 实例
- [ ] 重构 `LocalAIProvider` 读取 AIConfig 配置
- [ ] 在 Web 管理后台同步显示当前 AI 配置状态

---

## 4. 🟢 直接复用：打字机效果

### 4.1 源码（Unity-AIChat ChatSample.cs）

```csharp
[SerializeField] private float m_WordWaitTime = 0.2f;
[SerializeField] private bool m_WriteState = false;

private IEnumerator SetTextPerWord(string _msg) {
    int currentPos = 0;
    while (m_WriteState) {
        yield return new WaitForSeconds(m_WordWaitTime);
        currentPos++;
        m_TextBack.text = _msg.Substring(0, currentPos);
        m_WriteState = currentPos < _msg.Length;
    }
    SetAnimator("state", 0); // 回到 idle
}
```

### 4.2 移植到 AstralFox

**创建文件：** `Assets/Scripts/UI/TypewriterEffect.cs`

```csharp
using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

public class TypewriterEffect : MonoBehaviour
{
    [SerializeField] private float m_CharDelay = 0.05f;    // 快一些 (0.05s vs 0.2s)
    [SerializeField] private float m_PunctuationDelay = 0.15f; // 标点停顿
    
    private Coroutine m_CurrentCoroutine;

    public void Play(TMP_Text textComponent, string message) {
        if (m_CurrentCoroutine != null) StopCoroutine(m_CurrentCoroutine);
        m_CurrentCoroutine = StartCoroutine(TypeText(textComponent, message));
    }

    public void Skip(TMP_Text textComponent, string message) {
        if (m_CurrentCoroutine != null) StopCoroutine(m_CurrentCoroutine);
        textComponent.text = message;
    }

    private IEnumerator TypeText(TMP_Text textComponent, string message) {
        textComponent.text = "";
        for (int i = 0; i < message.Length; i++) {
            textComponent.text += message[i];
            float delay = "，。！？,.!?".Contains(message[i]) ? m_PunctuationDelay : m_CharDelay;
            yield return new WaitForSeconds(delay);
        }
    }
}
```

**任务清单：**
- [ ] 创建 `TypewriterEffect.cs`
- [ ] 集成到对话气泡 UI（LLM 回复时触发）
- [ ] 支持点击跳过（直接显示全文）
- [ ] 在 TTS 播放时同步高亮当前朗读文字

---

## 5. 🟡 参考后改进：口型同步

### 5.1 当前 AstralFox 状态

Live2D Cubism SDK 支持通过参数驱动口型（`ParamMouthOpenY`），但当前可能仅使用简单的响度映射。

### 5.2 Unity-AIChat 的做法

```csharp
// AudioMouthController.cs — 响度驱动 BlendShape
void Update() {
    float amplitude = GetAmplitude(); // 512 样本 RMS
    blendWeight = Mathf.SmoothDamp(blendWeight, amplitude * 100f, ...);
    meshRenderer.SetBlendShapeWeight(index, blendWeight);
}
```

### 5.3 建议：升级为音素级别

```csharp
// 伪代码：将 TTS 输出的音素时间戳映射到 Live2D 参数
public class LipSyncController : MonoBehaviour {
    public void PlayWithLipSync(AudioClip clip, PhonemeTiming[] phonemes) {
        // phonemes: [{phoneme: "a", start: 0.1, end: 0.3}, ...]
        // 映射到 Live2D ParamMouthOpenY + ParamMouthForm
    }
}
```

**任务清单：**
- [ ] 研究 sherpa-onnx 是否输出音素时间戳
- [ ] 如果是，实现音素→Live2D 口型映射
- [ ] 如果否，升级响度驱动（增加平滑度 + 多频率段分析）

---

## 6. 🟡 参考后改进：按压录音 UI

### 6.1 Unity-AIChat 的做法

```csharp
// EventTrigger: PointerDown → 开始录音, PointerUp → 停止识别
_pointDown_entry.callback.AddListener(delegate { StartRecord(); });
_pointUp_entry.callback.AddListener(delegate { StopRecord(); });

void StartRecord() { m_VoiceInputs.StartRecordAudio(); }
void StopRecord() { m_VoiceInputs.StopRecordAudio(AcceptClip); }
void AcceptClip(AudioClip clip) { m_ChatSettings.m_SpeechToText.SpeechToText(clip, callback); }
```

### 6.2 移植到 AstralFox

**任务清单：**
- [ ] Unity 客户端添加"按住说话"按钮（桌面浮窗）
- [ ] 按钮状态：待机 → 录音中（波形动画）→ 识别中（旋转动画）→ 发送
- [ ] 支持键盘快捷键激活录音（如 `Ctrl+Space`）
- [ ] Web 端同步显示语音状态

---

## 7. ❌ 不参考：表现力层

| 维度 | Unity-AIChat | AstralFox 当前 | 差距 |
|------|-------------|---------------|------|
| 透明窗口 | ❌ 标准窗口 | Live2D 透明桌面 | 我们领先 |
| 角色渲染 | 3D SkinnedMesh | Live2D Cubism SDK | 不同技术栈 |
| 情绪表达 | ❌ 无 | ✅ Live2D 参数系统 | 我们领先 |
| 待机动画 | ❌ 完全静止 | (待确认) | — |
| 鼠标交互 | ❌ 无 | (待确认) | — |
| UI 风格 | Unity UGUI | Web 管理后台 | 不同平台 |

**决定：表现力层不从 Unity-AIChat 借鉴任何内容。**

---

## 8. 实施优先级总结

| 优先级 | 任务 | 预估工时 | 依赖 |
|--------|------|---------|------|
| P0 | 创建 `AIServiceProvider` 抽象基类 | 1d | 无 |
| P0 | 创建 `AIConfig` ScriptableObject | 0.5d | 无 |
| P1 | 移植打字机效果 `TypewriterEffect.cs` | 0.3d | 无 |
| P1 | 重构 LLM/TTS/STT 为 `LocalAIProvider` | 2d | AIServiceProvider |
| P2 | 升级口型同步（响度→音素） | 1.5d | 需要研究 sherpa-onnx API |
| P2 | 按压录音 UI (桌面浮窗) | 1d | AIServiceProvider |
| P3 | `RemoteAIProvider` (BFF HTTP) | 1d | AIServiceProvider |

**总预估：约 6 天**

---

## 9. 文件清单

```
Assets/Scripts/Core/
├── AIServiceProvider.cs        # 抽象基类 (新建)
├── LocalAIProvider.cs          # 本地引擎实现 (新建)
├── RemoteAIProvider.cs         # BFF HTTP 实现 (新建)
└── MockAIProvider.cs           # 测试桩 (新建)

Assets/Settings/
└── AIConfig.cs                 # ScriptableObject 配置 (新建)

Assets/Scripts/UI/
└── TypewriterEffect.cs         # 打字机效果 (移植)

Assets/Scripts/LipSync/
└── LipSyncController.cs        # 音素口型同步 (改进)
```
