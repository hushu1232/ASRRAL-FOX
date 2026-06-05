using System.Collections.Generic;

namespace AstralFox
{
    /// <summary>
    /// Centralized localization for AstralFox desktop pet.
    /// Supports Chinese (zh), English (en), Japanese (ja).
    ///
    /// Usage:
    ///   AstralFoxLoc.Get("voice.listen_timeout")
    ///   AstralFoxLoc.SetLanguage("en")
    ///
    /// All hardcoded strings in VoiceManager, AIManager, ConfigManager, etc.
    /// should migrate to this class. Add new keys in InitializeStrings().
    /// </summary>
    public static class AstralFoxLoc
    {
        public enum Language { Chinese, English, Japanese }

        private static Language _currentLanguage = Language.Chinese;
        private static readonly Dictionary<string, string[]> _strings = new Dictionary<string, string[]>();

        // Column indices
        private const int ZH = 0;
        private const int EN = 1;
        private const int JA = 2;

        static AstralFoxLoc()
        {
            InitializeStrings();
            // Auto-detect language from system culture
            var culture = System.Globalization.CultureInfo.CurrentUICulture;
            if (culture.Name.StartsWith("ja")) SetLanguage(Language.Japanese);
            else if (culture.Name.StartsWith("en")) SetLanguage(Language.English);
        }

        private static void InitializeStrings()
        {
            // ── Voice Pipeline ────────────────────────────────
            Add("voice.listen_timeout",       "等太久了～再叫我一次吧！",        "Taking too long~ Call me again!",         "待ちすぎた〜もう一度呼んでね！");
            Add("voice.record_max_duration",  "说了好多呢，让我想想...",         "That was a lot! Let me think...",         "たくさん話したね、考えてみる...");
            Add("voice.processing_timeout",   "唔…刚才走神了，再说一次好吗？",  "Hmm... I spaced out. Can you say that again?", "うーん…ぼんやりしちゃった。もう一度言ってくれる？");
            Add("voice.speaking_timeout",     "声音卡住了…重新来一次？",          "Voice got stuck... Try again?",            "声が詰まっちゃった…もう一度やる？");
            Add("voice.backend_error",        "唔…刚才走神了，再说一次好吗？",  "Hmm... I spaced out. Can you say that again?", "うーん…ぼんやりしちゃった。もう一度言ってくれる？");
            Add("voice.welcome_connected",    "星尘已连接！",                      "Stardust connected!",                       "星塵が接続されました！");

            // ── AI Manager ────────────────────────────────────
            Add("ai.service_checking",       "正在检查本地 AI 服务...",           "Checking local AI services...",              "ローカルAIサービスをチェック中...");
            Add("ai.engine_ready",           "全离线 AI 引擎就绪",                 "Fully offline AI engine ready",              "完全オフラインAIエンジン準備完了");
            Add("ai.engine_degraded",        "AI 引擎部分就绪（降级模式）",       "AI engine partially ready (degraded mode)",  "AIエンジン部分準備完了（縮退モード）");
            Add("ai.engine_initializing",    "AI 服务初始化中...",                 "AI services initializing...",                "AIサービス初期化中...");
            Add("ai.asr_degraded",           "语音识别服务异常，使用离线降级模式", "Speech recognition degraded, using offline fallback", "音声認識サービス異常、オフライン縮退モードを使用");
            Add("ai.tts_degraded",           "语音合成服务异常",                   "Speech synthesis service degraded",          "音声合成サービス異常");
            Add("ai.pipeline_not_ready",     "AI 引擎未就绪",                      "AI engine not ready",                        "AIエンジンの準備ができていません");
            Add("ai.transcribing",           "正在理解你说的话...",                "Understanding what you said...",             "あなたの言葉を理解中...");
            Add("ai.thinking",               "星尘正在思考...",                    "Stardust is thinking...",                    "星塵が考え中...");
            Add("ai.synthesizing",           "正在合成语音...",                    "Synthesizing speech...",                     "音声を合成中...");
            Add("ai.complete",               "完成！",                              "Done!",                                      "完了！");
            Add("ai.asr_failed",             "未能识别语音内容",                   "Could not recognize speech",                 "音声を認識できませんでした");
            Add("ai.llm_failed",             "AI 回复生成失败",                     "AI response generation failed",              "AI応答の生成に失敗しました");
            Add("ai.pipeline_error_fmt",     "处理失败: {0}",                       "Processing failed: {0}",                     "処理失敗: {0}");
            Add("ai.fallback_response",      "[happy]喵～听到了听到了！[/happy]", "[happy]Meow~ I heard you![/happy]",          "[happy]にゃ〜聞こえた聞こえた！[/happy]");

            // ── Interaction ───────────────────────────────────
            Add("interact.pat_head",         "拍了拍狐狸头 (pat pat)!",              "Patted the fox (pat pat)!",                  "キツネの頭をなでた！");

            // ── Config ───────────────────────────────────────
            Add("config.first_time_setup",   "首次运行，需要配置 AI 服务",          "First run — AI service setup needed",         "初回起動 — AIサービスの設定が必要です");
        }

        private static void Add(string key, string zh, string en, string ja)
        {
            _strings[key] = new[] { zh, en, ja };
        }

        public static void SetLanguage(Language lang)
        {
            _currentLanguage = lang;
            int idx = lang switch
            {
                Language.English => EN,
                Language.Japanese => JA,
                _ => ZH,
            };
            UnityEngine.Debug.Log($"[AstralFoxLoc] Language set to {lang} (index={idx})");
        }

        public static Language CurrentLanguage => _currentLanguage;

        /// <summary>Get localized string by key. Returns key itself if not found.</summary>
        public static string Get(string key)
        {
            if (_strings.TryGetValue(key, out string[] values))
            {
                int idx = _currentLanguage switch
                {
                    Language.English => EN,
                    Language.Japanese => JA,
                    _ => ZH,
                };
                return values[idx] ?? key;
            }
            UnityEngine.Debug.LogWarning($"[AstralFoxLoc] Missing key: {key}");
            return key;
        }

        /// <summary>Get localized string with format argument replacement.</summary>
        public static string Get(string key, params object[] args)
        {
            string template = Get(key);
            return string.Format(template, args);
        }
    }
}
