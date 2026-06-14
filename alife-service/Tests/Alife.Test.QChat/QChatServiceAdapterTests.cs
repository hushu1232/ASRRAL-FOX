using Alife.Function.QChat;
using Microsoft.Extensions.Logging.Abstractions;
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
        QChatService service = new(null!, new NullLogger<QChatService>(), oneBotRuntime: runtime)
        {
            Configuration = new QChatConfig { BotId = 999 }
        };

        await service.SendChatAsync("group", 123, " hello ");
        await service.SendChatAsync("private", 456, " hi ");

        Assert.That(runtime.GroupMessages, Is.EqualTo(new[] { (123L, "hello") }));
        Assert.That(runtime.PrivateMessages, Is.EqualTo(new[] { (456L, "hi") }));
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
}
