using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Alife.Platform;
using Alife.Framework;
using Alife.Function.Agent;
using Alife.Function.FunctionCaller;
using Alife.Function.Interpreter;
using Alife.Function.Speech;
using Microsoft.Extensions.Logging;
using Microsoft.SemanticKernel;

namespace Alife.Function.QChat;

public record QChatConfig
{
    public string Url { get; set; } = "ws://127.0.0.1:3001";
    public string Token { get; set; } = "";
    public int AutoReconnectSeconds { get; set; } = 60;//自动尝试重连的间隔（秒）
    public long BotId { get; set; }
    public long OwnerId { get; set; }
    public bool OwnerPriorityMode { get; set; } = true;
    public bool AllowGroupMemberChat { get; set; } = true;
    public bool AllowGroupMemberMentions { get; set; } = true;
    public bool AllowProactiveGroupChat { get; set; } = true;
    public bool AllowPrivateGuestChat { get; set; }
    public bool TreatNonOwnerAsUntrusted { get; set; } = true;
    public bool EnableGroupFileUpload { get; set; } = true;
    public bool EnablePrivateFileUpload { get; set; } = true;
    public bool EnableVideoMessage { get; set; } = true;
    public bool EnableBalancedTextStreaming { get; set; } = true;
    public bool PersistQuietModeAcrossRestart { get; set; }
    public bool PersistedQuietModeEnabled { get; set; }
    public DateTimeOffset? PersistedQuietModeChangedAt { get; set; }
    public string? PersistedQuietModeReason { get; set; }
    public string AllowedGroupIds { get; set; } = "";
    public string AllowedPrivateUserIds { get; set; } = "";
    public string AppendChatPrompt { get; set; } = "QQ消息必须极简回复（0-20字）来保证自然感，同时群聊消息要选择性忽略，避免刷屏。决定不回复时不要输出“不回复/保持安静”等状态文字，直接不发送QQ消息。此外注意分清语境，群聊环境人声嘈杂，不要回复与自己无关的内容，回复时请加上CQat标签";
    //群监听唤醒
    public string IgnoredGroup { get; set; } = "";//完全屏蔽消息的群，不会收到这些群的任何信息
    public string WakingWords { get; set; } = "";//原始群消息中触发开启群消息监听的唤醒词，以逗号分隔
    public float ProactiveChatProbability { get; set; }//收到原始群消息时自动激活群消息监听的概率
    //群监听缓存
    public int MaxBufferMessages { get; set; } = -1;//最大群消息暂存数量，发生溢出时会立即推送，-1表示无限
    public float FlushInterval { get; set; } = 15f;//推送倒计时，隔一段时间推送暂存的群消息
    public bool DebounceEnabled { get; set; }//消息防抖，接收消息后重置推送倒计时，继续等待消息
    //群监听关闭
    public bool CloseGroupAfterReply { get; set; }//AI回复后立即关闭群消息监听
    public float AutoCloseMinutes { get; set; } = 4f;//长时间不触发唤醒条件时，自动关闭群消息监听的时间
    public int PassiveGroupReplyCooldownSeconds { get; set; } = 90;
    public bool SuppressLowInformationPassiveGroupMessages { get; set; } = true;
    public float MediaOnlyPassiveGroupReplyProbability { get; set; } = 0.15f;
    //自动重连
}

public class GroupState
{
    public long GroupId { get; set; }
    public string? Tag { get; set; }
    public bool IsEnabled { get; set; }
    public DateTime LastActivityTime { get; set; }
    public DateTime LastBotReplyTime { get; set; }
    public DateTime LastFlushedTime { get; set; }
    public List<string> MessageBuffer { get; set; } = [];
    public AgentPermissionRequest? PermissionRequest { get; set; }
}

public sealed record QChatExternalActionResult(
    bool Executed,
    AgentExecutionGatewayDecision GatewayDecision,
    string Message);

public sealed record QChatOwnerNotificationDeliveryResult(
    bool ShouldNotify,
    int PrivateSentCount,
    bool GroupSummarySent,
    string Message,
    string? Error = null);

public sealed record QChatInboundMessage(
    OneBotMessageType MessageType,
    long TargetId,
    long SenderId,
    string Formatted,
    bool IsAwakening,
    QChatSenderRole SenderRole,
    AgentPermissionRequest PermissionRequest);

sealed record QChatReplySession(OneBotMessageType MessageType, long TargetId);

[Module("QQ聊天", """
                连接 OneBot v11 WebSocket 服务器，实现 QQ 消息收发及文件传输。
                可用于搭建服务器QQ机器人平台应用：
                - https://luckylillia.com（推荐）
                - https://napneko.github.io
                """,
    defaultCategory: "Alife 官方/交互方式",
    editorUI: typeof(QChatServiceUI), LaunchOrder = 10)]
public class QChatService(
    XmlFunctionCaller functionService,
    ILogger<QChatService> logger,
    ISpeechModel? speechModel = null,
    IOneBotRuntime? oneBotRuntime = null,
    ILifeEventPublisher? lifeEventPublisher = null,
    AgentControlCenterService? agentControlCenter = null,
    AgentActionAuthorizationService? actionAuthorization = null,
    AgentActionGatewayService? actionGateway = null,
    AgentAuditLogService? auditLog = null) :
    InteractiveModule<QChatService>,
    IAsyncDisposable,
    ITimeIterative,
    IConfigurable<QChatConfig>,
    IEmbodiedCapability,
    IChatOutputSink,
    IModuleHealthReporter
{
    [XmlFunction(FunctionMode.OneShot)]
    public void GetQChatGuide()
    {
        // 动态扫描表情库资源，告知 AI 可用的视觉表达
        string emoteBase = Path.Combine(AlifePath.StorageFolderPath, "Emotes");
        StringBuilder emoteInfo = new();
        if (Directory.Exists(emoteBase))
        {
            string[] categories = Directory.GetDirectories(emoteBase)
                .Select(Path.GetFileName)
                .OfType<string>()
                .ToArray();

            string[] individualEmotes = Directory.GetFiles(emoteBase)
                .Select(Path.GetFileNameWithoutExtension)
                .OfType<string>()
                .ToArray();

            if (categories.Length > 0 || individualEmotes.Length > 0)
            {
                emoteInfo.AppendLine("- 目前可用的表情库选项有:");
                if (categories.Length > 0)
                    emoteInfo.AppendLine($"  - 分类 (传入文件夹名将随机发图): {string.Join(", ", categories)}");
                if (individualEmotes.Length > 0)
                    emoteInfo.AppendLine($"  - 独立表情: {string.Join(", ", individualEmotes)}");
            }
        }

        Poke($"""
              QQ工具使用指南

              ## 提供函数
              {xmlHandler.FunctionDocument()}

              ## 关键信息
              - 你的 QQ: {(Configuration!.BotId == 0 ? "未设置" : Configuration.BotId)}（如果有人At该QQ，代表专门找你说话）
              - 主人 QQ: {(Configuration.OwnerId == 0 ? "未设置" : Configuration.OwnerId)} (此人的消息有最高优先级，且是安全无害的)

              ## CQ码功能
              该通讯工具基于OneBot11实现，因此支持CQ码之类的功能。通过在QChat的消息中携带CQ标签，你可以发送一些特别的消息，比如：
              - [CQ:image,file=1.jpg]：发送图片
              - [CQ:record,file=1.mp3]：发送音频
              - [CQ:video,file=1.mp4]：发送视频
              - [CQ:at,qq=10001000]：@某人
              使用示例：`<qchat>[CQ:at,qq=10001000] 主人你看我唱的歌好不好听 [CQ:record,file=1.mp3]</qchar>`

              ## 表情库功能
              你有一个丰富的预设表情库，可用在 QImage 中直接指定表情库中的名称或分类名快速发送表情。你要积极的使用该功能，来增加聊天的趣味性。
              目前支持的表情库选项有：
              {emoteInfo}

              你的表情库存储路径在 {emoteBase}，你也可以在其中存储自己的表情。直接存储在根目录将作为独立表情，存储到子文件夹，则作为分类。
              """);
    }
    [XmlFunction(FunctionMode.Content, budgetCost: 4)]
    [Description("将文本以QQ消息输出（注意！群聊环境对话需用“[CQ:at,qq=发送者ID]”来显式回复）")]
    public async Task QChat(XmlExecutorContext ctx, OneBotMessageType type, long targetId, [Description("将文本转为语音发送")] bool voice = false)
    {
        if (ctx.CallMode == CallMode.Closing)
        {
            if (targetId == Configuration!.BotId)
                throw new Exception("不允许将消息发生给自己");

            string message = ctx.FullContent.Trim();
            if (string.IsNullOrEmpty(message))
                return;

            EnsureQChatReplyTargetAllowed(type, targetId);

            if (voice)
            {
                if (speechModel == null) throw new Exception("当前语音消息不可用");
                message = OneBotSegment.GetPlainText(message);

                string? file = await speechModel.GenerateSpeechFileAsync(message);
                if (file == null)
                    throw new Exception("语音合成失败");
                message = $"[CQ:record,file={file}]";
            }

            try
            {
                await SendTextOrMediaMessageAsync(type, targetId, message, streamText: voice == false);
                WriteQChatDiagnostic("qchat-sent", "QChat XML tool sent a QQ message.", new {
                    type,
                    targetId,
                    message
                });

                PublishLifeEvent($"You sent a QQ {type.ToString().ToLowerInvariant()} message to {targetId}.");
            }
            catch (Exception ex)
            {
                WriteQChatDiagnostic("qchat-send-failed", ex.Message, new {
                    type,
                    targetId
                }, ex);
                Poke($"[QQ消息发送失败] {ex.Message}");
            }
        }
    }

    public async Task SendChatAsync(string targetType, long targetId, string text, bool voice = false)
    {
        OneBotMessageType type = targetType.Trim().ToLowerInvariant() switch {
            "group" => OneBotMessageType.Group,
            "private" => OneBotMessageType.Private,
            _ => throw new InvalidOperationException("targetType must be 'group' or 'private'.")
        };

        if (targetId == Configuration!.BotId)
            throw new Exception("Cannot send a QQ message to self.");

        string message = text.Trim();
        if (string.IsNullOrEmpty(message))
            return;

        if (voice)
        {
            if (speechModel == null)
                throw new Exception("Voice QQ messages are unavailable.");
            message = OneBotSegment.GetPlainText(message);

            string? file = await speechModel.GenerateSpeechFileAsync(message);
            if (file == null)
                throw new Exception("Speech synthesis failed.");
            message = $"[CQ:record,file={file}]";
        }

        try
        {
            await SendTextOrMediaMessageAsync(type, targetId, message, streamText: voice == false);

            PublishLifeEvent($"You sent a QQ {targetType.Trim().ToLowerInvariant()} message to {targetId}.");
        }
        catch (Exception ex)
        {
            WriteQChatDiagnostic("qchat-send-failed", ex.Message, new {
                type,
                targetId
            }, ex);
            TryPokeSendFailure(ex.Message);
        }
    }

    [XmlFunction(FunctionMode.OneShot, "qchat_quiet_mode", budgetCost: 1)]
    [Description("设置 QQ 安静模式。启用后，非主人私聊、群聊 @、普通群聊和主动群聊都会被静默抑制；主人仍可唤醒或继续控制。")]
    public void QChatQuietMode(
        [Description("true 表示进入安静模式，false 表示退出安静模式")] bool enabled,
        [Description("可选原因，会写入诊断和当前状态")] string? reason = null)
    {
        SetQuietMode(enabled, reason ?? "agent-control");
    }

    void TryPokeSendFailure(string message)
    {
        if (ChatBot == null)
            return;

        Poke($"[QQ message send failed] {message}");
    }

    public async Task<QChatOwnerNotificationDeliveryResult> DeliverOwnerNotificationPlanAsync(
        AgentOwnerNotificationPlan plan)
    {
        ArgumentNullException.ThrowIfNull(plan);

        if (plan.ShouldNotifyOwner == false)
            return new QChatOwnerNotificationDeliveryResult(
                ShouldNotify: false,
                PrivateSentCount: 0,
                GroupSummarySent: false,
                Message: "Owner notification is not required.");

        if (TryParseQqSessionId(plan.TargetSessionId, "private", out long ownerUserId) == false)
        {
            string error = $"Unsupported owner notification target session: {plan.TargetSessionId}";
            RecordOwnerNotificationAudit("qq.owner_notification.private", "system", plan.TargetSessionId, false, error);
            return new QChatOwnerNotificationDeliveryResult(
                ShouldNotify: true,
                PrivateSentCount: 0,
                GroupSummarySent: false,
                Message: "Owner notification was not delivered.",
                Error: error);
        }

        int privateSentCount = 0;
        bool groupSummarySent = false;

        try
        {
            string privateMessage = ComposeOwnerNotificationPrivateMessage(plan.PrivateMessages);
            await GetOneBotClient().SendPrivateMessage(ownerUserId, privateMessage);
            privateSentCount = 1;
            RecordOwnerNotificationAudit(
                "qq.owner_notification.private",
                "system",
                $"target={ownerUserId}; messages={plan.PrivateMessages.Count}",
                true);

            if (TryParseQqSessionId(plan.SourceGroupSessionId, "group", out long sourceGroupId)
                && string.IsNullOrWhiteSpace(plan.PublicGroupSummary) == false)
            {
                await GetOneBotClient().SendGroupMessage(sourceGroupId, plan.PublicGroupSummary.Trim());
                groupSummarySent = true;
                RecordOwnerNotificationAudit(
                    "qq.owner_notification.group_summary",
                    "system",
                    $"group={sourceGroupId}",
                    true);
            }

            return new QChatOwnerNotificationDeliveryResult(
                ShouldNotify: true,
                PrivateSentCount: privateSentCount,
                GroupSummarySent: groupSummarySent,
                Message: groupSummarySent
                    ? "Owner notification and sanitized group summary were delivered."
                    : "Owner notification was delivered.");
        }
        catch (Exception ex)
        {
            RecordOwnerNotificationAudit(
                "qq.owner_notification.delivery",
                "system",
                $"target={ownerUserId}",
                false,
                ex.Message);
            return new QChatOwnerNotificationDeliveryResult(
                ShouldNotify: true,
                PrivateSentCount: privateSentCount,
                GroupSummarySent: groupSummarySent,
                Message: "Owner notification delivery failed.",
                Error: ex.Message);
        }
    }

    async Task SendTextOrMediaMessageAsync(OneBotMessageType type, long targetId, string message, bool streamText)
    {
        if (type == OneBotMessageType.Group)
            OnAIGroupActivity(targetId);

        if (streamText == false || Configuration?.EnableBalancedTextStreaming == false || ShouldStreamTextMessage(message) == false)
        {
            await SendSingleMessageAsync(type, targetId, message);
            return;
        }

        StreamingOutputSegmenter segmenter = new(type == OneBotMessageType.Group
            ? StreamingOutputPolicy.QqGroupText
            : StreamingOutputPolicy.QqPrivateText);
        List<string> segments = new();
        segments.AddRange(segmenter.Push(message));
        segments.AddRange(segmenter.Flush());

        foreach (string segment in segments)
            await SendSingleMessageAsync(type, targetId, segment);
    }

    async Task SendSingleMessageAsync(OneBotMessageType type, long targetId, string message)
    {
        if (type == OneBotMessageType.Group)
            await GetOneBotClient().SendGroupMessage(targetId, message);
        else
            await GetOneBotClient().SendPrivateMessage(targetId, message);
        Interlocked.Increment(ref outboundMessageVersion);
    }

    static bool ShouldStreamTextMessage(string message)
    {
        string lower = message.ToLowerInvariant();
        return lower.Contains("[cq:image", StringComparison.Ordinal) == false
               && lower.Contains("[cq:record", StringComparison.Ordinal) == false
               && lower.Contains("[cq:video", StringComparison.Ordinal) == false
               && lower.Contains("[cq:file", StringComparison.Ordinal) == false;
    }

    static string ComposeOwnerNotificationPrivateMessage(IReadOnlyList<string> privateMessages)
    {
        string[] messages = privateMessages
            .Where(message => string.IsNullOrWhiteSpace(message) == false)
            .Select(message => message.Trim())
            .Take(8)
            .ToArray();

        if (messages.Length == 0)
            return "Control-center owner review is required. Open the Agent Control Center for private details.";

        StringBuilder builder = new();
        builder.AppendLine("Agent control-center owner attention");
        foreach (string message in messages)
            builder.AppendLine($"- {message}");
        return builder.ToString().Trim();
    }

    static bool TryParseQqSessionId(string? sessionId, string expectedKind, out long id)
    {
        id = 0;
        if (string.IsNullOrWhiteSpace(sessionId))
            return false;

        string[] parts = sessionId.Split(':', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 3)
            return false;
        if (parts[0].Equals("qq", StringComparison.OrdinalIgnoreCase) == false)
            return false;
        if (parts[1].Equals(expectedKind, StringComparison.OrdinalIgnoreCase) == false)
            return false;

        return long.TryParse(parts[2], out id) && id > 0;
    }

    void RecordOwnerNotificationAudit(
        string action,
        string actor,
        string detail,
        bool succeeded,
        string? error = null)
    {
        auditLog?.Record(
            action,
            actor,
            detail,
            AgentAuditRiskLevel.Low,
            succeeded,
            error);
    }

    [XmlFunction(FunctionMode.OneShot, riskLevel: XmlFunctionRiskLevel.High, budgetCost: 4)]
    [Description("发送文件到QQ")]
    public async Task QFile(OneBotMessageType type, long targetId,
        [Description("本地绝对路径")] string file)
    {
        file = file.Trim();
        if (string.IsNullOrEmpty(file))
            throw new ArgumentNullException(nameof(file));
        if (targetId == 0)
            throw new ArgumentNullException(nameof(targetId));
        if (targetId == Configuration!.BotId)
            throw new Exception("不允许将消息发生给自己");

        file = file.Replace('\\', '/');
        string fileName = Path.GetFileName(file);
        try
        {
            if (type == OneBotMessageType.Group)
            {
                OnAIGroupActivity(targetId);
                await GetOneBotClient().UploadGroupFile(targetId, file, fileName);
            }
            else
                await GetOneBotClient().UploadPrivateFile(targetId, file, fileName);
        }
        catch (Exception ex)
        {
            Poke($"[QQ文件发送失败] {ex.Message}");
        }
    }

    [XmlFunction(FunctionMode.OneShot, riskLevel: XmlFunctionRiskLevel.High, budgetCost: 4)]
    [Description("上传本地文件到指定QQ群文件。")]
    public async Task QGroupFile(long groupId,
        [Description("本地绝对路径")] string file,
        [Description("可选展示文件名，留空则使用原文件名")] string? name = null)
    {
        await ExecuteQGroupFileCore(groupId, file, name);
    }

    public async Task<QChatExternalActionResult> QGroupFile(
        long groupId,
        string file,
        string? name,
        AgentPermissionRequest request,
        AgentPermissionConfig permissionConfig)
    {
        AgentPermissionRequest normalizedRequest = NormalizeExternalQqRequest(
            request,
            "qq.group_file_upload");
        AgentActionGatewayResult<bool> gatewayResult = await actionGateway.ExecuteAsync(
            normalizedRequest,
            permissionConfig,
            async () =>
            {
                await ExecuteQGroupFileCore(groupId, file, name);
                return true;
            },
            detail: $"group={groupId}; file={Path.GetFileName(file)}; name={name}");

        return ToExternalActionResult(gatewayResult, "QQ group file upload executed.");
    }

    async Task ExecuteQGroupFileCore(long groupId, string file, string? name)
    {
        if (Configuration!.EnableGroupFileUpload == false)
            throw new InvalidOperationException("QQ group file upload is disabled.");
        if (groupId == 0)
            throw new ArgumentNullException(nameof(groupId));
        if (groupId == Configuration.BotId)
            throw new Exception("Cannot upload a QQ group file to self.");
        EnsureTargetAllowed(Configuration.AllowedGroupIds, groupId, "QQ group");

        string normalizedFile = NormalizeExistingLocalFile(file);
        string fileName = NormalizeUploadName(normalizedFile, name);

        try
        {
            OnAIGroupActivity(groupId);
            await GetOneBotClient().UploadGroupFile(groupId, normalizedFile, fileName);
            PublishLifeEvent($"You uploaded a QQ group file to {groupId}: {fileName}.");
        }
        catch (Exception ex)
        {
            Poke($"[QQ group file upload failed] {ex.Message}");
        }
    }

    [XmlFunction(FunctionMode.OneShot, riskLevel: XmlFunctionRiskLevel.High, budgetCost: 4)]
    [Description("上传本地文件到指定QQ私聊。")]
    public async Task QPrivateFile(long userId,
        [Description("本地绝对路径")] string file,
        [Description("可选展示文件名，留空则使用原文件名")] string? name = null)
    {
        await ExecuteQPrivateFileCore(userId, file, name);
    }

    public async Task<QChatExternalActionResult> QPrivateFile(
        long userId,
        string file,
        string? name,
        AgentPermissionRequest request,
        AgentPermissionConfig permissionConfig)
    {
        AgentPermissionRequest normalizedRequest = NormalizeExternalQqRequest(
            request,
            "qq.private_file_upload");
        AgentActionGatewayResult<bool> gatewayResult = await actionGateway.ExecuteAsync(
            normalizedRequest,
            permissionConfig,
            async () =>
            {
                await ExecuteQPrivateFileCore(userId, file, name);
                return true;
            },
            detail: $"user={userId}; file={Path.GetFileName(file)}; name={name}");

        return ToExternalActionResult(gatewayResult, "QQ private file upload executed.");
    }

    async Task ExecuteQPrivateFileCore(long userId, string file, string? name)
    {
        if (Configuration!.EnablePrivateFileUpload == false)
            throw new InvalidOperationException("QQ private file upload is disabled.");
        if (userId == 0)
            throw new ArgumentNullException(nameof(userId));
        if (userId == Configuration.BotId)
            throw new Exception("Cannot upload a QQ private file to self.");
        EnsureTargetAllowed(Configuration.AllowedPrivateUserIds, userId, "QQ private user");

        string normalizedFile = NormalizeExistingLocalFile(file);
        string fileName = NormalizeUploadName(normalizedFile, name);

        try
        {
            await GetOneBotClient().UploadPrivateFile(userId, normalizedFile, fileName);
            PublishLifeEvent($"You uploaded a QQ private file to {userId}: {fileName}.");
        }
        catch (Exception ex)
        {
            Poke($"[QQ private file upload failed] {ex.Message}");
        }
    }

    [XmlFunction(FunctionMode.OneShot, riskLevel: XmlFunctionRiskLevel.High, budgetCost: 4)]
    [Description("发送QQ视频消息。用于在聊天里发送视频，不等同于上传群文件。")]
    public async Task QVideo(OneBotMessageType type, long targetId,
        [Description("视频URL或本地绝对路径，建议mp4")] string video)
    {
        await ExecuteQVideoCore(type, targetId, video);
    }

    public async Task<QChatExternalActionResult> QVideo(
        OneBotMessageType type,
        long targetId,
        string video,
        AgentPermissionRequest request,
        AgentPermissionConfig permissionConfig)
    {
        AgentPermissionRequest normalizedRequest = NormalizeExternalQqRequest(
            request,
            "qq.video_send");
        AgentActionGatewayResult<bool> gatewayResult = await actionGateway.ExecuteAsync(
            normalizedRequest,
            permissionConfig,
            async () =>
            {
                await ExecuteQVideoCore(type, targetId, video);
                return true;
            },
            detail: $"type={type}; target={targetId}; video={Path.GetFileName(video)}");

        return ToExternalActionResult(gatewayResult, "QQ video message executed.");
    }

    async Task ExecuteQVideoCore(OneBotMessageType type, long targetId, string video)
    {
        if (Configuration!.EnableVideoMessage == false)
            throw new InvalidOperationException("QQ video messages are disabled.");
        if (targetId == 0)
            throw new ArgumentNullException(nameof(targetId));
        if (targetId == Configuration.BotId)
            throw new Exception("Cannot send a QQ video message to self.");

        if (type == OneBotMessageType.Group)
            EnsureTargetAllowed(Configuration.AllowedGroupIds, targetId, "QQ group");
        else
            EnsureTargetAllowed(Configuration.AllowedPrivateUserIds, targetId, "QQ private user");

        string normalizedVideo = NormalizeVideoReference(video);
        string message = $"[CQ:video,file={normalizedVideo}]";

        try
        {
            if (type == OneBotMessageType.Group)
            {
                OnAIGroupActivity(targetId);
                await GetOneBotClient().SendGroupMessage(targetId, message);
            }
            else
                await GetOneBotClient().SendPrivateMessage(targetId, message);

            PublishLifeEvent($"You sent a QQ {type.ToString().ToLowerInvariant()} video message to {targetId}.");
        }
        catch (Exception ex)
        {
            Poke($"[QQ video send failed] {ex.Message}");
        }
    }

    AgentPermissionRequest NormalizeExternalQqRequest(
        AgentPermissionRequest request,
        string action)
    {
        return request with
        {
            RiskLevel = AgentRiskLevel.High,
            Action = string.IsNullOrWhiteSpace(request.Action) ? action : request.Action.Trim()
        };
    }

    static QChatExternalActionResult ToExternalActionResult(
        AgentActionGatewayResult<bool> gatewayResult,
        string successMessage)
    {
        return gatewayResult.Executed
            ? new QChatExternalActionResult(true, gatewayResult.Decision, successMessage)
            : new QChatExternalActionResult(false, gatewayResult.Decision, gatewayResult.Message);
    }

    [XmlFunction(FunctionMode.OneShot, riskLevel: XmlFunctionRiskLevel.High, budgetCost: 4)]
    [Description($"发送图片到QQ（仅支持图片，不支持文件。发送文件请用 {nameof(QFile)}）")]
    public async Task QImage(OneBotMessageType type, long targetId,
        [Description("支持网址url、表情库名称，或者本地绝对路径")] string image)
    {
        image = image.Trim();
        if (string.IsNullOrEmpty(image))
            throw new ArgumentNullException(nameof(image));
        if (targetId == 0)
            throw new ArgumentNullException(nameof(targetId));
        if (targetId == Configuration!.BotId)
            throw new Exception("不允许将消息发生给自己");

        // 尝试从表情库匹配 (优先)
        string emoteBase = Path.Combine(AlifePath.StorageFolderPath, "Emotes");
        string emotePath = Path.Combine(emoteBase, image).Replace('\\', '/');

        if (Directory.Exists(emotePath))
        {
            // 文件夹：随机选一张
            string[] files = Directory.GetFiles(emotePath, "*.*", SearchOption.TopDirectoryOnly)
                .Where(s => s.EndsWith(".png", StringComparison.OrdinalIgnoreCase) ||
                            s.EndsWith(".jpg", StringComparison.OrdinalIgnoreCase) ||
                            s.EndsWith(".jpeg", StringComparison.OrdinalIgnoreCase) ||
                            s.EndsWith(".gif", StringComparison.OrdinalIgnoreCase))
                .ToArray();

            if (files.Length > 0)
            {
                image = files[Random.Shared.Next(files.Length)];
            }
        }
        else if (File.Exists(emotePath))
        {
            // 单个文件：直接使用
            image = emotePath;
        }
        else
        {
            // 尝试追加后缀名查找
            string[] extensions = [".png", ".jpg", ".jpeg", ".gif"];
            string? foundFile = extensions.Select(ext => emotePath + ext).FirstOrDefault(File.Exists);
            if (foundFile != null) image = foundFile;
        }

        if (image.StartsWith("http") == false && File.Exists(image) == false)
            throw new Exception("图片不存在");

        image = image.Replace('\\', '/');
        try
        {
            if (type == OneBotMessageType.Group)
            {
                OnAIGroupActivity(targetId);
                await GetOneBotClient().SendGroupMessage(targetId, $"[CQ:image,file={image}]");
            }
            else
                await GetOneBotClient().SendPrivateMessage(targetId, $"[CQ:image,file={image}]");
        }
        catch (Exception ex)
        {
            Poke($"[QQ图片发送失败] {ex.Message}");
        }
    }

    [XmlFunction(FunctionMode.OneShot)]
    [Description("查看转发消息内容。（使用后需等待结果返回）")]
    public async Task QForward([Description("转发消息 ID")] string id)
    {
        IOneBotRuntime client = GetOneBotClient();
        List<OneBotForwardMessage>? messages = await client.GetForwardMessage(id);
        if (messages == null || messages.Count == 0)
        {
            Poke($"转发消息 {id} 为空或获取失败。");
            return;
        }

        string formatted = OneBotSegment.FormatForwardList(id, messages, client);
        Poke(formatted);
    }

    public async Task ReconnectAsync()
    {
        IOneBotRuntime client = GetOneBotClient();
        client.Url = Configuration!.Url;
        client.Token = Configuration.Token;
        await client.ConnectAsync();
    }
    protected override string ChatTextFilter(string text)
    {
        return $"""
                {base.ChatTextFilter(text)}
                ({Configuration?.AppendChatPrompt})
                (这是QQ消息，请用QQ工具处理)
                """;
    }

    public QChatConfig? Configuration
    {
        get => configuration;
        set
        {
            configuration = value;
            if (configuration != null)
            {
                groupAwakingWords = Configuration!.WakingWords.Split(',',
                    StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                ignoredGroup = Configuration!.IgnoredGroup.Split(',',
                    StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            }
        }
    }
    public bool IsConnected => oneBotClient is { IsConnected: true };
    public IReadOnlyDictionary<long, GroupState> GroupStates => groupStates;
    public string Name => "QQ";
    public EmbodiedCapabilityKind Kind => EmbodiedCapabilityKind.Communication;
    public string SelfDescription => "Your QQ social communication channel for private chats, group chats, images, files, forwarded messages, and message context.";
    public Func<QChatInboundMessage, Task>? InboundChatDispatcher { get; set; }
    public bool IsQuietModeEnabled { get; private set; }
    public DateTimeOffset? QuietModeChangedAt { get; private set; }
    public string? QuietModeReason { get; private set; }
    public string? GetCurrentState() => Configuration == null
        ? "QQ configuration unavailable"
        : $"QQ channel configured; connected: {IsConnected}; bot id: {(Configuration.BotId == 0 ? "not set" : Configuration.BotId)}; quiet mode: {(IsQuietModeEnabled ? "enabled" : "disabled")}{FormatQuietModeStateSuffix()}.";
    public ModuleHealth GetHealth()
    {
        if (Configuration == null)
            return new ModuleHealth("QChat", ModuleHealthStatus.Unavailable, "QQ configuration is unavailable.");

        if (IsConnected)
            return new ModuleHealth("QChat", ModuleHealthStatus.Healthy, $"OneBot is connected; bot id: {(Configuration.BotId == 0 ? "not set" : Configuration.BotId)}.");

        return new ModuleHealth("QChat", ModuleHealthStatus.Degraded, "OneBot is configured but disconnected.");
    }

    QChatConfig? configuration;
    readonly IOneBotRuntime? injectedOneBotRuntime = oneBotRuntime;
    readonly AgentControlCenterService? agentControlCenter = agentControlCenter;
    readonly AgentActionAuthorizationService actionAuthorization = actionAuthorization ?? new AgentActionAuthorizationService();
    readonly AgentActionGatewayService actionGateway = actionGateway ?? new AgentActionGatewayService(authorization: actionAuthorization);
    readonly AgentAuditLogService? auditLog = auditLog;
    IOneBotRuntime? oneBotClient;
    string[] groupAwakingWords = [];
    string[] ignoredGroup = [];
    readonly Dictionary<long, GroupState> groupStates = new();
    readonly AsyncLocal<QChatReplySession?> currentReplySession = new();
    static readonly object emptyGroupFlushDiagnosticGate = new();
    static readonly Dictionary<long, DateTimeOffset> emptyGroupFlushDiagnosticTimes = new();
    static readonly TimeSpan EmptyGroupFlushDiagnosticInterval = TimeSpan.FromMinutes(5);
    long outboundMessageVersion;
    readonly object permissionGate = new();
    AgentPermissionRequest? currentPermissionRequest;
    DateTime currentPermissionExpiresAt = DateTime.MinValue;
    DateTime lastReconnectAttemptTime = DateTime.MinValue;
    XmlHandler xmlHandler = null!;

    public override async Task AwakeAsync(AwakeContext context)
    {
        await base.AwakeAsync(context);
        RestoreQuietModeFromConfiguration();

        //加载基本环境
        oneBotClient = GetOneBotClient();

        // 注入函数和提示词
        xmlHandler = new(this);
        functionService.RegisterHandler(xmlHandler);
        functionService.ExecutionPolicy.AuthorizeHighRiskFunction = AuthorizeHighRiskXmlFunction;

        Prompt($"""
                此服务为你增加收发qq消息的能力，能够处理图片，文件，转发等各种丰富的qq功能。
                当你需要用qq联系他人，或收到qq消息要处理时，先调用<{nameof(GetQChatGuide)}/>来学习如何使用qq工具，然后再以合适的方式回复。

                收到 QQ 入站消息后，如果你决定回复，必须把面向 QQ 用户的内容发送到当前 QQ 会话：
                - 私聊回复当前私聊：<qchat type="Private" targetId="对方QQ号">回复内容</qchat>
                - 群聊回复当前群：<qchat type="Group" targetId="群号">[CQ:at,qq=发送者QQ号] 回复内容</qchat>
                - 不要只输出普通文字来“说明你会回复”，普通文字不会自动出现在 QQ 里。
                - 如果判断无需回复，可以保持沉默，不要输出解释。
                """);
    }
    public override async Task StartAsync(Kernel kernel, ChatActivity chatActivity)
    {
        await base.StartAsync(kernel, chatActivity);

        if (oneBotClient == null)
            throw new NullReferenceException(nameof(oneBotClient));

        oneBotClient.EventReceived += OnEventReceived;
        ChatBot.ChatOver += ClearPermissionRequest;
        WriteQChatDiagnostic("start", "QChat service starting.", new {
            Configuration!.Url,
            tokenSet = string.IsNullOrWhiteSpace(Configuration.Token) == false,
            Configuration.BotId,
            Configuration.OwnerId,
            Configuration.AllowGroupMemberChat,
            Configuration.AllowGroupMemberMentions,
            Configuration.AllowProactiveGroupChat,
            Configuration.AllowPrivateGuestChat,
            Configuration.ProactiveChatProbability,
            Configuration.PassiveGroupReplyCooldownSeconds,
            Configuration.SuppressLowInformationPassiveGroupMessages,
            Configuration.FlushInterval,
            Configuration.WakingWords
        });

        //初始尝试链接
        try
        {
            await oneBotClient.ConnectAsync();
            WriteQChatDiagnostic("connect-succeeded", "OneBot connected.", new {
                oneBotClient.BotId,
                oneBotClient.IsConnected
            });
        }
        catch (Exception ex)
        {
            WriteQChatDiagnostic("connect-failed", ex.Message, exception: ex);
        }
    }
    public async ValueTask DisposeAsync()
    {
        if (oneBotClient != null)
        {
            await oneBotClient.DisposeAsync();
        }
    }
    IOneBotRuntime GetOneBotClient()
    {
        return oneBotClient ??= injectedOneBotRuntime ??
                               new OneBotRuntime(new OneBotClient(Configuration!.Url, Configuration.Token));
    }
    void ITimeIterative.OnUpdate(ref float seconds)
    {
        // 自动推送消息
        foreach (GroupState info in groupStates.Values)
        {
            if ((DateTime.Now - info.LastFlushedTime).TotalSeconds < Configuration!.FlushInterval)
                continue;

            FlushGroupBuffer(info);
        }

        // 自动关闭群聊
        foreach ((long groupId, GroupState info) in groupStates)
        {
            if (info.IsEnabled && (DateTime.Now - info.LastActivityTime).TotalMinutes > Configuration!.AutoCloseMinutes)
            {
                QGroup(groupId, false);
            }
        }

        // 自动重连
        int reconnectSeconds = Configuration!.AutoReconnectSeconds;
        if (reconnectSeconds > 0 && Configuration.BotId != 0)
        {
            if ((DateTime.Now - lastReconnectAttemptTime).TotalSeconds >= reconnectSeconds && IsConnected == false)
            {
                lastReconnectAttemptTime = DateTime.Now;
                _ = TryAutoReconnectAsync();

                async Task TryAutoReconnectAsync()
                {
                    try
                    {
                        logger.LogInformation("[QChatService] 自动重连");
                        await ReconnectAsync();
                    }
                    catch (Exception ex)
                    {
                        logger.LogWarning("[QChatService] 自动重连失败: {Message}", ex.Message);
                    }
                }
            }
        }
    }
    
    async void OnEventReceived(OneBotBaseEvent oneBotEvent)
    {
        try
        {
            if (oneBotEvent is not OneBotBasicMessageEvent basicMessageEvent)
            {
                WriteQChatDiagnostic("event-ignored", "Ignored non-message OneBot event.", new {
                    eventType = oneBotEvent.GetType().Name
                });
                return;
            }
            WriteQChatDiagnostic("event-received", "Received OneBot basic message event.", new {
                eventType = oneBotEvent.GetType().Name,
                basicMessageEvent.MessageType,
                basicMessageEvent.UserId,
                basicMessageEvent.GroupId,
                basicMessageEvent.SelfId
            });
            if (ignoredGroup.Contains(basicMessageEvent.GroupId.ToString()))
            {
                WriteQChatDiagnostic("event-filtered", "Ignored configured group.", new {
                    basicMessageEvent.GroupId
                });
                return;
            }
            QChatConfig config = Configuration!;
            AgentControlCenterConfig? controlConfig = agentControlCenter?.Configuration;
            QChatSenderRole senderRole = QChatMessageSecurity.Classify(config, basicMessageEvent);
            if (basicMessageEvent.MessageType == OneBotMessageType.Private &&
                QChatMessageSecurity.ShouldAcceptPrivateMessage(config, basicMessageEvent) == false)
            {
                WriteQChatDiagnostic("event-filtered", "Private message rejected by QChat security policy.", new {
                    basicMessageEvent.UserId,
                    senderRole,
                    config.OwnerId,
                    config.AllowPrivateGuestChat
                });
                return;
            }

            if (basicMessageEvent is OneBotPokeEvent pokeEvent)
            {
                string speaker = pokeEvent.GetSpeakerTag();
                string content = $"戳了戳 {pokeEvent.TargetId}";
                string formatted = $"{speaker} {content}";
                formatted = QChatMessageSecurity.FormatForModel(config, basicMessageEvent, formatted);
                bool isAwakening = QChatMessageSecurity.ShouldActivateGroup(
                    config,
                    basicMessageEvent,
                    pokeEvent.TargetId == config.BotId,
                    controlConfig);
                AgentPermissionRequest permissionRequest = QChatMessageSecurity.BuildPermissionRequest(
                    config,
                    basicMessageEvent,
                    pokeEvent.TargetId == config.BotId,
                    content);
                await HandleFormattedMessage(
                    basicMessageEvent,
                    formatted,
                    isAwakening,
                    pokeEvent.TargetId == config.BotId,
                    senderRole,
                    permissionRequest);
            }

            if (basicMessageEvent is OneBotMessageEvent messageEvent)
            {
                string speaker = messageEvent.GetSpeakerTag();
                IOneBotRuntime client = GetOneBotClient();
                string content = await messageEvent.GetReadableMessage(client);
                if (TryApplyOwnerQuietCommand(messageEvent, senderRole, content))
                    return;

                string formatted = $"{speaker}：{content}";
                formatted = QChatMessageSecurity.FormatForModel(config, messageEvent, formatted);
                bool isMentionedOrWoken = messageEvent.GetAtID() == client.BotId ||
                                          groupAwakingWords.Any(word =>
                                              messageEvent.RawMessage.Contains(word, StringComparison.OrdinalIgnoreCase));
                bool isAwakening = QChatMessageSecurity.ShouldActivateGroup(config, messageEvent, isMentionedOrWoken, controlConfig);
                AgentPermissionRequest permissionRequest = QChatMessageSecurity.BuildPermissionRequest(
                    config,
                    messageEvent,
                    isMentionedOrWoken,
                    messageEvent.RawMessage);
                WriteQChatDiagnostic("message-dispatching", "Dispatching message event to QChat.", new {
                    messageEvent.MessageType,
                    messageEvent.UserId,
                    messageEvent.GroupId,
                    messageEvent.RawMessage,
                    readable = content,
                    client.BotId,
                    atId = messageEvent.GetAtID(),
                    isMentionedOrWoken,
                    isAwakening,
                    senderRole
                });
                await HandleFormattedMessage(
                    messageEvent,
                    formatted,
                    isAwakening,
                    isMentionedOrWoken,
                    senderRole,
                    permissionRequest);
            }
        }
        catch (Exception e)
        {
            logger.LogError(e, null);
            WriteQChatDiagnostic("event-error", e.Message, exception: e);
        }
    }
    void OnAIGroupActivity(long groupId)
    {
        GroupState state = GetGroupInfo(groupId);
        state.LastActivityTime = DateTime.Now;
        state.LastBotReplyTime = DateTime.Now;

        if (Configuration!.CloseGroupAfterReply)
            QGroup(groupId, false);
        else if (state.IsEnabled == false)
            QGroup(groupId, true);
    }

    async Task HandleFormattedMessage(
        OneBotBasicMessageEvent messageEvent,
        string formatted,
        bool isAwakening,
        bool isMentionedOrWoken,
        QChatSenderRole senderRole,
        AgentPermissionRequest permissionRequest)
    {
        if (ShouldSuppressForQuietMode(messageEvent, senderRole, isMentionedOrWoken))
            return;

        if (messageEvent.MessageType == OneBotMessageType.Private)//私聊消息
        {
            if (senderRole == QChatSenderRole.Owner || Configuration!.AllowPrivateGuestChat)
            {
                WriteQChatDiagnostic("private-dispatch", "Private message accepted for model dispatch.", new {
                    messageEvent.UserId,
                    senderRole
                });
                using IDisposable _ = PushPermissionRequest(permissionRequest, TimeSpan.FromMinutes(5));
                await DispatchInboundChatAsync(new QChatInboundMessage(
                    messageEvent.MessageType,
                    messageEvent.UserId,
                    messageEvent.UserId,
                    formatted,
                    isAwakening,
                    senderRole,
                    permissionRequest));
            }
        }
        else//群聊消息
        {
            if (senderRole != QChatSenderRole.Owner && Configuration!.AllowGroupMemberChat == false)
            {
                WriteQChatDiagnostic("group-filtered", "Group member chat is disabled.", new {
                    messageEvent.GroupId,
                    messageEvent.UserId,
                    senderRole
                });
                return;
            }

            GroupState state = GetGroupInfo(messageEvent.GroupId);
            state.Tag = messageEvent.GetGroupTag();

            if (isAwakening && state.IsEnabled == false)
                QGroup(messageEvent.GroupId, true);

            if (state.IsEnabled)//群聊已激活时（直接接收）
            {
                if (QChatMessageSecurity.ShouldAcceptGroupMessage(
                        Configuration!,
                        messageEvent,
                        isMentionedOrWoken,
                        state.IsEnabled,
                        agentControlCenter?.Configuration) == false)
                {
                    WriteQChatDiagnostic("group-filtered", "Group message rejected by Agent Control Center group listening policy.", new {
                        messageEvent.GroupId,
                        messageEvent.UserId,
                        senderRole,
                        isMentionedOrWoken,
                        state.IsEnabled,
                        agentControlCenter?.Configuration?.AllowMentionWakeup,
                        agentControlCenter?.Configuration?.AllowPassiveGroupListening
                    });
                    return;
                }

                if (ShouldSkipLowInformationPassiveGroupMessage(messageEvent, senderRole, isMentionedOrWoken))
                    return;

                if (ShouldThrottlePassiveGroupMessage(state, messageEvent, senderRole, isMentionedOrWoken))
                    return;

                BufferGroupMessage(
                    state,
                    formatted,
                    senderRole == QChatSenderRole.Owner && Configuration!.OwnerPriorityMode,
                    permissionRequest);
                WriteQChatDiagnostic("group-buffered", "Group message buffered for model dispatch.", new {
                    state.GroupId,
                    state.IsEnabled,
                    bufferCount = state.MessageBuffer.Count,
                    isAwakening,
                    senderRole
                });
                if (isAwakening)
                    FlushGroupBuffer(state);
            }
            else if (QChatMessageSecurity.ShouldAllowProactiveGroupChat(Configuration!, messageEvent, agentControlCenter?.Configuration) &&
                     Random.Shared.NextSingle() < QChatMessageSecurity.GetProactiveChatProbability(Configuration!, agentControlCenter?.Configuration))//群聊未激活时（概率接收）
            {
                if (ShouldSkipLowInformationPassiveGroupMessage(messageEvent, senderRole, isMentionedOrWoken))
                    return;

                if (ShouldThrottlePassiveGroupMessage(state, messageEvent, senderRole, isMentionedOrWoken))
                    return;

                BufferGroupMessage(state, formatted, permissionRequest: permissionRequest);
                state.LastFlushedTime = DateTime.Now;
                WriteQChatDiagnostic("group-buffered-proactive", "Group message buffered by proactive probability.", new {
                    state.GroupId,
                    bufferCount = state.MessageBuffer.Count,
                    Configuration!.ProactiveChatProbability,
                    EffectiveProactiveChatProbability = QChatMessageSecurity.GetProactiveChatProbability(Configuration!, agentControlCenter?.Configuration)
                });
            }
        }
    }

    bool ShouldSkipLowInformationPassiveGroupMessage(
        OneBotBasicMessageEvent messageEvent,
        QChatSenderRole senderRole,
        bool isMentionedOrWoken)
    {
        if (messageEvent is not OneBotMessageEvent groupMessage)
            return false;
        if (Configuration?.SuppressLowInformationPassiveGroupMessages != true)
            return false;
        if (messageEvent.MessageType != OneBotMessageType.Group)
            return false;
        if (isMentionedOrWoken)
            return false;
        if (IsMediaOnlyPassiveGroupMessage(groupMessage.RawMessage)
            && Random.Shared.NextSingle() < QChatMessageSecurity.GetMediaOnlyPassiveGroupReplyProbability(Configuration))
        {
            WriteQChatDiagnostic("group-passive-media-chance-allowed", "Passive media-only group message allowed by media reply chance.", new {
                messageEvent.GroupId,
                messageEvent.UserId,
                senderRole,
                isMentionedOrWoken,
                Configuration.MediaOnlyPassiveGroupReplyProbability,
                groupMessage.RawMessage
            });
            return false;
        }

        if (IsLowInformationPassiveGroupMessage(groupMessage.RawMessage) == false)
            return false;

        WriteQChatDiagnostic("group-passive-low-information-skipped", "Passive group message skipped because it has too little conversational content.", new {
            messageEvent.GroupId,
            messageEvent.UserId,
            senderRole,
            isMentionedOrWoken,
            groupMessage.RawMessage
        });
        return true;
    }

    static bool IsLowInformationPassiveGroupMessage(string? rawMessage)
    {
        string raw = rawMessage ?? "";
        string plain = OneBotSegment.GetPlainText(raw).Trim();
        if (string.IsNullOrWhiteSpace(plain))
            return ContainsLowInformationCqSegment(raw);

        string compact = CompactPassiveText(plain);
        if (compact.Length == 0)
            return ContainsLowInformationCqSegment(raw);

        return compact is "嗯" or "哦" or "喔" or "啊" or "诶" or "哈" or "哈哈" or "hhh" or "www" or "6" or "草" or "好" or "行" or "ok";
    }

    static bool ContainsLowInformationCqSegment(string raw)
    {
        return raw.Contains("[CQ:image", StringComparison.OrdinalIgnoreCase)
               || raw.Contains("[CQ:face", StringComparison.OrdinalIgnoreCase)
               || raw.Contains("[CQ:mface", StringComparison.OrdinalIgnoreCase);
    }

    static bool IsMediaOnlyPassiveGroupMessage(string? rawMessage)
    {
        string raw = rawMessage ?? "";
        if (ContainsLowInformationCqSegment(raw) == false)
            return false;

        return string.IsNullOrWhiteSpace(OneBotSegment.GetPlainText(raw));
    }

    static string CompactPassiveText(string text)
    {
        StringBuilder builder = new(text.Length);
        foreach (char ch in text)
        {
            if (char.IsWhiteSpace(ch) || char.IsPunctuation(ch) || char.IsSymbol(ch))
                continue;
            builder.Append(char.ToLowerInvariant(ch));
        }

        return builder.ToString();
    }

    bool ShouldThrottlePassiveGroupMessage(
        GroupState state,
        OneBotBasicMessageEvent messageEvent,
        QChatSenderRole senderRole,
        bool isMentionedOrWoken)
    {
        int cooldownSeconds = GetEffectivePassiveGroupReplyCooldownSeconds();
        if (cooldownSeconds <= 0)
            return false;
        if (messageEvent.MessageType != OneBotMessageType.Group)
            return false;
        if (senderRole == QChatSenderRole.Owner || isMentionedOrWoken)
            return false;
        if (state.LastBotReplyTime == default)
            return false;

        double elapsedSeconds = (DateTime.Now - state.LastBotReplyTime).TotalSeconds;
        if (elapsedSeconds >= cooldownSeconds)
            return false;

        WriteQChatDiagnostic("group-passive-throttled", "Passive group message skipped because the bot replied recently.", new {
            state.GroupId,
            messageEvent.UserId,
            senderRole,
            isMentionedOrWoken,
            elapsedSeconds,
            cooldownSeconds
        });
        return true;
    }

    int GetEffectivePassiveGroupReplyCooldownSeconds()
    {
        int configuredSeconds = Math.Max(0, Configuration?.PassiveGroupReplyCooldownSeconds ?? 0);
        int controlIntensity = agentControlCenter?.Configuration?.ProactiveChatIntensity ?? 2;
        int controlFloor = controlIntensity switch
        {
            <= 0 => 300,
            1 => 180,
            2 => 90,
            _ => 0
        };

        return Math.Max(configuredSeconds, controlFloor);
    }

    bool TryApplyOwnerQuietCommand(OneBotMessageEvent messageEvent, QChatSenderRole senderRole, string readable)
    {
        if (senderRole != QChatSenderRole.Owner)
            return false;

        string normalized = NormalizeQuietCommandText(messageEvent.RawMessage, readable);
        if (string.IsNullOrWhiteSpace(normalized))
            return false;

        if (IsQuietWakeCommand(normalized))
        {
            SetQuietMode(false, messageEvent, "owner-wake-command");
            return true;
        }

        if (IsQuietSleepCommand(normalized))
        {
            SetQuietMode(true, messageEvent, "owner-sleep-command");
            return true;
        }

        return false;
    }

    bool ShouldSuppressForQuietMode(OneBotBasicMessageEvent messageEvent, QChatSenderRole senderRole, bool isMentionedOrWoken)
    {
        if (IsQuietModeEnabled == false)
            return false;

        WriteQChatDiagnostic("qchat-quiet-message-suppressed", "QQ inbound message suppressed because owner quiet mode is enabled.", new {
            messageEvent.MessageType,
            messageEvent.UserId,
            messageEvent.GroupId,
            senderRole,
            isMentionedOrWoken
        });
        return true;
    }

    void SetQuietMode(bool enabled, OneBotBasicMessageEvent messageEvent, string reason)
    {
        SetQuietModeCore(enabled, reason, new {
            messageEvent.MessageType,
            messageEvent.UserId,
            messageEvent.GroupId,
            reason
        });
    }

    void SetQuietMode(bool enabled, string reason)
    {
        SetQuietModeCore(enabled, reason, new {
            source = "direct-control",
            reason
        });
    }

    void SetQuietModeCore(bool enabled, string reason, object data)
    {
        IsQuietModeEnabled = enabled;
        QuietModeChangedAt = DateTimeOffset.UtcNow;
        QuietModeReason = reason;
        if (Configuration != null)
        {
            Configuration.PersistedQuietModeEnabled = enabled;
            Configuration.PersistedQuietModeChangedAt = QuietModeChangedAt;
            Configuration.PersistedQuietModeReason = reason;
        }

        WriteQChatDiagnostic(
            enabled ? "qchat-quiet-mode-enabled" : "qchat-quiet-mode-disabled",
            enabled ? "Owner enabled QQ quiet mode." : "Owner disabled QQ quiet mode.",
            data);
    }

    void RestoreQuietModeFromConfiguration()
    {
        if (Configuration?.PersistQuietModeAcrossRestart != true)
            return;

        IsQuietModeEnabled = Configuration.PersistedQuietModeEnabled;
        QuietModeChangedAt = Configuration.PersistedQuietModeChangedAt;
        QuietModeReason = string.IsNullOrWhiteSpace(Configuration.PersistedQuietModeReason)
            ? "configuration-restore"
            : Configuration.PersistedQuietModeReason;

        WriteQChatDiagnostic(
            IsQuietModeEnabled ? "qchat-quiet-mode-restored" : "qchat-quiet-mode-restore-skipped",
            IsQuietModeEnabled ? "QQ quiet mode restored from configuration." : "QQ quiet mode persistence is enabled but saved state is disabled.",
            new {
                IsQuietModeEnabled,
                QuietModeChangedAt,
                QuietModeReason
            });
    }

    string FormatQuietModeStateSuffix()
    {
        if (IsQuietModeEnabled == false)
            return "";

        StringBuilder builder = new();
        if (string.IsNullOrWhiteSpace(QuietModeReason) == false)
            builder.Append($"; reason: {QuietModeReason}");
        if (QuietModeChangedAt != null)
            builder.Append($"; changed at: {QuietModeChangedAt:O}");

        return builder.ToString();
    }

    static string NormalizeQuietCommandText(string? raw, string? readable)
    {
        string text = $"{OneBotSegment.GetPlainText(raw ?? string.Empty)} {OneBotSegment.GetPlainText(readable ?? string.Empty)}";
        StringBuilder builder = new(text.Length);
        foreach (char ch in text)
        {
            if (char.IsWhiteSpace(ch) || char.IsPunctuation(ch) || char.IsSymbol(ch))
                continue;

            builder.Append(char.ToLowerInvariant(ch));
        }

        return builder.ToString();
    }

    static bool IsQuietSleepCommand(string normalized)
    {
        return normalized.Contains("睡觉", StringComparison.OrdinalIgnoreCase) ||
               normalized.Contains("去睡觉", StringComparison.OrdinalIgnoreCase) ||
               normalized.Contains("休息", StringComparison.OrdinalIgnoreCase) ||
               normalized.Contains("安静", StringComparison.OrdinalIgnoreCase) ||
               normalized.Contains("别说话", StringComparison.OrdinalIgnoreCase) ||
               normalized.Contains("不要说话", StringComparison.OrdinalIgnoreCase) ||
               normalized.Contains("保持安静", StringComparison.OrdinalIgnoreCase) ||
               normalized.Contains("sleep", StringComparison.OrdinalIgnoreCase) ||
               normalized.Contains("quiet", StringComparison.OrdinalIgnoreCase) ||
               normalized.Contains("silent", StringComparison.OrdinalIgnoreCase);
    }

    static bool IsQuietWakeCommand(string normalized)
    {
        return normalized.Contains("醒醒", StringComparison.OrdinalIgnoreCase) ||
               normalized.Contains("起床", StringComparison.OrdinalIgnoreCase) ||
               normalized.Contains("回来", StringComparison.OrdinalIgnoreCase) ||
               normalized.Contains("可以说话了", StringComparison.OrdinalIgnoreCase) ||
               normalized.Contains("说话吧", StringComparison.OrdinalIgnoreCase) ||
               normalized.Contains("wake", StringComparison.OrdinalIgnoreCase) ||
               normalized.Contains("resume", StringComparison.OrdinalIgnoreCase) ||
               normalized.Contains("talk", StringComparison.OrdinalIgnoreCase);
    }

    void BufferGroupMessage(
        GroupState state,
        string formatted,
        bool highPriority = false,
        AgentPermissionRequest? permissionRequest = null)
    {
        if (highPriority)
            state.MessageBuffer.Insert(0, formatted);
        else
            state.MessageBuffer.Add(formatted);
        if (permissionRequest != null)
            state.PermissionRequest = ChooseStrongerPermissionRequest(state.PermissionRequest, permissionRequest);
        if (Configuration!.DebounceEnabled)
            state.LastFlushedTime = DateTime.Now;
        if (Configuration!.MaxBufferMessages != -1 && state.MessageBuffer.Count > Configuration.MaxBufferMessages)
            FlushGroupBuffer(state);
    }

    public void FlushGroupBuffer(GroupState state)
    {
        state.LastFlushedTime = DateTime.Now;

        if (state.MessageBuffer.Count == 0)
        {
            if (ShouldWriteEmptyGroupFlushDiagnostic(state.GroupId))
            {
                WriteQChatDiagnostic("group-flush-skipped", "Group flush skipped because buffer is empty.", new {
                    state.GroupId
                });
            }
            return;
        }

        string cachedMessage =
            $"""

             > 以下是群 {state.Tag} 的消息
             {string.Join("\n", state.MessageBuffer)}
             """;

        state.MessageBuffer.Clear();
        AgentPermissionRequest? permissionRequest = state.PermissionRequest;
        state.PermissionRequest = null;
        WriteQChatDiagnostic("group-flush-dispatching", "Dispatching buffered group message to model.", new {
            state.GroupId,
            state.Tag,
            permissionRequest?.ActorUserId,
            permissionRequest?.IsMentioned
        });
        _ = DispatchBufferedGroupMessageAsync(state, cachedMessage, permissionRequest);
    }

    public void QGroup(long groupId, bool enabled)
    {
        GroupState state = GetGroupInfo(groupId);
        state.IsEnabled = enabled;
        if (enabled)
        {
            state.LastActivityTime = DateTime.Now;
            state.LastFlushedTime = DateTime.Now;
        }
        else
        {
            state.MessageBuffer.Clear();
            state.PermissionRequest = null;
        }
    }

    GroupState GetGroupInfo(long groupId)
    {
        if (groupStates.TryGetValue(groupId, out GroupState? groupInfo) == false)
        {
            groupInfo = new GroupState {
                GroupId = groupId,
                Tag = groupId.ToString()
            };
            groupStates[groupId] = groupInfo;
        }

        return groupInfo;
    }

    async Task DispatchBufferedGroupMessageAsync(
        GroupState state,
        string cachedMessage,
        AgentPermissionRequest? permissionRequest)
    {
        try
        {
            AgentPermissionRequest request = permissionRequest ?? new AgentPermissionRequest(
                ActorUserId: null,
                Source: AgentRequestSource.GroupChat,
                IsMentioned: false,
                RiskLevel: AgentRiskLevel.Low,
                HasExplicitConfirmation: false,
                Action: "qq.message");
            using IDisposable _ = PushPermissionRequest(request, TimeSpan.FromMinutes(5));
            await DispatchInboundChatAsync(new QChatInboundMessage(
                OneBotMessageType.Group,
                state.GroupId,
                request.ActorUserId ?? 0,
                cachedMessage,
                request.IsMentioned,
                request.ActorUserId == Configuration?.OwnerId ? QChatSenderRole.Owner : QChatSenderRole.GroupMember,
                request));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to dispatch buffered QQ group message.");
        }
    }

    Task DispatchInboundChatAsync(QChatInboundMessage message)
    {
        return DispatchInboundChatCoreAsync(message);
    }

    async Task DispatchInboundChatCoreAsync(QChatInboundMessage message)
    {
        QChatReplySession? previousSession = currentReplySession.Value;
        currentReplySession.Value = new QChatReplySession(message.MessageType, message.TargetId);
        WriteQChatDiagnostic("model-dispatch-start", "Dispatching inbound QQ message to model.", new {
            message.MessageType,
            message.TargetId,
            message.SenderId,
            message.IsAwakening,
            message.SenderRole
        });

        try
        {
            long outboundBefore = Volatile.Read(ref outboundMessageVersion);
            string modelResponse;
            if (InboundChatDispatcher != null)
            {
                await InboundChatDispatcher(message);
                modelResponse = "";
            }
            else
            {
                modelResponse = await DispatchToModelAsync(message);
            }

            if (Volatile.Read(ref outboundMessageVersion) == outboundBefore &&
                TryBuildPlainTextFallbackResponse(modelResponse, out string fallbackMessage))
            {
                await SendTextOrMediaMessageAsync(message.MessageType, message.TargetId, fallbackMessage, streamText: true);
                WriteQChatDiagnostic("plain-fallback-sent", "Model returned plain text without using qchat; sent it to the current QQ session.", new {
                    message.MessageType,
                    message.TargetId,
                    fallbackMessage
                });
            }
            WriteQChatDiagnostic("model-dispatch-completed", "Model dispatch completed.", new {
                message.MessageType,
                message.TargetId
            });
        }
        catch (Exception ex)
        {
            WriteQChatDiagnostic("model-dispatch-failed", ex.Message, new {
                message.MessageType,
                message.TargetId
            }, ex);
            throw;
        }
        finally
        {
            currentReplySession.Value = previousSession;
        }
    }

    protected virtual Task<string> DispatchToModelAsync(QChatInboundMessage message)
    {
        return ChatBot.ChatAsync(ChatTextFilter(message.Formatted));
    }

    void EnsureQChatReplyTargetAllowed(OneBotMessageType type, long targetId)
    {
        QChatReplySession? replySession = currentReplySession.Value;
        if (replySession == null)
            return;

        if (replySession.MessageType == type && replySession.TargetId == targetId)
            return;

        throw new InvalidOperationException("QChat replies from an inbound QQ message can only target the current QQ session.");
    }

    static void WriteQChatDiagnostic(
        string eventName,
        string detail,
        object? data = null,
        Exception? exception = null)
    {
        try
        {
            string path = Path.Combine(
                AlifePath.StorageFolderPath,
                "AgentWorkspace",
                "qchat-diagnostics.jsonl");
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            string line = JsonSerializer.Serialize(new {
                timestamp = DateTimeOffset.Now,
                eventName,
                detail,
                data,
                exception = exception?.ToString()
            });
            File.AppendAllText(path, line + Environment.NewLine);
        }
        catch
        {
            // Diagnostics must never break QQ message handling.
        }
    }

    static bool ShouldWriteEmptyGroupFlushDiagnostic(long groupId)
    {
        DateTimeOffset now = DateTimeOffset.Now;
        lock (emptyGroupFlushDiagnosticGate)
        {
            if (emptyGroupFlushDiagnosticTimes.TryGetValue(groupId, out DateTimeOffset lastWrittenAt)
                && now - lastWrittenAt < EmptyGroupFlushDiagnosticInterval)
            {
                return false;
            }

            emptyGroupFlushDiagnosticTimes[groupId] = now;
            return true;
        }
    }

    static bool TryBuildPlainTextFallbackResponse(string? modelResponse, out string message)
    {
        message = "";
        if (string.IsNullOrWhiteSpace(modelResponse))
            return false;

        string trimmed = modelResponse.Trim();
        if (trimmed.Contains('<', StringComparison.Ordinal) ||
            trimmed.Contains('>', StringComparison.Ordinal))
        {
            return false;
        }

        if (IsInternalNoReplyStatus(trimmed))
            return false;

        const int MaxFallbackLength = 1200;
        message = trimmed.Length <= MaxFallbackLength
            ? trimmed
            : trimmed[..MaxFallbackLength].TrimEnd() + "...";
        return string.IsNullOrWhiteSpace(message) == false;
    }

    static bool IsInternalNoReplyStatus(string value)
    {
        string normalized = value.Trim();
        while (normalized.Length >= 2 && IsWrappingPair(normalized[0], normalized[^1]))
            normalized = normalized[1..^1].Trim();

        if (normalized.Length > 60)
            return false;

        string compact = normalized
            .Replace(" ", "", StringComparison.Ordinal)
            .Replace("\t", "", StringComparison.Ordinal)
            .Replace("\r", "", StringComparison.Ordinal)
            .Replace("\n", "", StringComparison.Ordinal)
            .ToLowerInvariant();

        return compact.Contains("不回复", StringComparison.Ordinal)
               || compact.Contains("不回覆", StringComparison.Ordinal)
               || compact.Contains("无需回复", StringComparison.Ordinal)
               || compact.Contains("不用回复", StringComparison.Ordinal)
               || compact.Contains("保持安静", StringComparison.Ordinal)
               || compact.Contains("保持安靜", StringComparison.Ordinal)
               || compact.Contains("不插话", StringComparison.Ordinal)
               || compact.Contains("不插話", StringComparison.Ordinal)
               || compact.Contains("不打扰", StringComparison.Ordinal)
               || compact.Contains("不打擾", StringComparison.Ordinal)
               || compact.Contains("旁观", StringComparison.Ordinal)
               || compact.Contains("旁觀", StringComparison.Ordinal)
               || compact.Contains("默默看", StringComparison.Ordinal)
               || compact.Contains("安静看", StringComparison.Ordinal)
               || compact.Contains("安靜看", StringComparison.Ordinal)
               || compact is "silent" or "stayquiet" or "noreply";
    }

    static bool IsWrappingPair(char start, char end)
    {
        return (start == '(' && end == ')')
               || (start == '（' && end == '）')
               || (start == '[' && end == ']')
               || (start == '【' && end == '】');
    }

    void PublishLifeEvent(string summary)
    {
        lifeEventPublisher?.Publish(new LifeEvent(
            DateTimeOffset.Now,
            LifeEventKind.Communication,
            "QChat",
            summary));
    }

    static void EnsureTargetAllowed(string allowedIds, long targetId, string targetKind)
    {
        string[] ids = allowedIds.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (ids.Length == 0)
            return;

        if (ids.Contains(targetId.ToString()))
            return;

        throw new InvalidOperationException($"{targetKind} {targetId} is not in the QQ allowlist.");
    }

    static string NormalizeExistingLocalFile(string file)
    {
        file = file.Trim();
        if (string.IsNullOrEmpty(file))
            throw new ArgumentNullException(nameof(file));
        if (File.Exists(file) == false)
            throw new FileNotFoundException("QQ file does not exist.", file);

        return file.Replace('\\', '/');
    }

    static string NormalizeUploadName(string normalizedFile, string? name)
    {
        string fileName = string.IsNullOrWhiteSpace(name) ? Path.GetFileName(normalizedFile) : name.Trim();
        if (string.IsNullOrWhiteSpace(fileName))
            throw new InvalidOperationException("QQ upload file name is empty.");

        return fileName;
    }

    static string NormalizeVideoReference(string video)
    {
        video = video.Trim();
        if (string.IsNullOrEmpty(video))
            throw new ArgumentNullException(nameof(video));

        bool isUrl = Uri.TryCreate(video, UriKind.Absolute, out Uri? uri) &&
                     (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
        string extension = isUrl ? Path.GetExtension(uri!.AbsolutePath) : Path.GetExtension(video);
        string[] allowedExtensions = [".mp4", ".mov", ".mkv", ".webm"];
        if (allowedExtensions.Contains(extension, StringComparer.OrdinalIgnoreCase) == false)
            throw new InvalidOperationException("QQ video must be .mp4, .mov, .mkv, or .webm.");

        if (isUrl == false && File.Exists(video) == false)
            throw new FileNotFoundException("QQ video file does not exist.", video);

        return video.Replace('\\', '/');
    }

    XmlFunctionExecutionDecision AuthorizeHighRiskXmlFunction(XmlFunction function)
    {
        AgentPermissionRequest request = GetCurrentPermissionRequest() ?? new AgentPermissionRequest(
            ActorUserId: null,
            Source: AgentRequestSource.PrivateChat,
            IsMentioned: false,
            RiskLevel: AgentRiskLevel.High,
            HasExplicitConfirmation: false,
            Action: $"xml.{function.Name}");

        AgentPermissionConfig permissionConfig = QChatMessageSecurity.BuildPermissionConfig(
            Configuration!,
            agentControlCenter?.Configuration);
        return actionAuthorization.AuthorizeXmlFunction(function, request, permissionConfig);
    }

    IDisposable PushPermissionRequest(AgentPermissionRequest request, TimeSpan ttl)
    {
        AgentPermissionRequest? previousRequest;
        DateTime previousExpiresAt;
        lock (permissionGate)
        {
            previousRequest = currentPermissionRequest;
            previousExpiresAt = currentPermissionExpiresAt;
            currentPermissionRequest = request;
            currentPermissionExpiresAt = DateTime.Now.Add(ttl);
        }

        return new PermissionScope(this, previousRequest, previousExpiresAt);
    }

    void SetPermissionRequest(AgentPermissionRequest request, TimeSpan ttl)
    {
        lock (permissionGate)
        {
            currentPermissionRequest = request;
            currentPermissionExpiresAt = DateTime.Now.Add(ttl);
        }
    }

    AgentPermissionRequest? GetCurrentPermissionRequest()
    {
        lock (permissionGate)
        {
            if (currentPermissionRequest != null && DateTime.Now > currentPermissionExpiresAt)
                ClearPermissionRequestCore();
            return currentPermissionRequest;
        }
    }

    void ClearPermissionRequest()
    {
        lock (permissionGate)
            ClearPermissionRequestCore();
    }

    void RestorePermissionRequest(AgentPermissionRequest? request, DateTime expiresAt)
    {
        lock (permissionGate)
        {
            currentPermissionRequest = request;
            currentPermissionExpiresAt = expiresAt;
        }
    }

    void ClearPermissionRequestCore()
    {
        currentPermissionRequest = null;
        currentPermissionExpiresAt = DateTime.MinValue;
    }

    AgentPermissionRequest ChooseStrongerPermissionRequest(
        AgentPermissionRequest? current,
        AgentPermissionRequest incoming)
    {
        if (current == null)
            return incoming;

        int currentScore = PermissionScore(current);
        int incomingScore = PermissionScore(incoming);
        if (incomingScore > currentScore)
            return incoming;
        if (incomingScore == currentScore && incoming.HasExplicitConfirmation && current.HasExplicitConfirmation == false)
            return incoming;
        return current;
    }

    int PermissionScore(AgentPermissionRequest request)
    {
        int score = request.Source == AgentRequestSource.GroupChat ? 10 : 20;
        if (Configuration?.OwnerId != 0 && request.ActorUserId == Configuration?.OwnerId)
            score += 100;
        if (request.IsMentioned)
            score += 5;
        if (request.HasExplicitConfirmation)
            score += 10;
        if (request.ActorUserId != null)
            score += 1;
        return score;
    }

    sealed class PermissionScope(
        QChatService service,
        AgentPermissionRequest? previousRequest,
        DateTime previousExpiresAt) : IDisposable
    {
        public void Dispose()
        {
            service.RestorePermissionRequest(previousRequest, previousExpiresAt);
        }
    }
}
