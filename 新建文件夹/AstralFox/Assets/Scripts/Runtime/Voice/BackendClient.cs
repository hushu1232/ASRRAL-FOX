using System;
using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

namespace AstralFox.Voice
{
    /// <summary>
    /// WebSocket client for the AstralFox backend (FastAPI BFF).
    ///
    /// Protocol:
    ///   Client → Server: binary PCM audio chunks (16kHz, 16bit, mono)
    ///   Server → Client: JSON text messages
    ///     {"type": "partial_transcript", "text": "..."}
    ///     {"type": "final_transcript", "text": "用户说了什么"}
    ///     {"type": "llm_token", "token": "你"}          // streaming token
    ///     {"type": "emotion", "emotion": "happy"}        // streaming emotion change
    ///     {"type": "action", "action": "wave"}           // streaming action
    ///     {"type": "llm_response", "text": "[happy]你好呀!"}  // full response (legacy)
    ///     {"type": "tts_audio", "index": 0, "data": "<base64 PCM>"}
    ///     {"type": "tts_audio_wav", "index": 0, "data": "<base64 WAV>"} // WAV chunks
    ///     {"type": "tts_done"}
    ///     {"type": "reminder", "reminder_id": "...", "reminder_title": "..."}
    ///     {"type": "error", "message": "..."}
    ///
    /// For Phase 3 testing, connects to ws://localhost:8765/ws/chat.
    /// </summary>
    public sealed class BackendClient : MonoBehaviour, IVoicePipeline
    {
        #region Connection State Machine

        private enum ConnectionState
        {
            Disconnected,
            Connecting,
            Connected,
            Disconnecting,
        }

        private readonly object _stateLock = new object();
        private ConnectionState _connectionState = ConnectionState.Disconnected;

        private bool TryTransition(ConnectionState from, ConnectionState to)
        {
            lock (_stateLock)
            {
                if (_connectionState != from) return false;
                _connectionState = to;
                return true;
            }
        }

        private void SetState(ConnectionState state)
        {
            lock (_stateLock) { _connectionState = state; }
        }

        #endregion

        #region Inspector

        [Header("Connection")]
        [SerializeField]
        private string _serverUrl = "ws://localhost:8765/ws/chat";

        [SerializeField, Range(1f, 30f)]
        private float _reconnectDelay = 3f;

        [SerializeField, Range(1f, 60f)]
        private float _pingInterval = 10f;

        [Header("Audio Send")]
#pragma warning disable CS0414 // Inspector field, reserved for batched send scheduling
        [SerializeField, Range(0.02f, 0.5f)]
        private float _sendInterval = 0.1f;
#pragma warning restore CS0414

        [SerializeField, Range(1, 10)]
        private int _maxQueueSize = 5;

        [Header("Debug")]
        [SerializeField]
        private bool _autoConnect = true;

        [SerializeField]
        private bool _logMessages = false; // set true to debug raw WebSocket messages

        #endregion

        #region Events

        public event Action<bool> OnConnectionChanged;
        public event Action OnReconnected;            // fired after successful reconnect
        public event Action<string> OnPartialTranscript;
        public event Action<string> OnFinalTranscript;
        public event Action<string> OnLLMResponse;   // full text with tags (legacy/completion)
        public event Action<string> OnLLMToken;      // streaming token from LLM
        public event Action<string> OnEmotionTag;    // streaming emotion change
        public event Action<string> OnActionTag;     // streaming action
        public event Action<int, byte[]> OnTTSAudio;  // chunk index, PCM data
        public event Action<int, byte[]> OnTTSWavAudio; // chunk index, WAV bytes
        public event Action OnTTSDone;
        public event Action<string, string> OnReminder; // reminder_id, title
        public event Action<string> OnError;

        #endregion

        #region Properties

        public bool IsConnected
        {
            get { lock (_stateLock) return _connectionState == ConnectionState.Connected; }
        }

        #endregion

        #region Private Fields

        private ClientWebSocket _ws;
        private CancellationTokenSource _cts;
        private CancellationTokenSource _connectCts;
        private bool _wasUnexpectedDisconnect;
        private float _reconnectTimer;
        private float _sendTimer;
        private float _pingTimer;

        // Audio buffer — SemaphoreSlim for precise backpressure
        private readonly System.Collections.Concurrent.ConcurrentQueue<byte[]> _audioOutQueue = new();
        private System.Threading.SemaphoreSlim _audioSendSemaphore;

        // Receive buffer + main-thread dispatch queue
        private byte[] _recvBuffer = new byte[65536];
        private ConcurrentQueue<string> _pendingMessages = new ConcurrentQueue<string>();

        #endregion

        #region Unity Lifecycle

        private async void Start()
        {
            if (_autoConnect)
                await ConnectAsync();
        }

        private void Update()
        {
            // Drain pending messages from background thread onto main thread
            while (_pendingMessages.TryDequeue(out string json))
            {
                ProcessMessage(json);
            }

            if (IsConnected)
            {
                _sendTimer += Time.unscaledDeltaTime;
                _pingTimer += Time.unscaledDeltaTime;

                if (_pingTimer >= _pingInterval)
                {
                    _pingTimer = 0f;
                    _ = SendPingAsync();
                }
            }
            else
            {
                _reconnectTimer += Time.unscaledDeltaTime;
                if (_reconnectTimer >= _reconnectDelay)
                {
                    _reconnectTimer = 0f;
                    _ = ConnectAsync();
                }
            }
        }

        private async void OnDestroy()
        {
            await DisconnectAsync();
        }

        #endregion

        #region Connection

        private const int ProtocolVersion = 4;

        private async Task SendHelloAsync()
        {
            var hello = new
            {
                type = "hello",
                version = ProtocolVersion,
                features = new[] { "streaming_tokens", "wav_audio", "emotion_stream", "action_stream" },
                client = "astralfox-unity",
                client_version = Application.version,
            };
            await SendTextAsync(JsonUtility.ToJson(hello));
        }

        public async Task ConnectAsync()
        {
            // Prevent duplicate connection attempts
            if (!TryTransition(ConnectionState.Disconnected, ConnectionState.Connecting))
                return;

            try
            {
                _connectCts?.Cancel();
                _connectCts = new CancellationTokenSource(TimeSpan.FromSeconds(5));

                _cts?.Cancel();
                _cts = new CancellationTokenSource();

                _ws?.Dispose();
                _ws = new ClientWebSocket();
                _ws.Options.KeepAliveInterval = TimeSpan.FromSeconds(30);

                await _ws.ConnectAsync(new Uri(_serverUrl), _connectCts.Token);

                SetState(ConnectionState.Connected);
                _reconnectTimer = 0f;
                _pingTimer = 0f;
                _sendTimer = 0f;

                // Dispatch event on main thread
                OnConnectionChanged?.Invoke(true);

                if (_logMessages)
                    Debug.Log($"[BackendClient] Connected to {_serverUrl}");

                // Protocol handshake
                await SendHelloAsync();

                // Fire reconnect event if this was an unexpected drop
                if (_wasUnexpectedDisconnect)
                {
                    _wasUnexpectedDisconnect = false;
                    OnReconnected?.Invoke();
                    if (_logMessages)
                        Debug.Log("[BackendClient] Reconnected after unexpected disconnect.");
                }

                _ = ReceiveLoopAsync(_cts.Token);
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[BackendClient] Connection failed: {ex.Message}");
                SetState(ConnectionState.Disconnected);
                OnConnectionChanged?.Invoke(false);
            }
        }

        public async Task DisconnectAsync()
        {
            _wasUnexpectedDisconnect = false; // manual disconnect, not a drop
            SetState(ConnectionState.Disconnecting);
            _cts?.Cancel();

            if (_ws != null && _ws.State == WebSocketState.Open)
            {
                try
                {
                    using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(2));
                    await _ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", cts.Token);
                }
                catch { /* ignore close errors */ }
            }

            _ws?.Dispose();
            _ws = null;
            ClearAudioQueue();
            SetState(ConnectionState.Disconnected);
            OnConnectionChanged?.Invoke(false);
        }

        private void ClearAudioQueue()
        {
            while (_audioOutQueue.TryDequeue(out _))
                _audioSendSemaphore?.Release();
        }

        #endregion

        #region Send Audio

        /// <summary>Enqueue raw float audio samples to be sent to the backend.
        /// Samples are converted to 16-bit PCM and sent in batches.</summary>
        public void SendAudio(float[] samples, int sampleRate, int channels)
        {
            if (!IsConnected) return;

            if (_audioSendSemaphore == null)
                _audioSendSemaphore = new System.Threading.SemaphoreSlim(_maxQueueSize, _maxQueueSize);

            // Non-blocking backpressure: drop if queue full
            if (!_audioSendSemaphore.Wait(0)) return;

            byte[] pcm = ConvertToPCM16(samples);
            _audioOutQueue.Enqueue(pcm);
        }

        /// <summary>Send a text command/message to the backend.</summary>
        public async Task SendTextAsync(string message)
        {
            if (!IsConnected || _ws == null || _cts == null) return;
            try
            {
                byte[] data = Encoding.UTF8.GetBytes(message);
                await _ws.SendAsync(new ArraySegment<byte>(data), WebSocketMessageType.Text, true, _cts.Token);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[BackendClient] Send error: {ex.Message}");
                SetState(ConnectionState.Disconnected);
                OnConnectionChanged?.Invoke(false);
            }
        }

        /// <summary>Flush accumulated audio from the queue and send as a batch.</summary>
        public async Task FlushAudioAsync()
        {
            if (!IsConnected || _ws == null || _cts == null || _audioOutQueue.IsEmpty) return;

            try
            {
                var batch = new System.Collections.Generic.List<byte>();
                while (_audioOutQueue.TryDequeue(out byte[] chunk))
                {
                    batch.AddRange(chunk);
                    _audioSendSemaphore?.Release();
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
                // Drain the semaphore to prevent deadlock
                while (_audioOutQueue.TryDequeue(out _))
                    _audioSendSemaphore?.Release();
                SetState(ConnectionState.Disconnected);
                OnConnectionChanged?.Invoke(false);
            }
        }

        private async Task SendPingAsync()
        {
            try
            {
                await SendTextAsync("{\"type\":\"ping\"}");
            }
            catch { /* ignore ping failures */ }
        }

        #endregion

        #region Receive

        private async Task ReceiveLoopAsync(CancellationToken ct)
        {
            var msgBuffer = new System.Collections.Generic.List<byte>();

            try
            {
                while (!ct.IsCancellationRequested && _ws.State == WebSocketState.Open)
                {
                    var result = await _ws.ReceiveAsync(new ArraySegment<byte>(_recvBuffer), ct);

                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        Debug.Log("[BackendClient] Server closed connection.");
                        break;
                    }

                    msgBuffer.AddRange(new ArraySegment<byte>(_recvBuffer, 0, result.Count));

                    if (result.EndOfMessage)
                    {
                        string json = Encoding.UTF8.GetString(msgBuffer.ToArray());
                        msgBuffer.Clear();
                        _pendingMessages.Enqueue(json); // dispatch to main thread
                    }
                }

                // Loop exited cleanly (ws.State != Open) — treat as disconnected
                if (_logMessages)
                    Debug.Log("[BackendClient] Receive loop ended (connection closed).");
            }
            catch (OperationCanceledException) { }
            catch (Exception ex)
            {
                if (_logMessages)
                    Debug.LogWarning($"[BackendClient] Receive error: {ex.Message}");
            }
            finally
            {
                _wasUnexpectedDisconnect = true;
                SetState(ConnectionState.Disconnected);
                ClearAudioQueue();
                OnConnectionChanged?.Invoke(false);
            }
        }

        private void ProcessMessage(string json)
        {
            if (_logMessages)
                Debug.Log($"[BackendClient] ← {json}");

            try
            {
                var msg = JsonUtility.FromJson<WsMessage>(json);
                if (msg == null) return;

                switch (msg.type)
                {
                    case "welcome":
                        if (msg.protocol_version != ProtocolVersion)
                        {
                            Debug.LogError($"[BackendClient] Protocol mismatch! Server={msg.protocol_version}, Client={ProtocolVersion}");
                            OnError?.Invoke($"服务器协议版本不匹配 (服务器:{msg.protocol_version} 客户端:{ProtocolVersion})，请更新应用。");
                            _ = DisconnectAsync();
                        }
                        else if (_logMessages)
                        {
                            Debug.Log($"[BackendClient] Handshake OK. Server: {msg.server_version}");
                        }
                        break;

                    case "partial_transcript":
                        OnPartialTranscript?.Invoke(msg.text);
                        break;

                    case "final_transcript":
                        OnFinalTranscript?.Invoke(msg.text);
                        break;

                    case "llm_token":
                        if (!string.IsNullOrEmpty(msg.token))
                            OnLLMToken?.Invoke(msg.token);
                        break;

                    case "emotion":
                        if (!string.IsNullOrEmpty(msg.emotion))
                            OnEmotionTag?.Invoke(msg.emotion);
                        break;

                    case "action":
                        if (!string.IsNullOrEmpty(msg.action))
                            OnActionTag?.Invoke(msg.action);
                        break;

                    case "llm_response":
                        OnLLMResponse?.Invoke(msg.text);
                        break;

                    case "tts_audio":
                        {
                            int index = msg.index;
                            if (!string.IsNullOrEmpty(msg.data))
                            {
                                byte[] pcm = Convert.FromBase64String(msg.data);
                                OnTTSAudio?.Invoke(index, pcm);
                            }
                        }
                        break;

                    case "tts_audio_wav":
                        {
                            int index = msg.index;
                            if (!string.IsNullOrEmpty(msg.data))
                            {
                                byte[] wav = Convert.FromBase64String(msg.data);
                                OnTTSWavAudio?.Invoke(index, wav);
                            }
                        }
                        break;

                    case "tts_done":
                        OnTTSDone?.Invoke();
                        break;

                    case "reminder":
                        OnReminder?.Invoke(msg.reminder_id ?? "", msg.reminder_title ?? "");
                        Debug.Log($"[BackendClient] Reminder fired: {msg.reminder_title}");
                        break;

                    case "error":
                        OnError?.Invoke(msg.message);
                        break;
                }
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[BackendClient] Failed to parse message: {ex.Message}");
            }
        }

        #endregion

        #region Utilities

        [Serializable]
        private class WsMessage
        {
            public string type;
            public string text;
            public string token;
            public string emotion;
            public string action;
            public string message;
            public int index;
            public string data;
            public string reminder_id;
            public string reminder_title;
            public int protocol_version;
            public string server_version;
            public string error_code;
        }

        private static byte[] ConvertToPCM16(float[] samples)
        {
            byte[] pcm = new byte[samples.Length * 2];
            for (int i = 0; i < samples.Length; i++)
            {
                short s = (short)(Mathf.Clamp(samples[i], -1f, 1f) * 32767f);
                pcm[i * 2] = (byte)(s & 0xFF);
                pcm[i * 2 + 1] = (byte)((s >> 8) & 0xFF);
            }
            return pcm;
        }

        #endregion
    }
}
