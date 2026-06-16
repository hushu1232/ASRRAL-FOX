using Alife.Function.QChat;
using Alife.Function.Agent;
using Alife.Function.FunctionCaller;
using Alife.Function.Interpreter;
using Alife.Framework;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.Agents;
using NUnit.Framework;
using System.IO;

namespace Alife.Test.QChat;

[TestFixture]
public class QChatServiceAdapterTests
{
    [Test]
    public async Task SendChatAsync_UsesInjectedRuntime()
    {
        FakeOneBotRuntime runtime = new();
        FakeLifeEventPublisher publisher = new();
        QChatService service = new(null!, new NullLogger<QChatService>(), oneBotRuntime: runtime, lifeEventPublisher: publisher)
        {
            Configuration = new QChatConfig { BotId = 999 }
        };

        await service.SendChatAsync("group", 123, " hello ");
        await service.SendChatAsync("private", 456, " hi ");

        Assert.That(runtime.GroupMessages, Is.EqualTo(new[] { (123L, "hello") }));
        Assert.That(runtime.PrivateMessages, Is.EqualTo(new[] { (456L, "hi") }));
        Assert.That(publisher.Events.Select(lifeEvent => lifeEvent.Kind), Is.EqualTo(new[] {
            LifeEventKind.Communication,
            LifeEventKind.Communication,
        }));
        Assert.That(publisher.Events.Select(lifeEvent => lifeEvent.Summary), Is.EqualTo(new[] {
            "You sent a QQ group message to 123.",
            "You sent a QQ private message to 456.",
        }));
    }

    [Test]
    public async Task SendChatAsync_SplitsGroupTextWithBalancedStreamingPolicy()
    {
        FakeOneBotRuntime runtime = new();
        QChatService service = new(null!, new NullLogger<QChatService>(), oneBotRuntime: runtime)
        {
            Configuration = new QChatConfig { BotId = 999 }
        };

        await service.SendChatAsync("group", 123, "第一句。第二句！最后一句");

        Assert.That(runtime.GroupMessages, Is.EqualTo(new[] {
            (123L, "第一句。"),
            (123L, "第二句！"),
            (123L, "最后一句"),
        }));
    }

    [Test]
    public async Task SendChatAsync_DoesNotSplitOpenCqCodeInGroupText()
    {
        FakeOneBotRuntime runtime = new();
        QChatService service = new(null!, new NullLogger<QChatService>(), oneBotRuntime: runtime)
        {
            Configuration = new QChatConfig { BotId = 999 }
        };

        await service.SendChatAsync("group", 123, "[CQ:at,qq=3045846738]收到。后续继续");

        Assert.That(runtime.GroupMessages, Is.EqualTo(new[] {
            (123L, "[CQ:at,qq=3045846738]收到。"),
            (123L, "后续继续"),
        }));
    }

    [Test]
    public async Task QGroupFile_UsesInjectedRuntimeAndCustomName()
    {
        string file = Path.GetTempFileName();
        await File.WriteAllTextAsync(file, "group file");
        FakeOneBotRuntime runtime = new();
        QChatService service = new(null!, new NullLogger<QChatService>(), oneBotRuntime: runtime)
        {
            Configuration = new QChatConfig { BotId = 999 }
        };

        await service.QGroupFile(123, file, "report.txt");

        Assert.That(runtime.GroupFiles, Is.EqualTo(new[] { (123L, file.Replace('\\', '/'), "report.txt") }));
    }

    [Test]
    public async Task QGroupFile_UsesSecurityGatewayForExternalRequests()
    {
        string file = Path.GetTempFileName();
        await File.WriteAllTextAsync(file, "group file");
        FakeOneBotRuntime runtime = new();
        QChatService service = new(null!, new NullLogger<QChatService>(), oneBotRuntime: runtime)
        {
            Configuration = new QChatConfig { BotId = 999 }
        };
        AgentPermissionConfig config = new()
        {
            OwnerUserIds = [10001],
            RequireConfirmationForHighRisk = true
        };

        QChatExternalActionResult blocked = await service.QGroupFile(
            123,
            file,
            "report.txt",
            new AgentPermissionRequest(
                ActorUserId: 20002,
                Source: AgentRequestSource.GroupChat,
                IsMentioned: true,
                RiskLevel: AgentRiskLevel.Low,
                HasExplicitConfirmation: true,
                Action: "qq.group_file_upload"),
            config);
        QChatExternalActionResult needsConfirmation = await service.QGroupFile(
            123,
            file,
            "report.txt",
            new AgentPermissionRequest(
                ActorUserId: 10001,
                Source: AgentRequestSource.PrivateChat,
                IsMentioned: false,
                RiskLevel: AgentRiskLevel.Low,
                HasExplicitConfirmation: false,
                Action: "qq.group_file_upload"),
            config);
        QChatExternalActionResult executed = await service.QGroupFile(
            123,
            file,
            "report.txt",
            new AgentPermissionRequest(
                ActorUserId: 10001,
                Source: AgentRequestSource.PrivateChat,
                IsMentioned: false,
                RiskLevel: AgentRiskLevel.Low,
                HasExplicitConfirmation: true,
                Action: "qq.group_file_upload"),
            config);

        Assert.That(blocked.Executed, Is.False);
        Assert.That(blocked.GatewayDecision.Status, Is.EqualTo(AgentExecutionDecisionStatus.Blocked));
        Assert.That(blocked.GatewayDecision.RiskLevel, Is.EqualTo(AgentRiskLevel.High));
        Assert.That(needsConfirmation.Executed, Is.False);
        Assert.That(needsConfirmation.GatewayDecision.Status, Is.EqualTo(AgentExecutionDecisionStatus.OwnerConfirmationRequired));
        Assert.That(executed.Executed, Is.True);
        Assert.That(runtime.GroupFiles, Is.EqualTo(new[] { (123L, file.Replace('\\', '/'), "report.txt") }));
    }

    [Test]
    public async Task QGroupFile_SecurityGatewayAuditsBlockedAndAllowedActions()
    {
        string file = Path.GetTempFileName();
        await File.WriteAllTextAsync(file, "group file");
        string root = Path.Combine(Path.GetTempPath(), "alife-qchat-gateway-tests", Guid.NewGuid().ToString("N"));
        AgentAuditLogService audit = new(Path.Combine(root, "audit.jsonl"));
        AgentActionGatewayService gateway = new(auditLog: audit);
        FakeOneBotRuntime runtime = new();
        QChatService service = new(null!, new NullLogger<QChatService>(), oneBotRuntime: runtime, actionGateway: gateway)
        {
            Configuration = new QChatConfig { BotId = 999 }
        };
        AgentPermissionConfig config = new()
        {
            OwnerUserIds = [10001],
            RequireConfirmationForHighRisk = true
        };

        QChatExternalActionResult blocked = await service.QGroupFile(
            123,
            file,
            "report.txt",
            new AgentPermissionRequest(
                ActorUserId: 20002,
                Source: AgentRequestSource.GroupChat,
                IsMentioned: true,
                RiskLevel: AgentRiskLevel.Low,
                HasExplicitConfirmation: true,
                Action: "qq.group_file_upload"),
            config);
        QChatExternalActionResult executed = await service.QGroupFile(
            123,
            file,
            "report.txt",
            new AgentPermissionRequest(
                ActorUserId: 10001,
                Source: AgentRequestSource.PrivateChat,
                IsMentioned: false,
                RiskLevel: AgentRiskLevel.Low,
                HasExplicitConfirmation: true,
                Action: "qq.group_file_upload"),
            config);
        AgentAuditLogEntry[] entries = audit.GetRecentEntries(10).ToArray();

        Assert.That(blocked.Executed, Is.False);
        Assert.That(executed.Executed, Is.True);
        Assert.That(entries.Select(entry => entry.Action), Is.EqualTo(new[] { "qq.group_file_upload", "qq.group_file_upload" }));
        Assert.That(entries[0].Succeeded, Is.False);
        Assert.That(entries[0].Error, Does.Contain("Blocked"));
        Assert.That(entries[1].Succeeded, Is.True);
        Assert.That(runtime.GroupFiles, Is.EqualTo(new[] { (123L, file.Replace('\\', '/'), "report.txt") }));
    }

    [Test]
    public async Task QPrivateFile_UsesInjectedRuntimeAndDefaultName()
    {
        string file = Path.Combine(Path.GetTempPath(), $"qchat-private-{Guid.NewGuid():N}.txt");
        await File.WriteAllTextAsync(file, "private file");
        FakeOneBotRuntime runtime = new();
        QChatService service = new(null!, new NullLogger<QChatService>(), oneBotRuntime: runtime)
        {
            Configuration = new QChatConfig { BotId = 999 }
        };

        await service.QPrivateFile(456, file);

        Assert.That(runtime.PrivateFiles, Is.EqualTo(new[] { (456L, file.Replace('\\', '/'), Path.GetFileName(file)) }));
    }

    [Test]
    public async Task QVideo_SendsCqVideoToGroup()
    {
        string video = Path.Combine(Path.GetTempPath(), $"qchat-video-{Guid.NewGuid():N}.mp4");
        await File.WriteAllTextAsync(video, "fake mp4");
        FakeOneBotRuntime runtime = new();
        QChatService service = new(null!, new NullLogger<QChatService>(), oneBotRuntime: runtime)
        {
            Configuration = new QChatConfig { BotId = 999 }
        };

        await service.QVideo(OneBotMessageType.Group, 123, video);

        Assert.That(runtime.GroupMessages, Is.EqualTo(new[] { (123L, $"[CQ:video,file={video.Replace('\\', '/')}]") }));
    }

    [Test]
    public async Task QVideo_UsesSecurityGatewayForExternalRequests()
    {
        string video = Path.Combine(Path.GetTempPath(), $"qchat-video-{Guid.NewGuid():N}.mp4");
        await File.WriteAllTextAsync(video, "fake mp4");
        FakeOneBotRuntime runtime = new();
        QChatService service = new(null!, new NullLogger<QChatService>(), oneBotRuntime: runtime)
        {
            Configuration = new QChatConfig { BotId = 999 }
        };
        AgentPermissionConfig config = new()
        {
            OwnerUserIds = [10001],
            RequireConfirmationForHighRisk = true
        };

        QChatExternalActionResult blocked = await service.QVideo(
            OneBotMessageType.Group,
            123,
            video,
            new AgentPermissionRequest(
                ActorUserId: 20002,
                Source: AgentRequestSource.GroupChat,
                IsMentioned: true,
                RiskLevel: AgentRiskLevel.Low,
                HasExplicitConfirmation: true,
                Action: "qq.video_send"),
            config);
        QChatExternalActionResult executed = await service.QVideo(
            OneBotMessageType.Group,
            123,
            video,
            new AgentPermissionRequest(
                ActorUserId: 10001,
                Source: AgentRequestSource.PrivateChat,
                IsMentioned: false,
                RiskLevel: AgentRiskLevel.Low,
                HasExplicitConfirmation: true,
                Action: "qq.video_send"),
            config);

        Assert.That(blocked.Executed, Is.False);
        Assert.That(blocked.GatewayDecision.Status, Is.EqualTo(AgentExecutionDecisionStatus.Blocked));
        Assert.That(blocked.GatewayDecision.RiskLevel, Is.EqualTo(AgentRiskLevel.High));
        Assert.That(executed.Executed, Is.True);
        Assert.That(runtime.GroupMessages, Is.EqualTo(new[] { (123L, $"[CQ:video,file={video.Replace('\\', '/')}]") }));
    }

    [Test]
    public async Task OwnerNotificationDeliverySendsPrivateDetailsAndSanitizedGroupSummary()
    {
        string root = Path.Combine(Path.GetTempPath(), "alife-qchat-owner-notification-tests", Guid.NewGuid().ToString("N"));
        AgentAuditLogService audit = new(Path.Combine(root, "audit.jsonl"));
        AgentControlCenterService controlCenter = new(auditLog: audit);
        controlCenter.ProposeConfigurationChange("OwnerUserIds", "10001", "agent", "owner identity is protected");
        ChatRuntimeState runtimeState = new(
            IsChatting: false,
            PendingPokeCount: 0,
            ChatHistoryCount: 0,
            LastError: null,
            RecentEvents: []);
        AgentControlCenterSnapshot snapshot = controlCenter.BuildSnapshot(runtimeState, "Kira");
        AgentOwnerNotificationPlan plan = AgentControlCenterService.BuildOwnerNotificationPlan(
            snapshot,
            ownerPrivateSessionId: "qq:private:3045846738",
            sourceGroupSessionId: "qq:group:867165927");
        AgentAuditLogService deliveryAudit = new(Path.Combine(root, "delivery-audit.jsonl"));
        FakeOneBotRuntime runtime = new();
        QChatService service = new(null!, new NullLogger<QChatService>(), oneBotRuntime: runtime, auditLog: deliveryAudit)
        {
            Configuration = new QChatConfig { BotId = 999 }
        };

        QChatOwnerNotificationDeliveryResult result = await service.DeliverOwnerNotificationPlanAsync(plan);

        Assert.That(runtime.PrivateMessages, Has.Count.EqualTo(1));
        Assert.That(runtime.PrivateMessages[0].Target, Is.EqualTo(3045846738));
        Assert.That(runtime.PrivateMessages[0].Message, Does.Contain("OwnerUserIds"));
        Assert.That(runtime.GroupMessages, Has.Count.EqualTo(1));
        Assert.That(runtime.GroupMessages[0].Target, Is.EqualTo(867165927));
        Assert.That(runtime.GroupMessages[0].Message, Does.Contain("owner attention"));
        Assert.That(runtime.GroupMessages[0].Message, Does.Not.Contain("OwnerUserIds"));
        Assert.That(result.PrivateSentCount, Is.EqualTo(1));
        Assert.That(result.GroupSummarySent, Is.True);
        Assert.That(deliveryAudit.GetRecentEntries(10).Select(entry => entry.Action), Is.EqualTo(new[] {
            "qq.owner_notification.private",
            "qq.owner_notification.group_summary",
        }));
    }

    [Test]
    public async Task OwnerNotificationDeliverySkipsWhenPlanDoesNotNeedNotification()
    {
        AgentOwnerNotificationPlan plan = new(
            ShouldNotifyOwner: false,
            TargetSessionId: "qq:private:3045846738",
            PublicGroupSummary: "No owner attention is currently required.",
            PrivateMessages: []);
        FakeOneBotRuntime runtime = new();
        QChatService service = new(null!, new NullLogger<QChatService>(), oneBotRuntime: runtime)
        {
            Configuration = new QChatConfig { BotId = 999 }
        };

        QChatOwnerNotificationDeliveryResult result = await service.DeliverOwnerNotificationPlanAsync(plan);

        Assert.That(runtime.PrivateMessages, Is.Empty);
        Assert.That(runtime.GroupMessages, Is.Empty);
        Assert.That(result.PrivateSentCount, Is.EqualTo(0));
        Assert.That(result.GroupSummarySent, Is.False);
    }

    [Test]
    public void QVideo_RejectsUnsupportedLocalExtension()
    {
        string video = Path.Combine(Path.GetTempPath(), $"qchat-video-{Guid.NewGuid():N}.txt");
        File.WriteAllText(video, "not a video");
        FakeOneBotRuntime runtime = new();
        QChatService service = new(null!, new NullLogger<QChatService>(), oneBotRuntime: runtime)
        {
            Configuration = new QChatConfig { BotId = 999 }
        };

        Assert.ThrowsAsync<InvalidOperationException>(() => service.QVideo(OneBotMessageType.Group, 123, video));
    }

    [Test]
    public void QGroupFile_RejectsDisallowedGroupWhenWhitelistConfigured()
    {
        string file = Path.GetTempFileName();
        File.WriteAllText(file, "group file");
        FakeOneBotRuntime runtime = new();
        QChatService service = new(null!, new NullLogger<QChatService>(), oneBotRuntime: runtime)
        {
            Configuration = new QChatConfig {
                BotId = 999,
                AllowedGroupIds = "999"
            }
        };

        Assert.ThrowsAsync<InvalidOperationException>(() => service.QGroupFile(123, file));
        Assert.That(runtime.GroupFiles, Is.Empty);
    }

    [Test]
    public async Task RelationCacheRefreshesGroupMembersFromRuntime()
    {
        FakeOneBotRuntime runtime = new();
        runtime.GroupMemberLists[123] = [
            new OneBotGroupMember { GroupId = 123, UserId = 1001, Nickname = "Alice", Card = "A-card", Role = "member" },
            new OneBotGroupMember { GroupId = 123, UserId = 1002, Nickname = "Bob", Role = "admin" }
        ];
        QChatRelationCacheService service = new(runtime);

        QChatGroupMemberCacheSnapshot snapshot = await service.RefreshGroupMembersAsync(123);

        Assert.That(snapshot.GroupId, Is.EqualTo(123));
        Assert.That(snapshot.Members.Select(member => member.UserId), Is.EqualTo(new[] { 1001L, 1002L }));
        Assert.That(snapshot.Members[0].DisplayName, Is.EqualTo("A-card"));
        Assert.That(service.TryGetMember(123, 1002)?.DisplayName, Is.EqualTo("Bob"));
    }

    [Test]
    public void RelationCacheReturnsEmptySnapshotForUnknownGroup()
    {
        QChatRelationCacheService service = new(new FakeOneBotRuntime());

        QChatGroupMemberCacheSnapshot snapshot = service.GetCachedGroupMembers(123);

        Assert.That(snapshot.GroupId, Is.EqualTo(123));
        Assert.That(snapshot.Members, Is.Empty);
    }

    [Test]
    public void RelationCacheExposesXmlTools()
    {
        string[] xmlFunctionNames = typeof(QChatRelationCacheService)
            .GetMethods()
            .Select(method => method.GetCustomAttributes(typeof(Alife.Function.Interpreter.XmlFunctionAttribute), inherit: false)
                .OfType<Alife.Function.Interpreter.XmlFunctionAttribute>()
                .FirstOrDefault())
            .OfType<Alife.Function.Interpreter.XmlFunctionAttribute>()
            .Select(attribute => attribute.Name ?? string.Empty)
            .ToArray();

        Assert.That(xmlFunctionNames, Does.Contain("qchat_group_members_refresh"));
        Assert.That(xmlFunctionNames, Does.Contain("qchat_group_members_cache"));
    }

    [Test]
    public async Task AwakeRegistersQChatToolInInitialFunctionGuide()
    {
        XmlFunctionCaller functionCaller = new(new NullLogger<XmlFunctionCaller>());
        QChatService service = new(functionCaller, new NullLogger<QChatService>(), oneBotRuntime: new FakeOneBotRuntime())
        {
            Configuration = new QChatConfig { BotId = 999, OwnerId = 1001 }
        };

        await service.AwakeAsync(new AwakeContext
        {
            Character = new Character { Name = "QChatGuideTest" },
            ContextBuilder = new ChatHistoryAgentThread(),
            KernelBuilder = Kernel.CreateBuilder(),
        });
        string guide = functionCaller.BuildFunctionGuide();

        Assert.That(guide, Does.Contain("qchat"));
        Assert.That(guide, Does.Contain("targetid"));
    }

    [Test]
    public async Task IncomingOwnerPrivateMessageCanDispatchModelReplyToPrivateChat()
    {
        FakeOneBotRuntime runtime = new();
        QChatService service = CreateStartedService(runtime, new QChatConfig
        {
            BotId = 999,
            OwnerId = 1001
        });
        service.InboundChatDispatcher = inbound => service.SendChatAsync("private", inbound.TargetId, "local-private-reply");

        runtime.Raise(new OneBotMessageEvent
        {
            SelfId = 999,
            UserId = 1001,
            RawMessage = "你是谁"
        });

        await WaitUntilAsync(() => runtime.PrivateMessages.Count > 0);
        Assert.That(runtime.PrivateMessages, Is.EqualTo(new[] { (1001L, "local-private-reply") }));
    }

    [Test]
    public async Task IncomingOwnerPrivatePlainModelReplyFallsBackToPrivateChat()
    {
        FakeOneBotRuntime runtime = new();
        XmlFunctionCaller functionCaller = new(new NullLogger<XmlFunctionCaller>());
        PlainReplyQChatService service = new(functionCaller, runtime, "plain-private-reply")
        {
            Configuration = new QChatConfig
            {
                BotId = 999,
                OwnerId = 1001,
                EnableBalancedTextStreaming = false
            }
        };
        StartService(service);

        runtime.Raise(new OneBotMessageEvent
        {
            SelfId = 999,
            UserId = 1001,
            RawMessage = "你还在吗"
        });

        await WaitUntilAsync(() => runtime.PrivateMessages.Count > 0);
        Assert.That(runtime.PrivateMessages, Is.EqualTo(new[] { (1001L, "plain-private-reply") }));
    }

    [Test]
    public async Task IncomingGroupMentionPlainModelReplyFallsBackToGroupChat()
    {
        FakeOneBotRuntime runtime = new();
        XmlFunctionCaller functionCaller = new(new NullLogger<XmlFunctionCaller>());
        PlainReplyQChatService service = new(functionCaller, runtime, "[CQ:at,qq=2001] plain-group-reply")
        {
            Configuration = new QChatConfig
            {
                BotId = 999,
                OwnerId = 1001,
                AllowGroupMemberChat = true,
                AllowGroupMemberMentions = true,
                EnableBalancedTextStreaming = false
            }
        };
        StartService(service);

        runtime.Raise(new OneBotMessageEvent
        {
            SelfId = 999,
            UserId = 2001,
            GroupId = 3001,
            GroupName = "test-group",
            Sender = new OneBotSender { UserId = 2001, Nickname = "member" },
            RawMessage = "[CQ:at,qq=999] 你还在吗"
        });

        await WaitUntilAsync(() => runtime.GroupMessages.Count > 0);
        Assert.That(runtime.GroupMessages, Is.EqualTo(new[] { (3001L, "[CQ:at,qq=2001] plain-group-reply") }));
    }

    [Test]
    public async Task IncomingPrivateQChatToolReplyCanSendOnlyToCurrentSession()
    {
        FakeOneBotRuntime runtime = new();
        QChatService service = CreateStartedService(runtime, new QChatConfig
        {
            BotId = 999,
            OwnerId = 1001
        });
        service.InboundChatDispatcher = async _ =>
        {
            await service.QChat(new XmlExecutorContext
            {
                CallMode = CallMode.Closing,
                Parameters = new Dictionary<string, string>(),
                CallChain = ["qchat"],
                Content = "same-session"
            }, OneBotMessageType.Private, 1001);

            await service.QChat(new XmlExecutorContext
            {
                CallMode = CallMode.Closing,
                Parameters = new Dictionary<string, string>(),
                CallChain = ["qchat"],
                Content = "cross-session"
            }, OneBotMessageType.Private, 2002);
        };

        runtime.Raise(new OneBotMessageEvent
        {
            SelfId = 999,
            UserId = 1001,
            RawMessage = "reply"
        });

        await WaitUntilAsync(() => runtime.PrivateMessages.Count > 0);
        Assert.That(runtime.PrivateMessages, Is.EqualTo(new[] { (1001L, "same-session") }));
    }

    [Test]
    public async Task IncomingGroupMentionCanDispatchModelReplyToGroupImmediately()
    {
        FakeOneBotRuntime runtime = new();
        QChatService service = CreateStartedService(runtime, new QChatConfig
        {
            BotId = 999,
            OwnerId = 1001,
            AllowGroupMemberChat = true,
            AllowGroupMemberMentions = true,
            EnableBalancedTextStreaming = false
        });
        service.InboundChatDispatcher = inbound => service.SendChatAsync("group", inbound.TargetId, "[CQ:at,qq=2001] local-group-reply");

        runtime.Raise(new OneBotMessageEvent
        {
            SelfId = 999,
            UserId = 2001,
            GroupId = 3001,
            GroupName = "test-group",
            Sender = new OneBotSender { UserId = 2001, Nickname = "member" },
            RawMessage = "[CQ:at,qq=999] 你是谁"
        });

        await WaitUntilAsync(() => runtime.GroupMessages.Count == 1);
        Assert.That(runtime.GroupMessages, Is.EqualTo(new[] { (3001L, "[CQ:at,qq=2001] local-group-reply") }));
    }

    [Test]
    public async Task IncomingPassiveGroupMessageCanDispatchModelReplyWhenProactiveProbabilityAllows()
    {
        FakeOneBotRuntime runtime = new();
        QChatService service = CreateStartedService(runtime, new QChatConfig
        {
            BotId = 999,
            OwnerId = 1001,
            AllowGroupMemberChat = true,
            AllowProactiveGroupChat = true,
            ProactiveChatProbability = 1.0f,
            FlushInterval = 0,
            EnableBalancedTextStreaming = false
        });
        service.InboundChatDispatcher = inbound => service.SendChatAsync("group", inbound.TargetId, "local-passive-reply");

        runtime.Raise(new OneBotMessageEvent
        {
            SelfId = 999,
            UserId = 2001,
            GroupId = 3001,
            GroupName = "test-group",
            Sender = new OneBotSender { UserId = 2001, Nickname = "member" },
            RawMessage = "今晚吃什么"
        });

        await WaitUntilAsync(() => runtime.GroupMessages.Count == 1, TimeSpan.FromSeconds(4));
        Assert.That(runtime.GroupMessages, Is.EqualTo(new[] { (3001L, "local-passive-reply") }));
    }

    [Test]
    public void EmptyGroupFlushDiagnosticsAreThrottledPerGroup()
    {
        string previousStorage = Alife.Platform.AlifePath.StorageFolderPath;
        string storageRoot = Path.Combine(Path.GetTempPath(), "alife-qchat-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(storageRoot);
        try
        {
            Alife.Platform.AlifePath.SetStorageFolderPath(storageRoot);
            QChatService service = new(null!, new NullLogger<QChatService>(), oneBotRuntime: new FakeOneBotRuntime())
            {
                Configuration = new QChatConfig { BotId = 999 }
            };
            GroupState state = new() { GroupId = 3001 };

            service.FlushGroupBuffer(state);
            service.FlushGroupBuffer(state);
            service.FlushGroupBuffer(state);

            string diagnosticsPath = Path.Combine(storageRoot, "AgentWorkspace", "qchat-diagnostics.jsonl");
            string[] skippedLines = File.ReadAllLines(diagnosticsPath)
                .Where(line => line.Contains("\"eventName\":\"group-flush-skipped\"", StringComparison.Ordinal))
                .ToArray();
            Assert.That(skippedLines, Has.Length.EqualTo(1));
        }
        finally
        {
            Alife.Platform.AlifePath.SetStorageFolderPath(previousStorage);
        }
    }

    static QChatService CreateStartedService(FakeOneBotRuntime runtime, QChatConfig config)
    {
        XmlFunctionCaller functionCaller = new(new NullLogger<XmlFunctionCaller>());
        QChatService service = new(functionCaller, new NullLogger<QChatService>(), oneBotRuntime: runtime)
        {
            Configuration = config
        };
        StartService(service);
        return service;
    }

    static void StartService(QChatService service)
    {
        Character character = new() { Name = "QChatTest" };
        ChatHistoryAgentThread thread = new();
        service.AwakeAsync(new AwakeContext
        {
            Character = character,
            ContextBuilder = thread,
            KernelBuilder = Kernel.CreateBuilder(),
        }).GetAwaiter().GetResult();
        ChatBot chatBot = new(null!, thread);
        service.StartAsync(Kernel.CreateBuilder().Build(), new ChatActivity(
            character,
            Kernel.CreateBuilder().Build(),
            null!,
            chatBot,
            [])).GetAwaiter().GetResult();
    }

    static async Task WaitUntilAsync(Func<bool> condition, TimeSpan? timeout = null)
    {
        DateTime deadline = DateTime.UtcNow + (timeout ?? TimeSpan.FromSeconds(2));
        while (DateTime.UtcNow < deadline)
        {
            if (condition())
                return;

            await Task.Delay(50);
        }

        Assert.Fail("Condition was not met before timeout.");
    }

    sealed class FakeOneBotRuntime : IOneBotRuntime
    {
        public event Action<OneBotBaseEvent>? EventReceived;
        public long BotId { get; set; } = 999;
        public bool IsConnected { get; set; } = true;
        public string Url { get; set; } = "";
        public string Token { get; set; } = "";
        public List<(long Target, string Message)> GroupMessages { get; } = new();
        public List<(long Target, string Message)> PrivateMessages { get; } = new();
        public List<(long Target, string File, string Name)> GroupFiles { get; } = new();
        public List<(long Target, string File, string Name)> PrivateFiles { get; } = new();
        public Dictionary<long, IReadOnlyList<OneBotGroupMember>> GroupMemberLists { get; } = new();

        public Task ConnectAsync() => Task.CompletedTask;
        public Task SendGroupMessage(long groupId, string message)
        {
            GroupMessages.Add((groupId, message));
            return Task.CompletedTask;
        }

        public Task SendPrivateMessage(long userId, string message)
        {
            PrivateMessages.Add((userId, message));
            return Task.CompletedTask;
        }

        public Task UploadGroupFile(long groupId, string filePath, string name)
        {
            GroupFiles.Add((groupId, filePath, name));
            return Task.CompletedTask;
        }

        public Task UploadPrivateFile(long userId, string filePath, string name)
        {
            PrivateFiles.Add((userId, filePath, name));
            return Task.CompletedTask;
        }
        public Task<OneBotFile?> GetPrivateFileUrl(string fileId) => Task.FromResult<OneBotFile?>(null);
        public Task<OneBotFile?> GetGroupFileUrl(long groupId, string fileId) => Task.FromResult<OneBotFile?>(null);
        public Task<OneBotMessageEvent?> GetMessage(long messageId) => Task.FromResult<OneBotMessageEvent?>(null);
        public Task<List<OneBotForwardMessage>?> GetForwardMessage(string forwardId) => Task.FromResult<List<OneBotForwardMessage>?>([]);
        public Task<IReadOnlyList<OneBotGroupMember>> GetGroupMemberList(long groupId)
        {
            return Task.FromResult(GroupMemberLists.TryGetValue(groupId, out IReadOnlyList<OneBotGroupMember>? members)
                ? members
                : Array.Empty<OneBotGroupMember>());
        }
        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
        public void Raise(OneBotBaseEvent ev) => EventReceived?.Invoke(ev);
    }

    sealed class PlainReplyQChatService(
        XmlFunctionCaller functionCaller,
        IOneBotRuntime runtime,
        string reply) : QChatService(functionCaller, new NullLogger<QChatService>(), oneBotRuntime: runtime)
    {
        protected override Task<string> DispatchToModelAsync(QChatInboundMessage message)
        {
            return Task.FromResult(reply);
        }
    }

    sealed class FakeLifeEventPublisher : ILifeEventPublisher
    {
        public List<LifeEvent> Events { get; } = new();
        public void Publish(LifeEvent lifeEvent) => Events.Add(lifeEvent);
    }
}
