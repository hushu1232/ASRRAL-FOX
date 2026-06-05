using System.Text.RegularExpressions;
using AstralFox.Animation;

namespace AstralFox.Voice
{
    /// <summary>
    /// Parses structured tags from LLM response text.
    /// Extracted from VoiceManager to keep parsing logic independent and testable.
    ///
    /// Supported tags:
    ///   [happy|sad|shy|angry|neutral]   → emotion
    ///   [action:wave|jump|...]          → action
    ///   [memory:...]                     → long-term memory
    ///   [cmd:command_name:value]         → commands
    /// </summary>
    public static class ResponseParser
    {
        private static readonly Regex EmoRegex = new Regex(
            @"\[(happy|sad|shy|angry|neutral|surprised)\]",
            RegexOptions.IgnoreCase | RegexOptions.Compiled,
            System.TimeSpan.FromMilliseconds(50));

        private static readonly Regex ActRegex = new Regex(
            @"\[action:(\w+)\]",
            RegexOptions.IgnoreCase | RegexOptions.Compiled,
            System.TimeSpan.FromMilliseconds(50));

        private static readonly Regex MemRegex = new Regex(
            @"\[memory:(.+?)\]",
            RegexOptions.IgnoreCase | RegexOptions.Compiled,
            System.TimeSpan.FromMilliseconds(50));

        private static readonly Regex CmdRegex = new Regex(
            @"\[cmd:(\w+)(?::([^\]]*))?\]",
            RegexOptions.IgnoreCase | RegexOptions.Compiled,
            System.TimeSpan.FromMilliseconds(50));

        public struct ParsedResponse
        {
            public string CleanText;
            public string Emotion;
            public string Action;
            public string Memory;
            public string Command;
            public string CommandValue;
        }

        /// <summary>Parse all tag types from raw LLM response.</summary>
        public static ParsedResponse Parse(string raw)
        {
            var result = new ParsedResponse();
            string text = raw ?? "";

            var em = EmoRegex.Match(text);
            if (em.Success)
            {
                result.Emotion = em.Groups[1].Value.ToLowerInvariant();
                text = text.Replace(em.Value, "");
            }

            var am = ActRegex.Match(text);
            if (am.Success)
            {
                result.Action = am.Groups[1].Value.ToLowerInvariant();
                text = text.Replace(am.Value, "");
            }

            var mm = MemRegex.Match(text);
            if (mm.Success)
            {
                result.Memory = mm.Groups[1].Value.Trim();
                text = text.Replace(mm.Value, "");
            }

            var cm = CmdRegex.Match(text);
            if (cm.Success)
            {
                result.Command = cm.Groups[1].Value.ToLowerInvariant();
                result.CommandValue = cm.Groups.Count > 2 ? cm.Groups[2].Value.Trim() : "";
                text = text.Replace(cm.Value, "");
            }

            result.CleanText = text.Trim();
            return result;
        }

        /// <summary>Convert emotion tag string to PetEmotion enum.</summary>
        public static PetEmotion ParseEmotion(string tag)
        {
            if (string.IsNullOrEmpty(tag)) return PetEmotion.Neutral;
            return tag.ToLowerInvariant() switch
            {
                "happy" => PetEmotion.Happy,
                "sad" => PetEmotion.Sad,
                "shy" => PetEmotion.Shy,
                "angry" => PetEmotion.Angry,
                "surprised" => PetEmotion.Happy, // map surprised→happy
                _ => PetEmotion.Neutral,
            };
        }
    }
}
