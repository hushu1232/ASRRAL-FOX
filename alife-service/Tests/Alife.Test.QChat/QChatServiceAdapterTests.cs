using Alife.Function.QChat;
using Microsoft.Extensions.Logging.Abstractions;
using NUnit.Framework;

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

    sealed class FakeOneBotRuntime : IOneBotRuntime
    {
        public event Action<OneBotBaseEvent>? EventReceived;
        public long BotId { get; set; } = 999;
        public bool IsConnected { get; set; } = true;
        public string Url { get; set; } = "";
        public string Token { get; set; } = "";
        public List<(long Target, string Message)> GroupMessages { get; } = new();
        public List<(long Target, string Message)> PrivateMessages { get; } = new();

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

        public Task UploadGroupFile(long groupId, string filePath, string name) => Task.CompletedTask;
        public Task UploadPrivateFile(long userId, string filePath, string name) => Task.CompletedTask;
        public Task<OneBotFile?> GetPrivateFileUrl(string fileId) => Task.FromResult<OneBotFile?>(null);
        public Task<OneBotFile?> GetGroupFileUrl(long groupId, string fileId) => Task.FromResult<OneBotFile?>(null);
        public Task<OneBotMessageEvent?> GetMessage(long messageId) => Task.FromResult<OneBotMessageEvent?>(null);
        public Task<List<OneBotForwardMessage>?> GetForwardMessage(string forwardId) => Task.FromResult<List<OneBotForwardMessage>?>([]);
        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
        public void Raise(OneBotBaseEvent ev) => EventReceived?.Invoke(ev);
    }
}
