using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Alife.Framework;
using Alife.Function.FunctionCaller;
using Alife.Function.Interpreter;
using Alife.Platform;

namespace Alife.Function.Agent;

public sealed record AgentControlCenterSnapshot(
    DateTimeOffset Timestamp,
    AgentStateSnapshot AgentState,
    AgentIssueReportSnapshot IssueReport,
    AgentTaskState? LatestTask,
    IReadOnlyList<AgentWorkspacePatchProposal> PendingWorkspaceProposals,
    IReadOnlyList<string> WorkspaceRoots,
    IReadOnlyList<AgentCommandDefinition> AllowedCommands,
    IReadOnlyList<AgentAuditLogEntry> RecentAuditEntries);

[Module(
    "Agent Control Center",
    "Shows the agent runtime state, task status, audit trail, allowed commands, issue report, and workspace proposals.",
    defaultCategory: "Alife Official/Agent",
    editorUI: typeof(AgentControlCenterServiceUI),
    LaunchOrder = -59)]
public class AgentControlCenterService(
    AgentDiagnosticsService? diagnostics = null,
    AgentIssueReportService? issueReports = null,
    AgentTaskService? tasks = null,
    AgentWorkspaceService? workspace = null,
    AgentWorkspacePolicy? workspacePolicy = null,
    AgentCommandPolicy? commandPolicy = null,
    AgentAuditLogService? auditLog = null,
    XmlFunctionCaller? functionCaller = null)
    : InteractiveModule<AgentControlCenterService>
{
    readonly AgentAuditLogService auditLog = auditLog ?? new AgentAuditLogService(
        Path.Combine(AlifePath.StorageFolderPath, "AgentWorkspace", "agent-audit.jsonl"));
    readonly AgentCommandPolicy commandPolicy = NormalizeCommandPolicy(commandPolicy ?? CreateDefaultCommandPolicy());
    readonly AgentDiagnosticsService diagnostics = diagnostics ?? new AgentDiagnosticsService();
    readonly AgentIssueReportService issueReports = issueReports ?? new AgentIssueReportService(auditLog);
    readonly AgentTaskService tasks = tasks ?? new AgentTaskService(auditLog);
    readonly AgentWorkspaceService workspace = workspace ?? new AgentWorkspaceService(
        workspacePolicy,
        auditLog: auditLog);
    readonly AgentWorkspacePolicy workspacePolicy = NormalizeWorkspacePolicy(workspacePolicy ?? CreateDefaultWorkspacePolicy());

    [XmlFunction(FunctionMode.OneShot, name: "agent_control_center")]
    [Description("Show a concise Agent control center summary for runtime state, tasks, audit, commands, errors, and workspace proposals.")]
    public void ShowAgentControlCenter()
    {
        AgentControlCenterSnapshot snapshot = BuildSnapshot(ChatBot.GetRuntimeState(), Character.Name);
        Poke($"""
              Agent control center
              State: {(snapshot.AgentState.IsChatting ? "chatting" : "idle")}
              Last error: {snapshot.AgentState.LastError ?? "none"}
              Latest task: {snapshot.LatestTask?.Goal ?? "none"}
              Pending proposals: {snapshot.PendingWorkspaceProposals.Count}
              Recent audit entries: {snapshot.RecentAuditEntries.Count}
              Allowed commands: {snapshot.AllowedCommands.Count}
              """);
    }

    public AgentControlCenterSnapshot BuildSnapshot(ChatRuntimeState runtimeState, string characterName)
    {
        return new AgentControlCenterSnapshot(
            DateTimeOffset.Now,
            diagnostics.BuildSnapshot(runtimeState, characterName),
            issueReports.BuildSnapshot(runtimeState),
            tasks.GetLatestTask(),
            workspace.GetPendingProposals(),
            workspacePolicy.AllowedRoots,
            commandPolicy.AllowedCommands,
            auditLog.GetRecentEntries(12));
    }

    public override async Task AwakeAsync(AwakeContext context)
    {
        await base.AwakeAsync(context);
        functionCaller?.RegisterHandler(this);
    }

    static AgentWorkspacePolicy NormalizeWorkspacePolicy(AgentWorkspacePolicy rawPolicy)
    {
        string[] roots = rawPolicy.AllowedRoots
            .Where(root => string.IsNullOrWhiteSpace(root) == false)
            .Select(Path.GetFullPath)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (roots.Length == 0)
            throw new ArgumentException("At least one workspace root is required.", nameof(rawPolicy));

        return rawPolicy with { AllowedRoots = roots };
    }

    static AgentCommandPolicy NormalizeCommandPolicy(AgentCommandPolicy rawPolicy)
    {
        AgentCommandDefinition[] commands = rawPolicy.AllowedCommands
            .Where(command => string.IsNullOrWhiteSpace(command.Id) == false)
            .Select(command => command with
            {
                Id = command.Id.Trim(),
                Description = command.Description.Trim(),
                FileName = command.FileName.Trim(),
                Arguments = command.Arguments.Trim(),
                WorkingDirectory = Path.GetFullPath(command.WorkingDirectory),
                Timeout = command.Timeout <= TimeSpan.Zero ? TimeSpan.FromSeconds(30) : command.Timeout
            })
            .ToArray();

        return new AgentCommandPolicy(commands);
    }

    static AgentWorkspacePolicy CreateDefaultWorkspacePolicy()
    {
        string agentWorkspace = Path.Combine(AlifePath.StorageFolderPath, "AgentWorkspace");
        return new AgentWorkspacePolicy([Environment.CurrentDirectory, agentWorkspace, AlifePath.TempFolderPath]);
    }

    static AgentCommandPolicy CreateDefaultCommandPolicy()
    {
        string cwd = Environment.CurrentDirectory;
        return new AgentCommandPolicy([
            new AgentCommandDefinition("git-status", "Show repository status.", "git", "status --short", cwd, TimeSpan.FromSeconds(20)),
            new AgentCommandDefinition("git-diff", "Show unstaged repository diff.", "git", "diff --", cwd, TimeSpan.FromSeconds(20)),
            new AgentCommandDefinition("dotnet-build-solution", "Build the Alife solution without restoring packages.", "dotnet", "build Alife.slnx --no-restore", cwd, TimeSpan.FromMinutes(3)),
            new AgentCommandDefinition("dotnet-test-solution", "Run the Alife solution tests without restoring packages.", "dotnet", "test Alife.slnx --no-restore", cwd, TimeSpan.FromMinutes(5))
        ]);
    }
}
