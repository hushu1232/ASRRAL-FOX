using System;

namespace Alife.Function.QChat;

public sealed record QChatDiagnosticsResult(bool Handled, string Text);

public sealed record QChatDiagnosticsRuntimeState(
    bool ReplyTimingDelayEnabled = false,
    bool ConversationSettleWindowEnabled = false);

public static class QChatDiagnosticsService
{
    const string CommandPrefix = "/qchat";

    public static string FormatDecisionTrace(QChatDecisionTrace trace)
    {
        ArgumentNullException.ThrowIfNull(trace);
        return trace.ToDiagnosticText();
    }

    public static QChatDiagnosticsResult TryHandle(string? text, QChatAgentRoute route, QChatAgentProfile profile)
    {
        return TryHandle(text, route, profile, new QChatDiagnosticsRuntimeState());
    }

    public static QChatDiagnosticsResult TryHandle(
        string? text,
        QChatAgentRoute route,
        QChatAgentProfile profile,
        QChatDiagnosticsRuntimeState runtimeState)
    {
        string commandText = text?.Trim() ?? string.Empty;
        if (!IsQChatCommand(commandText))
            return new QChatDiagnosticsResult(false, string.Empty);

        ArgumentNullException.ThrowIfNull(route);
        ArgumentNullException.ThrowIfNull(profile);
        ArgumentNullException.ThrowIfNull(runtimeState);

        string command = commandText.Length == CommandPrefix.Length
            ? string.Empty
            : commandText[CommandPrefix.Length..].Trim();
        command = StripCopiedMenuDescription(command);

        return command.ToLowerInvariant() switch
        {
            "route" => Handled(BuildRouteText(route)),
            "identity" => Handled(BuildIdentityText(route, profile)),
            "profile" => Handled(BuildProfileText(profile)),
            "status" => Handled(BuildStatusText(route, profile, runtimeState)),
            "" or "help" or "menu" or "帮助" or "菜单" => Handled(BuildRootMenuText()),
            "memory" => Handled(BuildMemoryMenuText()),
            "desktop" => Handled(BuildDesktopMenuText()),
            "timing" => Handled(BuildTimingMenuText()),
            "events" => Handled(BuildEventsMenuText()),
            "diag" or "diagnostics" => Handled(BuildDiagnosticsMenuText()),
            "files" => Handled("files=pending:0 downloaded:0 deleted:0"),
            "approvals" => Handled("approvals=pending:0"),
            "failures" => Handled("failures=0"),
            "recent private" => Handled("recent.private=empty"),
            "recent group" => Handled("recent.group=empty"),
            _ => Handled(BuildRootMenuText())
        };
    }

    static bool IsQChatCommand(string text)
    {
        if (!text.StartsWith(CommandPrefix, StringComparison.OrdinalIgnoreCase))
            return false;

        return text.Length == CommandPrefix.Length || char.IsWhiteSpace(text[CommandPrefix.Length]);
    }

    static string StripCopiedMenuDescription(string command)
    {
        int descriptionStart = command.IndexOf(" - ", StringComparison.Ordinal);
        return descriptionStart >= 0 ? command[..descriptionStart].TrimEnd() : command;
    }

    static QChatDiagnosticsResult Handled(string text)
    {
        return new QChatDiagnosticsResult(true, text);
    }

    static string BuildRouteText(QChatAgentRoute route)
    {
        return string.Join(Environment.NewLine,
            $"agent={route.AgentId}",
            $"bot={route.BotAccountId}",
            $"session={route.SessionKey}",
            $"conversation={route.ConversationKind}",
            $"peer={route.PeerId}",
            $"owner={route.IsOwner}");
    }

    static string BuildProfileText(QChatAgentProfile profile)
    {
        return string.Join(Environment.NewLine,
            $"agent={profile.AgentId}",
            $"display={profile.DisplayName}",
            $"model={profile.Model}",
            $"memory={profile.MemoryScope}",
            $"persona={profile.PersonaPath}");
    }

    static string BuildIdentityText(QChatAgentRoute route, QChatAgentProfile profile)
    {
        return string.Join(Environment.NewLine,
            $"agent={route.AgentId}",
            $"bot={route.BotAccountId}",
            $"display={profile.DisplayName}",
            $"owner_address={profile.OwnerAddressName}",
            $"memory={profile.MemoryScope}",
            $"session={route.SessionKey}");
    }

    static string BuildStatusText(
        QChatAgentRoute route,
        QChatAgentProfile profile,
        QChatDiagnosticsRuntimeState runtimeState)
    {
        return string.Join(Environment.NewLine,
            $"agent={route.AgentId}",
            $"bot={route.BotAccountId}",
            $"session={route.SessionKey}",
            $"model={profile.Model}",
            $"reply_timing_delay={FormatEnabled(runtimeState.ReplyTimingDelayEnabled)}",
            $"conversation_settle_window={FormatEnabled(runtimeState.ConversationSettleWindowEnabled)}",
            "status=online");
    }

    static string FormatEnabled(bool value)
    {
        return value ? "enabled" : "disabled";
    }

    public static string BuildRootMenuText()
    {
        return string.Join(Environment.NewLine,
            "QChat 指令菜单，只限术术账号使用。",
            "",
            "常用：",
            "/qchat status - 查看当前 QQ 聊天状态",
            "/qchat timing - 回复延时设置",
            "/qchat memory - 记忆相关指令",
            "/qchat desktop - 桌面能力相关指令",
            "/qchat events - 主人事件 outbox",
            "/qchat diag - 路由、身份、模型等诊断",
            "",
            "输入对应分类查看二级菜单。",
            "例如：/qchat memory");
    }

    public static string BuildMemoryMenuText()
    {
        return string.Join(Environment.NewLine,
            "记忆指令：",
            "/qchat memory status - 查看记忆层是否接通",
            "/qchat memory recent - 查看最近记忆事件",
            "/qchat memory forget <id> - 从当前上下文移除某条记忆",
            "/qchat memory purge <id> confirm - 将记忆归档移入回收区",
            "",
            "说明：",
            "forget 只移出当前上下文，归档仍可恢复。",
            "purge 是更强操作，必须带 confirm。");
    }

    public static string BuildDesktopMenuText()
    {
        return string.Join(Environment.NewLine,
            "桌面指令：",
            "/qchat desktop status - 查看桌面能力状态",
            "/qchat desktop capabilities - 查看可用能力和风险等级",
            "/qchat desktop processes - 查看进程摘要",
            "/qchat desktop windows - 查看窗口摘要",
            "/qchat desktop audit recent - 查看最近桌面审计",
            "/qchat desktop audit health - 查看审计健康状态",
            "/qchat desktop request <action> - 创建待审批桌面动作草稿",
            "/qchat desktop drafts recent - 查看最近草稿",
            "/qchat desktop draft approve <id> - 批准草稿",
            "/qchat desktop draft reject <id> - 拒绝草稿",
            "/qchat desktop draft execute <id> - 执行已批准草稿",
            "/qchat desktop jobs recent - 查看最近任务",
            "/qchat desktop job <id> - 查看任务详情",
            "/qchat desktop file policy - 查看文件黑名单和写入限制",
            "",
            "说明：",
            "桌面动作仍受权限、审批、审计、文件黑名单和 outbox 约束。");
    }

    public static string BuildTimingMenuText()
    {
        return string.Join(Environment.NewLine,
            "回复延时：",
            "/qchat timing status - 查看当前延时状态",
            "/qchat timing on - 开启拟人回复延时",
            "/qchat timing off - 关闭拟人回复延时",
            "",
            "说明：",
            "这个只影响 QQ 回复节奏，不改变权限和安全边界。");
    }

    public static string BuildEventsMenuText()
    {
        return string.Join(Environment.NewLine,
            "主人事件：",
            "/qchat events status - 查看 outbox 状态",
            "/qchat events retry - 重试待发送主人事件",
            "",
            "说明：",
            "outbox 用来保证高风险或重要事件不会绕过主人通知链路。");
    }

    public static string BuildDiagnosticsMenuText()
    {
        return string.Join(Environment.NewLine,
            "诊断指令：",
            "/qchat route - 查看当前会话路由",
            "/qchat identity - 查看当前 agent 身份",
            "/qchat profile - 查看模型、人设、记忆配置",
            "/qchat status - 查看在线和回复窗口状态",
            "",
            "说明：",
            "诊断信息只给主人账号开放，用来排查 QQ 链路。");
    }
}
