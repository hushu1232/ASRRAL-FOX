using System;
using System.Collections.Concurrent;
using System.Threading;

namespace Alife.Function.MessageFilter;

public enum AgentApprovalRisk
{
    Low,
    Medium,
    High
}

public enum AgentApprovalStatus
{
    Pending,
    Approved,
    Denied,
    Expired
}

public sealed record AgentApprovalRequest(
    long Id,
    long OwnerUserId,
    string Title,
    AgentApprovalRisk Risk,
    string Summary,
    DateTimeOffset CreatedAt,
    DateTimeOffset ExpiresAt,
    AgentApprovalStatus Status);

public sealed class AgentApprovalService
{
    readonly ConcurrentDictionary<long, AgentApprovalRequest> requests = new();
    long nextId;

    public AgentApprovalRequest CreateRequest(
        long ownerUserId,
        string title,
        AgentApprovalRisk risk,
        string summary,
        TimeSpan expiresAfter)
    {
        long id = Interlocked.Increment(ref nextId);
        DateTimeOffset now = DateTimeOffset.Now;
        AgentApprovalRequest request = new(
            id,
            ownerUserId,
            (title ?? "").Trim(),
            risk,
            (summary ?? "").Trim(),
            now,
            now.Add(expiresAfter),
            AgentApprovalStatus.Pending);
        requests[id] = request;
        return request;
    }

    public AgentApprovalRequest? GetRequest(long id)
    {
        if (requests.TryGetValue(id, out AgentApprovalRequest? request) == false)
            return null;

        if (request.Status == AgentApprovalStatus.Pending && request.ExpiresAt < DateTimeOffset.Now)
        {
            request = request with { Status = AgentApprovalStatus.Expired };
            requests[id] = request;
        }

        return request;
    }

    public bool TryApprove(long id, long actorUserId, out string message)
    {
        return TrySetStatus(id, actorUserId, AgentApprovalStatus.Approved, "approved", out message);
    }

    public bool TryDeny(long id, long actorUserId, out string message)
    {
        return TrySetStatus(id, actorUserId, AgentApprovalStatus.Denied, "denied", out message);
    }

    bool TrySetStatus(long id, long actorUserId, AgentApprovalStatus status, string statusText, out string message)
    {
        AgentApprovalRequest? request = GetRequest(id);
        if (request == null)
        {
            message = $"approval #{id} not found";
            return false;
        }

        if (request.OwnerUserId != actorUserId)
        {
            message = $"approval #{id} can only be handled by owner";
            return false;
        }

        if (request.Status != AgentApprovalStatus.Pending)
        {
            message = $"approval #{id} is {request.Status}";
            return false;
        }

        requests[id] = request with { Status = status };
        message = $"approval #{id} {statusText}";
        return true;
    }
}
