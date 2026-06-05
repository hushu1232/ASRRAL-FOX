# AstralFox 技术债务修复计划

> **作者视角**: 高级/资深工程师面试中对项目深度审查后的系统性修复方案
> **日期**: 2026-06-03
> **范围**: Unity C# 客户端 + Python BFF
> **原则**: 按风险优先级排序；每项修复包含具体代码；先止血再重构

---

## 优先级定义

| 级别 | 含义 | 触发条件 |
|------|------|----------|
| **P0** | 立即修复，阻塞发布 | 数据丢失、安全漏洞、可复现崩溃 |
| **P1** | 本迭代修复 | 静默失败、内存泄漏、协议不一致 |
| **P2** | 下迭代修复 | 性能优化、架构重构、代码清理 |
| **P3** | 长期规划 | 测试覆盖、文档、平台战略调整 |

---

## Phase 0: 止血 (P0 — 1-3 天)

### P0-1: 修复 DataStore 明文存储认证 Token

**文件**: `Assets/Scripts/Runtime/Data/DataStore.cs`
**影响**: JWT access token + refresh token 明文落盘，任何本地进程可读取
**修复**: 使用 Windows DPAPI 加密敏感字段

```csharp
// DataStore.cs — 新增加密工具方法

#if UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN
using System.Security.Cryptography;

private static byte[] ProtectData(byte[] plaintext)
{
    return ProtectedData.Protect(plaintext, null,
        DataProtectionScope.CurrentUser);
}

private static byte[] UnprotectData(byte[] ciphertext)
{
    return ProtectedData.Unprotect(ciphertext, null,
        DataProtectionScope.CurrentUser);
}
#else
// 非 Windows 平台暂时用 AES + PBKDF2(playerPrefs 中存储的随机 salt)
private static byte[] ProtectData(byte[] plaintext) { /* 实现 */ }
private static byte[] UnprotectData(byte[] ciphertext) { /* 实现 */ }
#endif

// 修改 SaveAuthTokens:
public void SaveAuthTokens(string accessToken, string refreshToken)
{
    _data.authToken = Convert.ToBase64String(
        ProtectData(Encoding.UTF8.GetBytes(accessToken ?? "")));
    _data.authRefreshToken = Convert.ToBase64String(
        ProtectData(Encoding.UTF8.GetBytes(refreshToken ?? "")));
    _dirty = true;
}

// 修改 LoadAccessToken / LoadRefreshToken:
public string LoadAccessToken()
{
    if (string.IsNullOrEmpty(_data.authToken)) return "";
    try
    {
        return Encoding.UTF8.GetString(
            UnprotectData(Convert.FromBase64String(_data.authToken)));
    }
    catch { return ""; }
}
```

**预计工时**: 2h (含 Android/macOS fallback)

---

### P0-2: 修复 ConfigManager 密钥派生的伪加密

**文件**: `Assets/Scripts/Runtime/Config/ConfigManager.cs`
**影响**: API Key 被"加密"但任何拿到 .enc 文件 + deviceId 的人都能解密
**修复**: 同样走 DPAPI，废弃 PBKDF2(deviceId) 方案

```csharp
// ConfigManager.cs — 替换 Encrypt/Decrypt 实现

private byte[] Encrypt(byte[] plaintext)
{
#if UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN
    // DPAPI: 操作系统级用户绑定加密，不需要管理密钥
    byte[] protectedData = ProtectedData.Protect(plaintext, null,
        DataProtectionScope.CurrentUser);

    // 在密文前加版本头和长度，兼容旧格式
    byte[] output = new byte[HeaderSize + protectedData.Length];
    Buffer.BlockCopy(BitConverter.GetBytes(2 /* new version */), 0, output, 0, HeaderSize);
    Buffer.BlockCopy(protectedData, 0, output, HeaderSize, protectedData.Length);
    return output;
#else
    // fallback to AES-CBC-HMAC (existing code, but fix HMAC key separation)
    return EncryptLegacy(plaintext);
#endif
}

private byte[] Decrypt(byte[] data)
{
    if (data.Length < HeaderSize)
        throw new FormatException("Config file too short.");

    int version = BitConverter.ToInt32(data, 0);
    if (version == 2)
    {
        // DPAPI path
        int cipherLen = data.Length - HeaderSize;
        byte[] protectedData = new byte[cipherLen];
        Buffer.BlockCopy(data, HeaderSize, protectedData, 0, cipherLen);
        return ProtectedData.Unprotect(protectedData, null,
            DataProtectionScope.CurrentUser);
    }
    else if (version == 1)
    {
        // 向后兼容旧格式: 读取后自动升级到 v2
        byte[] plaintext = DecryptLegacy(data);
        SaveConfig(JsonUtility.FromJson<AppConfig>(
            Encoding.UTF8.GetString(plaintext))); // 触发重新加密(v2)
        return plaintext;
    }
    throw new NotSupportedException($"Unsupported config version: {version}");
}
```

**预计工时**: 3h (含向后兼容测试)

---

### P0-3: 修复 docker-compose 生产密钥硬编码

**文件**: `docker-compose.yml`
**影响**: 环境变量缺失时使用 `dev-jwt-secret-change-me` 作为 JWT 签名密钥
**修复**:

```yaml
# docker-compose.yml
environment:
  # P0 FIX: 移除默认值，强制要求设置环境变量
  JWT_SECRET: ${JWT_SECRET:?error: JWT_SECRET must be set}
  PET_ENCRYPTION_KEY: ${PET_ENCRYPTION_KEY:?error: PET_ENCRYPTION_KEY must be set}
  DB_PASSWORD: ${DB_PASSWORD:?error: DB_PASSWORD must be set}
```

并在仓库根目录添加 `.env.example`:
```bash
# .env.example — 复制为 .env 并填入真实值
JWT_SECRET=            # openssl rand -base64 64
PET_ENCRYPTION_KEY=    # openssl rand -base64 32
DB_PASSWORD=           # openssl rand -base64 24
```

**预计工时**: 0.5h

---

### P0-4: 修复 Environment.TickCount 49.7天溢出导致虚假"回归问候"

**文件**: `Assets/Scripts/Runtime/Behavior/TimeAwareness.cs`
**影响**: 系统运行超过 24.9 天后用户空闲检测失效，狐狸在无人时频繁触发返回问候
**修复**:

```csharp
// TimeAwareness.cs line 194 — 替换 TickCount 计算
private void DetectUserActivity()
{
    var lii = new LASTINPUTINFO { cbSize = (uint)Marshal.SizeOf<LASTINPUTINFO>() };
    if (!GetLastInputInfo(ref lii)) return;

    // P0 FIX: 使用无符号减法处理 TickCount 溢出
    uint tickNow = (uint)Environment.TickCount;
    uint lastInput = lii.dwTime;
    uint idleMs = tickNow - lastInput; // 无符号环绕自动处理溢出

    // idleMs 在溢出时会是正确的小值（因为无符号减法自动 wrap）

    if (idleMs < 5000)
    {
        _lastActivityTime = DateTime.Now;
        _isUserActive = true;
        _idleStartTime = DateTime.MinValue;
    }
    else if (_isUserActive)
    {
        _isUserActive = false;
        _idleStartTime = DateTime.Now;
    }
}
```

**预计工时**: 0.5h

---

## Phase 1: 线程安全与并发 (P1 — 3-5 天)

### P1-1: BackendClient 全面线程安全改造

**文件**: `Assets/Scripts/Runtime/Voice/BackendClient.cs`
**影响**: 多线程无锁访问 `IsConnected`、`_ws`、`_cts`，弱内存序平台上可观测崩溃
**修复方案**: 引入连接状态机 + 锁保护

```csharp
// BackendClient.cs — 重写连接状态管理

public sealed class BackendClient : MonoBehaviour
{
    // 连接状态机: Disconnected → Connecting → Connected → Disconnecting → Disconnected
    private enum ConnectionState
    {
        Disconnected,
        Connecting,
        Connected,
        Disconnecting,
    }

    private readonly object _stateLock = new object();
    private ConnectionState _state = ConnectionState.Disconnected;
    private ClientWebSocket _ws;
    private CancellationTokenSource _cts;
    private CancellationTokenSource _connectCts; // 独立的连接超时 token

    // 线程安全的属性
    public bool IsConnected
    {
        get { lock (_stateLock) return _state == ConnectionState.Connected; }
    }

    private bool TryTransition(ConnectionState from, ConnectionState to)
    {
        lock (_stateLock)
        {
            if (_state != from) return false;
            _state = to;
            return true;
        }
    }

    public async Task ConnectAsync()
    {
        // 防止重复连接
        if (!TryTransition(ConnectionState.Disconnected, ConnectionState.Connecting))
            return;

        try
        {
            // 取消任何未完成的连接尝试
            _connectCts?.Cancel();
            _connectCts = new CancellationTokenSource(TimeSpan.FromSeconds(5));

            _cts?.Cancel();
            _cts = new CancellationTokenSource();

            _ws?.Dispose();
            _ws = new ClientWebSocket();
            _ws.Options.KeepAliveInterval = TimeSpan.FromSeconds(30);

            await _ws.ConnectAsync(new Uri(_serverUrl), _connectCts.Token);

            lock (_stateLock) { _state = ConnectionState.Connected; }
            _reconnectTimer = 0f;
            _pingTimer = 0f;

            // 从主线程安全触发事件
            UnityMainThreadDispatcher.Instance.Enqueue(
                () => OnConnectionChanged?.Invoke(true));

            _ = ReceiveLoopAsync(_cts.Token);
        }
        catch (Exception ex)
        {
            lock (_stateLock) { _state = ConnectionState.Disconnected; }
            UnityMainThreadDispatcher.Instance.Enqueue(
                () => OnConnectionChanged?.Invoke(false));
        }
    }

    // ... DisconnectAsync / ReceiveLoopAsync 类似改造
}
```

**预计工时**: 8h (含回归测试)

---

### P1-2: 修复音频队列的 TOCTOU 竞态

**文件**: `Assets/Scripts/Runtime/Voice/BackendClient.cs`
**影响**: `_audioOutQueueCount` 和 `ConcurrentQueue` 之间的计数不一致
**修复**: 使用 `SemaphoreSlim` 做精确背压

```csharp
// BackendClient.cs
private readonly ConcurrentQueue<byte[]> _audioOutQueue = new();
private readonly SemaphoreSlim _audioSendSemaphore;

// 构造函数或 Awake 中:
_audioSendSemaphore = new SemaphoreSlim(_maxQueueSize, _maxQueueSize);

public void SendAudio(float[] samples, int sampleRate, int channels)
{
    if (!IsConnected) return;

    // 非阻塞尝试获取信号量; 如果队列满了就直接丢帧
    if (!_audioSendSemaphore.Wait(0)) return;

    byte[] pcm = ConvertToPCM16(samples);
    _audioOutQueue.Enqueue(pcm);
    // 不需要手动 Interlocked — SemaphoreSlim 本身就是计数器
}

public async Task FlushAudioAsync()
{
    if (!IsConnected || _ws == null || _audioOutQueue.IsEmpty) return;

    try
    {
        var batch = new List<byte>();
        while (_audioOutQueue.TryDequeue(out byte[] chunk))
        {
            batch.AddRange(chunk);
            _audioSendSemaphore.Release(); // 每取出一块就释放一个槽
        }

        if (batch.Count > 0)
        {
            await _ws.SendAsync(new ArraySegment<byte>(batch.ToArray()),
                WebSocketMessageType.Binary, true, _cts.Token);
        }
    }
    catch (Exception ex)
    {
        Debug.LogError($"[BackendClient] Flush error: {ex.Message}");
        // 连接断开时释放所有 pending 信号量, 避免死锁
        int released = 0;
        while (_audioOutQueue.TryDequeue(out _)) { released++; }
        if (released > 0) _audioSendSemaphore.Release(released);

        lock (_stateLock) { _state = ConnectionState.Disconnected; }
        OnConnectionChanged?.Invoke(false);
    }
}

private void ClearAudioQueue()
{
    while (_audioOutQueue.TryDequeue(out _))
        _audioSendSemaphore.Release(); // 统一释放
}
```

**预计工时**: 2h

---

### P1-3: VoiceManager 中 streaming token 和完整响应的竞态保护

**文件**: `Assets/Scripts/Runtime/Voice/VoiceManager.cs`
**影响**: `llm_token` 晚于 `llm_response` 到达时 token 丢失
**修复**: 用互锁标记位保护 accumulator

```csharp
// VoiceManager.cs
private string _streamAccumulatedText = "";
private bool _responseFinalized; // 标记 llm_response 是否已被处理

private void OnBackendLLMToken(string token)
{
    // 如果 response 已经 finalize, 忽略后续 token
    if (_responseFinalized) return;

    lock (_streamLock)
    {
        if (_responseFinalized) return;
        _streamAccumulatedText += token;
    }
    OnStreamToken?.Invoke(token);
}

private void OnBackendLLMResponse(string rawText)
{
    string fullRaw;

    lock (_streamLock)
    {
        _responseFinalized = true;
        fullRaw = !string.IsNullOrEmpty(_streamAccumulatedText)
            ? _streamAccumulatedText : rawText;
        _streamAccumulatedText = "";
    }

    // ... 后续处理使用 fullRaw
}

// 在新一轮对话开始(startRecording)时重置:
private void StartRecording()
{
    lock (_streamLock)
    {
        _responseFinalized = false;
        _streamAccumulatedText = "";
    }
    // ...
}

private readonly object _streamLock = new object();
```

**预计工时**: 1.5h

---

## Phase 2: 状态机与错误处理 (P1 — 2-3 天)

### P2-1: VoiceManager 超时通知用户

**文件**: `Assets/Scripts/Runtime/Voice/VoiceManager.cs`
**影响**: 所有超时静默回到 Idle，用户完全不知道发生了什么
**修复**:

```csharp
// VoiceManager.cs — 在 SetState 失败路径触发用户可见反馈

// 新增事件:
public event Action<string> OnUserNotification; // "正在思考...", "超时了,请再说一次"

private void Update()
{
    _stateTimer += Time.unscaledDeltaTime;

    switch (CurrentState)
    {
        case VoiceState.Listening:
            if (_stateTimer >= _listenTimeout)
            {
                OnUserNotification?.Invoke("等太久了～再叫我一次吧！");
                SetState(VoiceState.Idle);
            }
            break;

        case VoiceState.Processing:
            if (_stateTimer >= _processingTimeout)
            {
                OnUserNotification?.Invoke("唔…刚才走神了，再说一次好吗？");
                SetState(VoiceState.Idle);
            }
            break;

        case VoiceState.Speaking:
            if (_stateTimer >= _speakingTimeout)
            {
                OnUserNotification?.Invoke("声音卡住了…重新来一次？");
                Animation.PetAnimationManager.Instance?.CurrentAnimator?.OnSpeakingEnd();
                SetState(VoiceState.Idle);
            }
            break;
    }
}
```

用户通知可以播放一个简单的气泡动画（在 `FoxInteraction` 或 UI 层监听 `OnUserNotification`），加上一句语音合成好的预置音频。**关键**：至少让用户知道"现在发生了什么"。

**预计工时**: 2h

---

### P2-2: FoxAnimationController Sleep→Listening 视觉撕裂修复

**文件**: `Assets/Scripts/Runtime/Animation/FoxAnimationController.cs`
**影响**: 从睡眠唤醒后眼睛保持半闭
**修复**:

```csharp
// FoxAnimationController.cs — SetState 方法补全状态转换逻辑

public void SetState(FoxState newState)
{
    if (!_isReady) return;
    if (newState == _currentState) return;

    FoxState previous = _currentState;
    _currentState = newState;

    // 通用: 退出 Sleep 状态时恢复眼睛
    if (previous == FoxState.Sleep && newState != FoxState.Sleep)
    {
        _driver.SetParameterImmediate(FoxParamId.EyeLOpen, 1f);
        _driver.SetParameterImmediate(FoxParamId.EyeROpen, 1f);
        // 重置 Sleep 姿态
        _driver.SetParameter(FoxParamId.BodyAngleX, 0f);
        _driver.SetParameter(FoxParamId.BodyAngleY, 0f);
    }

    // 重置空闲计时器
    if (newState != FoxState.Idle)
        _idleTimer = 0f;

    // 状态进入逻辑
    switch (newState)
    {
        case FoxState.Listening:
            _driver.SetParameter(FoxParamId.EarL, _listeningEarPerk);
            _driver.SetParameter(FoxParamId.EarR, _listeningEarPerk);
            break;
        case FoxState.Sleep:
            _driver.SetParameter(FoxParamId.EyeLOpen, _sleepEyeClose);
            _driver.SetParameter(FoxParamId.EyeROpen, _sleepEyeClose);
            break;
        // ... 其他 case
    }
}
```

**预计工时**: 1h

---

### P2-3: 所有 Debug.LogWarning → 结构化错误处理

**文件**: 全局
**影响**: 运行时错误只出现在 Unity Console，用户永远看不到
**修复**: 引入 `DiagnosticBus` 单例，所有组件通过它报告错误:

```csharp
// 新建: Assets/Scripts/Runtime/Diagnostics/DiagnosticBus.cs
namespace AstralFox.Diagnostics
{
    public sealed class DiagnosticBus
    {
        public static DiagnosticBus Instance { get; } = new();

        public enum Severity { Info, Warning, Error, Fatal }

        public event Action<Severity, string, string> OnDiagnostic; // severity, source, message

        public void Report(Severity severity, string source, string message)
        {
            Debug.Log($"[{severity}][{source}] {message}");
            OnDiagnostic?.Invoke(severity, source, message);
        }
    }
}

// 使用:
DiagnosticBus.Instance.Report(DiagnosticBus.Severity.Error, "BackendClient",
    $"Connection failed: {ex.Message}");

// UI 层监听:
DiagnosticBus.Instance.OnDiagnostic += (severity, source, message) =>
{
    if (severity == DiagnosticBus.Severity.Error)
        ShowBubble($"⚠ {message}", 5f);
};
```

**预计工时**: 3h (含现有日志迁移)

---

## Phase 3: 协议版本化 (P1 — 1-2 天)

### P3-1: WebSocket 握手协议

**文件**: `BackendClient.cs` + `main.py`
**影响**: 客户端/服务端协议变更后没有检测机制
**修复**:

**Unity 侧**:
```csharp
// BackendClient.cs — 连接成功后发送 hello
private async Task SendHelloAsync()
{
    var hello = new
    {
        type = "hello",
        version = 4,  // 协议版本号
        features = new[] { "streaming_tokens", "wav_audio", "emotion_stream" },
        client = "astralfox-unity",
        client_version = Application.version,
    };
    await SendTextAsync(JsonUtility.ToJson(hello));
}

// 然后等待服务端 welcome 响应... 在 ProcessMessage 中:
case "welcome":
    if (msg.protocol_version != EXPECTED_VERSION)
    {
        Debug.LogError($"Protocol mismatch! Server={msg.protocol_version}, Client={EXPECTED_VERSION}");
        OnError?.Invoke("服务器版本不匹配，请更新客户端。");
        _ = DisconnectAsync();
    }
    break;
case "error":
    if (msg.error_code == "PROTOCOL_MISMATCH")
    {
        Debug.LogError($"Server rejected connection: {msg.message}");
        OnError?.Invoke(msg.message);
        _ = DisconnectAsync();
    }
    break;
```

**Python 侧**:
```python
# main.py
PROTOCOL_VERSION = 4
SUPPORTED_VERSIONS = {3, 4}

async def handle_hello(websocket, msg: dict):
    client_version = msg.get("version", 0)
    if client_version not in SUPPORTED_VERSIONS:
        await websocket.send_text(json.dumps({
            "type": "error",
            "error_code": "PROTOCOL_MISMATCH",
            "message": f"Unsupported protocol version {client_version}. "
                       f"Server supports: {sorted(SUPPORTED_VERSIONS)}"
        }))
        await websocket.close(4000, "Protocol mismatch")
        return False
    await websocket.send_text(json.dumps({
        "type": "welcome",
        "protocol_version": PROTOCOL_VERSION,
        "server_version": "0.2.0",
    }))
    return True
```

**预计工时**: 4h

---

## Phase 4: 音频管线修复 (P1-P2 — 2-3 天)

### P4-1: TTSPlayer 内存分配优化

**文件**: `Assets/Scripts/Runtime/Voice/TTSPlayer.cs`
**影响**: 每段 TTS 分配 ~4MB 临时内存，30+ 句子 = 240MB
**修复**: 使用 `stream=true` 的 AudioClip + 增量 `SetData`

```csharp
// TTSPlayer.cs — 重写播放逻辑

private AudioClip _streamingClip;
private int _playbackWriteHead; // 已写入但尚未被播放器消费的 sample 位置

private void Awake()
{
    _source = GetComponent<AudioSource>();
    // ... 其他初始化 ...

    // 预分配一个 streaming clip (不拷贝数据到原生层)
    _streamingClip = AudioClip.Create(
        "tts_streaming",
        _maxSamples,
        1,
        _sampleRate,
        stream: true,            // ← 关键: 流模式
        pcmreadercallback: null,
        pcmsetpositioncallback: null
    );
    _source.clip = _streamingClip;
    _playbackWriteHead = 0;
}

private void AddFloatSamples(float[] samples)
{
    if (samples == null || samples.Length == 0) return;

    int spaceLeft = _maxSamples - _playbackWriteHead;
    if (samples.Length > spaceLeft)
    {
        Debug.LogWarning($"[TTSPlayer] Buffer overflow, truncating {samples.Length - spaceLeft} samples");
        Array.Resize(ref samples, spaceLeft);
    }

    if (samples.Length == 0) return;

    // 增量写入: 只把新数据传入原生层, 不重建整个 clip
    _streamingClip.SetData(samples, _playbackWriteHead);
    _playbackWriteHead += samples.Length;
    _totalSamplesWritten = _playbackWriteHead;

    if (!_source.isPlaying && AutoPlay)
    {
        _source.Play();
        IsPlaying = true;
        OnPlaybackStarted?.Invoke();
    }
}

public void StopImmediate()
{
    _source.Stop();
    _playbackWriteHead = 0;
    _totalSamplesWritten = 0;
    _dataComplete = false;
    IsPlaying = false;
    // 不需要销毁和重建 clip — 重用同一个 streaming clip
}
```

**预计工时**: 3h

---

### P4-2: 音频重采样添加低通滤波

**文件**: `Assets/Scripts/Runtime/Voice/TTSPlayer.cs`
**影响**: 线性插值重采样引入混叠伪影
**修复**:

```csharp
// TTSPlayer.cs — 替换 ResampleSimple

private static float[] ResampleWithLPF(float[] input, int fromRate, int toRate)
{
    if (fromRate == toRate) return input;
    if (fromRate < toRate)
    {
        // 上采样不需要 LPF, 线性插值可接受
        return ResampleLinear(input, fromRate, toRate);
    }

    // 下采样: 先做简单的一阶 IIR 低通 (截止频率 = toRate/2)
    float cutoff = toRate / 2f;
    float rc = 1f / (2f * Mathf.PI * cutoff);
    float dt = 1f / fromRate;
    float alpha = dt / (rc + dt);

    float[] filtered = new float[input.Length];
    filtered[0] = input[0];
    for (int i = 1; i < input.Length; i++)
    {
        filtered[i] = filtered[i - 1] + alpha * (input[i] - filtered[i - 1]);
    }

    // 再做线性插值下采样
    return ResampleLinear(filtered, fromRate, toRate);
}

private static float[] ResampleLinear(float[] input, int fromRate, int toRate)
{
    float ratio = (float)fromRate / toRate;
    int outputLen = Mathf.RoundToInt(input.Length / ratio);
    float[] output = new float[outputLen];
    for (int i = 0; i < outputLen; i++)
    {
        float srcIdx = i * ratio;
        int idx0 = Mathf.FloorToInt(srcIdx);
        int idx1 = Mathf.Min(idx0 + 1, input.Length - 1);
        output[i] = Mathf.Lerp(input[idx0], input[idx1], srcIdx - idx0);
    }
    return output;
}
```

**注**: 这仍然是一个简化方案。真正的生产级方案应该用 `AudioSource` 的 `SetData` + Unity 内置重采样，或者在 Python 端统一输出 16kHz。

**预计工时**: 1.5h

---

## Phase 5: 架构重构 (P2 — 5-7 天)

### P5-1: AI 后端统一抽象层

**文件**: 新增接口 + 现有三个实现
**影响**: 三种 AI 后端（云端 WebSocket / 离线本地 / Mock）零抽象，无法互换
**修复**:

```csharp
// 新建: Assets/Scripts/Runtime/Voice/IVoicePipeline.cs
namespace AstralFox.Voice
{
    /// <summary>
    /// 统一的语音交互管线接口。
    /// 不同的实现提供: 云端 BFF / 离线 AI / Mock 测试
    /// </summary>
    public interface IVoicePipeline
    {
        /// <summary>管线是否已就绪</summary>
        bool IsReady { get; }

        /// <summary>收到用户最终语音文本</summary>
        event Action<string> OnTranscript;

        /// <summary>收到 LLM 流式 token</summary>
        event Action<string> OnStreamToken;

        /// <summary>收到 LLM 完整响应 (含标签)</summary>
        event Action<string> OnLLMResponse;

        /// <summary>收到 TTS 音频数据</summary>
        event Action<byte[]> OnTTSAudio; // 统一为 WAV bytes

        /// <summary>TTS 数据发送完毕</summary>
        event Action OnTTSDone;

        /// <summary>连接状态变化</summary>
        event Action<bool> OnConnectionChanged;

        /// <summary>管线错误</summary>
        event Action<string> OnError;

        /// <summary>开始处理用户语音 (raw float samples)</summary>
        void ProcessSpeech(float[] audioSamples, int sampleRate);

        /// <summary>发送语音上下文 (在录音结束时调用)</summary>
        void SendContext(VoiceContextMessage context);

        /// <summary>打断当前处理</summary>
        void Cancel();
    }
}
```

然后 `BackendClient`、`AIManager`、`MockVoicePipeline` 分别实现 `IVoicePipeline`。`VoiceManager` 只依赖接口：

```csharp
// VoiceManager.cs
[SerializeField] private MonoBehaviour _pipelineSource; // Inspector 拖入
private IVoicePipeline _pipeline;

private void Awake()
{
    _pipeline = _pipelineSource as IVoicePipeline;
    if (_pipeline == null)
    {
        Debug.LogError("[VoiceManager] Pipeline source must implement IVoicePipeline!");
        enabled = false;
        return;
    }
    _pipeline.OnTranscript += OnTranscript;
    _pipeline.OnLLMResponse += OnLLMResponse;
    // ... 接线
}
```

**预计工时**: 6h (含三个实现的适配 + 回归测试)

---

### P5-2: 单例生命周期管理

**文件**: 全局
**影响**: `ConfigManager`/`DataStore` 单例在 Unity 生命周期中初始化时机不确定
**修复**: 引入统一的初始化锚点

```csharp
// 新建: Assets/Scripts/Runtime/Core/AppBootstrap.cs
namespace AstralFox.Core
{
    /// <summary>
    /// 应用启动引导器 — 确保所有单例在 Awake 之前就绪。
    /// 使用 RuntimeInitializeOnLoadMethod 在所有 Scene 加载前执行。
    /// </summary>
    public static class AppBootstrap
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        private static void Initialize()
        {
            // 强制初始化单例
            var cfg = Config.ConfigManager.Instance;
            var data = Data.DataStore.Instance;

            Debug.Log($"[AppBootstrap] Initialized. " +
                      $"Config exists: {cfg.ConfigFileExists}, " +
                      $"Chat records: {data.ChatHistoryCount}");
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void OnSceneLoaded()
        {
            // 应用好感度衰减
            Data.DataStore.Instance.ApplyAffectionDecay();
        }
    }
}
```

**预计工时**: 2h

---

### P5-3: 消除 Python Mock ASR 的随机假转录

**文件**: `backend/asr.py`
**影响**: ASR 不可用时随机返回假转录, 导致 AI 给出完全无关的回复
**修复**:

```python
# asr.py — 替换 mock_recognize

class ASRUnavailableError(Exception):
    """ASR 服务不可用"""
    pass

async def mock_recognize(pcm_bytes_list: list) -> str:
    """
    当 Azure ASR 不可用时, 不返回假数据。
    抛异常让上层决定如何处理 (例如告知用户/使用降级模式)。
    """
    raise ASRUnavailableError(
        "语音识别服务未配置。请设置 AZURE_SPEECH_KEY 环境变量, "
        "或在设置页面切换到本地 FunASR 模式。"
    )
```

**预计工时**: 0.5h

---

## Phase 6: 性能优化 (P2 — 2-3 天)

### P6-1: Chroma Key GPU 化

**文件**: `Assets/Scripts/Runtime/TransparentWindow.cs`
**影响**: 每帧 CPU 上处理 300k 像素的色键检测
**修复**: 创建 Compute Shader

```hlsl
// 新建: Assets/Shaders/ChromaKey.compute
#pragma kernel ChromaKey

Texture2D<float4> InputTexture;
RWStructuredBuffer<uint> OutputBuffer;

float4 ChromaKeyColor;
float ToleranceSq;
uint2 TextureSize;

[numthreads(8, 8, 1)]
void ChromaKey(uint3 id : SV_DispatchThreadID)
{
    if (id.x >= TextureSize.x || id.y >= TextureSize.y) return;

    float4 color = InputTexture.Load(uint3(id.xy, 0));

    float3 diff = color.rgb - ChromaKeyColor.rgb;
    float distSq = dot(diff, diff);

    uint pixelIndex = id.y * TextureSize.x + id.x;
    if (distSq <= ToleranceSq)
    {
        OutputBuffer[pixelIndex] = 0; // 透明
    }
    else
    {
        // 打包 BGRA (保持 Unity 的 BGRA32 格式)
        uint b = (uint)(color.b * 255);
        uint g = (uint)(color.g * 255);
        uint r = (uint)(color.r * 255);
        uint a = (uint)(color.a * 255);
        OutputBuffer[pixelIndex] = b | (g << 8) | (r << 16) | (a << 24);
    }
}
```

然后在 C# 中用 `ComputeShader.Dispatch` + `AsyncGPUReadback` 异步读取结果。

**预计工时**: 4h

---

### P6-2: DataStore 批量写入

**文件**: `Assets/Scripts/Runtime/Data/DataStore.cs`
**影响**: 每条聊天记录触发一次全量 JSON 写盘
**修复**: 引入写入节流

```csharp
// DataStore.cs
private float _saveThrottleTimer;
private const float SaveThrottleInterval = 5f; // 每 5 秒最多写一次

public void MarkDirty()
{
    _dirty = true;
}

public void Update(float deltaTime)
{
    if (!_dirty) return;
    _saveThrottleTimer += deltaTime;
    if (_saveThrottleTimer >= SaveThrottleInterval)
    {
        Save();
        _saveThrottleTimer = 0f;
    }
}

// 应用退出时强制保存:
public static void OnApplicationQuit()
{
    Instance.Save();
}
```

然后在 `VoiceManager` 或其他高频写入处调用 `DataStore.Instance.MarkDirty()` 而不是 `Save()`。

**预计工时**: 1.5h

---

## Phase 7: 测试基础设施 (P3 — 持续)

### P7-1: Unity 端单元测试

**关键测试用例**:

```csharp
// 新建: Assets/Tests/Runtime/Voice/VoiceManagerStateMachineTests.cs
using NUnit.Framework;
using UnityEngine.TestTools;
using AstralFox.Voice;

public class VoiceManagerStateMachineTests
{
    [Test]
    public void AllTimeouts_ShouldReportUserNotification()
    {
        // 验证每个超时状态触发 OnUserNotification 事件
    }

    [Test]
    public void StreamTokensArrivingAfterResponse_ShouldNotCorruptAccumulator()
    {
        // 验证 P1-3 的竞态修复
    }

    [Test]
    public void WakeWordDuringSpeaking_ShouldInterruptAndListen()
    {
        // 验证打断逻辑
    }
}
```

```csharp
// 新建: Assets/Tests/Runtime/Data/DataStoreEncryptionTests.cs
[Test]
public void AuthTokens_ShouldBeEncryptedOnDisk()
{
    DataStore.Instance.SaveAuthTokens("test-access", "test-refresh");
    DataStore.Instance.Save();

    // 读取原始文件, 验证不包含明文 token
    string raw = File.ReadAllText(Path.Combine(
        Application.persistentDataPath, "astralfox_data.json"));
    Assert.That(raw, Does.Not.Contain("test-access"));
}

[Test]
public void AuthTokens_ShouldRoundtrip()
{
    DataStore.Instance.SaveAuthTokens("access-123", "refresh-456");
    Assert.AreEqual("access-123", DataStore.Instance.LoadAccessToken());
    Assert.AreEqual("refresh-456", DataStore.Instance.LoadRefreshToken());
}
```

**预计工时**: 12h (首批关键测试)

---

### P7-2: Python BFF 集成测试

```python
# 新建: backend/tests/test_ws_protocol.py
import pytest
from fastapi.testclient import TestClient
from main import app

@pytest.mark.asyncio
async def test_hello_handshake():
    """协议握手: 版本不匹配时应拒绝连接"""
    ...

@pytest.mark.asyncio
async def test_end_of_speech_without_audio():
    """空音频应返回合理错误, 不崩溃"""
    ...

@pytest.mark.asyncio
async def test_mock_asr_raises_when_unconfigured():
    """Azure Key 未设置时 mock_recognize 应抛异常而非返回假数据"""
    ...
```

**预计工时**: 6h

---

## 工时汇总

| Phase | 内容 | 级别 | 预计工时 |
|-------|------|------|----------|
| Phase 0 | 止血 (安全 + 关键 Bug) | P0 | 6.5h |
| Phase 1 | 线程安全与并发 | P1 | 11.5h |
| Phase 2 | 状态机与错误处理 | P1 | 6h |
| Phase 3 | 协议版本化 | P1 | 4h |
| Phase 4 | 音频管线修复 | P1-P2 | 4.5h |
| Phase 5 | 架构重构 | P2 | 8.5h |
| Phase 6 | 性能优化 | P2 | 5.5h |
| Phase 7 | 测试基础设施 | P3 | 18h+ |
| **总计** | | | **~64h (约 8-10 个工作日)** |

---

## 执行建议

1. **Phase 0 必须在任何公开发布前完成**。安全漏洞（明文 Token、伪加密）是红线。
2. **Phase 1 和 Phase 2 可并行**：线程安全由一人负责，状态机/错误处理由另一人负责。
3. **Phase 5 (架构重构) 风险最高**，建议在 Phase 1-4 稳定后、有测试覆盖的情况下再做。
4. **Phase 7 (测试) 不应作为独立阶段**，而是在每个 Phase 的修复中同步添加测试。
5. 战略建议：**砍掉 Web 管理平台的创作者市场、A/B 实验、OAuth 服务器等不存在的用户需求**，把工程精力集中到桌面客户端的核心体验上。一个没有用户的平台基础设施 = 沉没成本。
