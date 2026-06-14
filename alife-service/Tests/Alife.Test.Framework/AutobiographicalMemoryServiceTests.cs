using Alife.Framework;
using Alife.Function.Memory;

namespace Alife.Test.Framework;

public class AutobiographicalMemoryServiceTests
{
    [Test]
    public async Task RememberRecentLife_NoEventsDoesNotWriteMemory()
    {
        FakeLifeEventStream stream = new();
        FakeMemorySink sink = new();
        AutobiographicalMemoryService service = new(stream, sink);

        string? result = await service.RememberRecentLifeAsync();

        Assert.That(result, Is.Null);
        Assert.That(sink.Writes, Is.Empty);
    }

    [Test]
    public async Task RememberRecentLife_BodyOnlyEventDoesNotWriteMemory()
    {
        FakeLifeEventStream stream = new();
        stream.Publish(Event(LifeEventKind.Body, "DeskPet", "Your desk-pet body played expression: smile."));
        FakeMemorySink sink = new();
        AutobiographicalMemoryService service = new(stream, sink);

        string? result = await service.RememberRecentLifeAsync();

        Assert.That(result, Is.Null);
        Assert.That(sink.Writes, Is.Empty);
    }

    [Test]
    public async Task RememberRecentLife_MeaningfulEventsWriteOneAutobiographicalMemory()
    {
        FakeLifeEventStream stream = new();
        stream.Publish(Event(LifeEventKind.Browser, "Browser", "You opened a browser page: https://example.com", minute: 1));
        stream.Publish(Event(LifeEventKind.Communication, "QChat", "You sent a QQ group message to 123456.", minute: 2));
        FakeMemorySink sink = new();
        AutobiographicalMemoryService service = new(stream, sink);

        string? result = await service.RememberRecentLifeAsync();

        Assert.That(result, Is.EqualTo("memory-1"));
        Assert.That(sink.Writes, Has.Count.EqualTo(1));
        Assert.That(sink.Writes[0].Summary, Does.Contain("Autobiographical memory"));
        Assert.That(sink.Writes[0].Summary, Does.Contain("You opened a browser page"));
        Assert.That(sink.Writes[0].Content, Does.Contain("[Browser/Browser] You opened a browser page: https://example.com"));
        Assert.That(sink.Writes[0].Content, Does.Contain("[Communication/QChat] You sent a QQ group message to 123456."));
        Assert.That(sink.Writes[0].StartTime, Is.EqualTo(new DateTime(2026, 6, 14, 10, 1, 0)));
        Assert.That(sink.Writes[0].EndTime, Is.EqualTo(new DateTime(2026, 6, 14, 10, 2, 0)));
    }

    [Test]
    public async Task RememberRecentLife_DoesNotWriteSameEventsTwice()
    {
        FakeLifeEventStream stream = new();
        stream.Publish(Event(LifeEventKind.Browser, "Browser", "You observed a page.", minute: 1));
        FakeMemorySink sink = new();
        AutobiographicalMemoryService service = new(stream, sink);

        await service.RememberRecentLifeAsync();
        string? second = await service.RememberRecentLifeAsync();

        Assert.That(second, Is.Null);
        Assert.That(sink.Writes, Has.Count.EqualTo(1));
    }

    [Test]
    public async Task RememberRecentLife_WritesNewEventsAfterPreviousMemory()
    {
        FakeLifeEventStream stream = new();
        stream.Publish(Event(LifeEventKind.Browser, "Browser", "You observed a page.", minute: 1));
        FakeMemorySink sink = new();
        AutobiographicalMemoryService service = new(stream, sink);

        await service.RememberRecentLifeAsync();
        stream.Publish(Event(LifeEventKind.Communication, "QChat", "You sent a QQ private message.", minute: 3));
        string? second = await service.RememberRecentLifeAsync();

        Assert.That(second, Is.EqualTo("memory-2"));
        Assert.That(sink.Writes, Has.Count.EqualTo(2));
        Assert.That(sink.Writes[1].Content, Does.Contain("You sent a QQ private message."));
        Assert.That(sink.Writes[1].Content, Does.Not.Contain("You observed a page."));
    }

    static LifeEvent Event(LifeEventKind kind, string source, string summary, int minute = 0)
    {
        return new LifeEvent(
            new DateTimeOffset(2026, 6, 14, 10, minute, 0, TimeSpan.Zero),
            kind,
            source,
            summary);
    }

    sealed class FakeLifeEventStream : ILifeEventStream
    {
        readonly List<LifeEvent> events = new();

        public void Publish(LifeEvent lifeEvent)
        {
            events.Add(lifeEvent);
        }

        public IReadOnlyList<LifeEvent> GetRecentEvents(int maxCount)
        {
            return events
                .OrderBy(lifeEvent => lifeEvent.Timestamp)
                .TakeLast(maxCount)
                .ToArray();
        }
    }

    sealed class FakeMemorySink : IAutobiographicalMemorySink
    {
        public List<Write> Writes { get; } = new();

        public Task<string> InsertAutobiographicalMemoryAsync(
            string summary,
            string content,
            DateTime startTime,
            DateTime endTime,
            CancellationToken cancellationToken = default)
        {
            Writes.Add(new Write(summary, content, startTime, endTime));
            return Task.FromResult($"memory-{Writes.Count}");
        }
    }

    sealed record Write(string Summary, string Content, DateTime StartTime, DateTime EndTime);
}
