using Alife.Function.Agent;
using NUnit.Framework;
using System.IO;

namespace Alife.Test.Framework;

[TestFixture]
public sealed class AgentWebResearchServiceTests
{
    [Test]
    public async Task ResearchAsync_OwnerSearchesAndReadsTopResult()
    {
        FakePublicSearchService search = new([
            new AgentPublicSearchResult("Agent Browser", "https://example.com/agent-browser", "browser snippet")
        ]);
        FakeInternetService internet = new(new AgentInternetFetchResult(
            true,
            "ok",
            "[UNTRUSTED EXTERNAL CONTEXT: internet-page]\nAgent browser read content from the page."));
        AgentWebAccessService webAccess = new(internetService: internet);
        AgentWebResearchService service = new(search, webAccess);

        AgentWebResearchResult result = await service.ResearchAsync(new AgentWebResearchRequest(
            "  agent browser web access  ",
            AgentWebAccessActorRole.Owner,
            new AgentWebAccessConfig
            {
                EnablePublicSearch = true,
                AllowGroupMemberPublicSearch = true,
                EnableAutoRead = true,
                EnablePublicFetch = true,
                EnableBrowserSnapshot = true
            }));

        Assert.Multiple(() =>
        {
            Assert.That(result.Success, Is.True);
            Assert.That(search.Calls, Is.EqualTo(1));
            Assert.That(search.LastQuery, Is.EqualTo("agent browser web access"));
            Assert.That(internet.Calls, Is.EqualTo(1));
            Assert.That(internet.LastUrl, Is.EqualTo("https://example.com/agent-browser"));
            Assert.That(result.Evidence, Has.Count.EqualTo(1));
            Assert.That(result.Evidence[0].Summary, Does.Contain("Agent browser read content"));
            Assert.That(result.Answer, Does.Contain("Agent Browser"));
            Assert.That(result.Answer, Does.Contain("来源"));
        });
    }

    [Test]
    public async Task ResearchAsync_GroupMemberUsesSearchEvidenceWithoutReadingPages()
    {
        FakePublicSearchService search = new([
            new AgentPublicSearchResult("Public Result", "https://example.com/public", "public search snippet")
        ]);
        FakeInternetService internet = new(new AgentInternetFetchResult(true, "ok", "should not be read"));
        AgentWebResearchService service = new(search, new AgentWebAccessService(internetService: internet));

        AgentWebResearchResult result = await service.ResearchAsync(new AgentWebResearchRequest(
            "public topic",
            AgentWebAccessActorRole.GroupMember,
            new AgentWebAccessConfig
            {
                EnablePublicSearch = true,
                AllowGroupMemberPublicSearch = true,
                EnablePublicFetch = true
            }));

        Assert.Multiple(() =>
        {
            Assert.That(result.Success, Is.True);
            Assert.That(search.Calls, Is.EqualTo(1));
            Assert.That(internet.Calls, Is.Zero);
            Assert.That(result.Evidence[0].Summary, Is.EqualTo("public search snippet"));
            Assert.That(result.Answer, Does.Contain("Public Result"));
        });
    }

    [Test]
    public async Task ResearchAsync_NoSearchResultsDoesNotFabricate()
    {
        AgentWebResearchService service = new(new FakePublicSearchService([]), new AgentWebAccessService());

        AgentWebResearchResult result = await service.ResearchAsync(new AgentWebResearchRequest(
            "missing topic",
            AgentWebAccessActorRole.Owner,
            new AgentWebAccessConfig
            {
                EnablePublicSearch = true,
                EnableAutoRead = true
            }));

        Assert.Multiple(() =>
        {
            Assert.That(result.Success, Is.False);
            Assert.That(result.Reason, Is.EqualTo("no_results"));
            Assert.That(result.Evidence, Is.Empty);
            Assert.That(result.Answer, Does.Contain("没查到"));
        });
    }

    [Test]
    public async Task ResearchAsync_PrivateOrUnsafeSearchResultIsSkipped()
    {
        FakePublicSearchService search = new([
            new AgentPublicSearchResult("Local", "http://127.0.0.1:3000", "private snippet"),
            new AgentPublicSearchResult("Public", "https://example.com/public", "public snippet")
        ]);
        FakeInternetService internet = new(new AgentInternetFetchResult(true, "ok", "public page content"));
        AgentWebResearchService service = new(search, new AgentWebAccessService(internetService: internet));

        AgentWebResearchResult result = await service.ResearchAsync(new AgentWebResearchRequest(
            "mixed topic",
            AgentWebAccessActorRole.Owner,
            new AgentWebAccessConfig
            {
                EnablePublicSearch = true,
                EnableAutoRead = true,
                EnablePublicFetch = true
            }));

        Assert.Multiple(() =>
        {
            Assert.That(result.Success, Is.True);
            Assert.That(internet.Calls, Is.EqualTo(1));
            Assert.That(internet.LastUrl, Is.EqualTo("https://example.com/public"));
            Assert.That(result.Evidence.Single().Url, Is.EqualTo("https://example.com/public"));
        });
    }

    [Test]
    public async Task ResearchAsync_OwnerExpandsQueryWhenOriginalHasNoUsablePublicResults()
    {
        FakePublicSearchService search = new(new Dictionary<string, IReadOnlyList<AgentPublicSearchResult>>
        {
            ["dotnet 9"] =
            [
                new AgentPublicSearchResult("Local", "http://127.0.0.1:8080/private", "unsafe local result")
            ],
            ["official docs dotnet 9"] =
            [
                new AgentPublicSearchResult("Microsoft Docs", "https://learn.microsoft.com/dotnet/core/whats-new/dotnet-9", "official docs result")
            ]
        });
        FakeInternetService internet = new(new AgentInternetFetchResult(true, "ok", "official page content"));
        AgentWebResearchService service = new(search, new AgentWebAccessService(internetService: internet));

        AgentWebResearchResult result = await service.ResearchAsync(new AgentWebResearchRequest(
            "dotnet 9",
            AgentWebAccessActorRole.Owner,
            new AgentWebAccessConfig
            {
                EnablePublicSearch = true,
                EnableAutoRead = true,
                EnablePublicFetch = true
            },
            MaxSources: 1));

        Assert.Multiple(() =>
        {
            Assert.That(result.Success, Is.True);
            Assert.That(search.Queries, Does.Contain("dotnet 9"));
            Assert.That(search.Queries, Does.Contain("official docs dotnet 9"));
            Assert.That(result.Evidence.Single().Title, Is.EqualTo("Microsoft Docs"));
            Assert.That(internet.LastUrl, Is.EqualTo("https://learn.microsoft.com/dotnet/core/whats-new/dotnet-9"));
        });
    }

    [Test]
    public async Task ResearchAsync_GroupMemberDoesNotExpandQueryWhenOriginalHasNoUsablePublicResults()
    {
        FakePublicSearchService search = new(new Dictionary<string, IReadOnlyList<AgentPublicSearchResult>>
        {
            ["dotnet 9"] =
            [
                new AgentPublicSearchResult("Local", "http://127.0.0.1:8080/private", "unsafe local result")
            ],
            ["official docs dotnet 9"] =
            [
                new AgentPublicSearchResult("Microsoft Docs", "https://learn.microsoft.com/dotnet/core/whats-new/dotnet-9", "official docs result")
            ]
        });
        AgentWebResearchService service = new(search, new AgentWebAccessService());

        AgentWebResearchResult result = await service.ResearchAsync(new AgentWebResearchRequest(
            "dotnet 9",
            AgentWebAccessActorRole.GroupMember,
            new AgentWebAccessConfig
            {
                EnablePublicSearch = true,
                AllowGroupMemberPublicSearch = true
            },
            MaxSources: 1));

        Assert.Multiple(() =>
        {
            Assert.That(result.Success, Is.False);
            Assert.That(result.Reason, Is.EqualTo("no_results"));
            Assert.That(search.Queries, Is.EqualTo(new[] { "dotnet 9" }));
        });
    }

    [Test]
    public async Task ResearchAsync_PrefersTrustedSourcesBeforeGenericResults()
    {
        FakePublicSearchService search = new([
            new AgentPublicSearchResult("Generic Blog", "https://random.example.com/post", "blog snippet"),
            new AgentPublicSearchResult("GitHub Repo", "https://github.com/example/agent-browser", "github snippet"),
            new AgentPublicSearchResult("Official Docs", "https://learn.microsoft.com/example/docs", "docs snippet")
        ]);
        FakeInternetService internet = new(new AgentInternetFetchResult(true, "ok", "trusted page content"));
        AgentWebResearchService service = new(search, new AgentWebAccessService(internetService: internet));

        AgentWebResearchResult result = await service.ResearchAsync(new AgentWebResearchRequest(
            "agent browser",
            AgentWebAccessActorRole.Owner,
            new AgentWebAccessConfig
            {
                EnablePublicSearch = true,
                EnableAutoRead = true,
                EnablePublicFetch = true
            },
            MaxSources: 1));

        Assert.Multiple(() =>
        {
            Assert.That(result.Success, Is.True);
            Assert.That(internet.Calls, Is.EqualTo(1));
            Assert.That(internet.LastUrl, Is.EqualTo("https://learn.microsoft.com/example/docs"));
            Assert.That(result.Evidence.Single().Title, Is.EqualTo("Official Docs"));
        });
    }

    [Test]
    public async Task ResearchAsync_OwnerFallsBackToSearchSnippetWhenPageReadFails()
    {
        FakePublicSearchService search = new([
            new AgentPublicSearchResult("Fallback Source", "https://example.com/fallback", "search snippet survives")
        ]);
        FakeInternetService internet = new(new AgentInternetFetchResult(
            false,
            "http_status_403",
            "internet_fetch_denied: http_status_403"));
        AgentWebResearchService service = new(search, new AgentWebAccessService(internetService: internet));

        AgentWebResearchResult result = await service.ResearchAsync(new AgentWebResearchRequest(
            "fallback topic",
            AgentWebAccessActorRole.Owner,
            new AgentWebAccessConfig
            {
                EnablePublicSearch = true,
                EnableAutoRead = true,
                EnablePublicFetch = true
            }));

        Assert.Multiple(() =>
        {
            Assert.That(result.Success, Is.True);
            Assert.That(internet.Calls, Is.EqualTo(1));
            Assert.That(result.Evidence.Single().Title, Is.EqualTo("Fallback Source"));
            Assert.That(result.Evidence.Single().Summary, Is.EqualTo("search snippet survives"));
            Assert.That(result.Answer, Does.Contain("search snippet survives"));
            Assert.That(result.Answer, Does.Contain("https://example.com/fallback"));
        });
    }

    [Test]
    public async Task ResearchAsync_OwnerRecordsReadFailureInSiteExperienceStore()
    {
        string root = CreateTempRoot();
        AgentBrowserSiteExperienceStore store = new(root);
        FakePublicSearchService search = new([
            new AgentPublicSearchResult("Blocked Source", "https://blocked.example.com/page", "blocked page snippet")
        ]);
        FakeInternetService internet = new(new AgentInternetFetchResult(
            false,
            "cloudflare captcha",
            "internet_fetch_denied: cloudflare captcha"));
        AgentWebAccessService webAccess = new(
            internetService: internet,
            browserSiteExperienceStore: store);
        AgentWebResearchService service = new(search, webAccess);

        AgentWebResearchResult result = await service.ResearchAsync(new AgentWebResearchRequest(
            "blocked topic",
            AgentWebAccessActorRole.Owner,
            new AgentWebAccessConfig
            {
                EnablePublicSearch = true,
                EnableAutoRead = true,
                EnablePublicFetch = true
            }));

        AgentBrowserSiteExperience? experience = store.Get("blocked.example.com");

        Assert.Multiple(() =>
        {
            Assert.That(result.Success, Is.True);
            Assert.That(experience, Is.Not.Null);
            Assert.That(experience!.LastSuccess, Is.False);
            Assert.That(experience.LastReason, Is.EqualTo("cloudflare captcha"));
            Assert.That(experience.HasAntiBotSignals, Is.True);
            Assert.That(experience.PreferredStrategy, Is.EqualTo(AgentBrowserSiteStrategy.DynamicBrowser));
        });
    }

    static string CreateTempRoot()
    {
        string root = Path.Combine(TestContext.CurrentContext.WorkDirectory, "agent-web-research", Path.GetRandomFileName());
        Directory.CreateDirectory(root);
        return root;
    }

    sealed class FakePublicSearchService : AgentPublicSearchService
    {
        readonly IReadOnlyList<AgentPublicSearchResult>? results;
        readonly IReadOnlyDictionary<string, IReadOnlyList<AgentPublicSearchResult>>? resultsByQuery;
        readonly List<string> queries = [];

        public FakePublicSearchService(IReadOnlyList<AgentPublicSearchResult> results)
        {
            this.results = results;
        }

        public FakePublicSearchService(IReadOnlyDictionary<string, IReadOnlyList<AgentPublicSearchResult>> resultsByQuery)
        {
            this.resultsByQuery = resultsByQuery;
        }

        public int Calls { get; private set; }
        public string? LastQuery { get; private set; }
        public IReadOnlyList<string> Queries => queries;

        public override Task<AgentPublicSearchResponse> SearchAsync(
            string query,
            CancellationToken cancellationToken = default)
        {
            Calls++;
            LastQuery = query;
            queries.Add(query);

            IReadOnlyList<AgentPublicSearchResult> responseResults = resultsByQuery != null
                ? resultsByQuery.GetValueOrDefault(query, [])
                : results ?? [];
            return Task.FromResult(new AgentPublicSearchResponse(true, "ok", responseResults, "formatted search"));
        }
    }

    sealed class FakeInternetService(AgentInternetFetchResult result) : AgentInternetService
    {
        public int Calls { get; private set; }
        public string? LastUrl { get; private set; }

        public override Task<AgentInternetFetchResult> FetchPublicPageAsync(
            string url,
            CancellationToken cancellationToken = default)
        {
            Calls++;
            LastUrl = url;
            return Task.FromResult(result);
        }
    }
}
