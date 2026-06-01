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
    public sealed class BackendClient : MonoBehaviour
    {
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

        public bool IsConnected { get; private set; }

        #endregion

        #region Private Fields

        private ClientWebSocket _ws;
        private CancellationTokenSource _cts;
        private float _reconnectTimer;
        private float _sendTimer;
        private float _pingTimer;

        // Audio buffer — accumulates samples for batched send
        private ConcurrentQueue<byte[]> _audioOutQueue = new ConcurrentQueue<byte[]>();
        private int _audioOutQueueCount;

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

        public async Task ConnectAsync()
        {
            if (IsConnected) return;

            try
            {
                _cts?.Cancel();
                _cts = new CancellationTokenSource();

                _ws?.Dispose();
                _ws = new ClientWebSocket();
                _ws.Options.KeepAliveInterval = TimeSpan.FromSeconds(30);

                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                await _ws.ConnectAsync(new Uri(_serverUrl), cts.Token);

                IsConnected = true;
                _reconnectTimer = 0f;
                _pingTimer = 0f;
                _sendTimer = 0f;

                OnConnectionChanged?.Invoke(true);

                if (_logMessages)
                    Debug.Log($"[BackendClient] Connected to {_serverUrl}");

                // Start receive loop
                _ = ReceiveLoopAsync(_cts.Token);
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[BackendClient] Connection failed: {ex.Message}");
                IsConnected = false;
                OnConnectionChanged?.Invoke(false);
            }
        }

        public async Task DisconnectAsync()
        {
            IsConnected = false;
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
            OnConnectionChanged?.Invoke(false);
        }

        private void ClearAudioQueue()
        {
            while (_audioOutQueue.TryDequeue(out _))
                Interlocked.Decrement(ref _audioOutQueueCount);
        }

        #endregion

        #region Send Audio

        /// <summary>Enqueue raw float audio samples to be sent to the backend.
        /// Samples are converted to 16-bit PCM and sent in batches.</summary>
        public void SendAudio(float[] samples, int sampleRate, int channels)
        {
            if (!IsConnected) return;
            if (_audioOutQueueCount >= _maxQueueSize) return; // backpressure

            byte[] pcm = ConvertToPCM16(samples);
            _audioOutQueue.Enqueue(pcm);
            Interlocked.Increment(ref _audioOutQueueCount);
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
                IsConnected = false;
                OnConnectionChanged?.Invoke(false);
            }
        }

        /// <summary>Flush accumulated audio from the queue and send as a batch.</summary>
        public async Task FlushAudioAsync()
        {
            if (!IsConnected || _ws == null || _cts == null || _audioOutQueue.IsEmpty) return;

            try
            {
                // Combine all queued audio buffers
                var batch = new System.Collections.Generic.List<byte>();
                while (_audioOutQueue.TryDequeue(out byte[] chunk))
                {
                    batch.AddRange(chunk);
                    Interlocked.Decrement(ref _audioOutQueueCount);
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
                IsConnected = false;
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
                IsConnected = false;
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
