using System;
using System.Threading.Tasks;

namespace Alife.Function.Agent;

public sealed record AgentActionGatewayResult<T>(
    bool Executed,
    T? Value,
    AgentExecutionGatewayDecision Decision,
    string Message,
    Exception? Exception = null);

public class AgentActionGatewayService(
    AgentAuditLogService? auditLog = null,
    AgentActionAuthorizationService? authorization = null)
{
    readonly AgentAuditLogService? auditLog = auditLog;
    readonly AgentActionAuthorizationService authorization = authorization ?? new AgentActionAuthorizationService();

    public async Task<AgentActionGatewayResult<T>> ExecuteAsync<T>(
        AgentPermissionRequest request,
        AgentPermissionConfig config,
        Func<Task<T>> execute,
        string detail = "")
    {
        ArgumentNullException.ThrowIfNull(config);
        ArgumentNullException.ThrowIfNull(execute);

        AgentExecutionGatewayDecision decision = authorization.EvaluateExecution(request, config);
        string action = decision.Action;
        string actor = DescribeActor(request, decision);
        string normalizedDetail = detail?.Trim() ?? string.Empty;

        if (decision.AllowedNow == false)
        {
            string prefix = decision.Status == AgentExecutionDecisionStatus.OwnerConfirmationRequired
                ? "Owner confirmation required"
                : "Blocked";
            string message = $"{prefix}: {decision.Reason}";
            Record(action, actor, normalizedDetail, decision.RiskLevel, succeeded: false, error: message);
            return new AgentActionGatewayResult<T>(false, default, decision, message);
        }

        try
        {
            T value = await execute();
            string message = $"Executed: {decision.Reason}";
            Record(action, actor, normalizedDetail, decision.RiskLevel, succeeded: true);
            return new AgentActionGatewayResult<T>(true, value, decision, message);
        }
        catch (Exception exception)
        {
            string message = $"Failed: {exception.Message}";
            Record(action, actor, normalizedDetail, decision.RiskLevel, succeeded: false, error: message);
            return new AgentActionGatewayResult<T>(false, default, decision, message, exception);
        }
    }

    void Record(string action, string actor, string detail, AgentRiskLevel riskLevel, bool succeeded, string? error = null)
    {
        auditLog?.Record(
            action,
            actor,
            detail,
            ToAuditRiskLevel(riskLevel),
            succeeded,
            error);
    }

    static AgentAuditRiskLevel ToAuditRiskLevel(AgentRiskLevel riskLevel)
    {
        return riskLevel switch
        {
            AgentRiskLevel.Low => AgentAuditRiskLevel.Low,
            AgentRiskLevel.Medium => AgentAuditRiskLevel.Medium,
            _ => AgentAuditRiskLevel.High
        };
    }

    static string DescribeActor(AgentPermissionRequest request, AgentExecutionGatewayDecision decision)
    {
        string prefix = decision.Priority switch
        {
            AgentActorPriority.Owner => "owner",
            AgentActorPriority.System => "system",
            AgentActorPriority.GroupParticipant => "group",
            _ => "guest"
        };

        return request.ActorUserId == null ? prefix : $"{prefix}:{request.ActorUserId.Value}";
    }
}
