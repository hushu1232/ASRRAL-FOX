using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Alife.Framework;
using Alife.Function.FunctionCaller;
using Alife.Function.Interpreter;
using Alife.Platform;

namespace Alife.Function.Agent;

public sealed record AgentMaintenanceProposal(
    string Id,
    DateTimeOffset CreatedAt,
    string Actor,
    string Title,
    string Evidence,
    IReadOnlyList<string> SuggestedNextSteps,
    AgentAuditRiskLevel RiskLevel,
    bool RequiresOwnerConfirmationForExecution,
    bool CanApplyAutomatically);

[Module(
    "Agent Maintenance",
    "Turns runtime issue reports into owner-confirmed self-maintenance proposals without directly changing files or configuration.",
    defaultCategory: "Alife Official/Agent",
    LaunchOrder = -55)]
public class AgentMaintenanceService(
    AgentIssueReportService? issueReports = null,
    AgentAuditLogService? auditLog = null,
    XmlFunctionCaller? functionCaller = null)
    : InteractiveModule<AgentMaintenanceService>
{
    readonly AgentIssueReportService issueReports = issueReports ?? new AgentIssueReportService();
    readonly AgentAuditLogService auditLog = auditLog ?? new AgentAuditLogService(
        Path.Combine(AlifePath.StorageFolderPath, "AgentWorkspace", "agent-audit.jsonl"));
    readonly Dictionary<string, AgentMaintenanceProposal> proposals = new(StringComparer.OrdinalIgnoreCase);

    [XmlFunction(FunctionMode.OneShot, name: "agent_maintenance_propose", budgetCost: 4)]
    [Description("Create a self-maintenance proposal from recent runtime errors and failed audit entries. This does not modify files or configuration.")]
    public void ProposeMaintenance(int maxEntries = 8)
    {
        AgentMaintenanceProposal proposal = ProposeFromIssueReport(
            issueReports.BuildSnapshot(ChatBot.GetRuntimeState(), maxEntries),
            Character.Name);
        Poke(FormatProposal(proposal));
    }

    [XmlFunction(FunctionMode.OneShot, name: "agent_maintenance_pending")]
    [Description("List pending self-maintenance proposals.")]
    public void ShowPendingMaintenanceProposals()
    {
        IReadOnlyList<AgentMaintenanceProposal> pending = GetPendingProposals();
        if (pending.Count == 0)
        {
            Poke("No pending agent maintenance proposals.");
            return;
        }

        StringBuilder builder = new();
        builder.AppendLine("Pending agent maintenance proposals:");
        foreach (AgentMaintenanceProposal proposal in pending)
            builder.AppendLine($"- {proposal.Id}: {proposal.Title} [{proposal.RiskLevel}]");
        Poke(builder.ToString().TrimEnd());
    }

    public AgentMaintenanceProposal ProposeFromIssueReport(AgentIssueReportSnapshot issueReport, string actor)
    {
        string evidence = BuildEvidence(issueReport);
        AgentAuditRiskLevel risk = issueReport.FailedAuditEntries.Any(entry => entry.RiskLevel == AgentAuditRiskLevel.High)
            ? AgentAuditRiskLevel.High
            : AgentAuditRiskLevel.Medium;
        AgentMaintenanceProposal proposal = new(
            Guid.NewGuid().ToString("N"),
            DateTimeOffset.Now,
            string.IsNullOrWhiteSpace(actor) ? "agent" : actor.Trim(),
            BuildTitle(issueReport),
            evidence,
            BuildSuggestedSteps(issueReport),
            risk,
            RequiresOwnerConfirmationForExecution: true,
            CanApplyAutomatically: false);

        proposals[proposal.Id] = proposal;
        auditLog.Record(
            "agent.maintenance.propose",
            proposal.Actor,
            proposal.Title,
            proposal.RiskLevel,
            succeeded: true);
        return proposal;
    }

    public IReadOnlyList<AgentMaintenanceProposal> GetPendingProposals()
    {
        return proposals.Values
            .OrderByDescending(proposal => proposal.CreatedAt)
            .ToArray();
    }

    public static string FormatProposal(AgentMaintenanceProposal proposal)
    {
        StringBuilder builder = new();
        builder.AppendLine("Agent maintenance proposal");
        builder.AppendLine($"Id: {proposal.Id}");
        builder.AppendLine($"Title: {proposal.Title}");
        builder.AppendLine($"Risk: {proposal.RiskLevel}");
        builder.AppendLine($"Requires owner confirmation for execution: {proposal.RequiresOwnerConfirmationForExecution}");
        builder.AppendLine($"Can apply automatically: {proposal.CanApplyAutomatically}");
        builder.AppendLine("No files or configuration were changed.");
        builder.AppendLine("Evidence:");
        builder.AppendLine(proposal.Evidence);
        builder.AppendLine("Suggested next steps:");
        foreach (string step in proposal.SuggestedNextSteps)
            builder.AppendLine($"- {step}");
        builder.AppendLine("Apply boundary:");
        builder.AppendLine("- Use workspace_propose_replace for patch previews.");
        builder.AppendLine("- Use confirm execute <workspace_apply_proposal id=\"...\" /> only after owner confirmation.");
        return builder.ToString().TrimEnd();
    }

    public override async Task AwakeAsync(AwakeContext context)
    {
        await base.AwakeAsync(context);
        functionCaller?.RegisterHandler(this);
    }

    static string BuildTitle(AgentIssueReportSnapshot issueReport)
    {
        if (string.IsNullOrWhiteSpace(issueReport.LastError) == false)
            return TrimLine(issueReport.LastError, 96);
        ModuleHealth? unhealthy = issueReport.UnhealthyModules.FirstOrDefault();
        if (unhealthy != null)
            return $"{unhealthy.Name} is {unhealthy.Status}";
        AgentAuditLogEntry? failed = issueReport.FailedAuditEntries.LastOrDefault();
        return failed == null ? "Review recent agent state" : $"{failed.Action} failed";
    }

    static string BuildEvidence(AgentIssueReportSnapshot issueReport)
    {
        StringBuilder builder = new();
        builder.AppendLine($"Last error: {issueReport.LastError ?? "none"}");
        foreach (ChatRuntimeEvent runtimeEvent in issueReport.RuntimeErrors.TakeLast(3))
            builder.AppendLine($"Runtime error: {runtimeEvent.Detail}");
        foreach (AgentAuditLogEntry entry in issueReport.FailedAuditEntries.TakeLast(3))
            builder.AppendLine($"Failed audit: {entry.Action}; {entry.Detail}; error={entry.Error ?? "none"}");
        foreach (ModuleHealth health in issueReport.UnhealthyModules.Take(3))
            builder.AppendLine($"Unhealthy module: {health.Name}; {health.Status}; {health.Summary}");
        return builder.ToString().TrimEnd();
    }

    static IReadOnlyList<string> BuildSuggestedSteps(AgentIssueReportSnapshot issueReport)
    {
        List<string> steps = [
            "Run agent_issue_report again if the error state may have changed.",
            "Use workspace_search to locate the relevant code path before proposing a patch.",
            "Use workspace_propose_replace to preview an exact code change without modifying files.",
            "Run agent_run for an allowed build/test command after a patch preview or owner-approved change.",
            "Use workspace_apply_proposal only after explicit owner confirmation."
        ];
        if (issueReport.UnhealthyModules.Count > 0)
            steps.Insert(1, "Inspect degraded module health before changing shared code.");
        return steps;
    }

    static string TrimLine(string value, int maxLength)
    {
        value = value.ReplaceLineEndings(" ").Trim();
        if (value.Length <= maxLength)
            return value;
        return value[..(maxLength - 3)] + "...";
    }
}

