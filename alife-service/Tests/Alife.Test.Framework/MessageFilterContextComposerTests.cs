using Alife.Framework;
using Alife.Function.MessageFilter;

namespace Alife.Test.Framework;

public class MessageFilterContextComposerTests
{
    [Test]
    public void FormatChatMessage_ComposesContributorContextWithinBudget()
    {
        MessageFilterService service = new(
            contextContributors: [
                new StubContextContributor(new ContextContribution("self", "self context", Priority: 1000, MaxLength: 100)),
                new StubContextContributor(new ContextContribution("low", "low context should be trimmed", Priority: 10, MaxLength: 100))
            ])
        {
            Configuration = new MessageFilterData
            {
                EnableTimestamp = false,
                MessageAppend = "",
                MaxContextLength = 24,
                MaxMessageLength = 200
            }
        };

        string result = service.FormatChatMessage("hello");

        Assert.That(result, Does.StartWith("self context"));
        Assert.That(result, Does.Contain("low cont..."));
        Assert.That(result, Does.EndWith("hello"));
        Assert.That(result.IndexOf("self context", StringComparison.Ordinal), Is.LessThan(result.IndexOf("low cont...", StringComparison.Ordinal)));
    }

    sealed class StubContextContributor(ContextContribution contribution) : IContextContributor
    {
        public IEnumerable<ContextContribution> GetContextContributions()
        {
            return [contribution];
        }
    }
}
