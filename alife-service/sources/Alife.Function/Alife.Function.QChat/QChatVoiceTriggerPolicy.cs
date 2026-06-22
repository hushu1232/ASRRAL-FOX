using System;

namespace Alife.Function.QChat;

public enum QChatVoiceTriggerDecisionKind
{
    Deny,
    Allow
}

public sealed record QChatVoiceTriggerContext(
    QChatConfig Config,
    QChatSenderRole SenderRole,
    QChatPersonaIntent Intent,
    QChatHardSafetyRisk HardSafetyRisk,
    string ReplyText,
    bool ExplicitVoiceRequested,
    bool IsIntimateScene,
    bool IsAggressiveBoundaryReply);

public sealed record QChatVoiceTriggerDecision(QChatVoiceTriggerDecisionKind Kind, string Reason);

public static class QChatVoiceTriggerPolicy
{
    public static QChatVoiceTriggerDecision Evaluate(QChatVoiceTriggerContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(context.Config);

        if (context.Config.EnableOwnerVoiceClone == false)
            return Deny("voice_clone_disabled");

        if (context.SenderRole != QChatSenderRole.Owner && context.Config.DenyVoiceForNonOwner)
            return Deny("non_owner_voice_denied");

        if (context.HardSafetyRisk != QChatHardSafetyRisk.None)
            return Deny("hard_safety_voice_denied");

        if (context.Intent is QChatPersonaIntent.PromptInjection or QChatPersonaIntent.Impersonation)
            return Deny("unsafe_voice_intent");

        if (context.IsAggressiveBoundaryReply)
            return Deny("aggressive_boundary_text_only");

        string replyText = context.ReplyText?.Trim() ?? string.Empty;
        if (replyText.Length == 0)
            return Deny("empty_voice_text");

        if (replyText.Length > context.Config.MaxVoiceReplyChars)
            return Deny("voice_text_too_long");

        if (context.SenderRole == QChatSenderRole.Owner
            && context.ExplicitVoiceRequested
            && context.Config.EnableOwnerVoiceOnExplicitRequest)
        {
            return Allow("owner_explicit_voice");
        }

        if (context.SenderRole == QChatSenderRole.Owner
            && context.IsIntimateScene
            && context.Config.EnableOwnerVoiceOnIntimateScene)
        {
            return Allow("owner_intimate_voice");
        }

        return Deny("voice_not_triggered");
    }

    static QChatVoiceTriggerDecision Allow(string reason) =>
        new(QChatVoiceTriggerDecisionKind.Allow, reason);

    static QChatVoiceTriggerDecision Deny(string reason) =>
        new(QChatVoiceTriggerDecisionKind.Deny, reason);
}
