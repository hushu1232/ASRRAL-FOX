using Alife.Function.MessageFilter;
using NUnit.Framework;

namespace Alife.Test.Framework;

public class AgentApprovalServiceTests
{
    [Test]
    public void CreateRequest_ReturnsPendingOwnerScopedApproval()
    {
        AgentApprovalService service = new();

        AgentApprovalRequest request = service.CreateRequest(
            ownerUserId: 3045846738,
            title: "下载 QQ 文件",
            risk: AgentApprovalRisk.Medium,
            summary: "保存到夏羽管理文件夹",
            expiresAfter: TimeSpan.FromMinutes(10));

        Assert.That(request.Id, Is.GreaterThan(0));
        Assert.That(request.OwnerUserId, Is.EqualTo(3045846738));
        Assert.That(request.Status, Is.EqualTo(AgentApprovalStatus.Pending));
        Assert.That(request.Risk, Is.EqualTo(AgentApprovalRisk.Medium));
        Assert.That(request.ExpiresAt, Is.GreaterThan(DateTimeOffset.Now));
    }

    [Test]
    public void Approve_OnlyOwnerCanApprovePendingRequest()
    {
        AgentApprovalService service = new();
        AgentApprovalRequest request = service.CreateRequest(3045846738, "改配置", AgentApprovalRisk.High, "修改夏羽 QChat 配置", TimeSpan.FromMinutes(10));

        Assert.That(service.TryApprove(request.Id, actorUserId: 20001, out string denied), Is.False);
        Assert.That(denied, Does.Contain("owner"));

        Assert.That(service.TryApprove(request.Id, actorUserId: 3045846738, out string approved), Is.True);
        Assert.That(approved, Does.Contain("approved"));
        Assert.That(service.GetRequest(request.Id)!.Status, Is.EqualTo(AgentApprovalStatus.Approved));
    }

    [Test]
    public void Deny_OnlyOwnerCanDenyPendingRequest()
    {
        AgentApprovalService service = new();
        AgentApprovalRequest request = service.CreateRequest(3045846738, "删除文件", AgentApprovalRisk.Medium, "删除托管文件", TimeSpan.FromMinutes(10));

        Assert.That(service.TryDeny(request.Id, actorUserId: 999, out string denied), Is.False);
        Assert.That(denied, Does.Contain("owner"));

        Assert.That(service.TryDeny(request.Id, actorUserId: 3045846738, out string result), Is.True);
        Assert.That(result, Does.Contain("denied"));
        Assert.That(service.GetRequest(request.Id)!.Status, Is.EqualTo(AgentApprovalStatus.Denied));
    }
}
