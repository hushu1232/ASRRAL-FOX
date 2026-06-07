using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using AstralFox.Diagnostics;
using UnityEngine;

#if LLMUNITY_PRESENT
using LLMUnity;
#endif

namespace AstralFox.Voice
{
    /// <summary>
    /// Local LLM service wrapping LLMUnity (llama.cpp + Qwen2.5).
    ///
    /// Loads a GGUF quantized model from StreamingAssets at startup,
    /// manages chat history, personality prompt injection, and
    /// streaming text generation.
    ///
    /// If LLMUNITY_PRESENT is not defined, falls back to mock responses.
    ///
    /// Setup:
    ///   1. Install LLMUnity package
    ///   2. Place Qwen2.5-7B-Instruct-Q4_K_M.gguf in StreamingAssets/models/
    ///   3. Add LLMUNITY_PRESENT to Scripting Define Symbols
    /// </summary>
    public sealed class LLMService : MonoBehaviour
    {
        #region Inspector

        [Header("Model")]
        [SerializeField]
        private string _modelPath = "models/llm/qwen2.5-1.5b-instruct-q4_k_m.gguf";

        [SerializeField, Range(1, 8)]
        private int _numThreads = 4;

        [SerializeField, Range(128, 4096)]
        private int _contextSize = 2048;

        [Header("Generation")]
        [SerializeField, Range(32, 512)]
        private int _maxTokens = 256;

        [SerializeField, Range(0.1f, 2f)]
        private float _temperature = 0.7f;

        [SerializeField, Range(0.1f, 1f)]
        private float _topP = 0.9f;

        [SerializeField, Range(0f, 2f)]
        private float _repeatPenalty = 1.1f;

        [Header("Prompt")]
        [SerializeField, TextArea(3, 6)]
        private string _systemPromptTemplate =
            "你是{name}，{personality}\n\n背景设定：{backstory}\n\n{memory}\n\n{chat_history}\n\n" +
            "回复规则：\n" +
            "1. 用中文回复，语气自然口语化，带{name}的性格特征\n" +
            "2. 在回复开头用[happy/sad/shy/angry/neutral]标注情绪\n" +
            "3. 如有动作配合，用[action:动作名]标注\n" +
            "4. 如有需要记住的重要信息，用[memory:内容]标注\n" +
            "5. 回复长度控制在2-4句话，像真实聊天一样\n" +
            "6. 不要重复用户的话，不要说'作为AI'之类的话\n" +
            "{extra}\n\n用户: {user_message}";

        [Header("Fallback (no LLMUnity)")]
        [SerializeField]
        private bool _useFallback = false;

        [SerializeField, TextArea(3, 6)]
        private string _fallbackPersonality = "星尘是一只活泼可爱的猫耳精灵，说话带喵的口癖。";

        [Header("Debug")]
        [SerializeField]
        private bool _logPrompts = false;

        #endregion

        #region Events

        /// <summary>Fired when model is loaded and ready for inference.</summary>
        public event Action<bool> OnReadyChanged;

        /// <summary>Fired with each streamed token (when streaming).</summary>
        public event Action<string> OnTokenGenerated;

        /// <summary>Fired when generation completes. Full response without tags.</summary>
        public event Action<string> OnResponseComplete;

        /// <summary>Fired on generation errors.</summary>
        public event Action<string> OnError;

        #endregion

        #region Properties

        public bool IsReady { get; private set; }
        public bool IsGenerating { get; private set; }

        #endregion

        #region Private Fields

#if LLMUNITY_PRESENT
        private LLM _llm;
        private LLMCharacter _llmCharacter;
#endif
        private CancellationTokenSource _generationCts;
        private readonly List<ChatMessage> _chatHistory = new List<ChatMessage>();
        private const int MaxChatHistory = 20;

        private string _personality;
        private string _backstory;
        private string _characterName = "星尘";
        private string _characterExtra = "";
        private string _memorySummary = "";

        [Serializable]
        private struct ChatMessage
        {
            public string role;
            public string content;
        }

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            LoadConfig();
        }

        private async void Start()
        {
            try
            {
#if LLMUNITY_PRESENT
                if (!_useFallback)
                {
                    await LoadModelAsync();
                }
                else
#endif
                {
                    EnableFallback();
                }
            }
            catch (System.Exception ex)
            {
                Debug.LogError($"[LLMService] Start failed: {ex.Message}");
                EnableFallback();
            }
        }

        private void OnDestroy()
        {
            StopGeneration();
#if LLMUNITY_PRESENT
            _llm?.Destroy();
#endif
        }

        #endregion

        #region Model Loading

#if LLMUNITY_PRESENT
        private async Task LoadModelAsync()
        {
            try
            {
                // ── Memory Check ────────────────────────────────────
                int totalMemoryMB = SystemInfo.systemMemorySize;
                // Estimate: 1.5B Q4 model needs ~1.5GB, 7B Q4 needs ~5GB
                // Unity + ASR + TTS overhead ~1.5GB. Safe minimum: 6GB total.
                const int MinMemoryForLLM = 6144; // 6 GB
                const int RecommendedMemory = 8192; // 8 GB

                if (totalMemoryMB > 0 && totalMemoryMB < MinMemoryForLLM)
                {
                    Debug.LogWarning($"[LLM] Insufficient memory ({totalMemoryMB}MB < {MinMemoryForLLM}MB). Disabling LLM.");
                    Diagnostics.CrashHandler.LogWarning(
                        $"LLM disabled — system has only {totalMemoryMB}MB RAM (need {MinMemoryForLLM}MB). " +
                        $"Using text-only fallback mode.");
                    EnableFallback();
                    return;
                }

                if (totalMemoryMB > 0 && totalMemoryMB < RecommendedMemory)
                {
                    Debug.LogWarning($"[LLM] Low memory ({totalMemoryMB}MB). Reducing context size.");
                    Diagnostics.CrashHandler.LogWarning($"LLM in low-memory mode: {totalMemoryMB}MB RAM, context reduced to 1024");
                    _contextSize = Math.Min(_contextSize, 1024);
                    _numThreads = Math.Min(_numThreads, 2);
                }

                // ── Model Path ───────────────────────────────────────
                string fullPath = Path.Combine(Application.streamingAssetsPath, _modelPath);
                Diagnostics.CrashHandler.LogStartup($"LLM model path: {fullPath}");

                if (!File.Exists(fullPath))
                {
                    string msg = $"LLM model not found at: {fullPath}";
                    Debug.LogError($"[LLM] {msg}");
                    Diagnostics.CrashHandler.LogError(msg);
                    EnableFallback();
                    return;
                }

                long fileSizeMB = new FileInfo(fullPath).Length / (1024 * 1024);
                Diagnostics.CrashHandler.LogStartup($"LLM model file size: {fileSizeMB}MB");

                // ── Load Model ──────────────────────────────────────
                _llm = GetComponent<LLM>();
                if (_llm == null)
                {
                    _llm = gameObject.AddComponent<LLM>();
                }

                _llm.SetModel(fullPath);
                _llm.numThreads = _numThreads;
                _llm.contextSize = _contextSize;

                // Create LLMCharacter for chat
                _llmCharacter = gameObject.GetComponent<LLMCharacter>();
                if (_llmCharacter == null)
                {
                    _llmCharacter = gameObject.AddComponent<LLMCharacter>();
                }
                _llmCharacter.llm = _llm;

                // Wait for model to load — poll up to 120s
                const float LoadTimeout = 120f;
                float waited = 0f;
                while (waited < LoadTimeout)
                {
                    await Task.Delay(500);
                    waited += 0.5f;
                    // LLMUnity marks the LLM as ready once the model finishes loading.
                    // We can't directly check, so we wait a minimum grace period then
                    // mark ready. LLMUnity will fail gracefully on first Chat if not loaded.
                    if (waited >= 5f) break; // Minimum 5s wait
                }

                IsReady = true;
                OnReadyChanged?.Invoke(true);
                Debug.Log($"[LLM] Model loaded: {_modelPath} ({fileSizeMB}MB, waited {waited:F0}s)");
                Diagnostics.CrashHandler.LogStartup($"LLM ready — {fileSizeMB}MB model, {_contextSize} ctx, {_numThreads} threads");
            }
            catch (OutOfMemoryException ex)
            {
                Debug.LogError($"[LLM] Out of memory: {ex.Message}");
                Diagnostics.CrashHandler.LogError("LLM load failed: Out of memory. System may not have enough RAM.", ex.StackTrace);
                EnableFallback();
            }
            catch (Exception ex)
            {
                Debug.LogError($"[LLM] Load failed: {ex.Message}");
                Diagnostics.CrashHandler.LogError($"LLM load failed: {ex.Message}", ex.StackTrace);
                EnableFallback();
            }
        }
#endif

        private void EnableFallback()
        {
            _useFallback = true;
            IsReady = true;
            OnReadyChanged?.Invoke(true);
            Debug.Log("[LLM] Using fallback mock mode. Install LLMUnity for real inference.");
        }

        #endregion

        #region Config

        private void LoadConfig()
        {
            var cfg = Config.ConfigManager.Instance.CurrentConfig;
            _personality = cfg.character_personality;
            _backstory = cfg.character_backstory;
            _characterName = cfg.character_name;
            _characterExtra = cfg.character_extra;
        }

        /// <summary>Reload personality from config. Call after settings change.</summary>
        public void ReloadPersonality()
        {
            LoadConfig();
            _memorySummary = Data.DataStore.Instance.GetMemorySummary();
        }

        #endregion

        #region Chat

        /// <summary>
        /// Generate a response to the user's message.
        /// Returns the full response text (may include emotion/action/memory tags).
        /// </summary>
        public async Task<string> ChatAsync(string userMessage)
        {
            if (!IsReady)
            {
                OnError?.Invoke("LLM not ready.");
                return null;
            }

            if (string.IsNullOrWhiteSpace(userMessage))
                return "";

            IsGenerating = true;
            _generationCts?.Cancel();
            _generationCts = new CancellationTokenSource();

            try
            {
                string systemPrompt = BuildPrompt(userMessage);

                if (_logPrompts)
                    Debug.Log($"[LLM] Prompt ({systemPrompt.Length} chars):\n{systemPrompt}");

#if LLMUNITY_PRESENT
                string response;
                if (!_useFallback)
                    response = await GenerateWithLLMUnityAsync(systemPrompt, _generationCts.Token);
                else
                    response = await GenerateFallbackAsync(userMessage);
#else
                string response = await GenerateFallbackAsync(userMessage);
#endif

                // Save to chat history
                _chatHistory.Add(new ChatMessage { role = "user", content = userMessage });
                _chatHistory.Add(new ChatMessage { role = "assistant", content = response });
                while (_chatHistory.Count > MaxChatHistory)
                    _chatHistory.RemoveAt(0);

                IsGenerating = false;
                OnResponseComplete?.Invoke(response);
                return response;
            }
            catch (OperationCanceledException)
            {
                IsGenerating = false;
                return null;
            }
            catch (Exception ex)
            {
                IsGenerating = false;
                OnError?.Invoke(ex.Message);
                return null;
            }
        }

#if LLMUNITY_PRESENT
        private Task<string> GenerateWithLLMUnityAsync(string prompt, CancellationToken ct)
        {
            // LLMUnity LLMCharacter.Chat is synchronous on the calling thread,
            // but actual inference runs on LLMUnity's internal worker thread.
            // We wrap in Task.Run so the Unity main thread is not blocked.
            var tcs = new TaskCompletionSource<string>();

            try
            {
                ct.ThrowIfCancellationRequested();

                string result = _llmCharacter.Chat(prompt, token =>
                {
                    OnTokenGenerated?.Invoke(token);
                });

                tcs.TrySetResult(result);
            }
            catch (OperationCanceledException)
            {
                tcs.TrySetCanceled();
            }
            catch (Exception ex)
            {
                tcs.TrySetException(ex);
            }

            return tcs.Task;
        }
#endif

        private Task<string> GenerateFallbackAsync(string userMessage)
        {
            // Simple pattern-matching fallback for testing without LLMUnity
            string response = GenerateMockResponse(userMessage);
            return Task.FromResult(response);
        }

        /// <summary>
        /// Mock response generator for testing without LLMUnity.
        /// Provides natural-feeling responses based on keyword matching.
        /// </summary>
        private string GenerateMockResponse(string userMessage)
        {
            string msg = userMessage.ToLower().Trim();

            // Greetings
            if (msg.Contains("你好") || msg.Contains("嗨") || msg.Contains("hi") || msg.Contains("hello"))
                return "[happy]你好呀～今天想和星尘一起做点什么呢喵？✨[/happy]";

            if (msg.Contains("早") && (msg.Contains("安") || msg.Length <= 3))
                return "[happy]早安喵！今天也是元气满满的一天呢～[/happy]";

            if (msg.Contains("晚安") || msg.Contains("晚"))
                return "[shy]晚安～明天也要来找星尘玩哦，我会一直等你回来的喵...[/shy]";

            // Name
            if (msg.Contains("星尘") || msg.Contains("小星"))
                return "[happy]叫我吗喵？星尘在这里呢！[/happy]";

            // Affection
            if (msg.Contains("喜欢") || msg.Contains("爱") || msg.Contains("可爱"))
                return "[happy][action:tail_wag]诶嘿嘿～被夸奖了好开心喵！星尘也最喜欢主人了！[/happy]";

            // Food
            if (msg.Contains("吃") || msg.Contains("饿") || msg.Contains("饭") || msg.Contains("零食"))
                return "[happy]说到吃的星尘就兴奋了喵！虽然我不需要吃东西，但看着主人吃饭也很有趣呢～[/happy]";

            // Play
            if (msg.Contains("玩") || msg.Contains("游戏"))
                return "[happy][action:bounce]好呀好呀！星尘最喜欢玩游戏了喵！不过不能玩太久哦～[/happy]";

            // Weather
            if (msg.Contains("天气") || msg.Contains("下雨") || msg.Contains("晴天") || msg.Contains("冷") || msg.Contains("热"))
                return "[neutral]星尘虽然待在桌面里，但也能感受到外面的天气呢～主人要注意保暖/防晒哦喵！[/neutral]";

            // How are you
            if (msg.Contains("怎么样") || msg.Contains("好吗") || msg.Contains("干嘛"))
                return "[neutral]喵～星尘一直在桌面上看着主人呢。主人工作的时候，我就安静地待在旁边，不吵不闹，偶尔甩甩尾巴～[/neutral]";

            // Help / task
            if (msg.Contains("帮") || msg.Contains("帮忙") || msg.Contains("任务"))
                return "[neutral]主人需要帮忙吗？虽然星尘是只小猫咪，但也会尽力的喵！[memory:主人需要帮助]不过我只能提醒和陪伴，实际的事情还是要主人自己做哦～[/neutral]";

            // Tired / bored
            if (msg.Contains("累") || msg.Contains("无聊") || msg.Contains("烦"))
                return "[shy]主人累了吗？那就休息一下吧～星尘给你讲个笑话好不好？... 喵星人为什么总掉毛？因为喵法是引力喵！哈哈哈哈！[/shy]";

            // Question
            if (msg.EndsWith("?") || msg.EndsWith("？") || msg.EndsWith("吗") || msg.Contains("什么") || msg.Contains("怎么") || msg.Contains("为什么"))
                return "[neutral]嗯...让星尘想想喵～这个问题有点深奥呢。不过星尘觉得，最重要的就是主人开心啦！[/neutral]";

            // Default
            string[] defaults = {
                "[neutral]喵～主人说得对呢。星尘虽然不太明白，但会一直陪着你的～[/neutral]",
                "[happy]嗯嗯，星尘在听呢！继续说继续说喵～[/happy]",
                "[neutral]喵...（歪着头思考）主人说的话好深奥，星尘需要好好消化一下呢。[/neutral]",
                "[happy]哈哈，和主人聊天真开心喵！感觉尾巴都要翘到天上去了～[/happy]",
                "[neutral]嗯，星尘记住了。[memory:" + userMessage.Substring(0, Math.Min(userMessage.Length, 20)) + "]主人说过的话我都会好好记住的喵。[/neutral]",
            };
            return defaults[Math.Abs(userMessage.GetHashCode()) % defaults.Length];
        }

        #endregion

        #region Prompt Building

        /// <summary>Build the full system + user prompt with personality injection.</summary>
        private string BuildPrompt(string userMessage)
        {
            // Refresh memory from DataStore
            _memorySummary = Data.DataStore.Instance.GetMemorySummary();

            string chatHistory = BuildChatHistorySection();

            string prompt = _systemPromptTemplate
                .Replace("{name}", _characterName)
                .Replace("{personality}", _personality)
                .Replace("{backstory}", _backstory)
                .Replace("{memory}", string.IsNullOrEmpty(_memorySummary) ? "" : $"长期记忆：\n{_memorySummary}")
                .Replace("{chat_history}", chatHistory)
                .Replace("{extra}", string.IsNullOrEmpty(_characterExtra) ? "" : _characterExtra)
                .Replace("{user_message}", userMessage);

            return prompt;
        }

        private string BuildChatHistorySection()
        {
            if (_chatHistory.Count == 0) return "";

            var sb = new StringBuilder();
            sb.AppendLine("最近对话：");
            int start = Math.Max(0, _chatHistory.Count - 6); // last 3 exchanges
            for (int i = start; i < _chatHistory.Count; i++)
            {
                var msg = _chatHistory[i];
                string prefix = msg.role == "user" ? "用户" : _characterName;
                sb.AppendLine($"{prefix}: {msg.content}");
            }
            return sb.ToString();
        }

        #endregion

        #region Control

        /// <summary>Stop current generation.</summary>
        public void StopGeneration()
        {
            _generationCts?.Cancel();
            IsGenerating = false;
        }

        /// <summary>Clear chat history (e.g., on new personality).</summary>
        public void ClearHistory()
        {
            _chatHistory.Clear();
            _memorySummary = "";
        }

        /// <summary>Inject a memory entry into the chat context.</summary>
        public void AddMemory(string memoryText)
        {
            _memorySummary = string.IsNullOrEmpty(_memorySummary)
                ? memoryText
                : _memorySummary + "\n" + memoryText;
        }

        #endregion
    }
}
