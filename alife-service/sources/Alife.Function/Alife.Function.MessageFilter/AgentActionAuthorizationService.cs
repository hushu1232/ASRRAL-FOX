using Alife.Function.Interpreter;

namespace Alife.Function.Agent;

public class AgentActionAuthorizationService
{
    public XmlFunctionExecutionDecision AuthorizeXmlFunction(
        XmlFunction function,
        AgentPermissionRequest request,
        AgentPermissionConfig config)
    {
        AgentPermissionPolicy policy = new(config);
        AgentPermissionDecision decision = policy.Evaluate(request with {
            RiskLevel = ToAgentRiskLevel(function.RiskLevel),
            Action = $"xml.{function.Name}"
        });

        return new XmlFunctionExecutionDecision(decision.Allowed, decision.Reason);
    }

    public static AgentRiskLevel ToAgentRiskLevel(XmlFunctionRiskLevel riskLevel) => riskLevel switch {
        XmlFunctionRiskLevel.High => AgentRiskLevel.High,
        XmlFunctionRiskLevel.Medium => AgentRiskLevel.Medium,
        _ => AgentRiskLevel.Low,
    };
}
