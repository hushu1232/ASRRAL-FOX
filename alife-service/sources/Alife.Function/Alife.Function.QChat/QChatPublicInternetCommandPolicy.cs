using System;

namespace Alife.Function.QChat;

public enum QChatPublicInternetCommandKind
{
    None,
    Search,
    RagQuery
}

public sealed record QChatPublicInternetCommand(
    QChatPublicInternetCommandKind Kind,
    string Query)
{
    public static QChatPublicInternetCommand None { get; } = new(QChatPublicInternetCommandKind.None, "");
}

public sealed record QChatPublicInternetCommandContext(
    QChatSenderRole SenderRole,
    QChatPublicInternetCommandKind Kind,
    string Query,
    int MaxQueryChars,
    bool EnablePublicSearch,
    bool EnablePublicRagQuery);

public sealed record QChatPublicInternetCommandDecision(bool Allowed, string Reason);

public static class QChatPublicInternetCommandPolicy
{
    public static QChatPublicInternetCommand Parse(string? text)
    {
        string normalized = text?.Trim() ?? string.Empty;
        if (normalized.StartsWith("/qchat", StringComparison.OrdinalIgnoreCase))
            return QChatPublicInternetCommand.None;

        if (TryParsePrefix(normalized, "/search ", out string search))
            return new QChatPublicInternetCommand(QChatPublicInternetCommandKind.Search, search);

        if (TryParsePrefix(normalized, "/rag ", out string rag))
            return new QChatPublicInternetCommand(QChatPublicInternetCommandKind.RagQuery, rag);

        return QChatPublicInternetCommand.None;
    }

    public static QChatPublicInternetCommandDecision Evaluate(QChatPublicInternetCommandContext context)
    {
        if (context.Kind == QChatPublicInternetCommandKind.None)
            return new QChatPublicInternetCommandDecision(false, "not_public_internet_command");

        if (context.SenderRole is not (QChatSenderRole.Owner or QChatSenderRole.GroupMember))
            return new QChatPublicInternetCommandDecision(false, "public_internet_sender_not_allowed");

        if (context.Kind == QChatPublicInternetCommandKind.Search && context.EnablePublicSearch == false)
            return new QChatPublicInternetCommandDecision(false, "public_search_disabled");

        if (context.Kind == QChatPublicInternetCommandKind.RagQuery && context.EnablePublicRagQuery == false)
            return new QChatPublicInternetCommandDecision(false, "public_rag_disabled");

        int maxQueryChars = Math.Max(context.MaxQueryChars, 1);
        if (context.Query.Trim().Length > maxQueryChars)
            return new QChatPublicInternetCommandDecision(false, "public_query_too_long");

        return new QChatPublicInternetCommandDecision(true, "allowed");
    }

    static bool TryParsePrefix(string text, string prefix, out string value)
    {
        value = "";
        if (text.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) == false)
            return false;

        value = text[prefix.Length..].Trim();
        return value.Length > 0;
    }
}
