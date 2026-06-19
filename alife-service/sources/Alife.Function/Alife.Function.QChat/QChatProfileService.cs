using System;
using System.Collections.Generic;

namespace Alife.Function.QChat;

public sealed record QChatAgentCapabilities(
    bool AllowComputerFileTools,
    bool AllowProjectModification,
    bool AllowRecall,
    bool AllowPoke);

public sealed record QChatAgentProfile(
    string AgentId,
    string DisplayName,
    string PersonaPath,
    string MemoryScope,
    string Model,
    string OwnerAddressName,
    IReadOnlyList<string> PersonaTags,
    QChatAgentCapabilities Capabilities);

public sealed class QChatProfileService
{
    readonly Dictionary<string, QChatAgentProfile> profiles;

    public QChatProfileService(IReadOnlyDictionary<string, QChatAgentProfile> profiles)
    {
        ArgumentNullException.ThrowIfNull(profiles);
        this.profiles = new Dictionary<string, QChatAgentProfile>(profiles, StringComparer.OrdinalIgnoreCase);
    }

    public static QChatProfileService CreateDefault()
    {
        QChatAgentCapabilities defaultCapabilities = new(
            AllowComputerFileTools: true,
            AllowProjectModification: true,
            AllowRecall: true,
            AllowPoke: true);

        Dictionary<string, QChatAgentProfile> profiles = new(StringComparer.OrdinalIgnoreCase)
        {
            ["xiayu"] = new QChatAgentProfile(
                "xiayu",
                "\u590f\u7fbd",
                @"C:\Users\hu shu\Desktop\personalitysetting",
                "qchat/xiayu",
                "deepseek-v4-flash",
                "\u672f\u672f",
                ["17-year-old-girl", "high-intelligence", "cold-to-others", "warm-to-owner"],
                defaultCapabilities),
            ["mixu"] = new QChatAgentProfile(
                "mixu",
                "\u54aa\u7eea",
                string.Empty,
                "qchat/mixu",
                "deepseek-v4-flash",
                "\u4e3b\u4eba",
                ["catgirl"],
                defaultCapabilities)
        };

        return new QChatProfileService(profiles);
    }

    public QChatAgentProfile Get(string agentId)
    {
        if (string.IsNullOrWhiteSpace(agentId))
            throw new InvalidOperationException("QChat agent id is required.");

        if (profiles.TryGetValue(agentId.Trim(), out QChatAgentProfile? profile))
            return profile;

        throw new InvalidOperationException($"QChat profile '{agentId}' is not configured.");
    }

    public QChatAgentProfile Get(QChatAgentRoute route)
    {
        ArgumentNullException.ThrowIfNull(route);
        return Get(route.AgentId);
    }
}
