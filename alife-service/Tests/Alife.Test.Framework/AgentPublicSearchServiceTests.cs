using Alife.Function.Agent;
using NUnit.Framework;

namespace Alife.Test.Framework;

[TestFixture]
public sealed class AgentPublicSearchServiceTests
{
    [Test]
    public async Task SearchAsync_WhenDisabled_DoesNotCallProvider()
    {
        FakePublicSearchProvider provider = new();
        AgentPublicSearchService service = new(
            new AgentPublicSearchConfig { EnablePublicSearch = false },
            provider);

        AgentPublicSearchResponse response = await service.SearchAsync("test");

        Assert.Multiple(() =>
        {
            Assert.That(response.Success, Is.False);
            Assert.That(response.Reason, Is.EqualTo("public_search_disabled"));
            Assert.That(provider.Calls, Is.Zero);
        });
    }

    [Test]
    public async Task SearchAsync_LimitsResultsAndWrapsAsUntrusted()
    {
        FakePublicSearchProvider provider = new(
            new AgentPublicSearchResult("One", "https://example.com/1", "first"),
            new AgentPublicSearchResult("Two", "https://example.com/2", "second"),
            new AgentPublicSearchResult("Three", "https://example.com/3", "third"));
        AgentPublicSearchService service = new(
            new AgentPublicSearchConfig
            {
                EnablePublicSearch = true,
                MaxResults = 2
            },
            provider);

        AgentPublicSearchResponse response = await service.SearchAsync("example");

        Assert.Multiple(() =>
        {
            Assert.That(response.Success, Is.True);
            Assert.That(response.Results, Has.Count.EqualTo(2));
            Assert.That(response.FormattedContent, Does.Contain("[UNTRUSTED EXTERNAL CONTEXT: public-search]"));
            Assert.That(response.FormattedContent, Does.Contain("https://example.com/1"));
            Assert.That(response.FormattedContent, Does.Not.Contain("https://example.com/3"));
        });
    }

    [Test]
    public async Task SearchAsync_PassesNormalizedQueryAndClampedMaxResultsToProvider()
    {
        FakePublicSearchProvider provider = new(
            new AgentPublicSearchResult("One", "https://example.com/1", "first"));
        AgentPublicSearchService service = new(
            new AgentPublicSearchConfig
            {
                EnablePublicSearch = true,
                MaxQueryChars = 7,
                MaxResults = 0
            },
            provider);

        AgentPublicSearchResponse response = await service.SearchAsync("   abcdefghij   ");

        Assert.Multiple(() =>
        {
            Assert.That(response.Success, Is.True);
            Assert.That(provider.LastQuery, Is.EqualTo("abcdefg"));
            Assert.That(provider.LastMaxResults, Is.EqualTo(1));
        });
    }

    [Test]
    public async Task SearchAsync_WhenSuccessful_RecordsAgentAuditSuccess()
    {
        FakePublicSearchProvider provider = new(
            new AgentPublicSearchResult("One", "https://example.com/1", "first"));
        AgentAuditLogService audit = new(CreateAuditPath());
        AgentPublicSearchService service = new(
            new AgentPublicSearchConfig { EnablePublicSearch = true },
            provider,
            audit);

        AgentPublicSearchResponse response = await service.SearchAsync("example");

        AgentAuditLogEntry entry = audit.GetRecentEntries(10).Single();
        Assert.Multiple(() =>
        {
            Assert.That(response.Success, Is.True);
            Assert.That(entry.Action, Is.EqualTo("agent.public_search"));
            Assert.That(entry.Actor, Is.EqualTo("agent"));
            Assert.That(entry.Succeeded, Is.True);
            Assert.That(entry.Error, Is.Null);
        });
    }

    [TestCase("")]
    [TestCase("   ")]
    public async Task SearchAsync_WhenQueryEmpty_DoesNotCallProvider(string query)
    {
        FakePublicSearchProvider provider = new();
        AgentPublicSearchService service = new(
            new AgentPublicSearchConfig { EnablePublicSearch = true },
            provider);

        AgentPublicSearchResponse response = await service.SearchAsync(query);

        Assert.Multiple(() =>
        {
            Assert.That(response.Success, Is.False);
            Assert.That(response.Reason, Is.EqualTo("empty_query"));
            Assert.That(provider.Calls, Is.Zero);
        });
    }

    [Test]
    public async Task SearchAsync_WhenQueryEmpty_RecordsAgentAuditFailure()
    {
        FakePublicSearchProvider provider = new();
        AgentAuditLogService audit = new(CreateAuditPath());
        AgentPublicSearchService service = new(
            new AgentPublicSearchConfig { EnablePublicSearch = true },
            provider,
            audit);

        AgentPublicSearchResponse response = await service.SearchAsync("   ");

        AgentAuditLogEntry entry = audit.GetRecentEntries(10).Single();
        Assert.Multiple(() =>
        {
            Assert.That(response.Success, Is.False);
            Assert.That(response.Reason, Is.EqualTo("empty_query"));
            Assert.That(entry.Action, Is.EqualTo("agent.public_search"));
            Assert.That(entry.Actor, Is.EqualTo("agent"));
            Assert.That(entry.Succeeded, Is.False);
            Assert.That(entry.Error, Is.EqualTo("empty_query"));
        });
    }

    [Test]
    public async Task SearchAsync_WhenProviderMissing_ReturnsNotConfigured()
    {
        AgentPublicSearchService service = new(
            new AgentPublicSearchConfig { EnablePublicSearch = true },
            provider: null);

        AgentPublicSearchResponse response = await service.SearchAsync("example");

        Assert.Multiple(() =>
        {
            Assert.That(response.Success, Is.False);
            Assert.That(response.Reason, Is.EqualTo("search_provider_not_configured"));
        });
    }

    [Test]
    public async Task SearchAsync_WhenProviderThrows_ReturnsFailureAndRecordsAuditFailure()
    {
        FakePublicSearchProvider provider = new(exception: new InvalidOperationException("provider offline"));
        AgentAuditLogService audit = new(CreateAuditPath());
        AgentPublicSearchService service = new(
            new AgentPublicSearchConfig { EnablePublicSearch = true },
            provider,
            audit);

        AgentPublicSearchResponse response = await service.SearchAsync("example");

        AgentAuditLogEntry entry = audit.GetRecentEntries(10).Single();
        Assert.Multiple(() =>
        {
            Assert.That(response.Success, Is.False);
            Assert.That(response.Reason, Is.EqualTo("search_failed"));
            Assert.That(entry.Action, Is.EqualTo("agent.public_search"));
            Assert.That(entry.Actor, Is.EqualTo("agent"));
            Assert.That(entry.Succeeded, Is.False);
            Assert.That(entry.Error, Is.EqualTo("search_failed"));
        });
    }

    static string CreateAuditPath() => Path.Combine(
        TestContext.CurrentContext.WorkDirectory,
        "agent-public-search-audit",
        $"{Guid.NewGuid():N}.jsonl");

    sealed class FakePublicSearchProvider : IAgentPublicSearchProvider
    {
        readonly AgentPublicSearchResult[] results;
        readonly Exception? exception;

        public FakePublicSearchProvider(params AgentPublicSearchResult[] results)
        {
            this.results = results;
        }

        public FakePublicSearchProvider(Exception exception)
        {
            results = [];
            this.exception = exception;
        }

        public int Calls { get; private set; }
        public string? LastQuery { get; private set; }
        public int? LastMaxResults { get; private set; }

        public Task<IReadOnlyList<AgentPublicSearchResult>> SearchAsync(
            string query,
            int maxResults,
            CancellationToken cancellationToken = default)
        {
            Calls++;
            LastQuery = query;
            LastMaxResults = maxResults;
            if (exception != null)
                throw exception;

            return Task.FromResult<IReadOnlyList<AgentPublicSearchResult>>(results.ToArray());
        }
    }
}
