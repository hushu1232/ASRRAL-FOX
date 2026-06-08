using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;

namespace AstralFox.Voice
{
    /// <summary>
    /// Offline AI Brain orchestrator for AstralFox.
    ///
    /// Coordinates the local AI pipeline:
    ///   Microphone → VAD → WakeWord → [AIManager] → FunASR(ASR) → LLM → TTS → Speaker
    ///
    /// Replaces the external BackendClient (Python BFF) with fully offline services.
    /// VoiceManager continues to handle state machine + audio capture + wake word.
    /// AIManager handles transcript → response → speech synthesis.
    ///
    /// Service Status Lifecycle:
    ///   Initializing → Checking → Ready / Degraded / Unavailable
    ///
    /// Startup Wizard:
    ///   On first run, guides user through model download and setup.
    /// </summary>
    public sealed class AIManager : MonoBehaviour, IVoicePipeline
    {
        #region Types

        public enum ServiceTier
        {
            Unavailable,   // service not installed or failed to start
            Initializing,  // starting up, health check pending
            Degraded,      // running but with fallback (e.g., mock LLM)
            Ready,         // fully operational
        }

        public enum PipelineStage
        {
            Idle,
            Transcribing,  // FunASR recognizing speech
            Thinking,      // LLM generating response
            Speaking,      // TTS synthesizing audio
        }

        [Serializable]
        public struct ServiceStatus
        {
            public ServiceTier asr;
            public ServiceTier llm;
            public ServiceTier tts;
            public bool isFullyOffline;
            public string message;
        }

        #endregion

        #region Events

        /// <summary>One or more service statuses changed.</summary>
        public event Action<ServiceStatus> OnServiceStatusChanged;

        /// <summary>Pipeline stage changed (for UI progress display).</summary>
        public event Action<PipelineStage> OnPipelineStageChanged;

        /// <summary>Transcript received from ASR.</summary>
        public event Action<string> OnTranscript;

        /// <summary>LLM response received (raw, with [emotion][action][memory] tags).</summary>
        public event Action<string> OnLLMResponse;

        /// <summary>AudioClip ready for playback.</summary>
        public event Action<AudioClip> OnSpeechClipReady;

        /// <summary>Error during pipeline processing.</summary>
        public event Action<string> OnPipelineError;

        /// <summary>Progress update during pipeline stages.</summary>
        public event Action<string, float> OnProgress; // message, percent 0-1

        #endregion

        #region Inspector

        [Header("Services (auto-detected)")]
        [SerializeField]
        private FunASRService _asrService;

        [SerializeField]
        private LLMService _llmService;

        [SerializeField]
        private TTSService _ttsService;

        [Header("Pipeline")]
        [SerializeField, Range(5f, 60f)]
        private float _pipelineTimeout = 30f;

        [SerializeField]
        private bool _autoStartServices = true;

        [Header("Startup Wizard")]
        [SerializeField]
        private bool _showStartupWizard = true;

        [Header("Debug")]
        [SerializeField]
        private bool _verboseLogging = true;

        #endregion

        #region Properties

        public ServiceStatus CurrentStatus { get; private set; }
        public PipelineStage CurrentStage { get; private set; } = PipelineStage.Idle;
        public bool IsReady => CurrentStatus.asr >= ServiceTier.Degraded
                            && CurrentStatus.llm >= ServiceTier.Degraded
                            && CurrentStatus.tts >= ServiceTier.Degraded;
        public bool IsFullyOffline => CurrentStatus.isFullyOffline;

        #endregion

        #region Private Fields

        private bool _servicesStarted;
        private bool _wizardShown;
        private Task _currentPipelineTask;

        // Saved delegate references for proper unsubscribe in OnDestroy
        private Action _asrReadyHandler;
        private Action<string> _asrErrorHandler;
        private Action _ttsReadyHandler;
        private Action<string> _ttsErrorHandler;
        private Action<bool> _llmReadyHandler;
        private Action<string> _llmTokenHandler;
        private Action<string> _llmCompleteHandler;

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            // Auto-detect services on this GameObject
            if (_asrService == null) _asrService = GetComponent<FunASRService>();
            if (_llmService == null) _llmService = GetComponent<LLMService>();
            if (_ttsService == null) _ttsService = GetComponent<TTSService>();
            WirePipelineEvents();
        }

        private void Start()
        {
            if (_autoStartServices)
                _ = InitializeServicesAsync();
        }

        private void OnDestroy()
        {
            // Unsubscribe all service event handlers
            if (_asrService != null)
            {
                if (_asrReadyHandler != null) _asrService.OnReady -= _asrReadyHandler;
                if (_asrErrorHandler != null) _asrService.OnError -= _asrErrorHandler;
            }
            if (_ttsService != null)
            {
                if (_ttsReadyHandler != null) _ttsService.OnReady -= _ttsReadyHandler;
                if (_ttsErrorHandler != null) _ttsService.OnError -= _ttsErrorHandler;
            }
            if (_llmService != null)
            {
                if (_llmReadyHandler != null) _llmService.OnReadyChanged -= _llmReadyHandler;
                if (_llmTokenHandler != null) _llmService.OnTokenGenerated -= _llmTokenHandler;
                if (_llmCompleteHandler != null) _llmService.OnResponseComplete -= _llmCompleteHandler;
            }
        }

        #endregion

        #region Service Initialization

        /// <summary>Initialize all services and report status.</summary>
        public async System.Threading.Tasks.Task InitializeServicesAsync()
        {
            if (_servicesStarted) return;
            _servicesStarted = true;

            UpdateStatus(ServiceTier.Unavailable, ServiceTier.Unavailable, ServiceTier.Unavailable,
                "正在检查本地 AI 服务...");
            OnPipelineStageChanged?.Invoke(PipelineStage.Idle);

            // Start services in parallel
            var tasks = new List<Task>();

            if (_asrService != null)
            {
                _asrReadyHandler = () => UpdateSingleStatus(asr: ServiceTier.Ready);
                _asrErrorHandler = (err) =>
                {
                    Debug.LogWarning($"[AIManager] ASR error: {err}");
                    UpdateSingleStatus(asr: ServiceTier.Degraded, message: "语音识别服务异常，使用离线降级模式");
                };
                _asrService.OnReady += _asrReadyHandler;
                _asrService.OnError += _asrErrorHandler;
                tasks.Add(_asrService.StartServiceAsync());
            }

            if (_ttsService != null)
            {
                _ttsReadyHandler = () => UpdateSingleStatus(tts: ServiceTier.Ready);
                _ttsErrorHandler = (err) =>
                {
                    Debug.LogWarning($"[AIManager] TTS error: {err}");
                    UpdateSingleStatus(tts: ServiceTier.Degraded, message: "语音合成服务异常");
                };
                _ttsService.OnReady += _ttsReadyHandler;
                _ttsService.OnError += _ttsErrorHandler;
                tasks.Add(_ttsService.StartServiceAsync());
            }

            // LLM is in-process, just check readiness
            if (_llmService != null)
            {
                _llmReadyHandler = (ready) =>
                {
                    UpdateSingleStatus(llm: ready ? ServiceTier.Ready : ServiceTier.Degraded);
                };
                _llmService.OnReadyChanged += _llmReadyHandler;
                UpdateSingleStatus(llm: _llmService.IsReady ? ServiceTier.Ready : ServiceTier.Degraded);
            }

            await Task.WhenAll(tasks);

            // Final status check
            bool asrReady = _asrService != null && _asrService.IsReady;
            bool llmReady = _llmService != null && _llmService.IsReady;
            bool ttsReady = _ttsService != null && _ttsService.IsReady;
            bool isOffline = _llmService != null; // LLM is the anchor for "fully offline"

            string msg;
            if (asrReady && llmReady && ttsReady)
                msg = "全离线 AI 引擎就绪";
            else if (llmReady && (asrReady || ttsReady))
                msg = "AI 引擎部分就绪（降级模式）";
            else
                msg = "AI 服务初始化中...";

            UpdateStatus(
                asrReady ? ServiceTier.Ready : ServiceTier.Degraded,
                llmReady ? ServiceTier.Ready : ServiceTier.Degraded,
                ttsReady ? ServiceTier.Ready : ServiceTier.Degraded,
                msg,
                isOffline);

            if (_verboseLogging)
                Debug.Log($"[AIManager] Services initialized. ASR:{asrReady} LLM:{llmReady} TTS:{ttsReady} Offline:{isOffline}");

            // Show startup wizard if needed
            if (_showStartupWizard && !IsReady && !_wizardShown)
            {
                _wizardShown = true;
                ShowStartupWizard();
            }
        }

        #endregion

        #region Pipeline: Speech → Response

        /// <summary>
        /// Process recorded speech through the full pipeline with streaming:
        /// ASR(transcribe) → LLM(stream tokens) → TTS(per-sentence synthesis).
        /// Called by VoiceManager when user finishes speaking.
        /// </summary>
        public async Task ProcessSpeechAsync(float[] audioSamples, int sampleRate = 16000)
        {
            if (!IsReady)
            {
                OnPipelineError?.Invoke("AI 引擎未就绪");
                return;
            }

            try
            {
                // Stage 1: ASR — transcribe speech to text (always blocking)
                SetStage(PipelineStage.Transcribing);
                OnProgress?.Invoke("正在理解你说的话...", 0.1f);

                string transcript;
                if (_asrService != null && _asrService.IsReady)
                {
                    transcript = await _asrService.RecognizeAsync(audioSamples, sampleRate);
                }
                else
                {
                    transcript = "[语音识别不可用]";
                    Debug.LogWarning("[AIManager] ASR unavailable, using placeholder transcript.");
                }

                if (string.IsNullOrEmpty(transcript))
                {
                    OnPipelineError?.Invoke("未能识别语音内容");
                    SetStage(PipelineStage.Idle);
                    return;
                }

                OnTranscript?.Invoke(transcript);
                if (_verboseLogging) Debug.Log($"[AIManager] Transcript: \"{transcript}\"");

                // Stage 2: LLM — streaming generation with sentence-level TTS
                SetStage(PipelineStage.Thinking);
                OnProgress?.Invoke("星尘正在思考...", 0.3f);

                string response = await GenerateStreamingResponseAsync(transcript);

                if (string.IsNullOrEmpty(response))
                {
                    OnPipelineError?.Invoke("AI 回复生成失败");
                    SetStage(PipelineStage.Idle);
                    return;
                }

                OnLLMResponse?.Invoke(response);
                if (_verboseLogging) Debug.Log($"[AIManager] LLM: \"{response}\"");

                // Parse tags
                string cleanText = VoiceManager.ParseResponseTags(response,
                    out string emotion, out string action, out string memory,
                    out string command, out string commandValue);

                if (!string.IsNullOrEmpty(command))
                {
                    ExecuteACommand(command, commandValue);
                }

                // Stage 3: Synthesize any remaining unsynthesized text
                if (!string.IsNullOrEmpty(_pendingTtsText))
                {
                    SetStage(PipelineStage.Speaking);
                    OnProgress?.Invoke("正在合成语音...", 0.7f);
                    await SynthesizeAndPlay(_pendingTtsText);
                    _pendingTtsText = "";
                }

                // Synthesize remaining clean text (only if no sentence-level TTS happened)
                if (_ttsSentenceCount == 0 && _ttsService != null && _ttsService.IsReady)
                {
                    SetStage(PipelineStage.Speaking);
                    var clip = await _ttsService.SpeakAsync(cleanText);
                    if (clip != null)
                        OnSpeechClipReady?.Invoke(clip);
                }

                OnProgress?.Invoke("完成！", 1.0f);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[AIManager] Pipeline error: {ex.Message}");
                OnPipelineError?.Invoke($"处理失败: {ex.Message}");
            }
            finally
            {
                SetStage(PipelineStage.Idle);
                _ttsSentenceCount = 0;
            }
        }

        // Streaming LLM generation with per-sentence TTS
        private string _pendingTtsText = "";
        private int _ttsSentenceCount = 0;
        private static readonly System.Text.RegularExpressions.Regex SentenceEndRe =
            new System.Text.RegularExpressions.Regex(@"[。！？!?.\n]");

        private async Task<string> GenerateStreamingResponseAsync(string userMessage)
        {
            if (_llmService == null || !_llmService.IsReady)
                return "[happy]喵～听到了听到了！[/happy]";

            var tcs = new TaskCompletionSource<string>();
            var fullResponse = new System.Text.StringBuilder();
            var currentSentence = new System.Text.StringBuilder();

            // Subscribe to streaming tokens
            Action<string> onToken = null;
            Action<string> onComplete = null;

            onToken = (token) =>
            {
                fullResponse.Append(token);
                currentSentence.Append(token);

                // Check for sentence boundary
                string sentenceText = currentSentence.ToString();
                var match = SentenceEndRe.Match(sentenceText);
                if (match.Success)
                {
                    int endPos = match.Index + match.Length;
                    string complete = sentenceText.Substring(0, endPos).Trim();
                    string remainder = sentenceText.Substring(endPos);

                    if (!string.IsNullOrEmpty(complete))
                    {
                        // Synthesize this sentence asynchronously (fire-and-forget per sentence)
                        string sentence = complete;
                        _ = SynthesizeSentenceAsync(sentence);
                        _ttsSentenceCount++;
                    }

                    currentSentence.Clear();
                    if (!string.IsNullOrEmpty(remainder))
                        currentSentence.Append(remainder);
                }
            };

            onComplete = (response) =>
            {
                // Store any remaining text for final TTS
                string remaining = currentSentence.ToString().Trim();
                if (!string.IsNullOrEmpty(remaining))
                    _pendingTtsText = remaining;

                _llmService.OnTokenGenerated -= onToken;
                _llmService.OnResponseComplete -= onComplete;
                tcs.TrySetResult(response);
            };

            _llmService.OnTokenGenerated += onToken;
            _llmService.OnResponseComplete += onComplete;

            // Start generation
            try
            {
                _ = _llmService.ChatAsync(userMessage);
                return await tcs.Task;
            }
            catch (Exception ex)
            {
                _llmService.OnTokenGenerated -= onToken;
                _llmService.OnResponseComplete -= onComplete;
                Debug.LogError($"[AIManager] LLM streaming error: {ex.Message}");
                return null;
            }
        }

        private async Task SynthesizeSentenceAsync(string text)
        {
            if (string.IsNullOrEmpty(text) || _ttsService == null || !_ttsService.IsReady)
                return;

            try
            {
                SetStage(PipelineStage.Speaking);
                var clip = await _ttsService.SpeakAsync(text);
                if (clip != null)
                {
                    OnSpeechClipReady?.Invoke(clip);
                }
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[AIManager] Per-sentence TTS failed: {ex.Message}");
            }
        }

        private async Task SynthesizeAndPlay(string text)
        {
            if (_ttsService == null || !_ttsService.IsReady) return;
            var clip = await _ttsService.SpeakAsync(text);
            if (clip != null)
                OnSpeechClipReady?.Invoke(clip);
        }

        #endregion

        #region Public API

        /// <summary>Force a quick status check on all services.</summary>
        public ServiceStatus CheckAllServices()
        {
            ServiceTier asr = _asrService != null && _asrService.IsReady ? ServiceTier.Ready : ServiceTier.Degraded;
            ServiceTier llm = _llmService != null && _llmService.IsReady ? ServiceTier.Ready : ServiceTier.Degraded;
            ServiceTier tts = _ttsService != null && _ttsService.IsReady ? ServiceTier.Ready : ServiceTier.Degraded;
            UpdateStatus(asr, llm, tts, CurrentStatus.message, CurrentStatus.isFullyOffline);
            return CurrentStatus;
        }

        /// <summary>Restart all services.</summary>
        public void RestartAllServices()
        {
            _asrService?.StopService();
            _ttsService?.StopService();
            _servicesStarted = false;
            _ = InitializeServicesAsync();
        }

        /// <summary>Cancel current pipeline processing.</summary>
        public void CancelPipeline()
        {
            _llmService?.StopGeneration();
            SetStage(PipelineStage.Idle);
        }

        #endregion

        #region Startup Wizard

        private void ShowStartupWizard()
        {
            // Build a setup guide message
            string guide = BuildStartupGuide();
            Debug.Log($"[AIManager] Startup Wizard:\n{guide}");

            // The wizard can be displayed via a UI component that listens to OnServiceStatusChanged
            // For now, log the guide and set a flag
            var status = CurrentStatus;
            status.message = guide;
            CurrentStatus = status;
            OnServiceStatusChanged?.Invoke(CurrentStatus);
        }

        private string BuildStartupGuide()
        {
            var sb = new System.Text.StringBuilder();
            sb.AppendLine("═══════════════════════════════════════");
            sb.AppendLine("  星尘狐 本地 AI 引擎 — 首次启动向导");
            sb.AppendLine("═══════════════════════════════════════");
            sb.AppendLine("");

            if (CurrentStatus.asr == ServiceTier.Unavailable)
            {
                sb.AppendLine("【语音识别 (FunASR) — 未安装】");
                sb.AppendLine("  1. 安装 Python 3.10+ 和 funasr 包");
                sb.AppendLine("     pip install funasr soundfile numpy");
                sb.AppendLine("  2. 下载 Paraformer 模型放入 StreamingAssets/funasr/models/");
                sb.AppendLine("  3. 使用 PyInstaller 打包: pyinstaller --onefile funasr_server.py");
                sb.AppendLine("  4. 将 funasr_server.exe 放入 StreamingAssets/funasr/");
                sb.AppendLine("");
            }

            if (CurrentStatus.llm == ServiceTier.Unavailable)
            {
                sb.AppendLine("【大语言模型 (LLMUnity + Qwen2.5) — 未安装】");
                sb.AppendLine("  1. 在 Unity Package Manager 安装 LLMUnity");
                sb.AppendLine("  2. 下载 Qwen2.5-7B-Instruct-Q4_K_M.gguf");
                sb.AppendLine("  3. 放入 Assets/StreamingAssets/models/");
                sb.AppendLine("  4. 在 Player Settings → Scripting Define Symbols 添加: LLMUNITY_PRESENT");
                sb.AppendLine("");
            }

            if (CurrentStatus.tts == ServiceTier.Unavailable)
            {
                sb.AppendLine("【语音合成 (sherpa-onnx) — 未安装】");
                sb.AppendLine("  1. 安装 Python 3.10+ 和 sherpa-onnx 包");
                sb.AppendLine("     pip install sherpa-onnx");
                sb.AppendLine("  2. 下载 VITS-Melo-ZH 模型放入 StreamingAssets/tts/models/");
                sb.AppendLine("  3. 使用 PyInstaller 打包: pyinstaller --onefile tts_server.py");
                sb.AppendLine("  4. 将 tts_server.exe 放入 StreamingAssets/tts/");
                sb.AppendLine("");
            }

            sb.AppendLine("所有服务就绪后，重启应用程序即可享受全离线 AI 体验！");
            sb.AppendLine("═══════════════════════════════════════");

            return sb.ToString();
        }

        #endregion

        #region Helpers

        private void SetStage(PipelineStage stage)
        {
            if (CurrentStage == stage) return;
            CurrentStage = stage;
            OnPipelineStageChanged?.Invoke(stage);

            if (_verboseLogging)
                Debug.Log($"[AIManager] Stage: {stage}");
        }

        private void UpdateStatus(ServiceTier asr, ServiceTier llm, ServiceTier tts, string message, bool? offline = null)
        {
            CurrentStatus = new ServiceStatus
            {
                asr = asr,
                llm = llm,
                tts = tts,
                message = message,
                isFullyOffline = offline ?? CurrentStatus.isFullyOffline,
            };
            OnServiceStatusChanged?.Invoke(CurrentStatus);
        }

        private void UpdateSingleStatus(ServiceTier? asr = null, ServiceTier? llm = null,
                                         ServiceTier? tts = null, string message = null, bool? offline = null)
        {
            UpdateStatus(
                asr ?? CurrentStatus.asr,
                llm ?? CurrentStatus.llm,
                tts ?? CurrentStatus.tts,
                message ?? CurrentStatus.message,
                offline);
        }

        private void ExecuteACommand(string command, string value)
        {
            switch (command)
            {
                case "set_personality":
                    Data.DataStore.Instance.SetCharacterPersonality(value);
                    _llmService?.ReloadPersonality();
                    if (_verboseLogging) Debug.Log($"[AIManager] Personality updated: {value}");
                    break;
                case "clear_memory":
                    Data.DataStore.Instance.SetMemorySummary("");
                    _llmService?.ClearHistory();
                    if (_verboseLogging) Debug.Log("[AIManager] Memory cleared.");
                    break;
            }
        }

        #endregion

        #region IVoicePipeline — Unified Backend Interface

        // Audio accumulation: VoiceManager streams mic audio, we buffer for ASR
        private readonly System.Collections.Generic.List<float> _audioBuffer = new System.Collections.Generic.List<float>();
        private int _audioSampleRate = 16000;

        public bool IsConnected => IsReady;

        public event Action<bool> OnConnectionChanged;
        public event Action<string> OnFinalTranscript;
        event Action<string> IVoicePipeline.OnLLMToken
        {
            add => _llmTokenDelegates += value;
            remove => _llmTokenDelegates -= value;
        }
        private Action<string> _llmTokenDelegates;

        event Action<string> IVoicePipeline.OnEmotionTag
        {
            add => _emotionTagDelegates += value;
            remove => _emotionTagDelegates -= value;
        }
        private Action<string> _emotionTagDelegates;

        event Action<string> IVoicePipeline.OnActionTag
        {
            add => _actionTagDelegates += value;
            remove => _actionTagDelegates -= value;
        }
        private Action<string> _actionTagDelegates;

        event Action<string> IVoicePipeline.OnLLMResponse
        {
            add => _llmResponseDelegates += value;
            remove => _llmResponseDelegates -= value;
        }
        private Action<string> _llmResponseDelegates;

        public event Action<int, byte[]> OnTTSAudio;
        public event Action<int, byte[]> OnTTSWavAudio;
        public event Action OnTTSDone;
        public event Action<string, string> OnReminder;
        public event Action<string> OnError;
        public event Action OnReconnected;

        /// <summary>Accumulate audio from mic for later ASR processing.</summary>
        public void SendAudio(float[] samples, int sampleRate, int channels)
        {
            _audioSampleRate = sampleRate;
            _audioBuffer.AddRange(samples);
        }

        /// <summary>Send context JSON before processing (for compatibility with IVoicePipeline).</summary>
        public System.Threading.Tasks.Task SendTextAsync(string contextJson)
        {
            // AIManager builds its own context internally; no-op for text sends
            return System.Threading.Tasks.Task.CompletedTask;
        }

        /// <summary>Process accumulated audio through local AI pipeline.</summary>
        public async System.Threading.Tasks.Task FlushAudioAsync()
        {
            if (_audioBuffer.Count == 0) return;

            float[] audioCopy = _audioBuffer.ToArray();
            _audioBuffer.Clear();

            // Fire service status as connection change
            OnConnectionChanged?.Invoke(IsReady);

            await ProcessSpeechAsync(audioCopy, _audioSampleRate);

            // Bridge internal events to IVoicePipeline events
            OnTTSDone?.Invoke();
        }

        /// <summary>Disconnect local services.</summary>
        public async System.Threading.Tasks.Task DisconnectAsync()
        {
            _asrService?.StopService();
            _ttsService?.StopService();
            _audioBuffer.Clear();
            OnConnectionChanged?.Invoke(false);
            await System.Threading.Tasks.Task.CompletedTask;
        }

        /// <summary>Bridge internal AIManager events to IVoicePipeline interface events.</summary>
        private void WirePipelineEvents()
        {
            // Wire transcript
            OnTranscript += (text) =>
            {
                OnFinalTranscript?.Invoke(text);
                // Also fire connection changed on first successful pipeline
                if (!IsReady) OnConnectionChanged?.Invoke(IsReady);
            };

            // Wire LLM streaming (when LLMService provides tokens)
            if (_llmService != null)
            {
                _llmTokenHandler = (token) =>
                {
                    _llmTokenDelegates?.Invoke(token);
                };
                _llmCompleteHandler = (response) =>
                {
                    _llmResponseDelegates?.Invoke(response);
                };
                _llmService.OnTokenGenerated += _llmTokenHandler;
                _llmService.OnResponseComplete += _llmCompleteHandler;
            }

            // Wire speech to TTS audio callbacks
            OnSpeechClipReady += (clip) =>
            {
                if (clip != null)
                {
                    // Convert AudioClip to PCM bytes for TTS audio callback
                    float[] samples = new float[clip.samples * clip.channels];
                    clip.GetData(samples, 0);
                    byte[] pcm = ConvertAudioClipToPCM16(samples);
                    OnTTSAudio?.Invoke(0, pcm);
                }
            };

            // Wire errors
            OnPipelineError += (err) => OnError?.Invoke(err);

            // Wire service status changes
            OnServiceStatusChanged += (status) =>
            {
                OnConnectionChanged?.Invoke(IsReady);
            };
        }

        private static byte[] ConvertAudioClipToPCM16(float[] samples)
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
