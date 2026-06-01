using System;
using UnityEngine;

namespace AstralFox.Config
{
    /// <summary>
    /// Serializable configuration model for AstralFox.
    /// ALIGNED with Web platform (pet-config API) — no Azure/OpenAI cloud dependencies.
    /// Synced via BFF: GET/PUT /api/pet/config.
    /// </summary>
    [Serializable]
    public sealed class AppConfig
    {
        // ── Local AI Services (replaces Azure/OpenAI) ───────────
        public string tts_local_url = "http://127.0.0.1:9881";
        public string stt_local_url = "http://127.0.0.1:9000";
        public string llm_model_path = "models/qwen2.5-7b-instruct-q4_k_m.gguf";

        // ── GPT-SoVITS (voice cloning) ──────────────────────────
        public string sovits_url = "";
        public string sovits_reference_voice_id = "";

        // ── Legacy / cloud API keys (deprecated, kept for compilation) ──
        public string gpt_sovits_url = "";
        public string custom_voice_id = "";
        public string azure_speech_key = "";
        public string azure_speech_region = "";
        public string openai_api_key = "";
        public string openai_base_url = "";

        // ── Tools ────────────────────────────────────────────────
        public string ffmpeg_path = "";

        // ── Character Identity (synced from Web pet-config) ───────
        public string character_name = "星尘";

        public string character_personality = "星尘是一只来自异世界的猫耳精灵，拥有蓬松的尾巴和灵动的耳朵。她活泼好奇，喜欢在桌面上漫步探险，偶尔会撒娇要摸摸。她说话带着猫咪特有的慵懒和傲娇，喜欢用「～」「喵」「呢」等语气词。虽然表面高傲，其实非常依赖主人，会用尾巴轻轻蹭屏幕来表达亲昵。";

        public string character_backstory = "星尘原本是星界的一只小猫咪，因为追逐一颗流星不小心掉进了人类世界的电脑桌面。她发现自己可以在窗口之间跳跃、在任务栏上漫步，甚至能和屏幕前的人类对话。她决定留在这个新奇的世界，成为主人的桌面伙伴，用她蓬松的尾巴和灵动的耳朵为忙碌的主人带来一丝温暖与陪伴。";

        public string character_extra = "";

        /// <summary>Path to the Live2D model3.json, relative to StreamingAssets.</summary>
        public string model_path = "Models/Senko/senko.model3.json";

        // ── Animation ────────────────────────────────────────────
        public string animation_model = "live2d";

        // ── Voice ────────────────────────────────────────────────
        public bool enable_wake_word = true;
        public string wake_word = "小星小星";
        public float wake_sensitivity = 0.5f;

        // ── Pipeline ─────────────────────────────────────────────
        public bool auto_start_services = true;
        public float pipeline_timeout = 30f;

        // ── Version (for migration) ──────────────────────────────
        public int config_version = 3;

        // ── Helpers ──────────────────────────────────────────────

        /// <summary>Deep clone this config.</summary>
        public AppConfig Clone()
        {
            return new AppConfig
            {
                tts_local_url = this.tts_local_url,
                stt_local_url = this.stt_local_url,
                llm_model_path = this.llm_model_path,
                sovits_url = this.sovits_url,
                sovits_reference_voice_id = this.sovits_reference_voice_id,
                gpt_sovits_url = this.gpt_sovits_url,
                custom_voice_id = this.custom_voice_id,
                azure_speech_key = this.azure_speech_key,
                azure_speech_region = this.azure_speech_region,
                openai_api_key = this.openai_api_key,
                openai_base_url = this.openai_base_url,
                ffmpeg_path = this.ffmpeg_path,
                character_name = this.character_name,
                character_personality = this.character_personality,
                character_backstory = this.character_backstory,
                character_extra = this.character_extra,
                model_path = this.model_path,
                animation_model = this.animation_model,
                enable_wake_word = this.enable_wake_word,
                wake_word = this.wake_word,
                wake_sensitivity = this.wake_sensitivity,
                auto_start_services = this.auto_start_services,
                pipeline_timeout = this.pipeline_timeout,
                config_version = this.config_version,
            };
        }

        /// <summary>
        /// Apply defaults for any missing/empty fields (version migration).
        /// Returns true if any field was repaired.
        /// </summary>
        public bool RepairMissingFields()
        {
            bool repaired = false;
            var defaults = new AppConfig();

            if (string.IsNullOrEmpty(tts_local_url))
            { tts_local_url = defaults.tts_local_url; repaired = true; }
            if (string.IsNullOrEmpty(stt_local_url))
            { stt_local_url = defaults.stt_local_url; repaired = true; }
            if (string.IsNullOrEmpty(llm_model_path))
            { llm_model_path = defaults.llm_model_path; repaired = true; }
            if (string.IsNullOrEmpty(character_name))
            { character_name = defaults.character_name; repaired = true; }
            if (string.IsNullOrEmpty(character_personality))
            { character_personality = defaults.character_personality; repaired = true; }
            if (string.IsNullOrEmpty(character_backstory))
            { character_backstory = defaults.character_backstory; repaired = true; }
            if (string.IsNullOrEmpty(model_path))
            { model_path = defaults.model_path; repaired = true; }
            if (string.IsNullOrEmpty(animation_model))
            { animation_model = defaults.animation_model; repaired = true; }

            config_version = defaults.config_version;
            return repaired;
        }

        // ── Status Checks ────────────────────────────────────────

        public bool IsFullyOffline =>
            !string.IsNullOrWhiteSpace(tts_local_url) &&
            !string.IsNullOrWhiteSpace(stt_local_url) &&
            !string.IsNullOrWhiteSpace(llm_model_path);

        public bool IsSovitsMode =>
            !string.IsNullOrWhiteSpace(sovits_url);

        public bool IsGptSovitsMode =>
            !string.IsNullOrWhiteSpace(gpt_sovits_url) || !string.IsNullOrWhiteSpace(sovits_url);

        public bool NeedsFirstTimeSetup => false; // Always false — works out of the box
    }
}
