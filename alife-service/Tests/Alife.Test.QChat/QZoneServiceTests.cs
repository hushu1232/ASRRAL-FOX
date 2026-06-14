using Alife.Framework;
using Alife.Function.QChat;
using NUnit.Framework;
using System.Text.Json;

namespace Alife.Test.QChat;

[TestFixture]
public class QZoneServiceTests
{
    [Test]
    public async Task QZonePost_DryRunDoesNotCallRuntime()
    {
        FakeQZoneRuntime runtime = new();
        QZoneService service = new(runtime)
        {
            Configuration = new QZoneServiceConfig
            {
                EnableQZone = true,
                DryRunExternalActions = true
            }
        };

        QZoneActionResult result = await service.QZonePost("hello qzone");

        Assert.That(result.Executed, Is.False);
        Assert.That(result.Action, Is.EqualTo("post"));
        Assert.That(runtime.Posts, Is.Empty);
    }

    [Test]
    public async Task QZoneComment_CallsRuntimeForAllowedTarget()
    {
        FakeQZoneRuntime runtime = new();
        QZoneService service = new(runtime)
        {
            Configuration = new QZoneServiceConfig
            {
                EnableQZone = true,
                AllowedQZoneTargetIds = "1001",
                DryRunExternalActions = false
            }
        };

        QZoneActionResult result = await service.QZoneComment(1001, "post-a", "nice");

        Assert.That(result.Executed, Is.True);
        Assert.That(runtime.Comments, Is.EqualTo(new[] { (1001L, "post-a", "nice") }));
    }

    [Test]
    public async Task QZoneLike_SkipsTargetsOutsidePrivateChatContactPool()
    {
        FakeQZoneRuntime runtime = new();
        QZoneService service = new(runtime)
        {
            Configuration = new QZoneServiceConfig
            {
                EnableQZone = true,
                PrivateChatContactIds = "1001",
                PrivateContactLikeProbability = 1.0
            }
        };

        QZoneActionResult result = await service.QZoneLike(2001, "post-a", () => 0.0);

        Assert.That(result.Executed, Is.False);
        Assert.That(result.Reason, Does.Contain("private chat contact"));
        Assert.That(runtime.Likes, Is.Empty);
    }

    [Test]
    public async Task QZoneReplyComment_CallsRuntimeWhenMostlyReplyPolicyAllows()
    {
        FakeQZoneRuntime runtime = new();
        QZoneService service = new(runtime)
        {
            Configuration = new QZoneServiceConfig
            {
                EnableQZone = true,
                CommentReplyProbability = 0.8,
                DryRunExternalActions = false
            }
        };

        QZoneActionResult result = await service.QZoneReplyComment(1001, "post-a", "comment-b", "thanks", () => 0.5);

        Assert.That(result.Executed, Is.True);
        Assert.That(runtime.Replies, Is.EqualTo(new[] { (1001L, "post-a", "comment-b", "thanks") }));
    }

    [Test]
    public async Task QZoneComment_UsesInjectedOneBotActionInvokerWhenRuntimeIsAbsent()
    {
        FakeActionInvoker invoker = new();
        QZoneService service = new(actionInvoker: invoker)
        {
            Configuration = new QZoneServiceConfig
            {
                EnableQZone = true,
                DryRunExternalActions = false
            }
        };

        QZoneActionResult result = await service.QZoneComment(1001, "post-a", "nice");

        Assert.That(result.Executed, Is.True);
        Assert.That(invoker.Calls, Has.Count.EqualTo(1));
        Assert.That(invoker.Calls[0].Action, Is.EqualTo("send_comment"));
        Assert.That(invoker.Calls[0].Json, Does.Contain("\"target_uin\":1001"));
        Assert.That(invoker.Calls[0].Json, Does.Contain("\"target_tid\":\"post-a\""));
    }

    [Test]
    public async Task ConnectAsync_ConfiguresAndConnectsInjectedActionConnection()
    {
        FakeActionConnection connection = new();
        QZoneService service = new(actionConnection: connection)
        {
            Configuration = new QZoneServiceConfig
            {
                EnableQZone = true,
                DryRunExternalActions = false,
                Url = "ws://127.0.0.1:3010",
                Token = "secret"
            }
        };

        await service.ConnectAsync();

        Assert.That(connection.Url, Is.EqualTo("ws://127.0.0.1:3010"));
        Assert.That(connection.Token, Is.EqualTo("secret"));
        Assert.That(connection.ConnectCalls, Is.EqualTo(1));
        Assert.That(connection.IsConnected, Is.True);
        Assert.That(service.GetHealth().Status, Is.EqualTo(ModuleHealthStatus.Healthy));
    }

    sealed class FakeQZoneRuntime : IQZoneRuntime
    {
        public List<string> Posts { get; } = new();
        public List<(long TargetId, string PostId, string Content)> Comments { get; } = new();
        public List<(long TargetId, string PostId, string CommentId, string Content)> Replies { get; } = new();
        public List<(long TargetId, string PostId)> Likes { get; } = new();

        public Task PublishPost(string content)
        {
            Posts.Add(content);
            return Task.CompletedTask;
        }

        public Task Comment(long targetId, string postId, string content)
        {
            Comments.Add((targetId, postId, content));
            return Task.CompletedTask;
        }

        public Task ReplyComment(long targetId, string postId, string commentId, string content)
        {
            Replies.Add((targetId, postId, commentId, content));
            return Task.CompletedTask;
        }

        public Task LikePost(long targetId, string postId)
        {
            Likes.Add((targetId, postId));
            return Task.CompletedTask;
        }
    }

    sealed class FakeActionInvoker : IOneBotActionInvoker
    {
        public List<(string Action, string Json)> Calls { get; } = new();

        public Task<T?> CallActionAsync<T>(string action, object? parameters = null)
        {
            Calls.Add((action, JsonSerializer.Serialize(parameters)));
            return Task.FromResult<T?>(default);
        }
    }

    sealed class FakeActionConnection : IOneBotActionConnection
    {
        public bool IsConnected { get; private set; }
        public string Url { get; set; } = "";
        public string Token { get; set; } = "";
        public int ConnectCalls { get; private set; }

        public Task ConnectAsync()
        {
            ConnectCalls++;
            IsConnected = true;
            return Task.CompletedTask;
        }

        public Task<T?> CallActionAsync<T>(string action, object? parameters = null)
        {
            return Task.FromResult<T?>(default);
        }

        public ValueTask DisposeAsync()
        {
            return ValueTask.CompletedTask;
        }
    }
}
