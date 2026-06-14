using Alife.Framework;

namespace Alife.Test.Framework;

public class ContextBudgetComposerTests
{
    [Test]
    public void Compose_OrdersByPriorityAndFitsBudget()
    {
        ContextContribution[] contributions = [
            new("low", "low content", Priority: 10, MaxLength: 100),
            new("high", "high content", Priority: 100, MaxLength: 100),
            new("medium", "medium content", Priority: 50, MaxLength: 100)
        ];

        string result = ContextBudgetComposer.Compose(contributions, maxLength: 80);

        Assert.That(result.IndexOf("high content", StringComparison.Ordinal), Is.LessThan(result.IndexOf("medium content", StringComparison.Ordinal)));
        Assert.That(result.IndexOf("medium content", StringComparison.Ordinal), Is.LessThan(result.IndexOf("low content", StringComparison.Ordinal)));
        Assert.That(result.Length, Is.LessThanOrEqualTo(80));
    }

    [Test]
    public void Compose_TruncatesContributionBeforeDroppingIt()
    {
        ContextContribution[] contributions = [
            new("critical", "critical", Priority: 100, MaxLength: 100),
            new("verbose", "012345678901234567890123456789", Priority: 50, MaxLength: 100)
        ];

        string result = ContextBudgetComposer.Compose(contributions, maxLength: 32);

        Assert.That(result, Does.Contain("critical"));
        Assert.That(result, Does.Contain("012345"));
        Assert.That(result, Does.Contain("..."));
        Assert.That(result.Length, Is.LessThanOrEqualTo(32));
    }

    [Test]
    public void Compose_IgnoresEmptyContributions()
    {
        string result = ContextBudgetComposer.Compose([
            new ContextContribution("empty", "   ", Priority: 100, MaxLength: 100),
            new ContextContribution("real", "real content", Priority: 10, MaxLength: 100)
        ], maxLength: 100);

        Assert.That(result, Is.EqualTo("real content"));
    }
}
