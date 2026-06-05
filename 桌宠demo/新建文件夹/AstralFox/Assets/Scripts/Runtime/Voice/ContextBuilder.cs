using UnityEngine;

namespace AstralFox.Voice
{
    /// <summary>
    /// Builds JSON context messages for LLM prompt construction.
    /// Encapsulates the PAD emotion state, chat history, personality, and memory
    /// into a structured message sent before LLM inference.
    ///
    /// Extracted from VoiceManager.BuildContextMessage() for independent testability.
    /// </summary>
    public static class ContextBuilder
    {
        [System.Serializable]
        private struct VoiceContextMessage
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

        /// <summary>
        /// Build a JSON context string for the LLM, containing current emotional state,
        /// personality, chat history, and accumulated memory.
        /// </summary>
        /// <param name="padEngine">The PAD emotion engine (may be null).</param>
        /// <returns>JSON string ready to send to LLM backend.</returns>
        public static string BuildJson(
            Animation.PADEmotionEngine padEngine,
            Config.AppConfig config,
            Data.DataStore dataStore)
        {
            var msg = new VoiceContextMessage
            {
                type = "end_of_speech",
                emotion_context = padEngine != null
                    ? padEngine.GetEmotionPromptContext()
                    : "情绪状态: 平静。",
                chat_history = dataStore.GetRecentChatSummary(),
                personality = string.IsNullOrEmpty(config.character_personality)
                    ? dataStore.GetCharacterPersonality()
                    : config.character_personality,
                memory_summary = dataStore.GetMemorySummary()
                    + "\n" + dataStore.GetUserFactsSummary(),
                character_name = config.character_name,
                character_backstory = config.character_backstory,
                character_extra = config.character_extra,
            };

            return JsonUtility.ToJson(msg);
        }
    }
}
