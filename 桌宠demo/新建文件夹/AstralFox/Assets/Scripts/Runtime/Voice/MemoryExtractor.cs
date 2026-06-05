using System.Text.RegularExpressions;
using UnityEngine;

namespace AstralFox.Voice
{
    /// <summary>
    /// Extracts user facts from natural conversation text.
    /// Matches common self-disclosure patterns in Chinese and stores them for long-term memory.
    ///
    /// Extracted from VoiceManager.ExtractAndStoreUserFact() for independent testability.
    /// </summary>
    public static class MemoryExtractor
    {
        private struct FactPattern
        {
            public Regex Regex;
            public string Prefix;

            public FactPattern(string pattern, string prefix)
            {
                Regex = new Regex(pattern, RegexOptions.None, System.TimeSpan.FromMilliseconds(100));
                Prefix = prefix;
            }
        }

        private static readonly FactPattern[] Patterns = new FactPattern[]
        {
            new FactPattern(@"我叫(.+?)(?:[，。！？\s]|$)", "用户的名字是"),
            new FactPattern(@"我是(.+?)(?:[，。！？\s]|$)", "用户是"),
            new FactPattern(@"我喜欢(.+?)(?:[，。！？\s]|$)", "用户喜欢"),
            new FactPattern(@"我讨厌(.+?)(?:[，。！？\s]|$)", "用户讨厌"),
            new FactPattern(@"我在(.+?)(?:[，。！？\s]|$)", "用户正在"),
            new FactPattern(@"我的(.+?)是(.+?)(?:[，。！？\s]|$)", "用户的"),
        };

        /// <summary>
        /// Extract user facts from transcribed speech and store in DataStore.
        /// Returns the number of facts extracted.
        /// </summary>
        public static int ExtractAndStore(string text)
        {
            if (string.IsNullOrEmpty(text)) return 0;
            int extracted = 0;

            foreach (var pattern in Patterns)
            {
                var match = pattern.Regex.Match(text);
                if (!match.Success) continue;

                string value = match.Groups.Count > 2
                    ? $"{match.Groups[1].Value}{match.Groups[2].Value}"
                    : match.Groups[1].Value;

                string fact = $"{pattern.Prefix}{value.Trim()}";
                Data.DataStore.Instance.AddUserFact(fact);
                extracted++;

                Debug.Log($"[MemoryExtractor] Fact extracted: {fact}");
            }

            return extracted;
        }
    }
}
