using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Alife.Function.Agent;

namespace Alife.Function.Browser;

public sealed class AgentBrowserRuntimeProvider(IBrowserRuntime runtime) : IAgentBrowserProvider
{
    readonly IBrowserRuntime runtime = runtime;

    public async Task<AgentBrowserSnapshot> CaptureSnapshotAsync(
        AgentBrowserSnapshotRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        try
        {
            cancellationToken.ThrowIfCancellationRequested();
            await runtime.NavigateAsync(request.Url);
            cancellationToken.ThrowIfCancellationRequested();

            string title = DecodeScriptString(await runtime.ExecuteScriptAsync("document.title"));
            string text = await runtime.ObserveAsync(Math.Max(request.Page, 1));
            if (request.MaxTextChars >= 0 && text.Length > request.MaxTextChars)
                text = text[..request.MaxTextChars];

            return new AgentBrowserSnapshot(
                true,
                "ok",
                request.Url,
                title,
                text,
                []);
        }
        catch (Exception ex) when (ex is not OperationCanceledException || cancellationToken.IsCancellationRequested == false)
        {
            return new AgentBrowserSnapshot(
                false,
                "browser_snapshot_failed",
                request.Url,
                "",
                "",
                []);
        }
    }

    static string DecodeScriptString(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return "";

        try
        {
            string? decoded = JsonSerializer.Deserialize<string>(value);
            return decoded ?? "";
        }
        catch (JsonException)
        {
            return value.Trim();
        }
    }
}
