using Alife.Function.Interpreter;

[TestFixture]
public class XmlFunctionPolicyTests
{
    [Test]
    public void Handle_BlocksHighRiskFunctionByDefault()
    {
        PolicyHandler handler = new();
        XmlHandlerTable table = new();
        table.Register(new XmlHandler(handler));

        XmlContext context = OneShotContext();
        InvalidOperationException? exception = Assert.ThrowsAsync<InvalidOperationException>(
            async () => await table.Handle("deletefile", context));

        Assert.That(exception!.Message, Does.Contain("high-risk"));
        Assert.That(handler.DeleteCalls, Is.Zero);
    }

    [Test]
    public async Task Handle_BlocksFunctionWhenTurnBudgetIsExhausted()
    {
        PolicyHandler handler = new();
        XmlHandlerTable table = new();
        table.ExecutionPolicy.MaxBudgetPerTurn = 2;
        table.Register(new XmlHandler(handler));

        XmlContext context = OneShotContext();
        await table.Handle("ping", context);
        await table.Handle("ping", context);

        InvalidOperationException? exception = Assert.ThrowsAsync<InvalidOperationException>(
            async () => await table.Handle("ping", context));

        Assert.That(exception!.Message, Does.Contain("budget"));
        Assert.That(handler.PingCalls, Is.EqualTo(2));

        table.ExecutionPolicy.ResetTurnBudget();
        await table.Handle("ping", context);
        Assert.That(handler.PingCalls, Is.EqualTo(3));
    }

    [Test]
    public async Task Handle_AllowsHighRiskFunctionOnlyWhenAuthorizerApproves()
    {
        PolicyHandler handler = new();
        XmlHandlerTable table = new();
        table.ExecutionPolicy.MaxBudgetPerTurn = 1;
        table.ExecutionPolicy.AuthorizeHighRiskFunction = function =>
            function.Name == "deletefile"
                ? new XmlFunctionExecutionDecision(true, "approved")
                : new XmlFunctionExecutionDecision(false, "denied");
        table.Register(new XmlHandler(handler));

        XmlContext context = OneShotContext();
        await table.Handle("deletefile", context);

        Assert.That(handler.DeleteCalls, Is.EqualTo(1));
        Assert.That(table.ExecutionPolicy.BudgetUsedThisTurn, Is.EqualTo(1));
        InvalidOperationException? exception = Assert.ThrowsAsync<InvalidOperationException>(
            async () => await table.Handle("deletefile", context));
        Assert.That(exception!.Message, Does.Contain("budget"));
        Assert.That(handler.DeleteCalls, Is.EqualTo(1));
    }

    static XmlContext OneShotContext() => new()
    {
        CallMode = CallMode.OneShot,
        Parameters = new Dictionary<string, string>(),
    };

    sealed class PolicyHandler
    {
        public int DeleteCalls { get; private set; }
        public int PingCalls { get; private set; }

        [XmlFunction(FunctionMode.OneShot, riskLevel: XmlFunctionRiskLevel.High)]
        public void DeleteFile()
        {
            DeleteCalls++;
        }

        [XmlFunction(FunctionMode.OneShot)]
        public void Ping()
        {
            PingCalls++;
        }
    }
}
