using UnityEngine;

namespace AstralFox.Config
{
    /// <summary>
    /// Centralized AI service configuration for AstralFox.
    /// Create via: Assets → Create → AstralFox → AI Configuration
    ///
    /// Replaces scattered MonoBehaviour Inspector fields with a single asset
    /// that can be versioned, shared across scenes, and hot-reloaded.
    ///
    /// Inspired by Unity-AIChat's ChatSetting ScriptableObject pattern,
    /// adapted for AstralFox's local-first architecture.
    /// </summary>
    [CreateAssetMenu(menuName = "AstralFox/AI Configuration", fileName = "AIConfig")]
    public class AIConfig : ScriptableObject
    {
        #region LLM Settings

        [Header("LLM — Language Model")]
        [Tooltip("Provider for text generation/dialogue.")]
        public LLMProvider llmProvider = LLMProvider.Local;

        [Tooltip("Path to LLMUnity model (.gguf file). Used when provider = Local.")]
        public string localModelPath = "models/qwen2.5-7b-instruct-q4_k_m.gguf";

        [Tooltip("System prompt prefix injected before conversation.")]
        [TextArea(3, 5)]
        public string systemPrompt = "你是星尘狐，一只可爱的AI桌面宠物伴侣。用温柔、活泼的语气与主人交流。";

        [Tooltip("Ollama server URL. Used when provider = Ollama.")]
        public string ollamaUrl = "http://localhost:11434";

        [Tooltip("Ollama model name. Used when provider = Ollama.")]
        public string ollamaModel = "qwen2.5:7b";

        public enum LLMProvider
        {
            Local,   // LLMUnity in-process
            Ollama,  // External Ollama server
            BFF,     // Next.js BFF HTTP API (legacy/fallback)
        }

        #endregion

        #region TTS Settings

        [Header("TTS — Text-to-Speech")]
        [Tooltip("Provider for speech synthesis.")]
        public TTSProvider ttsProvider = TTSProvider.Local;

        [Tooltip("sherpa-onnx server URL. Used when provider = Local.")]
        public string ttsLocalUrl = "http://127.0.0.1:9881";

        [Tooltip("GPT-SoVITS API URL. Used when provider = SoVITS.")]
        public string sovitsUrl = "http://127.0.0.1:9880";

        [Tooltip("Reference audio for voice cloning (16kHz mono WAV).")]
        public AudioClip referenceVoiceClip;

        [Tooltip("Reference text matching the reference audio.")]
        public string referenceText = "";

        [Tooltip("Synthesis language.")]
        public SynthesisLanguage language = SynthesisLanguage.Chinese;

        public enum TTSProvider
        {
            Local,   // sherpa-onnx (default)
            SoVITS,  // GPT-SoVITS API
            BFF,     // Next.js BFF (legacy/fallback)
        }

        public enum SynthesisLanguage
        {
            Chinese,
            English,
            Japanese,
            ChineseEnglishMixed,
        }

        #endregion

        #region STT Settings

        [Header("STT — Speech-to-Text")]
        [Tooltip("Provider for speech recognition.")]
        public STTProvider sttProvider = STTProvider.Local;

        [Tooltip("FunASR server URL. Used when provider = Local.")]
        public string sttLocalUrl = "http://127.0.0.1:9000";

        [Tooltip("Whisper server URL. Used when provider = Whisper.")]
        public string whisperUrl = "http://127.0.0.1:9000";

        [Tooltip("Recognition language.")]
        public string sttLanguage = "zh";

        public enum STTProvider
        {
            Local,   // FunASR (default)
            Whisper, // OpenAI Whisper API compat
            BFF,     // Next.js BFF (legacy/fallback)
        }

        #endregion

        #region Voice Wake Settings

        [Header("Wake Word")]
        [Tooltip("Enable wake word detection. Disable for push-to-talk mode.")]
        public bool enableWakeWord = true;

        [Tooltip("Wake word phrase (Chinese pinyin supported).")]
        public string wakeWord = "小星小星";

        [Tooltip("Sensitivity threshold for wake word detection (0-1).")]
        [Range(0.1f, 1f)]
        public float wakeSensitivity = 0.5f;

        #endregion

        #region Pipeline Settings

        [Header("Pipeline")]
        [Tooltip("Automatically start all services on application launch.")]
        public bool autoStartServices = true;

        [Tooltip("Maximum pipeline processing time in seconds.")]
        [Range(10f, 120f)]
        public float pipelineTimeout = 30f;

        [Tooltip("Enable verbose debug logging.")]
        public bool verboseLogging = false;

        #endregion

        #region API

        /// <summary>Check if the currently configured providers are all local.</summary>
        public bool IsFullyOffline =>
            llmProvider == LLMProvider.Local &&
            ttsProvider == TTSProvider.Local &&
            sttProvider == STTProvider.Local;

        /// <summary>Get a human-readable summary of the current config.</summary>
        public string GetSummary()
        {
            return $"AI Config: LLM={llmProvider} TTS={ttsProvider} STT={sttProvider} Wake={enableWakeWord} Offline={IsFullyOffline}";
        }

        /// <summary>Load from Resources or create default.</summary>
        public static AIConfig LoadOrDefault()
        {
            var config = Resources.Load<AIConfig>("AIConfig");
            if (config != null) return config;

            Debug.LogWarning("[AIConfig] No AIConfig.asset found in Resources. Using default settings.");
            return CreateInstance<AIConfig>();
        }

        #endregion
    }
}
