using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Alife.Platform;

namespace Alife.Function.QChat;

public sealed class QChatVoiceProfileConfig
{
    public bool EnablePerAgentVoiceProfiles { get; set; } = true;
    public List<QChatVoiceProfile> Profiles { get; set; } = [];

    public static QChatVoiceProfileConfig CreateDefault()
    {
        return new QChatVoiceProfileConfig
        {
            Profiles =
            [
                new QChatVoiceProfile
                {
                    AgentId = "xiayu",
                    BotId = 2905391496,
                    VoiceId = "xiayu",
                    ReferenceAudioPath = Path.Combine(AlifePath.RuntimeFolderPath, "TTS", "voices", "xiayu", "ref.wav")
                },
                new QChatVoiceProfile
                {
                    AgentId = "mixu",
                    BotId = 3340947887,
                    VoiceId = "mixu",
                    ReferenceAudioPath = Path.Combine(AlifePath.RuntimeFolderPath, "TTS", "voices", "mixu", "ref.wav")
                }
            ]
        };
    }
}

public sealed class QChatVoiceProfile
{
    public string AgentId { get; set; } = "";
    public long BotId { get; set; }
    public string VoiceId { get; set; } = "";
    public string ApiBaseUrl { get; set; } = "http://127.0.0.1:9880";
    public string ReferenceAudioPath { get; set; } = "";
    public string PromptText { get; set; } = "";
    public string TextLanguage { get; set; } = "zh";
    public string PromptLanguage { get; set; } = "zh";
    public int MaxTextChars { get; set; } = 120;
    public bool Enabled { get; set; } = true;
}

public enum QChatVoiceProfileDecisionKind
{
    Deny,
    Allow
}

public sealed record QChatVoiceProfileDecision(
    QChatVoiceProfileDecisionKind Kind,
    QChatVoiceProfile? Profile,
    string Reason);

public static class QChatVoiceProfileRouter
{
    public static QChatVoiceProfileDecision Resolve(
        QChatVoiceProfileConfig? config,
        string? agentId,
        long botId)
    {
        config ??= QChatVoiceProfileConfig.CreateDefault();
        if (config.EnablePerAgentVoiceProfiles == false)
            return Deny("per_agent_voice_profiles_disabled");

        string normalizedAgentId = (agentId ?? string.Empty).Trim();
        IEnumerable<QChatVoiceProfile?> profiles = config.Profiles?.Cast<QChatVoiceProfile?>() ?? [];
        QChatVoiceProfile? profile = profiles.FirstOrDefault(candidate =>
            candidate != null && candidate.BotId > 0 && candidate.BotId == botId);
        if (profile != null)
            return profile.Enabled ? Allow(profile, "bot_id_profile_matched") : Deny("voice_profile_disabled");

        profile = profiles.FirstOrDefault(candidate =>
            candidate != null &&
            string.Equals(candidate.AgentId?.Trim(), normalizedAgentId, StringComparison.OrdinalIgnoreCase));
        if (profile != null)
            return profile.Enabled ? Allow(profile, "agent_id_profile_matched") : Deny("voice_profile_disabled");

        return Deny("voice_profile_not_found");
    }

    static QChatVoiceProfileDecision Allow(QChatVoiceProfile profile, string reason) =>
        new(QChatVoiceProfileDecisionKind.Allow, profile, reason);

    static QChatVoiceProfileDecision Deny(string reason) =>
        new(QChatVoiceProfileDecisionKind.Deny, null, reason);
}
