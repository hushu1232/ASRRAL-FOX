using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Alife.Framework;

namespace Alife.Function.Agent;

public sealed record AgentBrowserSnapshotRequest(
    string Url,
    int Page = 1,
    int MaxTextChars = 8000,
    int MaxElements = 50);

public sealed record AgentBrowserElement(
    string Id,
    string Type,
    string Text,
    string Href);

public sealed record AgentBrowserSnapshot(
    bool Success,
    string Reason,
    string Url,
    string Title,
    string Text,
    IReadOnlyList<AgentBrowserElement> Elements);

public interface IAgentBrowserProvider
{
    Task<AgentBrowserSnapshot> CaptureSnapshotAsync(
        AgentBrowserSnapshotRequest request,
        CancellationToken cancellationToken = default);
}

public static class AgentBrowserSnapshotFormatter
{
    public static string Format(
        AgentBrowserSnapshot snapshot,
        int maxTextChars = 8000,
        int maxElements = 50)
    {
        ArgumentNullException.ThrowIfNull(snapshot);

        if (snapshot.Success == false)
            return $"browser_snapshot_failed: {snapshot.Reason}";

        int textLimit = Math.Clamp(maxTextChars, 0, 50000);
        int elementLimit = Math.Clamp(maxElements, 0, 500);
        string text = snapshot.Text ?? "";
        if (text.Length > textLimit)
            text = text[..textLimit];

        StringBuilder builder = new();
        builder.AppendLine($"url={snapshot.Url}");
        builder.AppendLine($"title={snapshot.Title}");
        if (text.Length > 0)
            builder.AppendLine(text);

        foreach (AgentBrowserElement element in (snapshot.Elements ?? []).Take(elementLimit))
        {
            builder.AppendLine(FormatElement(element));
        }

        return ExternalContextFormatter.WrapUntrusted(
            "browser-snapshot",
            builder.ToString().TrimEnd());
    }

    static string FormatElement(AgentBrowserElement element)
    {
        string line = $"element {element.Id} type={element.Type} text={element.Text}";
        if (string.IsNullOrWhiteSpace(element.Href) == false)
            line += $" href={element.Href}";
        return line;
    }
}
