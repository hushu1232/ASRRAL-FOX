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

public sealed class AgentControlCenterConfig
{
    public bool AllowAgentLowRiskSelfConfiguration { get; set; } = true;
    public bool RequireOwnerConfirmationForHighRiskConfiguration { get; set; } = true;
    public bool AllowMentionWakeup { get; set; } = true;
    public bool AllowPassiveGroupListening { get; set; } = true;
    public bool AllowProactiveChat { get; set; } = true;
    public int ProactiveChatIntensity { get; set; } = 2;
    public int MaxSelfConfigChangesPerHour { get; set; } = 6;
    public string LowRiskConfigurationKeys { get; set; } =
        "AllowMentionWakeup;AllowPassiveGroupListening;AllowProactiveChat;ProactiveChatIntensity;MaxSelfConfigChangesPerHour";
    public string ProtectedConfigurationKeys { get; set; } =
        "OwnerUserIds;AllowedWorkspaceRoots;AllowedCommands;RequireOwnerConfirmationForHighRiskConfiguration;ProtectedConfigurationKeys;GitHubUpload;QZonePost;QZoneComment;QZoneLike;GroupFileUpload;CodeExecution";
}

public sealed record AgentConfigurationChangeProposal(
    string Id,
    string Key,
    string RequestedValue,
    string CurrentValue,
    string Reason,
    AgentAuditRiskLevel RiskLevel,
    DateTimeOffset CreatedAt,
    string Actor);

public sealed record AgentConfigurationChangeResult(
    bool Applied,
    bool RequiresOwnerConfirmation,
    string Key,
    string RequestedValue,
    string Message,
    AgentConfigurationChangeProposal? Proposal = null);

public sealed record AgentControlCenterSnapshot(
    DateTimeOffset Timestamp,
    AgentStateSnapshot AgentState,
    AgentIssueReportSnapshot IssueReport,
    AgentControlCenterConfig Configuration,
    IReadOnlyList<AgentConfigurationChangeProposal> PendingConfigurationProposals,
    AgentTaskState? LatestTask,
    IReadOnlyList<AgentWorkspacePatchProposal> PendingWorkspaceProposals,
    IReadOnlyList<AgentProactivePendingSuggestion> PendingProactiveSuggestions,
    IReadOnlyList<AgentProactivePendingSuggestion> CompletedProactiveSuggestions,
    IReadOnlyList<AgentMaintenanceProposal> PendingMaintenanceProposals,
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
    XmlFunctionCaller? functionCaller = null,
    ConfigurationSystem? configurationSystem = null,
    AgentMaintenanceService? maintenance = null)
    : InteractiveModule<AgentControlCenterService>, IConfigurable<AgentControlCenterConfig>
{
    readonly AgentAuditLogService auditLog = auditLog ?? new AgentAuditLogService(
        Path.Combine(AlifePath.StorageFolderPath, "AgentWorkspace", "agent-audit.jsonl"));
    readonly AgentCommandPolicy commandPolicy = NormalizeCommandPolicy(commandPolicy ?? CreateDefaultCommandPolicy());
    readonly AgentDiagnosticsService diagnostics = diagnostics ?? new AgentDiagnosticsService();
    readonly AgentIssueReportService issueReports = issueReports ?? new AgentIssueReportService(auditLog);
    readonly AgentMaintenanceService maintenance = maintenance ?? new AgentMaintenanceService(issueReports, auditLog);
    readonly AgentTaskService tasks = tasks ?? new AgentTaskService(auditLog);
    readonly AgentWorkspaceService workspace = workspace ?? new AgentWorkspaceService(
        workspacePolicy,
        auditLog: auditLog);
    AgentProactiveBehaviorService? proactiveBehavior;
    IReadOnlyList<IAgentProactiveSuggestionExecutor> proactiveExecutors = [];
    readonly AgentWorkspacePolicy workspacePolicy = NormalizeWorkspacePolicy(workspacePolicy ?? CreateDefaultWorkspacePolicy());
    readonly Dictionary<string, AgentConfigurationChangeProposal> configurationProposals = new(StringComparer.OrdinalIgnoreCase);
    readonly ConfigurationSystem? configurationSystem = configurationSystem;

    public AgentControlCenterConfig? Configuration { get; set; } = new();
    public AgentProactiveBehaviorService? ProactiveBehavior
    {
        get => proactiveBehavior;
        set => proactiveBehavior = value;
    }
    public IReadOnlyList<IAgentProactiveSuggestionExecutor> ProactiveExecutors
    {
        get => proactiveExecutors;
        set => proactiveExecutors = value ?? [];
    }

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
              Pending proactive suggestions: {snapshot.PendingProactiveSuggestions.Count}
              Recent audit entries: {snapshot.RecentAuditEntries.Count}
              Allowed commands: {snapshot.AllowedCommands.Count}
              """);
    }

    [XmlFunction(FunctionMode.OneShot, name: "agent_config_status")]
    [Description("Show the Agent Control Center self-configuration state and pending configuration proposals.")]
    public void ShowAgentConfigurationStatus()
    {
        AgentControlCenterConfig config = EnsureConfiguration();
        auditLog.Record("agent.config.status", "agent", "read self-configuration status", AgentAuditRiskLevel.Low, true);
        Poke($"""
              Agent self-configuration
              Low-risk self-configuration: {(config.AllowAgentLowRiskSelfConfiguration ? "enabled" : "disabled")}
              Mention wakeup: {(config.AllowMentionWakeup ? "enabled" : "disabled")}
              Passive group listening: {(config.AllowPassiveGroupListening ? "enabled" : "disabled")}
              Proactive chat: {(config.AllowProactiveChat ? "enabled" : "disabled")} intensity={config.ProactiveChatIntensity}
              Pending configuration proposals: {configurationProposals.Count}
              """);
    }

    [XmlFunction(FunctionMode.OneShot, name: "agent_config_apply")]
    [Description("Apply an allowed low-risk Agent Control Center configuration change, or create a proposal when owner confirmation is required.")]
    public void ApplyAgentConfiguration(string key, string value, string reason = "")
    {
        AgentConfigurationChangeResult result = ApplyConfigurationChange(key, value, "agent", reason);
        Poke(result.Proposal == null
            ? $"Agent configuration: {result.Message} key={result.Key}"
            : $"Agent configuration proposal created: {result.Proposal.Id} key={result.Key}");
    }

    [XmlFunction(FunctionMode.OneShot, name: "agent_config_propose")]
    [Description("Create a pending Agent Control Center configuration proposal for owner review.")]
    public void ProposeAgentConfiguration(string key, string value, string reason = "")
    {
        AgentConfigurationChangeProposal proposal = ProposeConfigurationChange(key, value, "agent", reason);
        Poke($"Agent configuration proposal created: {proposal.Id} key={proposal.Key}");
    }

    [XmlFunction(FunctionMode.OneShot, name: "agent_config_confirmation_text")]
    [Description("Show the owner confirmation command for a pending Agent Control Center configuration proposal.")]
    public void ShowAgentConfigurationConfirmationText(string id)
    {
        if (configurationProposals.TryGetValue(id, out AgentConfigurationChangeProposal? proposal) == false)
        {
            Poke("Configuration proposal was not found.");
            return;
        }

        Poke(BuildConfigurationProposalConfirmationText(proposal));
    }

    [XmlFunction(FunctionMode.OneShot, name: "agent_config_apply_proposal", riskLevel: XmlFunctionRiskLevel.High)]
    [Description("Apply a pending Agent Control Center configuration proposal after owner confirmation.")]
    public void ApplyAgentConfigurationProposal(string id)
    {
        AgentConfigurationChangeResult result = ApplyConfigurationProposal(id, "owner");
        Poke($"Agent configuration proposal: {result.Message} key={result.Key}");
    }

    public AgentControlCenterSnapshot BuildSnapshot(ChatRuntimeState runtimeState, string characterName)
    {
        AgentControlCenterConfig configuration = EnsureConfiguration();
        return new AgentControlCenterSnapshot(
            DateTimeOffset.Now,
            diagnostics.BuildSnapshot(runtimeState, characterName),
            issueReports.BuildSnapshot(runtimeState),
            configuration,
            GetPendingConfigurationProposals(),
            tasks.GetLatestTask(),
            workspace.GetPendingProposals(),
            proactiveBehavior?.GetPendingSuggestions() ?? [],
            proactiveBehavior?.GetCompletedSuggestions() ?? [],
            maintenance.GetPendingProposals(),
            workspacePolicy.AllowedRoots,
            commandPolicy.AllowedCommands,
            auditLog.GetRecentEntries(12));
    }

    public AgentTaskState StartTaskFromControlCenter(string taskId)
    {
        return tasks.StartTask(taskId, "agent-control-ui");
    }

    public AgentTaskState CompleteTaskFromControlCenter(string taskId, string detail = "completed from Agent Control Center")
    {
        return tasks.CompleteTask(taskId, "agent-control-ui", detail);
    }

    public AgentProactivePendingSuggestion ConfirmProactiveSuggestionFromControlCenter(string id)
    {
        return GetProactiveBehavior().ConfirmPendingSuggestion(id, "agent-control-ui");
    }

    public AgentProactivePendingSuggestion DismissProactiveSuggestionFromControlCenter(string id)
    {
        return GetProactiveBehavior().DismissPendingSuggestion(id, "agent-control-ui");
    }

    public AgentProactiveCleanupResult CleanupProactiveSuggestionsFromControlCenter(
        TimeSpan maxPendingAge,
        TimeSpan maxCompletedAge)
    {
        return GetProactiveBehavior().CleanupSuggestions(maxPendingAge, maxCompletedAge, "agent-control-ui");
    }

    public async Task<AgentProactiveExternalExecutionResult> ExecuteProactiveSuggestionFromControlCenter(string id)
    {
        AgentProactiveBehaviorService proactive = GetProactiveBehavior();
        AgentProactivePendingSuggestion? pending = proactive.GetCompletedSuggestion(id);
        if (pending == null)
            return new AgentProactiveExternalExecutionResult(false, "Confirmed proactive suggestion was not found.");
        if (pending.Status == AgentProactivePendingStatus.Executed)
            return new AgentProactiveExternalExecutionResult(false, "Proactive suggestion was already executed.");
        if (pending.Status != AgentProactivePendingStatus.Confirmed)
            return new AgentProactiveExternalExecutionResult(false, "Proactive suggestion must be confirmed before execution.");

        IAgentProactiveSuggestionExecutor? executor = proactiveExecutors.FirstOrDefault(item => item.CanExecute(pending));
        if (executor == null)
            return new AgentProactiveExternalExecutionResult(false, $"No executor is available for {pending.Suggestion.Kind}.");

        AgentProactiveExternalExecutionResult result = await executor.ExecuteAsync(pending);
        if (result.Succeeded)
            proactive.MarkSuggestionExecuted(id, "agent-control-ui", result.Message);

        auditLog.Record(
            "agent.proactive.control.execute",
            "agent-control-ui",
            $"{pending.Suggestion.Kind}: {result.Message}",
            pending.Suggestion.RiskLevel,
            result.Succeeded,
            result.Succeeded ? null : result.Message);
        return result;
    }

    public static string BuildWorkspaceProposalConfirmationText(AgentWorkspacePatchProposal proposal)
    {
        return $"confirm execute <workspace_apply_proposal id=\"{EscapeXmlAttribute(proposal.Id)}\" />";
    }

    public IReadOnlyList<AgentConfigurationChangeProposal> GetPendingConfigurationProposals()
    {
        return configurationProposals.Values
            .OrderBy(proposal => proposal.CreatedAt)
            .ToArray();
    }

    public AgentConfigurationChangeProposal ProposeConfigurationChange(
        string key,
        string requestedValue,
        string actor,
        string reason = "")
    {
        AgentControlCenterConfig config = EnsureConfiguration();
        string normalizedKey = key.Trim();
        string normalizedValue = requestedValue.Trim();
        string normalizedReason = reason.Trim();
        string normalizedActor = string.IsNullOrWhiteSpace(actor) ? "agent" : actor.Trim();
        AgentConfigurationChangeProposal proposal = new(
            Guid.NewGuid().ToString("N"),
            normalizedKey,
            normalizedValue,
            GetConfigValue(config, normalizedKey),
            normalizedReason,
            GetConfigurationRisk(normalizedKey),
            DateTimeOffset.Now,
            normalizedActor);

        configurationProposals[proposal.Id] = proposal;
        auditLog.Record(
            "agent.config.proposed",
            normalizedActor,
            FormatConfigAuditDetail(proposal.Key, proposal.RequestedValue, proposal.Reason),
            proposal.RiskLevel,
            true);
        return proposal;
    }

    public AgentConfigurationChangeResult ApplyConfigurationChange(
        string key,
        string requestedValue,
        string actor,
        string reason = "")
    {
        AgentControlCenterConfig config = EnsureConfiguration();
        string normalizedKey = key.Trim();
        string normalizedValue = requestedValue.Trim();
        string normalizedReason = reason.Trim();
        string normalizedActor = string.IsNullOrWhiteSpace(actor) ? "agent" : actor.Trim();

        if (CanApplyDirectly(config, normalizedKey) == false)
        {
            AgentConfigurationChangeProposal proposal = ProposeConfigurationChange(
                normalizedKey,
                normalizedValue,
                normalizedActor,
                normalizedReason);
            return new AgentConfigurationChangeResult(
                false,
                true,
                normalizedKey,
                normalizedValue,
                "Owner confirmation required.",
                proposal);
        }

        try
        {
            ApplyConfigValue(config, normalizedKey, normalizedValue);
            PersistConfiguration(config);
            auditLog.Record(
                "agent.config.applied",
                normalizedActor,
                FormatConfigAuditDetail(normalizedKey, normalizedValue, normalizedReason),
                AgentAuditRiskLevel.Low,
                true);
            return new AgentConfigurationChangeResult(
                true,
                false,
                normalizedKey,
                normalizedValue,
                "Configuration applied.");
        }
        catch (Exception exception)
        {
            auditLog.Record(
                "agent.config.failed",
                normalizedActor,
                FormatConfigAuditDetail(normalizedKey, normalizedValue, normalizedReason),
                AgentAuditRiskLevel.Low,
                false,
                exception.Message);
            return new AgentConfigurationChangeResult(
                false,
                false,
                normalizedKey,
                normalizedValue,
                exception.Message);
        }
    }

    public AgentConfigurationChangeResult ApplyConfigurationProposal(string id, string actor)
    {
        if (configurationProposals.TryGetValue(id, out AgentConfigurationChangeProposal? proposal) == false)
        {
            return new AgentConfigurationChangeResult(
                false,
                false,
                "",
                "",
                "Configuration proposal was not found.");
        }

        AgentControlCenterConfig config = EnsureConfiguration();
        string normalizedActor = string.IsNullOrWhiteSpace(actor) ? "owner" : actor.Trim();
        try
        {
            ApplyConfigValue(config, proposal.Key, proposal.RequestedValue);
            PersistConfiguration(config);
            configurationProposals.Remove(id);
            auditLog.Record(
                "agent.config.confirmed",
                normalizedActor,
                FormatConfigAuditDetail(proposal.Key, proposal.RequestedValue, proposal.Reason),
                proposal.RiskLevel,
                true);
            return new AgentConfigurationChangeResult(
                true,
                false,
                proposal.Key,
                proposal.RequestedValue,
                "Configuration proposal applied.",
                proposal);
        }
        catch (Exception exception)
        {
            auditLog.Record(
                "agent.config.failed",
                normalizedActor,
                FormatConfigAuditDetail(proposal.Key, proposal.RequestedValue, proposal.Reason),
                proposal.RiskLevel,
                false,
                exception.Message);
            return new AgentConfigurationChangeResult(
                false,
                false,
                proposal.Key,
                proposal.RequestedValue,
                exception.Message,
                proposal);
        }
    }

    public static string BuildConfigurationProposalConfirmationText(AgentConfigurationChangeProposal proposal)
    {
        return $"confirm execute <agent_config_apply_proposal id=\"{EscapeXmlAttribute(proposal.Id)}\" />";
    }

    public override async Task AwakeAsync(AwakeContext context)
    {
        await base.AwakeAsync(context);
        proactiveBehavior ??= context.Services.GetService(typeof(AgentProactiveBehaviorService)) as AgentProactiveBehaviorService;
        if (context.Services.GetService(typeof(IEnumerable<IAgentProactiveSuggestionExecutor>)) is IEnumerable<IAgentProactiveSuggestionExecutor> executors)
            proactiveExecutors = executors.ToArray();
        functionCaller?.RegisterHandler(this);
    }

    AgentProactiveBehaviorService GetProactiveBehavior()
    {
        return proactiveBehavior ?? throw new InvalidOperationException("Agent proactive behavior service is unavailable.");
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

    AgentControlCenterConfig EnsureConfiguration()
    {
        return Configuration ??= new AgentControlCenterConfig();
    }

    bool CanApplyDirectly(AgentControlCenterConfig config, string key)
    {
        if (config.AllowAgentLowRiskSelfConfiguration == false)
            return false;

        return ParseKeyList(config.LowRiskConfigurationKeys).Contains(key, StringComparer.OrdinalIgnoreCase)
               && ParseKeyList(config.ProtectedConfigurationKeys).Contains(key, StringComparer.OrdinalIgnoreCase) == false;
    }

    AgentAuditRiskLevel GetConfigurationRisk(string key)
    {
        AgentControlCenterConfig config = EnsureConfiguration();
        return CanApplyDirectly(config, key) ? AgentAuditRiskLevel.Low : AgentAuditRiskLevel.High;
    }

    static IReadOnlyList<string> ParseKeyList(string value)
    {
        return value.Split([';', ',', '\n', '\r'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    }

    static string GetConfigValue(AgentControlCenterConfig config, string key)
    {
        System.Reflection.PropertyInfo? property = typeof(AgentControlCenterConfig).GetProperty(key);
        object? value = property?.GetValue(config);
        return value?.ToString() ?? "";
    }

    static void ApplyConfigValue(AgentControlCenterConfig config, string key, string requestedValue)
    {
        System.Reflection.PropertyInfo? property = typeof(AgentControlCenterConfig).GetProperty(key);
        if (property == null || property.CanWrite == false)
            throw new InvalidOperationException($"Unknown configuration key: {key}");

        object value = property.PropertyType == typeof(bool)
            ? bool.Parse(requestedValue)
            : property.PropertyType == typeof(int)
                ? Math.Clamp(int.Parse(requestedValue), 0, 10)
                : requestedValue;
        property.SetValue(config, value);
    }

    static string FormatConfigAuditDetail(string key, string requestedValue, string reason)
    {
        return $"key={key}; value={requestedValue}; reason={reason}";
    }

    void PersistConfiguration(AgentControlCenterConfig config)
    {
        configurationSystem?.SetConfiguration(typeof(AgentControlCenterService), config);
    }

    static string EscapeXmlAttribute(string value)
    {
        return value
            .Replace("&", "&amp;", StringComparison.Ordinal)
            .Replace("\"", "&quot;", StringComparison.Ordinal)
            .Replace("<", "&lt;", StringComparison.Ordinal)
            .Replace(">", "&gt;", StringComparison.Ordinal);
    }
}
