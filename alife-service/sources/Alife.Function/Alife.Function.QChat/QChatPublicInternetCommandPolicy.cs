using System;
using System.Text.RegularExpressions;
using Alife.Function.Agent;

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
    bool EnablePublicRagQuery,
    bool AllowGroupMemberPublicSearch = true,
    bool AllowGroupMemberExternalRagQuery = true);

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

    public static QChatPublicInternetCommand ParseMessage(
        OneBotMessageType messageType,
        long botId,
        string? rawMessage,
        string? readableText)
    {
        QChatPublicInternetCommand explicitCommand = Parse(readableText);
        if (explicitCommand.Kind != QChatPublicInternetCommandKind.None)
            return explicitCommand;

        if (messageType != OneBotMessageType.Group && messageType != OneBotMessageType.Private)
            return QChatPublicInternetCommand.None;

        string raw = rawMessage ?? string.Empty;
        if (messageType == OneBotMessageType.Group && (botId <= 0 || IsMentioned(raw, botId) == false))
            return QChatPublicInternetCommand.None;

        string plain = OneBotSegment.GetPlainText(raw);
        if (plain.Contains("浏览器", StringComparison.OrdinalIgnoreCase))
            return QChatPublicInternetCommand.None;

        string query = ExtractSearchQuery(plain);
        return query.Length > 0
            ? new QChatPublicInternetCommand(QChatPublicInternetCommandKind.Search, query)
            : QChatPublicInternetCommand.None;
    }

    public static QChatPublicInternetCommandDecision Evaluate(QChatPublicInternetCommandContext context)
    {
        if (context.Kind == QChatPublicInternetCommandKind.None)
            return new QChatPublicInternetCommandDecision(false, "not_public_internet_command");

        if (context.SenderRole is not (QChatSenderRole.Owner or QChatSenderRole.GroupMember))
            return new QChatPublicInternetCommandDecision(false, "public_internet_sender_not_allowed");

        AgentWebAccessCapability capability = context.Kind == QChatPublicInternetCommandKind.Search
            ? AgentWebAccessCapability.PublicSearch
            : AgentWebAccessCapability.ExternalRagQuery;
        AgentWebAccessDecision decision = AgentWebAccessRouter.Evaluate(new AgentWebAccessRequest(
            MapActorRole(context.SenderRole),
            capability,
            context.Query,
            new AgentWebAccessConfig
            {
                EnablePublicSearch = context.EnablePublicSearch,
                EnableExternalRagQuery = context.EnablePublicRagQuery,
                AllowGroupMemberPublicSearch = context.AllowGroupMemberPublicSearch,
                AllowGroupMemberExternalRagQuery = context.AllowGroupMemberExternalRagQuery,
                MaxQueryChars = context.MaxQueryChars
            }));

        string reason = decision.Reason == "query_too_long"
            ? "public_query_too_long"
            : decision.Reason;
        if (reason == "external_rag_query_disabled")
            reason = "public_rag_disabled";
        return new QChatPublicInternetCommandDecision(decision.Allowed, reason);
    }

    static AgentWebAccessActorRole MapActorRole(QChatSenderRole senderRole)
    {
        return senderRole switch
        {
            QChatSenderRole.Owner => AgentWebAccessActorRole.Owner,
            QChatSenderRole.GroupMember => AgentWebAccessActorRole.GroupMember,
            QChatSenderRole.PrivateGuest => AgentWebAccessActorRole.PrivateGuest,
            _ => AgentWebAccessActorRole.Unknown
        };
    }

    static bool TryParsePrefix(string text, string prefix, out string value)
    {
        value = "";
        if (text.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) == false)
            return false;

        value = text[prefix.Length..].Trim();
        return value.Length > 0;
    }

    static bool IsMentioned(string rawMessage, long botId)
    {
        return Regex.IsMatch(
            rawMessage,
            $@"\[CQ:at,[^\]]*qq={Regex.Escape(botId.ToString())}(?:,|\])",
            RegexOptions.CultureInvariant);
    }

    static string ExtractSearchQuery(string text)
    {
        string normalized = Regex.Replace(text.Trim(), @"\s+", " ");
        if (normalized.Length == 0)
            return "";

        string simpleQuery = ExtractSimpleSearchQuery(normalized);
        if (simpleQuery.Length > 0)
            return simpleQuery;

        string[] patterns =
        [
            @"^(?:请|麻烦|帮我|帮忙|可以)?\s*(?:联网)?(?:搜一下|搜索一下|搜搜|搜索|搜|查一下|查查|查询一下|查询|找一下|找找)\s*(?<query>.+)$",
            @"^(?:请|麻烦|帮我|帮忙|可以)?\s*联网(?:看看|看一下|查一下|查询|搜一下|搜索)?\s*(?<query>.+)$",
            @"^(?:请|麻烦|帮我|帮忙|可以)?\s*(?:看看|看一下)?\s*(?:最新|实时)\s*(?<query>.+)$",
            @"^(?:请|麻烦|帮我|帮忙|可以)?\s*(?:看看|看一下)?\s*(?:今天|现在)\s*(?<query>.*(?:天气|新闻|价格|版本|发布|情况|状态|更新).*)$"
        ];

        foreach (string pattern in patterns)
        {
            Match match = Regex.Match(
                normalized,
                pattern,
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
            if (match.Success == false)
                continue;

            return CleanQuery(match.Groups["query"].Value);
        }

        return "";
    }

    static string ExtractSimpleSearchQuery(string normalized)
    {
        string[] markers =
        [
            "帮我搜一下",
            "帮我搜索",
            "搜一下",
            "搜索",
            "查一下",
            "查一查",
            "查询一下",
            "联网看看",
            "联网查一下",
            "找一下",
            "最新"
        ];

        foreach (string marker in markers)
        {
            int index = normalized.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
            if (index < 0)
                continue;

            string query = normalized[(index + marker.Length)..].Trim();
            return CleanQuery(query);
        }

        return "";
    }

    static string CleanQuery(string query)
    {
        string cleaned = Regex.Replace(query.Trim(), @"^(?:一下|看看|看一下)\s*", "");
        cleaned = Regex.Replace(cleaned, @"\s+", " ");
        return cleaned.Trim(' ', '，', ',', '。', '？', '?', '！', '!');
    }
}
