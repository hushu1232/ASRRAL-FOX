# AstralFox 性能优化任务书

> 基准: 瓶颈分析报告 (2026-06-07)
> 项目: 桌宠demo/新建文件夹/AstralFox (Unity 6000.4.10f1, URP)
> 目标: 三阶段消除已知性能热点，预计降低 CPU 开销 40-60%

---

## Phase 1 — 立即修复（ROI 最高）

### 任务 1.1: CubismRenderer 改用 sharedMaterial (恢复合批)

| 属性 | 内容 |
|------|------|
| **文件** | `Assets/Live2D/Cubism/Rendering/CubismRenderer.cs` |
| **位置** | 行 252-271 (Material getter/setter) |
| **严重度** | 🔴 HIGH — 阻止所有 Dynamic Batching |
| **工时** | 15 min |

**问题**: `MeshRenderer.material` 为每个 Drawable 创建独立材质实例。236 个 Drawables = 236 个无法合批的 draw calls。

**修复**:

```csharp
// ── 行 252-257: Material getter ──
// 原代码:
if (!MeshRenderer.material)
    MeshRenderer.material = SetMaterialFromPicker();
return MeshRenderer.material;

// 修复为:
if (!MeshRenderer.sharedMaterial)
    MeshRenderer.sharedMaterial = SetMaterialFromPicker();
return MeshRenderer.sharedMaterial;
```

```csharp
// ── 行 259-271: Material setter ──
// 原代码:
MeshRenderer.material = value;

// 修复为 (Editor 模式下保持原样以便调试):
#if UNITY_EDITOR
    MeshRenderer.material = value;
#else
    MeshRenderer.sharedMaterial = value;
#endif
```

**同时核实**: 所有 `MeshRenderer.material` 引用（不含 `s`）都应改为 `sharedMaterial`。搜索命令:
```bash
grep -rn "MeshRenderer.material[^s]" CubismRenderer.cs | grep -v "sharedMaterial"
```

**验收**: Play Mode 下检查 Frame Debugger，相同材质的 Drawable 应被合批。

---

### 任务 1.2: CubismRenderController 构建 Lookup Table (消除 O(n²))

| 属性 | 内容 |
|------|------|
| **文件** | `Assets/Live2D/Cubism/Rendering/CubismRenderController.cs` |
| **位置** | 行 928, 1022, 1046 (3 处 `Array.FindIndex`) |
| **严重度** | 🔴 HIGH — 每帧 180 次线性搜索 + 180 次 delegate 分配 |
| **工时** | 30 min |

**问题**: `OnDynamicDrawableData()` 中三个独立循环各调用一次 `Array.FindIndex(renderers, lambda)`。60 Drawables = 60×3=180 次 O(n) 搜索 + 180 个 Predicate 闭包分配。

**修复方案**:

在 `OnDynamicDrawableData()` 开头（或 Renderers 数组变化时）构建一次性查找表:

```csharp
// 在类顶部添加缓存字段:
private int[] _unmanagedIndexToRendererIndex;
private int _lastRendererCount = -1;

// 在 OnDynamicDrawableData 开头添加:
private void RebuildLookupIfNeeded()
{
    if (_lastRendererCount == Renderers.Length && _unmanagedIndexToRendererIndex != null)
        return;

    int maxIndex = 0;
    foreach (var r in Renderers)
    {
        if (r?.Drawable?.UnmanagedIndex > maxIndex)
            maxIndex = r.Drawable.UnmanagedIndex;
    }

    _unmanagedIndexToRendererIndex = new int[maxIndex + 1];
    for (int i = 0; i < _unmanagedIndexToRendererIndex.Length; i++)
        _unmanagedIndexToRendererIndex[i] = -1;

    for (int i = 0; i < Renderers.Length; i++)
    {
        var idx = Renderers[i]?.Drawable?.UnmanagedIndex ?? -1;
        if (idx >= 0) _unmanagedIndexToRendererIndex[idx] = i;
    }

    _lastRendererCount = Renderers.Length;
}
```

```csharp
// 三处 Array.FindIndex 替换为:
// 原代码 (行 928):  var rendererIndex = Array.FindIndex(renderers, ...);
// 修复为:
var rendererIndex = (dataIndex < _unmanagedIndexToRendererIndex.Length)
    ? _unmanagedIndexToRendererIndex[dataIndex]
    : -1;
if (rendererIndex < 0) continue;
```

**验收**: Profiler 中 `OnDynamicDrawableData` 的 GC Alloc 应为 0，CPU 时间显著降低。

---

### 任务 1.3: CubismParameterDriver 用 Enum 索引消除字符串哈希

| 属性 | 内容 |
|------|------|
| **文件** | `Assets/Scripts/Runtime/Animation/CubismParameterDriver.cs` |
| **位置** | 行 192-247 (`SetParameter`, `SetParameterImmediate`, `GetParameter`) |
| **严重度** | 🔴 HIGH — 每帧 15-50 次 SetParameter 调用，每次 3-4 次字符串哈希 |
| **工时** | 1.5 h |

**问题**: 每次 `SetParameter(string paramId, float value)` 执行 3 次 `Dictionary<string, T>` 查找（`ContainsKey` + `TryGetValue` + `[]` 索引器）。每帧 15-50 次调用 = 每帧 45-150 次字符串哈希。

**修复方案**:

**Step 1**: 将 `FoxParamId` 转换为 enum（如果还是 const string 类）:

```csharp
// FoxParamId.cs — 已是 const string，需新增 enum
public enum FoxParam
{
    // 身体姿态
    ParamAngleX, ParamAngleY, ParamAngleZ,
    ParamBodyAngleX, ParamBodyAngleY, ParamBodyAngleZ,
    // 面部
    ParamEyeBallX, ParamEyeBallY,
    ParamEyeLOpen, ParamEyeROpen,
    ParamMouthOpenY, ParamMouthForm,
    // 耳朵
    ParamEarL, ParamEarR,
    // 尾巴
    ParamTail, ParamTailAngle,
    // 呼吸
    ParamBreath,
    // 等等...
    COUNT  // ← 自动给出数组大小
}
```

**Step 2**: 在 `CubismParameterDriver` 中添加数组缓存:

```csharp
// 替换 Dictionary<string, float>:
private float[] _paramValues = new float[(int)FoxParam.COUNT];
private float[] _paramVelocities = new float[(int)FoxParam.COUNT];

// 保留 string→enum 的逆映射表 (仅初始化时使用一次):
private static readonly Dictionary<string, FoxParam> StringToEnum = new()
{
    { FoxParamId.AngleX, FoxParam.ParamAngleX },
    { FoxParamId.EyeBallX, FoxParam.ParamEyeBallX },
    // ... 全部映射
};
```

**Step 3**: 修改 SetParameter（热路径）:

```csharp
// 原签名:  public void SetParameter(string paramId, float value)
// 新签名 (推荐):
public void SetParameter(FoxParam param, float value)
{
    if (!_isReady) return;
    int idx = (int)param;
    // 直接数组访问 — 零哈希, 零字典查找
    float current = _paramValues[idx];
    float velocity = _paramVelocities[idx];
    float smoothed = Mathf.SmoothDamp(current, value, ref velocity, _smoothTime);
    _paramVelocities[idx] = velocity;
    _paramValues[idx] = smoothed;
}

// 保留 string 重载作为兼容桥 (逐步迁移):
public void SetParameter(string paramId, float value)
{
    if (StringToEnum.TryGetValue(paramId, out var p))
        SetParameter(p, value);
}
```

**Step 4**: 批量替换调用点。涉及的调用方:

| 文件 | 每帧调用次数 |
|------|-------------|
| FoxAnimationController.cs | ~10-15 |
| FoxEmotionController.cs | ~6-8 |
| GazeTracker.cs | ~2-4 |
| Audio2Face.cs | ~2 |
| PADEmotionEngine.cs | ~2-4 |
| FoxSimpleMovement.cs | ~1-2 |

**验收**: Profiler Deep Profile 中 `SetParameter(FoxParam)` 应无任何字典分配，CPU 时间降低 60-80%。

---

### 任务 1.4: 缓存 Camera.main / FindObjectOfType 引用

| 属性 | 内容 |
|------|------|
| **文件** | 3 个文件（见下） |
| **严重度** | 🔴 HIGH — 每帧场景遍历 |
| **工时** | 20 min |

**修复清单**:

**1.4a — GazeTracker.cs (行 69-70)**

`Camera.main` 在 `UpdateGazeTarget()` 中每帧调用。内部触发 `FindGameObjectWithTag("MainCamera")`——完整场景遍历。

```csharp
// 添加字段:
private Camera _cachedCamera;

// Awake 中添加:
private void Awake()
{
    _cachedCamera = Camera.main;
}

// UpdateGazeTarget 中 (行 69):
// 原: Vector3 petScreenPos = Camera.main != null
//         ? Camera.main.WorldToScreenPoint(transform.position) : Vector3.zero;
// 改为:
Vector3 petScreenPos = _cachedCamera != null
    ? _cachedCamera.WorldToScreenPoint(transform.position)
    : Vector3.zero;
```

**1.4b — QuickModelSwitch.cs (行 76-77)**

```csharp
// 同样缓存 Camera.main 到 Awake()
```

**1.4c — FoxInteraction.cs (行 361-363)**

```csharp
// HandleHotkeys() 中每帧调用 FindObjectOfType<AppLifecycle>()
// 改为缓存:
private AppLifecycle _appLifecycle;

private void Awake()
{
    _appLifecycle = FindObjectOfType<AppLifecycle>();
}
// 热路径中使用 _appLifecycle 字段
```

**验收**: Profiler 中 `Camera.main` 和 `FindObjectOfType` 不应出现在每帧调用中。

---

## Phase 2 — 优化热路径

### 任务 2.1: PADEmotionEngine 缓存 slow-changing 值

| 属性 | 内容 |
|------|------|
| **文件** | `Assets/Scripts/Runtime/Animation/PADEmotionEngine.cs` |
| **位置** | 行 200, 235, 238 |
| **严重度** | 🟡 MEDIUM |
| **工时** | 45 min |

**修复清单**:

**2.1a — 好感度 (行 200)**: 值仅在交互事件时变化（每分钟至多几次），不应每帧查询。

```csharp
// 添加字段:
private float _cachedAffectionLevel;
private float _cachedAffectionScale;
private float _lastAffectionCheckTime;

// Update/ApplyDecay 中:
// 每 2 秒检查一次 (代替每帧):
if (Time.unscaledTime - _lastAffectionCheckTime > 2f)
{
    _cachedAffectionLevel = Data.DataStore.Instance.GetAffection().affectionLevel;
    _cachedAffectionScale = Mathf.Clamp01(1f - _cachedAffectionLevel / 200f);
    _lastAffectionCheckTime = Time.unscaledTime;
}
// 使用 _cachedAffectionScale 代替每帧计算
```

**2.1b — PetAnimationManager (行 235)**: 缓存引用。

```csharp
private IPetAnimator _cachedAnimator;

// Awake 中:
_cachedAnimator = PetAnimationManager.Instance?.CurrentAnimator;

// UpdateEmotionOutput 中每帧使用 _cachedAnimator,
// 仅在 OnEnable 或模型切换时刷新
```

**2.1c — PADToEmotion (行 238)**: 仅当 raw PAD 值实质变化时重新计算。

```csharp
private float _lastRawP, _lastRawA, _lastRawD;
private PetEmotion _cachedEmotion;

public PetEmotion CurrentEmotion
{
    get
    {
        const float epsilon = 0.01f;
        if (Mathf.Abs(_smoothP - _lastRawP) > epsilon ||
            Mathf.Abs(_smoothA - _lastRawA) > epsilon ||
            Mathf.Abs(_smoothD - _lastRawD) > epsilon)
        {
            _cachedEmotion = PADToEmotion(_smoothP, _smoothA, _smoothD);
            _lastRawP = _smoothP; _lastRawA = _smoothA; _lastRawD = _smoothD;
        }
        return _cachedEmotion;
    }
}
```

**验收**: Profiler 中 `GetAffection` 应仅在交互事件后偶发调用，而非每帧出现。

---

### 任务 2.2: MicrophoneCapture 复用预分配缓冲区

| 属性 | 内容 |
|------|------|
| **文件** | `Assets/Scripts/Runtime/Voice/MicrophoneCapture.cs` |
| **位置** | 行 141, 210, 227-228, 251-252 |
| **严重度** | 🟡 MEDIUM — ~65KB 每 100ms GC 分配 |
| **工时** | 30 min |

**修复清单**:

**2.2a — 行 210: ProcessAudioData 复用 _sampleBuffer (最大热点)**

```csharp
// 行 141: _sampleBuffer 已分配但从未使用。改为预设最大容量:
private void StartRecording()
{
    // ...
    _sampleBuffer = new float[_sampleRate * _channels * 2]; // 2 秒缓冲,覆盖所有情况
    _lastSamplePos = 0;
    // ...
}

// 行 210: 原代码每次 new float[]:
// float[] data = new float[samplesAvailable];
// 改为复用:
if (samplesAvailable > _sampleBuffer.Length)
{
    // 仅在极端情况 realloc
    _sampleBuffer = new float[samplesAvailable];
}
float[] data = _sampleBuffer; // 零分配
```

**2.2b — 行 227-228: 消除环缓冲区回绕时的额外分配**

```csharp
// 原代码:
// float[] part1 = new float[part1Len];
// float[] part2 = new float[part2Len];
// 
// 改为直接在 data 中分两次 GetData:
_micClip.GetData(data, 0, _lastSamplePos);                 // 后半段
_micClip.GetData(data, part1Len, currentPos - part1Len);   // 前半段
```

**2.2c — 行 251-252: UpdateCurrentLevel 的 window 数组预分配**

```csharp
// 添加字段:
private float[] _rmsWindow;

// Start/OnEnable 中:
_rmsWindow = new float[256]; // 固定窗口大小

// UpdateCurrentLevel 中:
// 原: float[] window = new float[windowSize];
// 改为直接使用 _rmsWindow (并确保长度匹配)
```

**验收**: Profiler GC Alloc 中 `MicrophoneCapture.Update` 应接近 0 KB。

---

### 任务 2.3: VoiceManager._recordedAudio 预设容量

| 属性 | 内容 |
|------|------|
| **文件** | `Assets/Scripts/Runtime/Voice/VoiceManager.cs` |
| **位置** | 行 125 |
| **严重度** | 🟡 MEDIUM — 15s 录音期间 ~18 次数组 resize+copy |
| **工时** | 5 min |

**修复**:

```csharp
// 行 125 — 原代码:
// private List<float> _recordedAudio = new List<float>();

// 修复为:
private List<float> _recordedAudio = new List<float>(capacity: 240000);
// 16000 Hz × 15s max = 240,000 samples
```

**验收**: Profiler 中 `List<float>.AddRange` 不应触发 `Array.Resize`（检查 GC Alloc per frame 应恒定为 0 直到列表需要扩容的极罕见情况）。

---

## Phase 3 — 质量提升

### 任务 3.1: 音频管线引入 ArrayPool

| 属性 | 内容 |
|------|------|
| **文件** | `MicrophoneCapture.cs`, `BackendClient.cs`, `TTSPlayer.cs`, `WakeWordDetector.cs` |
| **严重度** | 🟢 LOW — 持续性小额 GC 压力 |
| **工时** | 1 h |

**修复方案**:

创建统一工具类:

```csharp
// 新文件: Assets/Scripts/Runtime/Voice/AudioBufferPool.cs
using System.Buffers;

public static class AudioBufferPool
{
    public static float[] RentFloat(int minLength) 
        => ArrayPool<float>.Shared.Rent(minLength);
    
    public static void ReturnFloat(float[] buffer) 
        => ArrayPool<float>.Shared.Return(buffer, clearArray: false);
    
    public static byte[] RentByte(int minLength) 
        => ArrayPool<byte>.Shared.Rent(minLength);
    
    public static void ReturnByte(byte[] buffer) 
        => ArrayPool<byte>.Shared.Return(buffer, clearArray: false);
}
```

**需要替换的热点**:

| 文件 | 行 | 当前代码 | 替换为 |
|------|-----|---------|--------|
| MicrophoneCapture.cs | 210 | `new float[samplesAvailable]` | `AudioBufferPool.RentFloat(samplesAvailable)` |
| BackendClient.cs | 329 | `ConvertToPCM16(samples)` 内部 new byte[] | 接受预分配 buffer 的重载 |
| TTSPlayer.cs | 329 | `new float[pcm16.Length / 2]` | `AudioBufferPool.RentFloat(...)` |

**关键**: 每次 `Rent` 必须在 finally 中调用 `Return`，否则造成内存泄漏。建议用 `using` 模式 + 自定义 Disposable 包装。

**验收**: GC Alloc per frame 在音频活跃时降低 80%+。

---

### 任务 3.2: 修复事件泄漏和协程清理

| 属性 | 内容 |
|------|------|
| **文件** | `AIManager.cs`, `FoxSimpleMovement.cs` |
| **严重度** | 🟡 MEDIUM |
| **工时** | 30 min |

**3.2a — AIManager.cs: Lambda 事件取消订阅**

```csharp
// 问题: OnDestroy() 为空 (行 146-148), 但 InitializeServices() 中注册了 5 个 lambda

// 修复: 保存 delegate 引用以便取消订阅
private System.Action _asrReadyHandler;
private System.Action<string> _asrErrorHandler;
// ... 等等

private void InitializeServices()
{
    _asrReadyHandler = () => UpdateSingleStatus(...);
    _asrService.OnReady += _asrReadyHandler;
    _asrErrorHandler = (err) => { ... };
    _asrService.OnError += _asrErrorHandler;
    // ...
}

private void OnDestroy()
{
    if (_asrService != null)
    {
        _asrService.OnReady -= _asrReadyHandler;
        _asrService.OnError -= _asrErrorHandler;
    }
    // ... 同理处理 TTS 和 LLM 服务的所有事件
}
```

**3.2b — FoxSimpleMovement.cs: 协程清理**

```csharp
// OnDestroy 中添加:
private void OnDestroy()
{
    StopAllCoroutines();
    // 同时释放任何持有的 GameObject 引用
}
```

**验收**: 反复进出 Play Mode 后，Profiler Memory 不应有持续增长的 MonoBehaviour 泄漏。

---

### 任务 3.3: 合并重复工具函数

| 属性 | 内容 |
|------|------|
| **工时** | 45 min |

**重复清单**:

| 函数 | 出现位置 |
|------|---------|
| `ConvertPCM16ToFloat` | `TTSPlayer.cs:327`, `TTSService.cs:?` |
| `ConvertToPCM16` | `BackendClient.cs:555`, `WakeWordDetector.cs:319` |
| `ResampleSimple` | `TTSPlayer.cs:351`, `TTSService.cs:345` |
| `FindDataChunk` | `TTSPlayer.cs:338`, `TTSService.cs:332` |

**修复**: 提取到 `AudioUtility.cs`:

```csharp
// 新文件: Assets/Scripts/Runtime/Voice/AudioUtility.cs
public static class AudioUtility
{
    /// <summary>PCM16 byte[] → float[] (-1..1), 零分配(需预分配 buffer)</summary>
    public static void ConvertPCM16ToFloat(byte[] pcm16, float[] output);
    
    /// <summary>float[] → PCM16 byte[], 零分配(需预分配 buffer)</summary>
    public static void ConvertToPCM16(float[] samples, byte[] output);
    
    /// <summary>简单线性插值重采样</summary>
    public static float[] ResampleSimple(float[] samples, int srcRate, int dstRate);
    
    /// <summary>WAV 字节中查找 "data" chunk</summary>
    public static int FindDataChunk(byte[] wavBytes);
}
```

**验收**: 搜索确认 `ConvertPCM16ToFloat`、`ResampleSimple`、`FindDataChunk` 仅存在于 `AudioUtility.cs` 中。

---

### 任务 3.4: GPU 端 Chroma Key (替代 CPU 像素处理)

| 属性 | 内容 |
|------|------|
| **文件** | `Assets/Scripts/Runtime/Platform/TransparentWindow.cs` 行 515-536 |
| **严重度** | 🟢 LOW (架构优化) |
| **工时** | 2 h |

**问题**: `PerPixelAlphaLoop()` 每帧:
1. `ReadPixels` GPU → CPU 读取 500×600 像素 (1.2 MB)
2. CPU 逐像素 chroma key 比较（300K 像素 × 4 channel = 120 万次数组访问）
3. `Marshal.Copy` 到 DWM bitmap
4. `UpdateLayeredWindow` Win32 API

**修复**: 将 chroma key 移到 Shader 中，用 CommandBuffer 直接输出到 RenderTexture 的 alpha 通道。

**Shader 方案** (Custom Render Feature):

```hlsl
// ChromaKey.shader — URP RenderFeature 中使用
half4 frag(Varyings IN) : SV_Target
{
    half4 col = tex2D(_MainTex, IN.uv);
    // Chroma key: 品红 (1,0,1) → alpha 0, 其他 → alpha 1
    half3 diff = abs(col.rgb - _ChromaColor.rgb);
    half alpha = 1.0 - saturate((1.0 - diff.r) * (1.0 - diff.g) * (1.0 - diff.b) * _ChromaTolerance);
    return half4(col.rgb, alpha);
}
```

**C# 端**: 创建 `ChromaKeyRenderFeature : ScriptableRendererFeature`，使用 `ScriptableRenderPass` 将 chroma key Blit 到专用 RenderTexture。之后只需将 RenderTexture 的 alpha 通道上传到 DWM bitmap（跳过每像素 CPU 比较）。

**验收**: Profiler 中 `PerPixelAlphaLoop` 的 CPU 时间降低 80%+，Game View 视觉效果不变。

---

## 综合验收清单

执行顺序和最终验证:

```
Phase 1 (预计 2.5h)
□ 1.1 sharedMaterial → Frame Debugger 合批验证
□ 1.2 lookup table  → OnDynamicDrawableData GC Alloc = 0
□ 1.3 enum 索引     → SetParameter 零字典分配
□ 1.4 Camera.main   → Profiler 无每帧场景遍历
□ Phase 1 整体: Profiler CPU 降低 30-40%

Phase 2 (预计 1.5h)
□ 2.1 PAD 缓存      → GetAffection 不再每帧调用
□ 2.2 音频缓冲区    → MicrophoneCapture GC = 0
□ 2.3 列表容量      → VoiceManager 录音无 resize
□ Phase 2 整体: 额外降低 CPU 10-15%

Phase 3 (预计 4h)
□ 3.1 ArrayPool     → GC Alloc 音频活跃时降低 80%
□ 3.2 事件/协程     → 多次 Play/Stop 无内存泄漏
□ 3.3 合并函数      → 仅 AudioUtility.cs 存在重复实现
□ 3.4 GPU chroma    → PerPixelAlphaLoop CPU ↓80%

最终:
□ Unity Editor 打开项目: 0 编译错误
□ Game View: 模型渲染正常, 动画流畅
□ Profiler: CPU 总开销降低 40-60% vs 优化前基线
□ 包体大小无显著增长 (< 100KB)
```

---

## 风险登记

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| sharedMaterial 改变破坏 Editor 调试 | 低 | 中 | Editor 下保留 .material 实现 |
| FoxParam enum 重构遗漏调用点 | 中 | 低 | 保留 string 重载作为兼容桥,逐步迁移 |
| ArrayPool 未正确归还导致泄漏 | 低 | 高 | 使用 try/finally + code review |
| GPU chroma key 与现有效果不一致 | 中 | 低 | A/B 对比测试,保留 CPU 路径作 fallback |
