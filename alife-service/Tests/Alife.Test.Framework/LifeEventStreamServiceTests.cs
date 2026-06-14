using System.Reflection;
using Alife.Framework;
using Alife.Function.MessageFilter;

namespace Alife.Test.Framework;

public class LifeEventStreamServiceTests
{
    [Test]
    public void Publish_KeepsNewestEventsInChronologicalOrder()
    {
        LifeEventStreamService stream = new(maxRetainedEvents: 2);

        stream.Publish(new LifeEvent(new DateTimeOffset(2026, 6, 14, 10, 0, 0, TimeSpan.Zero), LifeEventKind.Body, "DeskPet", "first"));
        stream.Publish(new LifeEvent(new DateTimeOffset(2026, 6, 14, 10, 1, 0, TimeSpan.Zero), LifeEventKind.Voice, "Speech", "second"));
        stream.Publish(new LifeEvent(new DateTimeOffset(2026, 6, 14, 10, 2, 0, TimeSpan.Zero), LifeEventKind.Action, "Act", "third"));

        IReadOnlyList<LifeEvent> events = stream.GetRecentEvents(10);

        Assert.That(events.Select(e => e.Summary), Is.EqualTo(new[] { "second", "third" }));
    }

    [Test]
    public void Publish_IgnoresWhitespaceSummaries()
    {
        LifeEventStreamService stream = new();

        stream.Publish(new LifeEvent(DateTimeOffset.UtcNow, LifeEventKind.Action, "Act", "   "));

        Assert.That(stream.GetRecentEvents(10), Is.Empty);
    }

    [Test]
    public void Constructor_LoadsPersistedEventsFromStore()
    {
        string rootPath = CreateTempRoot();
        LifeEvent original = new(
            new DateTimeOffset(2026, 6, 14, 10, 5, 0, TimeSpan.Zero),
            LifeEventKind.Browser,
            "Browser",
            "You opened a page.")
        {
            Id = "event-1",
            Importance = 3,
            Privacy = LifeEventPrivacy.Private
        };

        LifeEventStreamService first = new(storagePath: rootPath);
        first.Publish(original);

        LifeEventStreamService second = new(storagePath: rootPath);
        LifeEvent reloaded = second.GetRecentEvents(10).Single();

        Assert.That(reloaded.Id, Is.EqualTo("event-1"));
        Assert.That(reloaded.Importance, Is.EqualTo(3));
        Assert.That(reloaded.Privacy, Is.EqualTo(LifeEventPrivacy.Private));
        Assert.That(reloaded.Summary, Is.EqualTo("You opened a page."));
    }

    [Test]
    public void MarkPersisted_UpdatesEventsAndSurvivesReload()
    {
        string rootPath = CreateTempRoot();
        LifeEventStreamService stream = new(storagePath: rootPath);
        stream.Publish(new LifeEvent(DateTimeOffset.UtcNow, LifeEventKind.Browser, "Browser", "event")
        {
            Id = "event-2"
        });

        stream.MarkPersisted(["event-2"]);

        LifeEventStreamService reloaded = new(storagePath: rootPath);
        Assert.That(reloaded.GetRecentEvents(10).Single().IsPersisted, Is.True);
    }

    [Test]
    public void FormatRecentExperiences_ReturnsEmptyForNoEvents()
    {
        string formatted = LifeEventStreamService.FormatRecentExperiences([], maxCount: 5);

        Assert.That(formatted, Is.Empty);
    }

    [Test]
    public void FormatRecentExperiences_TruncatesLongSummaries()
    {
        LifeEvent[] events = [
            new(new DateTimeOffset(2026, 6, 14, 10, 3, 0, TimeSpan.Zero), LifeEventKind.Browser, "Browser", new string('a', 80))
        ];

        string formatted = LifeEventStreamService.FormatRecentExperiences(events, maxCount: 5, maxSummaryLength: 20);

        Assert.That(formatted, Does.Contain("[Recent experiences]"));
        Assert.That(formatted, Does.Contain("10:03"));
        Assert.That(formatted, Does.Contain(new string('a', 20)));
        Assert.That(formatted, Does.Not.Contain(new string('a', 21)));
    }

    [Test]
    public void MessageFilter_PrependsRecentExperiencesBeforeAppendText()
    {
        LifeEventStreamService stream = new();
        stream.Publish(new LifeEvent(new DateTimeOffset(2026, 6, 14, 10, 4, 0, TimeSpan.Zero), LifeEventKind.Body, "DeskPet", "You waved."));
        MessageFilterService filter = new(stream)
        {
            Configuration = new MessageFilterData
            {
                EnableTimestamp = false,
                MessageAppend = "(reply briefly)",
                MaxMessageLength = 5000
            }
        };

        string result = InvokePrivateFilter(filter, "OnChatSend", "Hello");

        Assert.That(result, Does.StartWith("[Recent experiences]"));
        Assert.That(result, Does.Contain("- 10:04 You waved."));
        Assert.That(result, Does.Contain("[/Recent experiences]\nHello(reply briefly)"));
    }

    static string InvokePrivateFilter(MessageFilterService filter, string methodName, string message)
    {
        MethodInfo method = typeof(MessageFilterService).GetMethod(methodName, BindingFlags.Instance | BindingFlags.NonPublic)
            ?? throw new InvalidOperationException($"{methodName} was not found.");
        return (string)method.Invoke(filter, [message])!;
    }

    static string CreateTempRoot()
    {
        string rootPath = Path.Combine(Path.GetTempPath(), "alife-life-event-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(rootPath);
        return rootPath;
    }
}
