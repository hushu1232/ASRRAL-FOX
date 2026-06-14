using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Alife.Framework;
using Alife.Function.FunctionCaller;
using Alife.Function.Interpreter;

namespace Alife.Function.Memory;

[Module(
    "Autobiographical Memory",
    "Consolidates meaningful recent life events into long-term autobiographical memory.",
    defaultCategory: "Alife Official/Living Environment",
    LaunchOrder = -70)]
public class AutobiographicalMemoryService(
    ILifeEventStream? lifeEventStream = null,
    IAutobiographicalMemorySink? memorySink = null,
    XmlFunctionCaller? functionCaller = null)
    : InteractiveModule<AutobiographicalMemoryService>, IModuleHealthReporter
{
    DateTimeOffset? lastPersistedEventTimestamp;
    readonly HashSet<string> persistedEventIds = new(StringComparer.Ordinal);

    [XmlFunction(FunctionMode.OneShot, name: "remember_life")]
    [Description("Consolidate meaningful recent lived experiences into long-term autobiographical memory.")]
    public async Task RememberLife(int maxEvents = 16, CancellationToken cancellationToken = default)
    {
        string? memoryName = await RememberRecentLifeAsync(maxEvents, cancellationToken);
        Poke(memoryName == null
            ? "No meaningful recent life events were found for long-term memory."
            : $"Autobiographical memory saved: {memoryName}");
    }

    public async Task<string?> RememberRecentLifeAsync(
        int maxEvents = 16,
        CancellationToken cancellationToken = default)
    {
        if (lifeEventStream == null || memorySink == null)
            return null;

        LifeEvent[] selectedEvents = SelectMeaningfulEvents(lifeEventStream.GetRecentEvents(maxEvents));
        if (selectedEvents.Length == 0)
            return null;

        DateTime startTime = selectedEvents.First().Timestamp.DateTime;
        DateTime endTime = selectedEvents.Last().Timestamp.DateTime;
        string summary = BuildSummary(selectedEvents, startTime, endTime);
        string content = BuildContent(selectedEvents, startTime, endTime);

        string memoryName = await memorySink.InsertAutobiographicalMemoryAsync(
            summary,
            content,
            startTime,
            endTime,
            cancellationToken);

        lastPersistedEventTimestamp = selectedEvents.Max(lifeEvent => lifeEvent.Timestamp);
        foreach (string eventId in selectedEvents.Select(lifeEvent => lifeEvent.Id))
            persistedEventIds.Add(eventId);
        lifeEventStream.MarkPersisted(selectedEvents.Select(lifeEvent => lifeEvent.Id));
        return memoryName;
    }

    public override async Task AwakeAsync(AwakeContext context)
    {
        await base.AwakeAsync(context);
        functionCaller?.RegisterHandler(this);
    }

    public ModuleHealth GetHealth()
    {
        if (lifeEventStream == null && memorySink == null)
            return new ModuleHealth("AutobiographicalMemory", ModuleHealthStatus.Unavailable, "Life event stream and memory sink are unavailable.");
        if (lifeEventStream == null)
            return new ModuleHealth("AutobiographicalMemory", ModuleHealthStatus.Degraded, "Life event stream is unavailable.");
        if (memorySink == null)
            return new ModuleHealth("AutobiographicalMemory", ModuleHealthStatus.Degraded, "Autobiographical memory sink is unavailable.");

        return new ModuleHealth("AutobiographicalMemory", ModuleHealthStatus.Healthy, "Autobiographical memory consolidation is available.");
    }

    LifeEvent[] SelectMeaningfulEvents(IEnumerable<LifeEvent> recentEvents)
    {
        LifeEvent[] candidates = recentEvents
            .Where(lifeEvent => string.IsNullOrWhiteSpace(lifeEvent.Summary) == false)
            .Where(lifeEvent => lifeEvent.IsPersisted == false)
            .Where(lifeEvent => persistedEventIds.Contains(lifeEvent.Id) == false)
            .Where(lifeEvent => lastPersistedEventTimestamp == null || lifeEvent.Timestamp > lastPersistedEventTimestamp || string.IsNullOrWhiteSpace(lifeEvent.Id) == false)
            .OrderBy(lifeEvent => lifeEvent.Timestamp)
            .ToArray();

        LifeEvent[] directlyMeaningful = candidates
            .Where(IsDirectlyMeaningful)
            .ToArray();

        if (directlyMeaningful.Length > 0)
        {
            DateTimeOffset first = directlyMeaningful.First().Timestamp;
            DateTimeOffset last = directlyMeaningful.Last().Timestamp;
            return candidates
                .Where(lifeEvent => lifeEvent.Timestamp >= first && lifeEvent.Timestamp <= last)
                .Where(lifeEvent => lifeEvent.Kind != LifeEventKind.Body || directlyMeaningful.Length > 1)
                .ToArray();
        }

        LifeEvent[] actionCluster = candidates
            .Where(lifeEvent => lifeEvent.Kind is LifeEventKind.Action or LifeEventKind.Voice)
            .ToArray();
        return actionCluster.Length >= 2 ? actionCluster : [];
    }

    static bool IsDirectlyMeaningful(LifeEvent lifeEvent)
    {
        return lifeEvent.Kind is LifeEventKind.Communication
            or LifeEventKind.Browser
            or LifeEventKind.Memory
            or LifeEventKind.Sense;
    }

    static string BuildSummary(IReadOnlyList<LifeEvent> events, DateTime startTime, DateTime endTime)
    {
        StringBuilder builder = new();
        builder.Append("Autobiographical memory from ");
        builder.Append(startTime.ToString("yyyy-MM-dd HH:mm"));
        builder.Append(" to ");
        builder.Append(endTime.ToString("yyyy-MM-dd HH:mm"));
        builder.AppendLine(":");

        foreach (LifeEvent lifeEvent in events.Take(5))
            builder.AppendLine("- " + lifeEvent.Summary.Trim());

        return builder.ToString().TrimEnd();
    }

    static string BuildContent(IReadOnlyList<LifeEvent> events, DateTime startTime, DateTime endTime)
    {
        StringBuilder builder = new();
        builder.AppendLine("You formed an autobiographical memory from recent lived experiences.");
        builder.Append("Time range: ");
        builder.Append(startTime.ToString("yyyy-MM-dd HH:mm"));
        builder.Append(" to ");
        builder.Append(endTime.ToString("yyyy-MM-dd HH:mm"));
        builder.AppendLine(".");
        builder.AppendLine("Events:");

        foreach (LifeEvent lifeEvent in events)
        {
            builder.Append("- [");
            builder.Append(lifeEvent.Kind);
            builder.Append('/');
            builder.Append(string.IsNullOrWhiteSpace(lifeEvent.Source) ? "Unknown" : lifeEvent.Source.Trim());
            builder.Append("] ");
            builder.AppendLine(lifeEvent.Summary.Trim());
        }

        return builder.ToString().TrimEnd();
    }
}
