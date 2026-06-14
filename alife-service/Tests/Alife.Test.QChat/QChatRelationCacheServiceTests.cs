using Alife.Framework;
using Alife.Function.QChat;
using NUnit.Framework;

namespace Alife.Test.QChat;

[TestFixture]
public class QChatRelationCacheServiceTests
{
    [Test]
    public async Task RelationCacheContributesCachedMembersToSelfContext()
    {
        FakeOneBotRuntime runtime = new();
        runtime.GroupMemberLists[123] = [
            new OneBotGroupMember { GroupId = 123, UserId = 1001, Card = "Alice-card", Nickname = "Alice", Role = "member" },
            new OneBotGroupMember { GroupId = 123, UserId = 1002, Nickname = "Bob", Role = "admin" }
        ];
        QChatRelationCacheService service = new(runtime);
        await service.RefreshGroupMembersAsync(123);

        Assert.That(service, Is.AssignableTo<IContextContributor>());
        ContextContribution contribution = ((IContextContributor)service).GetContextContributions().Single();

        Assert.That(contribution.Key, Is.EqualTo("qchat-relation-cache"));
        Assert.That(contribution.Content, Does.Contain("[QQ relation cache]"));
        Assert.That(contribution.Content, Does.Contain("123"));
        Assert.That(contribution.Content, Does.Contain("Alice-card"));
        Assert.That(contribution.Content, Does.Contain("Bob"));
        Assert.That(contribution.Priority, Is.GreaterThanOrEqualTo(700));
    }

    [Test]
    public async Task RelationCacheReportsHealthFromRuntimeAndCacheState()
    {
        FakeOneBotRuntime runtime = new() { IsConnected = true };
        runtime.GroupMemberLists[123] = [
            new OneBotGroupMember { GroupId = 123, UserId = 1001, Nickname = "Alice" }
        ];
        QChatRelationCacheService service = new(runtime);
        await service.RefreshGroupMembersAsync(123);

        Assert.That(service, Is.AssignableTo<IModuleHealthReporter>());
        ModuleHealth health = ((IModuleHealthReporter)service).GetHealth();

        Assert.That(health.Name, Is.EqualTo("QChatRelationCache"));
        Assert.That(health.Status, Is.EqualTo(ModuleHealthStatus.Healthy));
        Assert.That(health.Summary, Does.Contain("1 cached group"));
        Assert.That(health.Summary, Does.Contain("1 member"));
    }

    [Test]
    public void RelationCacheReportsUnavailableWhenRuntimeMissing()
    {
        QChatRelationCacheService service = new();

        Assert.That(service, Is.AssignableTo<IModuleHealthReporter>());
        ModuleHealth health = ((IModuleHealthReporter)service).GetHealth();

        Assert.That(health.Status, Is.EqualTo(ModuleHealthStatus.Unavailable));
        Assert.That(health.Summary, Does.Contain("runtime is unavailable"));
    }

    sealed class FakeOneBotRuntime : IOneBotRuntime
    {
        public event Action<OneBotBaseEvent>? EventReceived;
        public long BotId { get; set; } = 999;
        public bool IsConnected { get; set; }
        public string Url { get; set; } = "";
        public string Token { get; set; } = "";
        public Dictionary<long, IReadOnlyList<OneBotGroupMember>> GroupMemberLists { get; } = new();

        public Task ConnectAsync() => Task.CompletedTask;
        public Task SendGroupMessage(long groupId, string message) => Task.CompletedTask;
        public Task SendPrivateMessage(long userId, string message) => Task.CompletedTask;
        public Task UploadGroupFile(long groupId, string filePath, string name) => Task.CompletedTask;
        public Task UploadPrivateFile(long userId, string filePath, string name) => Task.CompletedTask;
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
    }
}
