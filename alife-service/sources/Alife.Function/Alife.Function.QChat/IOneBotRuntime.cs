using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Alife.Function.QChat;

public interface IOneBotRuntime : IAsyncDisposable
{
    event Action<OneBotBaseEvent>? EventReceived;
    long BotId { get; }
    bool IsConnected { get; }
    string Url { get; set; }
    string Token { get; set; }
    Task ConnectAsync();
    Task SendGroupMessage(long groupId, string message);
    Task SendPrivateMessage(long userId, string message);
    Task UploadGroupFile(long groupId, string filePath, string name);
    Task UploadPrivateFile(long userId, string filePath, string name);
    Task<OneBotFile?> GetPrivateFileUrl(string fileId);
    Task<OneBotFile?> GetGroupFileUrl(long groupId, string fileId);
    Task<OneBotMessageEvent?> GetMessage(long messageId);
    Task<List<OneBotForwardMessage>?> GetForwardMessage(string forwardId);
}

public sealed class OneBotRuntime(OneBotClient client) : IOneBotRuntime
{
    public event Action<OneBotBaseEvent>? EventReceived
    {
        add => client.EventReceived += value;
        remove => client.EventReceived -= value;
    }

    public long BotId => client.BotId;
    public bool IsConnected => client.IsConnected;
    public string Url { get => client.Url; set => client.Url = value; }
    public string Token { get => client.Token; set => client.Token = value; }
    public Task ConnectAsync() => client.ConnectAsync();
    public Task SendGroupMessage(long groupId, string message) => client.SendGroupMessage(groupId, message);
    public Task SendPrivateMessage(long userId, string message) => client.SendPrivateMessage(userId, message);
    public Task UploadGroupFile(long groupId, string filePath, string name) => client.UploadGroupFile(groupId, filePath, name);
    public Task UploadPrivateFile(long userId, string filePath, string name) => client.UploadPrivateFile(userId, filePath, name);
    public Task<OneBotFile?> GetPrivateFileUrl(string fileId) => client.GetPrivateFileUrl(fileId);
    public Task<OneBotFile?> GetGroupFileUrl(long groupId, string fileId) => client.GetGroupFileUrl(groupId, fileId);
    public Task<OneBotMessageEvent?> GetMessage(long messageId) => client.GetMessage(messageId);
    public Task<List<OneBotForwardMessage>?> GetForwardMessage(string forwardId) => client.GetForwardMessage(forwardId);
    public ValueTask DisposeAsync() => client.DisposeAsync();
}
