using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Alife.Framework;
using Microsoft.SemanticKernel;

namespace Alife.Function.MessageFilter;

public class MessageFilterData
{
    public bool EnableTimestamp { get; set; } = true;
    public string MessageAppend { get; set; } = "(回复消息时保持简洁，禁用旁白、emoji)";
    public string PokeAppend { get; set; } = "";
    public int MaxContextLength { get; set; } = 2400;
    public int MaxMessageLength { get; set; } = 5000;
}

[Module("消息过滤", "统一管理消息的提示词注入和格式化。负责添加时间戳、通用提示词以及系统消息头。",
    defaultCategory: "Alife 官方/生活环境",
    LaunchOrder = -100, EditorUI = typeof(MessageFilterServiceUI))]
public class MessageFilterService(
    ILifeEventStream? lifeEventStream = null,
    IEnumerable<IContextContributor>? contextContributors = null)
    : InteractiveModule<MessageFilterService>, IConfigurable<MessageFilterData>
{
    public MessageFilterData? Configuration { get; set; }

    public override async Task AwakeAsync(AwakeContext context)
    {
        await base.AwakeAsync(context);
        Prompt("在你每次收到的消息中，通常结构如下`[xx]xx(xx)`。其中`[]`表示消息属性，比如记载了发送时间，消息来源等；`()`则是对回复消息时的要求；中间的则是消息正文。注意观察消息属性和附加要求，仔细斟酌后再以正确合适的方式回复。");
    }

    public override async Task StartAsync(Kernel kernel, ChatActivity chatActivity)
    {
        await base.StartAsync(kernel, chatActivity);
        ChatBot.ChatSend += OnChatSend;
        ChatBot.PokeSend += OnPokeSend;
    }

    string OnChatSend(string message)
    {
        return FormatChatMessage(message);
    }

    public string FormatChatMessage(string message)
    {
        MessageFilterData configuration = Configuration ?? new MessageFilterData();
        string result = $"{PrependContext(message, configuration)}{configuration.MessageAppend}";
        if (configuration.EnableTimestamp)
            result = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}]{result}";

        if (result.Length > configuration.MaxMessageLength)
        {
            result = result.Substring(0, configuration.MaxMessageLength);
            result += $"(文本过长，超过 {configuration.MaxMessageLength} 的部分已截断)";
        }

        return result;
    }

    string OnPokeSend(string message)
    {
        return FormatPokeMessage(message);
    }

    public string FormatPokeMessage(string message)
    {
        MessageFilterData configuration = Configuration ?? new MessageFilterData();
        return $"{PrependContext(message, configuration)}{configuration.PokeAppend}";
    }

    string PrependContext(string message, MessageFilterData configuration)
    {
        List<ContextContribution> contributions = new();
        if (contextContributors != null)
        {
            foreach (IContextContributor contributor in contextContributors)
            {
                try
                {
                    contributions.AddRange(contributor.GetContextContributions());
                }
                catch
                {
                    // Context must never block user-visible message delivery.
                }
            }
        }

        if (lifeEventStream != null)
        {
            string recentExperiences = LifeEventStreamService.FormatRecentExperiences(lifeEventStream.GetRecentEvents(8));
            if (string.IsNullOrWhiteSpace(recentExperiences) == false)
                contributions.Add(new ContextContribution("recent-experiences", recentExperiences, Priority: 800, MaxLength: 1200));
        }

        string context = ContextBudgetComposer.Compose(contributions, configuration.MaxContextLength);
        if (string.IsNullOrWhiteSpace(context))
            return message;

        return $"{context}\n{message}";
    }
}
