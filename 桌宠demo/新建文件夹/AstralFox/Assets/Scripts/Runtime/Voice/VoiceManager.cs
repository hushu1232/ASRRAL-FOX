using System;
using System.Collections.Generic;
using UnityEngine;

[Serializable]
internal struct VoiceContextMessage
{
    public string type;
    public string emotion_context;
    public string chat_history;
    public string personality;
    public string memory_summary;
    public string character_name;
    public string character_backstory;
    public string character_extra;
}

namespace AstralFox.Voice
{
    /// <summary>
    /// Central coordinator for the voice pipeline.
    ///
    /// Pipeline:
    ///   Microphone → VAD → [WakeWord check] → [On wake: record] → Backend WS → Response
    ///
    /// States:
    ///   Idle        — waiting for wake word
    ///   Listening   — wake word detected, waiting for user speech (VAD)
    ///   Recording   — user is speaking, streaming audio to backend
    ///   Processing  — waiting for backend response (LLM + TTS)
    ///   Speaking    — playing TTS audio (handled by phase 5)
    ///
    /// Communication with IPetAnimator (via PetAnimationManager):
    ///   OnWakeWord → CurrentAnimator.OnWakeWord()
    ///   OnSpeechStart → CurrentAnimator.OnListening() style
    ///   OnResponse → CurrentAnimator.OnSpeakingStart()
    ///   OnResponseDone → CurrentAnimator.OnSpeakingEnd()
    /// </summary>
    [RequireComponent(typeof(MicrophoneCapture))]
    [RequireComponent(typeof(VoiceActivityDetector))]
    [RequireComponent(typeof(WakeWordDetector))]
    [RequireComponent(typeof(BackendClient))]
    [RequireComponent(typeof(TTSPlayer))]
    public sealed class VoiceManager : MonoBehaviour
    {
        #region Types

        public enum VoiceState
        {
            Idle,
            Listening,
            Recording,
            Processing,
            Speaking
        }

        #endregion

        #region Inspector

        [Header("Voice Pipeline")]
        [SerializeField, Range(1f, 30f)]
        private float _listenTimeout = 8f; // max time to wait for speech after wake

        [SerializeField, Range(1f, 30f)]
        private float _recordMaxDuration = 15f; // max recording length

        [SerializeField, Range(5f, 60f)]
        private float _processingTimeout = 30f; // max time to wait for backend response

        [SerializeField, Range(5f, 120f)]
        private float _speakingTimeout = 30f; // max TTS playback duration

        [Header("Interrupt")]
        [SerializeField, Range(0.01f, 0.5f)]
        private float _interruptMicThreshold = 0.05f; // mic level above which to interrupt TTS

        [SerializeField, Range(0.05f, 0.5f)]
        private float _interruptHoldTime = 0.2f; // time mic must be above threshold to trigger interrupt

        [SerializeField, Range(0.5f, 3f)]
        private float _interruptCooldown = 1f; // wait after speech starts before allowing interrupt

        [Header("Response")]
        [SerializeField]
        private bool _autoPlayResponse = true; // when true, send response to animation system

        [Header("Debug")]
        [SerializeField]
        private bool _verboseLogging = true;

        #endregion

        #region Events

        public event Action<VoiceState, VoiceState> OnStateChanged;
        public event Action<string> OnTranscriptReceived;
        public event Action<string> OnLLMResponseReceived; // raw response with tags
        public event Action<string> OnCleanResponseText;   // cleaned text without tags
        public event Action<string> OnStreamToken;         // real-time streaming token
        public event Action<string> OnStreamEmotion;       // real-time emotion change
        public event Action<string> OnUserNotification;    // user-visible status messages

        #endregion

        #region Properties

        public VoiceState CurrentState { get; private set; } = VoiceState.Idle;

        #endregion

        #region Private Fields

        private MicrophoneCapture _mic;
        private VoiceActivityDetector _vad;
        private WakeWordDetector _wakeWord;
        private IVoicePipeline _pipeline; // unified AI backend abstraction
        private TTSPlayer _ttsPlayer;

        // State timers
        private float _stateTimer;
        private float _recordDuration;

        // Audio accumulator for recording
        private List<float> _recordedAudio = new List<float>();

        // Transcript tracking (for history recording)
        private string _pendingTranscript = "";

        // Response accumulator
        private string _pendingResponse = "";

        // Interrupt tracking
        private float _interruptTimer;
        private float _interruptCooldownTimer;
        private bool _isTransitioning; // guards against re-entrant SetState calls

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            _mic = GetComponent<MicrophoneCapture>();
            _vad = GetComponent<VoiceActivityDetector>();
            _wakeWord = GetComponent<WakeWordDetector>();
            _pipeline = GetComponent<IVoicePipeline>(); // resolve first IVoicePipeline on GameObject
            _ttsPlayer = GetComponent<TTSPlayer>();

            if (_pipeline == null)
            {
                Debug.LogError("[VoiceManager] No IVoicePipeline component found on this GameObject!");
                enabled = false;
                return;
            }
        }

        private void Start()
        {
            // Wire up pipeline events
            _mic.OnAudioData += OnMicAudioData;
            _vad.OnSpeechStart += OnVadSpeechStart;
            _vad.OnSpeechEnd += OnVadSpeechEnd;
            _wakeWord.OnWakeWordDetected += OnWakeWord;
            _wakeWord.OnPartialResult += OnWakePartial;
            _pipeline.OnFinalTranscript += OnBackendTranscript;
            _pipeline.OnLLMToken += OnBackendLLMToken;
            _pipeline.OnEmotionTag += OnBackendEmotionTag;
            _pipeline.OnActionTag += OnBackendActionTag;
            _pipeline.OnLLMResponse += OnBackendLLMResponse;
            _pipeline.OnTTSAudio += OnTTSAudioChunk;
            _pipeline.OnTTSWavAudio += OnTTSWavAudioChunk;
            _pipeline.OnTTSDone += OnBackendTTSDone;
            _pipeline.OnError += OnBackendError;
            _pipeline.OnReconnected += OnBackendReconnected;
            _ttsPlayer.OnPlaybackComplete += OnTTSPlaybackComplete;

            SetState(VoiceState.Idle);
        }

        private void Update()
        {
            _stateTimer += Time.unscaledDeltaTime;

            // State timeouts
            switch (CurrentState)
            {
                case VoiceState.Listening:
                    if (_stateTimer >= _listenTimeout)
                    {
                        if (_verboseLogging) Debug.Log("[VoiceManager] Listen timeout.");
                        OnUserNotification?.Invoke(AstralFoxLoc.Get("voice.listen_timeout"));
                        SetState(VoiceState.Idle);
                    }
                    break;

                case VoiceState.Recording:
                    if (_stateTimer >= _recordMaxDuration)
                    {
                        if (_verboseLogging) Debug.Log("[VoiceManager] Record max duration reached.");
                        OnUserNotification?.Invoke(AstralFoxLoc.Get("voice.record_max_duration"));
                        EndRecording();
                    }
                    break;

                case VoiceState.Processing:
                    if (_stateTimer >= _processingTimeout)
                    {
                        Debug.LogWarning("[VoiceManager] Processing timeout.");
                        OnUserNotification?.Invoke(AstralFoxLoc.Get("voice.processing_timeout"));
                        SetState(VoiceState.Idle);
                    }
                    break;

                case VoiceState.Speaking:
                    if (_stateTimer >= _speakingTimeout)
                    {
                        Debug.LogWarning("[VoiceManager] Speaking timeout.");
                        OnUserNotification?.Invoke(AstralFoxLoc.Get("voice.speaking_timeout"));
                        Animation.PetAnimationManager.Instance?.CurrentAnimator?.OnSpeakingEnd();
                        SetState(VoiceState.Idle);
                    }
                    break;
            }
        }

        private void OnDestroy()
        {
            _mic.OnAudioData -= OnMicAudioData;
            _vad.OnSpeechStart -= OnVadSpeechStart;
            _vad.OnSpeechEnd -= OnVadSpeechEnd;
            _wakeWord.OnWakeWordDetected -= OnWakeWord;
            _wakeWord.OnPartialResult -= OnWakePartial;
            _pipeline.OnFinalTranscript -= OnBackendTranscript;
            _pipeline.OnLLMToken -= OnBackendLLMToken;
            _pipeline.OnEmotionTag -= OnBackendEmotionTag;
            _pipeline.OnActionTag -= OnBackendActionTag;
            _pipeline.OnLLMResponse -= OnBackendLLMResponse;
            _pipeline.OnTTSAudio -= OnTTSAudioChunk;
            _pipeline.OnTTSWavAudio -= OnTTSWavAudioChunk;
            _pipeline.OnTTSDone -= OnBackendTTSDone;
            _pipeline.OnError -= OnBackendError;
            _pipeline.OnReconnected -= OnBackendReconnected;
            if (_ttsPlayer != null)
                _ttsPlayer.OnPlaybackComplete -= OnTTSPlaybackComplete;
        }

        #endregion

        #region Audio Pipeline

        private void OnMicAudioData(float[] samples, int sampleRate, int channels)
        {
            // Always feed to VAD for level monitoring
            _vad.ProcessAudio(samples);

            switch (CurrentState)
            {
                case VoiceState.Idle:
                    // Feed to wake word detector
                    _wakeWord.ProcessAudio(samples, sampleRate, channels);
                    break;

                case VoiceState.Listening:
                    // VAD is monitoring for speech onset (handled via OnVadSpeechStart)
                    // Still check wake word in case user says it again
                    break;

                case VoiceState.Recording:
                    // Accumulate audio for full recording
                    _recordedAudio.AddRange(samples);
                    _recordDuration += (float)samples.Length / sampleRate;

                    // Stream to backend
                    _pipeline.SendAudio(samples, sampleRate, channels);
                    break;

                case VoiceState.Speaking:
                    // Monitor mic level for interrupt (barge-in)
                    UpdateInterruptDetection();
                    break;
            }
        }

        private void OnVadSpeechStart()
        {
            if (CurrentState == VoiceState.Listening)
            {
                SetState(VoiceState.Recording);
                _recordedAudio.Clear();
                _recordDuration = 0f;
                if (_verboseLogging) Debug.Log("[VoiceManager] Recording started.");
            }
        }

        private void OnVadSpeechEnd(float duration)
        {
            if (CurrentState == VoiceState.Recording)
            {
                if (_verboseLogging) Debug.Log($"[VoiceManager] Speech ended ({duration:F1}s).");
                EndRecording();
            }
        }

        #endregion

        #region Wake Word

        private void OnWakeWord()
        {
            if (_verboseLogging) Debug.Log("[VoiceManager] WAKE WORD!");

            Animation.PetAnimationManager.Instance?.CurrentAnimator?.OnWakeWord();
            SetState(VoiceState.Listening);
        }

        private void OnWakePartial(string text)
        {
            // Optional: show partial wake word recognition in debug UI
        }

        #endregion

        #region Recording

        private void EndRecording()
        {
            // Flush remaining audio to backend
            _ = _pipeline.FlushAudioAsync();

            // Send emotion context + end-of-speech marker
            string contextJson = ContextBuilder.BuildJson(
                GetComponent<Animation.PADEmotionEngine>(),
                Config.ConfigManager.Instance.CurrentConfig,
                Data.DataStore.Instance);
            _ = _pipeline.SendTextAsync(contextJson);

            SetState(VoiceState.Processing);

            if (_verboseLogging)
                Debug.Log($"[VoiceManager] Recording ended. {_recordedAudio.Count} samples.");
        }

        /// <summary>Build JSON context message with current emotion state for LLM prompt.</summary>
        private string BuildContextMessage()
        {
            var padEngine = GetComponent<Animation.PADEmotionEngine>();
            var cfg = Config.ConfigManager.Instance.CurrentConfig;

            var msg = new VoiceContextMessage
            {
                type = "end_of_speech",
                emotion_context = padEngine != null ? padEngine.GetEmotionPromptContext() : "情绪状态: 平静。",
                chat_history = Data.DataStore.Instance.GetRecentChatSummary(),
                personality = string.IsNullOrEmpty(cfg.character_personality)
                    ? Data.DataStore.Instance.GetCharacterPersonality()
                    : cfg.character_personality,
                memory_summary = Data.DataStore.Instance.GetMemorySummary()
                    + "\n" + Data.DataStore.Instance.GetUserFactsSummary(),
                character_name = cfg.character_name,
                character_backstory = cfg.character_backstory,
                character_extra = cfg.character_extra,
            };

            return JsonUtility.ToJson(msg);
        }

        #endregion

        #region Backend Responses

        // Streaming state (accumulated during token stream)
        private string _streamAccumulatedText = "";
        private string _streamEmotion = "";
        private string _streamAction = "";
        private bool _responseFinalized;
        private readonly object _streamLock = new object();

        private void OnBackendLLMToken(string token)
        {
            // If llm_response already arrived, ignore late tokens
            lock (_streamLock)
            {
                if (_responseFinalized) return;
                _streamAccumulatedText += token;
            }
            OnStreamToken?.Invoke(token);

            // Transition to Processing if still in Recording (early response)
            if (CurrentState == VoiceState.Recording || CurrentState == VoiceState.Processing)
            {
                if (CurrentState != VoiceState.Processing)
                    SetState(VoiceState.Processing);
            }
        }

        private void OnBackendEmotionTag(string emotion)
        {
            _streamEmotion = emotion;
            OnStreamEmotion?.Invoke(emotion);

            // Apply emotion to animation in real-time
            var animator = Animation.PetAnimationManager.Instance?.CurrentAnimator;
            if (animator != null && !string.IsNullOrEmpty(emotion))
                animator.SetEmotion(ResponseParser.ParseEmotion(emotion));
        }

        private void OnBackendActionTag(string action)
        {
            _streamAction = action;
        }

        private void OnTTSWavAudioChunk(int index, byte[] wavData)
        {
            // Feed WAV bytes directly to TTSPlayer (parses header internally)
            _ttsPlayer.AddWavChunk(wavData);

            // Transition to Speaking on first audio chunk
            if (CurrentState == VoiceState.Processing)
            {
                Debug.Log($"[VoiceManager] First TTS WAV chunk received ({wavData.Length} bytes) → Speaking");
                SetState(VoiceState.Speaking);
                Animation.PetAnimationManager.Instance?.CurrentAnimator?.OnSpeakingStart();
                _interruptCooldownTimer = _interruptCooldown;
            }
        }

        private void OnBackendTranscript(string text)
        {
            _pendingTranscript = text;
            if (_verboseLogging) Debug.Log($"[VoiceManager] Transcript: \"{text}\"");
            OnTranscriptReceived?.Invoke(text);

            // Auto-extract user facts from what they said
            MemoryExtractor.ExtractAndStore(text);
        }

        /// <summary>Simple pattern extraction: user tells us something about themselves.</summary>
        private static void ExtractAndStoreUserFact(string text)
        {
            if (string.IsNullOrEmpty(text)) return;

            // Match patterns like: 我叫X, 我是X, 我喜欢X, 我的X是Y, 我在学X
            var patterns = new (string regex, string prefix)[]
            {
                (@"我叫(.+?)(?:[，。！？\s]|$)", "用户的名字是"),
                (@"我是(.+?)(?:[，。！？\s]|$)", "用户是"),
                (@"我喜欢(.+?)(?:[，。！？\s]|$)", "用户喜欢"),
                (@"我讨厌(.+?)(?:[，。！？\s]|$)", "用户讨厌"),
                (@"我在(.+?)(?:[，。！？\s]|$)", "用户正在"),
                (@"我的(.+?)是(.+?)(?:[，。！？\s]|$)", "用户的"),
            };

            foreach (var (regex, prefix) in patterns)
            {
                var match = System.Text.RegularExpressions.Regex.Match(
                    text, regex, System.Text.RegularExpressions.RegexOptions.None,
                    System.TimeSpan.FromMilliseconds(100)); // safety timeout

                if (match.Success)
                {
                    string value = match.Groups.Count > 2
                        ? $"{match.Groups[1].Value}{match.Groups[2].Value}"
                        : match.Groups[1].Value;

                    string fact = $"{prefix}{value.Trim()}";
                    Data.DataStore.Instance.AddUserFact(fact);

                    if (true) // always log memory extraction
                        Debug.Log($"[VoiceManager] Memory extracted: {fact}");
                }
            }
        }

        private void OnBackendLLMResponse(string rawText)
        {
            // Atomically grab accumulated streaming text and prevent further token accumulation
            string fullRaw;
            lock (_streamLock)
            {
                _responseFinalized = true;
                fullRaw = !string.IsNullOrEmpty(_streamAccumulatedText)
                    ? _streamAccumulatedText : rawText;
                _streamAccumulatedText = "";
            }

            if (_verboseLogging) Debug.Log($"[VoiceManager] LLM Response: \"{fullRaw}\"");
            OnLLMResponseReceived?.Invoke(fullRaw);

            // Parse emotion/action/memory/cmd tags using extracted ResponseParser
            var parsed = ResponseParser.Parse(fullRaw);
            string cleanText = parsed.CleanText;
            string emotionTag = parsed.Emotion;
            string actionTag = parsed.Action;
            string memoryTag = parsed.Memory;
            string commandTag = parsed.Command;
            string commandValue = parsed.CommandValue;

            // Use streaming emotion/action if not already parsed from tags
            if (string.IsNullOrEmpty(emotionTag) && !string.IsNullOrEmpty(_streamEmotion))
                emotionTag = _streamEmotion;
            if (string.IsNullOrEmpty(actionTag) && !string.IsNullOrEmpty(_streamAction))
                actionTag = _streamAction;

            OnCleanResponseText?.Invoke(cleanText);

            // Record this conversation turn
            Data.DataStore.Instance.AddChatRecord("user", _pendingTranscript, emotionTag);
            Data.DataStore.Instance.AddChatRecord("assistant", cleanText, emotionTag);

            // Store long-term memory update
            if (!string.IsNullOrEmpty(memoryTag))
            {
                Data.DataStore.Instance.AppendMemorySummary(memoryTag);
                if (_verboseLogging) Debug.Log($"[VoiceManager] Memory updated: {memoryTag}");
            }

            // Execute command
            if (!string.IsNullOrEmpty(commandTag))
            {
                ExecuteCommand(commandTag, commandValue);
            }

            // Apply emotion to animation (if streaming didn't already set it)
            if (_autoPlayResponse && string.IsNullOrEmpty(_streamEmotion))
            {
                var animator = Animation.PetAnimationManager.Instance?.CurrentAnimator;
                if (animator != null && !string.IsNullOrEmpty(emotionTag))
                    animator.SetEmotion(ResponseParser.ParseEmotion(emotionTag));
            }

            _pendingResponse = cleanText;

            // Reset streaming state
            _streamAccumulatedText = "";
            _streamEmotion = "";
            _streamAction = "";
        }

        private void OnTTSAudioChunk(int index, byte[] pcmData)
        {
            _ttsPlayer.AddPCMChunk(pcmData);

            // Transition to Speaking on first audio chunk
            if (CurrentState == VoiceState.Processing)
            {
                Debug.Log($"[VoiceManager] First TTS chunk received ({pcmData.Length} bytes) → Speaking");
                SetState(VoiceState.Speaking);
                Animation.PetAnimationManager.Instance?.CurrentAnimator?.OnSpeakingStart();
                _interruptCooldownTimer = _interruptCooldown;
            }
        }

        private void OnBackendTTSDone()
        {
            Debug.Log("[VoiceManager] TTS data stream complete (tts_done received).");
            _ttsPlayer.OnTTSDataComplete();
        }

        private void OnTTSPlaybackComplete()
        {
            Debug.Log("[VoiceManager] TTS playback complete → returning to Idle.");
            Animation.PetAnimationManager.Instance?.CurrentAnimator?.OnSpeakingEnd();
            SetState(VoiceState.Idle);
        }

        private void OnBackendError(string error)
        {
            Debug.LogError($"[VoiceManager] Backend error: {error}");
            SetState(VoiceState.Idle);
        }

        private void OnBackendReconnected()
        {
            // If we're stuck in a non-idle state after reconnect, reset
            if (CurrentState != VoiceState.Idle)
            {
                if (_verboseLogging)
                    Debug.Log($"[VoiceManager] Connection restored while in {CurrentState} — resetting to Idle.");
                _ttsPlayer.StopImmediate();
                Animation.PetAnimationManager.Instance?.CurrentAnimator?.OnSpeakingEnd();
                SetState(VoiceState.Idle);
            }
        }

        #endregion

        #region Tag Parsing

        /// <summary>
        /// Parse emotion and action tags from LLM response.
        /// Example: "[happy][action:wave]你好呀！" → cleanText="你好呀！", emotion="happy", action="wave"
        /// </summary>
        private static readonly System.Text.RegularExpressions.Regex EmoRegex =
            new System.Text.RegularExpressions.Regex(
                @"\[(happy|sad|shy|angry|neutral)\]",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        private static readonly System.Text.RegularExpressions.Regex ActRegex =
            new System.Text.RegularExpressions.Regex(
                @"\[action:(\w+)\]",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        private static readonly System.Text.RegularExpressions.Regex MemRegex =
            new System.Text.RegularExpressions.Regex(
                @"\[memory:(.+?)\]",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        private static readonly System.Text.RegularExpressions.Regex CmdRegex =
            new System.Text.RegularExpressions.Regex(
                @"\[cmd:(\w+)(?::([^\]]*))?\]",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        /// <summary>Parse emotion/action/memory/cmd tags. Thread-safe, case-insensitive.</summary>
        public static string ParseResponseTags(string raw, out string emotion, out string action, out string memory, out string command, out string commandValue)
        {
            emotion = "";
            action = "";
            memory = "";
            command = "";
            commandValue = "";
            string result = raw;

            var em = EmoRegex.Match(result);
            if (em.Success)
            {
                emotion = em.Groups[1].Value.ToLower();
                result = result.Replace(em.Value, "");
            }

            var am = ActRegex.Match(result);
            if (am.Success)
            {
                action = am.Groups[1].Value.ToLower();
                result = result.Replace(am.Value, "");
            }

            var mm = MemRegex.Match(result);
            if (mm.Success)
            {
                memory = mm.Groups[1].Value.Trim();
                result = result.Replace(mm.Value, "");
            }

            var cm = CmdRegex.Match(result);
            if (cm.Success)
            {
                command = cm.Groups[1].Value.ToLower();
                commandValue = cm.Groups[2].Value.Trim();
                result = result.Replace(cm.Value, "");
            }

            return result.Trim();
        }

        /// <summary>Parse emotion/action/memory tags (without cmd).</summary>
        public static string ParseResponseTags(string raw, out string emotion, out string action, out string memory)
        {
            return ParseResponseTags(raw, out emotion, out action, out memory, out _, out _);
        }

        /// <summary>Parse emotion/action tags only (backward compat).</summary>
        public static string ParseResponseTags(string raw, out string emotion, out string action)
        {
            return ParseResponseTags(raw, out emotion, out action, out _);
        }

        public static Animation.PetEmotion ParseEmotionTag(string tag)
        {
            return tag.ToLower() switch
            {
                "happy" => Animation.PetEmotion.Happy,
                "sad" => Animation.PetEmotion.Sad,
                "shy" => Animation.PetEmotion.Shy,
                "angry" => Animation.PetEmotion.Angry,
                _ => Animation.PetEmotion.Neutral,
            };
        }

        #endregion

        #region State Management

        private void SetState(VoiceState newState)
        {
            if (newState == CurrentState) return;
            if (_isTransitioning) return; // prevent re-entrant transitions

            _isTransitioning = true;
            try
            {
                VoiceState previous = CurrentState;
                CurrentState = newState;
                _stateTimer = 0f;

            // State entry logic
            switch (newState)
            {
                case VoiceState.Idle:
                    _wakeWord.SetListening(true);
                    _mic.Muted = false;
                    _recordedAudio.Clear();
                    _pendingResponse = "";
                    // Reset streaming state for next conversation
                    lock (_streamLock)
                    {
                        _responseFinalized = false;
                        _streamAccumulatedText = "";
                        _streamEmotion = "";
                        _streamAction = "";
                    }
                    break;

                case VoiceState.Listening:
                    _wakeWord.SetListening(false); // don't re-trigger while listening
                    _vad.Reset();
                    // Reset streaming state for new utterance
                    lock (_streamLock)
                    {
                        _responseFinalized = false;
                        _streamAccumulatedText = "";
                        _streamEmotion = "";
                        _streamAction = "";
                    }
                    break;

                case VoiceState.Recording:
                    break;

                case VoiceState.Processing:
                    _mic.Muted = true; // prevent mic from capturing TTS playback
                    break;

                case VoiceState.Speaking:
                    _mic.Muted = true; // prevent mic loopback during TTS playback
                    break;
            }

                OnStateChanged?.Invoke(previous, newState);

                if (_verboseLogging)
                    Debug.Log($"[VoiceManager] State: {previous} → {newState}");
            }
            finally
            {
                _isTransitioning = false;
            }
        }

        #endregion

        #region Public API

        /// <summary>Force trigger wake word (for testing/debug).</summary>
        public void SimulateWakeWord()
        {
            OnWakeWord();
        }

        /// <summary>Simulate a text command (for testing).</summary>
        public void SimulateCommand(string command, string value = "")
        {
            ExecuteCommand(command.ToLower(), value);
        }

        #endregion

        #region Command Handling

        private void ExecuteCommand(string command, string value)
        {
            switch (command)
            {
                case "set_personality":
                    Data.DataStore.Instance.SetCharacterPersonality(value);
                    if (_verboseLogging)
                        Debug.Log($"[VoiceManager] Personality set: {value}");
                    break;

                case "clear_memory":
                    Data.DataStore.Instance.SetMemorySummary("");
                    if (_verboseLogging)
                        Debug.Log("[VoiceManager] Memory cleared.");
                    break;

                default:
                    if (_verboseLogging)
                        Debug.Log($"[VoiceManager] Unknown command: {command}");
                    break;
            }
        }

        #endregion

        #region Interrupt Detection

        /// <summary>Check mic level during Speaking state for barge-in interrupt.</summary>
        private void UpdateInterruptDetection()
        {
            if (_interruptCooldownTimer > 0f)
            {
                _interruptCooldownTimer -= Time.unscaledDeltaTime;
                return;
            }

            float micLevel = _mic.CurrentLevel;
            if (micLevel >= _interruptMicThreshold)
            {
                _interruptTimer += Time.unscaledDeltaTime;
                if (_interruptTimer >= _interruptHoldTime)
                {
                    if (_verboseLogging)
                        Debug.Log($"[VoiceManager] Interrupt triggered! Mic level: {micLevel:F3}");
                    DoInterrupt();
                }
            }
            else
            {
                _interruptTimer = 0f;
            }
        }

        private void DoInterrupt()
        {
            _ttsPlayer.StopImmediate();
            Animation.PetAnimationManager.Instance?.CurrentAnimator?.OnSpeakingEnd();
            SetState(VoiceState.Listening);
        }

        /// <summary>Interrupt current TTS playback and start listening.</summary>
        public void Interrupt()
        {
            if (CurrentState == VoiceState.Speaking)
            {
                if (_verboseLogging) Debug.Log("[VoiceManager] Manual interrupt!");
                DoInterrupt();
            }
        }

        #endregion
    }
}
