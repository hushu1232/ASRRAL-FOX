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

public sealed class AgentControlCenterConfig
{
    public bool AllowAgentLowRiskSelfConfiguration { get; set; } = true;
    public bool RequireOwnerConfirmationForHighRiskConfiguration { get; set; } = true;
    public bool AllowMentionWakeup { get; set; } = true;
    public bool AllowPassiveGroupListening { get; set; } = true;
    public bool AllowProactiveChat { get; set; } = true;
    public bool AllowAutomaticMaintenanceInspection { get; set; } = true;
    public int ProactiveChatIntensity { get; set; } = 2;
    public int MaxSelfConfigChangesPerHour { get; set; } = 6;
    public int MaintenanceInspectionIntervalMinutes { get; set; } = 15;
    public int MaintenanceDuplicateCooldownMinutes { get; set; } = 120;
    public string LowRiskConfigurationKeys { get; set; } =
        "AllowMentionWakeup;AllowPassiveGroupListening;AllowProactiveChat;AllowAutomaticMaintenanceInspection;ProactiveChatIntensity;MaxSelfConfigChangesPerHour;MaintenanceInspectionIntervalMinutes;MaintenanceDuplicateCooldownMinutes";
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

public sealed record AgentControlCenterAttentionSummary(
    int OwnerConfirmationRequiredCount,
    int AutonomousLowRiskActivityCount,
    IReadOnlyList<string> OwnerConfirmationItems,
    IReadOnlyList<string> AutonomousLowRiskItems);

public sealed record AgentControlCenterNotification(
    string Kind,
    AgentAuditRiskLevel RiskLevel,
    string Message);

public sealed record AgentControlCenterNotificationSummary(
    bool ShouldNotifyOwner,
    IReadOnlyList<AgentControlCenterNotification> Items);

public sealed record AgentOwnerNotificationPlan(
    bool ShouldNotifyOwner,
    string TargetSessionId,
    string PublicGroupSummary,
    IReadOnlyList<string> PrivateMessages,
    string? SourceGroupSessionId = null);

public sealed record AgentControlCenterSelfCheckSchedulerStatus(
    DateTimeOffset? LastCheckedAt,
    DateTimeOffset? LastWakeAt,
    DateTimeOffset? NextCheckAt,
    string LastSkipReason);

public sealed record AgentControlCenterSelfCheckItem(
    string Category,
    AgentAuditRiskLevel RiskLevel,
    string Summary,
    string RecommendedAction,
    bool CanAgentHandleAutonomously,
    string? ActionId = null);

public sealed record AgentControlCenterSelfCheckSnapshot(
    int OwnerReviewCount,
    int AutonomousRecommendationCount,
    IReadOnlyList<AgentControlCenterSelfCheckItem> Items);

public sealed record AgentControlCenterSelfCheckActionResult(
    bool Applied,
    bool RequiresOwnerConfirmation,
    string ActionId,
    string Key,
    string Message,
    AgentConfigurationChangeProposal? Proposal = null);

public sealed record AgentControlCenterSelfCheckLoopResult(
    AgentControlCenterSelfCheckSnapshot SelfCheck,
    AgentBackgroundTaskResult BackgroundResult,
    bool WakeRecommended,
    AgentEvent? WakeEvent,
    AgentMaintenanceInspectionResult? MaintenanceInspection);

public sealed record AgentStreamingPolicyVisibility(
    string Name,
    string Target,
    StreamingOutputMode Mode,
    int MinBufferedCharacters,
    int MaxBufferedCharacters);

public sealed record AgentChatLatencyVisibility(
    long? LastFirstContentLatencyMs,
    long? LastChatDurationMs,
    DateTimeOffset? LastChatStartedAt,
    DateTimeOffset? LastFirstContentAt,
    DateTimeOffset? LastChatEndedAt);

public sealed record AgentActionGatewayAuditSummary(
    int SucceededCount,
    int BlockedCount,
    int FailedCount,
    IReadOnlyList<AgentAuditLogEntry> RecentEntries);

public sealed record AgentControlCenterRuntimeVisibility(
    IReadOnlyList<AgentStreamingPolicyVisibility> StreamingPolicies,
    AgentChatLatencyVisibility ChatLatency,
    AgentEventPipelineSnapshot EventPipeline,
    IReadOnlyList<AgentBackgroundTaskResult> BackgroundTasks,
    AgentActionGatewayAuditSummary ActionGatewayAudit,
    IReadOnlyList<AgentRunSnapshot> RecentRunSessions);

public sealed record AgentControlCenterSnapshot(
    DateTimeOffset Timestamp,
    AgentStateSnapshot AgentState,
    AgentIssueReportSnapshot IssueReport,
    AgentEnvironmentCheckSnapshot EnvironmentCheck,
    AgentControlCenterConfig Configuration,
    IReadOnlyList<AgentConfigurationChangeProposal> PendingConfigurationProposals,
    AgentTaskState? LatestTask,
    IReadOnlyList<AgentTaskState> ActiveTasks,
    IReadOnlyList<AgentWorkspacePatchProposal> PendingWorkspaceProposals,
    IReadOnlyList<AgentProactivePendingSuggestion> PendingProactiveSuggestions,
    IReadOnlyList<AgentProactivePendingSuggestion> CompletedProactiveSuggestions,
    IReadOnlyList<AgentMaintenanceProposal> PendingMaintenanceProposals,
    IReadOnlyDictionary<string, IReadOnlyList<AgentMaintenanceRepairEvidence>> MaintenanceRepairEvidenceByProposalId,
    IReadOnlyList<string> WorkspaceRoots,
    IReadOnlyList<AgentCommandDefinition> AllowedCommands,
    IReadOnlyList<AgentAuditLogEntry> RecentAuditEntries,
    AgentControlCenterAttentionSummary AttentionSummary,
    AgentControlCenterNotificationSummary NotificationSummary,
    IReadOnlyList<AgentExecutionGatewayDecision> SecurityGatewayPreview,
    AgentControlCenterSelfCheckSnapshot SelfCheck,
    AgentControlCenterSelfCheckSchedulerStatus SelfCheckScheduler,
    AgentControlCenterRuntimeVisibility RuntimeVisibility);

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
    AgentMaintenanceService? maintenance = null,
    AgentEnvironmentCheckService? environmentChecks = null,
    AgentEventPipeline? eventPipeline = null,
    Func<DateTimeOffset>? clock = null)
    : InteractiveModule<AgentControlCenterService>, IConfigurable<AgentControlCenterConfig>
{
    readonly AgentAuditLogService auditLog = auditLog ?? new AgentAuditLogService(
        Path.Combine(AlifePath.StorageFolderPath, "AgentWorkspace", "agent-audit.jsonl"));
    readonly AgentCommandPolicy commandPolicy = NormalizeCommandPolicy(commandPolicy ?? CreateDefaultCommandPolicy());
    readonly AgentDiagnosticsService diagnostics = diagnostics ?? new AgentDiagnosticsService();
    readonly AgentIssueReportService issueReports = issueReports ?? new AgentIssueReportService(auditLog);
    readonly AgentEnvironmentCheckService environmentChecks = environmentChecks ?? new AgentEnvironmentCheckService();
    readonly AgentEventPipeline eventPipeline = eventPipeline ?? new AgentEventPipeline();
    readonly AgentMaintenanceService maintenance = maintenance ?? new AgentMaintenanceService(issueReports, auditLog);
    readonly AgentTaskService tasks = tasks ?? new AgentTaskService(auditLog);
    readonly AgentWorkspaceService workspace = workspace ?? new AgentWorkspaceService(
        workspacePolicy,
        auditLog: auditLog);
    AgentProactiveBehaviorService? proactiveBehavior;
    IReadOnlyList<IAgentProactiveSuggestionExecutor> proactiveExecutors = [];
    readonly AgentWorkspacePolicy workspacePolicy = NormalizeWorkspacePolicy(workspacePolicy ?? CreateDefaultWorkspacePolicy());
    readonly Dictionary<string, AgentConfigurationChangeProposal> configurationProposals = new(StringComparer.OrdinalIgnoreCase);
    readonly List<AgentBackgroundTaskResult> backgroundTaskResults = [];
    readonly List<AgentRunSnapshot> recentRunSessions = [];
    readonly ConfigurationSystem? configurationSystem = configurationSystem;
    readonly Func<DateTimeOffset> clock = clock ?? (() => DateTimeOffset.Now);
    DateTimeOffset? lastAutomaticMaintenanceInspectionAt;
    DateTimeOffset? lastAutomaticSelfCheckAt;
    DateTimeOffset? lastAutomaticSelfCheckWakeAt;
    string? lastAutomaticSelfCheckWakeFingerprint;
    string lastAutomaticSelfCheckSkipReason = "not-run";

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

    [XmlFunction(FunctionMode.OneShot, name: "agent_self_check")]
    [Description("Show an agent-readable control-center self-check with owner-review items and autonomous recommendations.")]
    public void ShowAgentSelfCheck()
    {
        AgentControlCenterSnapshot snapshot = BuildSnapshot(ChatBot.GetRuntimeState(), Character.Name);
        auditLog.Record("agent.self_check", "agent", "read control-center self-check", AgentAuditRiskLevel.Low, true);
        Poke(FormatSelfCheckForAgent(snapshot.SelfCheck));
    }

    [XmlFunction(FunctionMode.OneShot, name: "agent_self_check_apply")]
    [Description("Apply one allowlisted low-risk self-check action, or create an owner-confirmation proposal for protected actions.")]
    public void ApplyAgentSelfCheckAction(string actionId)
    {
        AgentControlCenterSelfCheckActionResult result = ApplySelfCheckAction(
            actionId,
            ChatBot.GetRuntimeState(),
            "agent");
        Poke(result.RequiresOwnerConfirmation
            ? $"Self-check action needs owner confirmation: {result.ActionId} key={result.Key}"
            : $"Self-check action applied: {result.ActionId} key={result.Key}");
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
              Automatic maintenance inspection: {(config.AllowAutomaticMaintenanceInspection ? "enabled" : "disabled")} every {config.MaintenanceInspectionIntervalMinutes}m, duplicate cooldown={config.MaintenanceDuplicateCooldownMinutes}m
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
        IReadOnlyList<AgentConfigurationChangeProposal> pendingConfigurationProposals = GetPendingConfigurationProposals();
        IReadOnlyList<AgentWorkspacePatchProposal> pendingWorkspaceProposals = workspace.GetPendingProposals();
        IReadOnlyList<AgentProactivePendingSuggestion> pendingProactiveSuggestions =
            proactiveBehavior?.GetPendingSuggestions() ?? [];
        IReadOnlyList<AgentProactivePendingSuggestion> completedProactiveSuggestions =
            proactiveBehavior?.GetCompletedSuggestions() ?? [];
        IReadOnlyList<AgentMaintenanceProposal> pendingMaintenanceProposals = maintenance.GetPendingProposals();
        IReadOnlyDictionary<string, IReadOnlyList<AgentMaintenanceRepairEvidence>> repairEvidence =
            maintenance.GetRepairEvidenceByProposalId();
        IReadOnlyList<AgentTaskState> activeTasks = tasks.GetTasks()
            .Where(task => task.Status is AgentTaskStatus.Planned or AgentTaskStatus.Running)
            .ToArray();
        IReadOnlyList<AgentAuditLogEntry> recentAuditEntries = auditLog.GetRecentEntries(12);
        AgentIssueReportSnapshot issueReport = issueReports.BuildSnapshot(runtimeState);
        AgentControlCenterAttentionSummary attentionSummary = BuildAttentionSummary(
            pendingConfigurationProposals,
            pendingWorkspaceProposals,
            pendingProactiveSuggestions,
            pendingMaintenanceProposals,
            recentAuditEntries);
        AgentControlCenterRuntimeVisibility runtimeVisibility = BuildRuntimeVisibility(runtimeState, recentAuditEntries);
        return new AgentControlCenterSnapshot(
            DateTimeOffset.Now,
            diagnostics.BuildSnapshot(runtimeState, characterName),
            issueReport,
            environmentChecks.BuildSnapshot(),
            configuration,
            pendingConfigurationProposals,
            tasks.GetLatestTask(),
            activeTasks,
            pendingWorkspaceProposals,
            pendingProactiveSuggestions,
            completedProactiveSuggestions,
            pendingMaintenanceProposals,
            repairEvidence,
            workspacePolicy.AllowedRoots,
            commandPolicy.AllowedCommands,
            recentAuditEntries,
            attentionSummary,
            BuildNotificationSummary(attentionSummary, issueReport),
            BuildSecurityGatewayPreview(),
            BuildSelfCheck(configuration, attentionSummary, issueReport, runtimeVisibility),
            BuildSelfCheckSchedulerStatus(configuration),
            runtimeVisibility);
    }

    public void RecordBackgroundTaskResult(AgentBackgroundTaskResult result)
    {
        backgroundTaskResults.Add(result);
        int overflow = backgroundTaskResults.Count - 12;
        if (overflow > 0)
            backgroundTaskResults.RemoveRange(0, overflow);
    }

    public void RecordAgentRunSession(AgentRunSession session)
    {
        recentRunSessions.Add(session.Snapshot());
        int overflow = recentRunSessions.Count - 12;
        if (overflow > 0)
            recentRunSessions.RemoveRange(0, overflow);
    }

    public AgentControlCenterSelfCheckActionResult ApplySelfCheckAction(
        string actionId,
        ChatRuntimeState runtimeState,
        string actor)
    {
        string normalizedActionId = string.IsNullOrWhiteSpace(actionId)
            ? throw new ArgumentException("Self-check action id cannot be empty.", nameof(actionId))
            : actionId.Trim();
        string normalizedActor = string.IsNullOrWhiteSpace(actor) ? "agent" : actor.Trim();

        AgentControlCenterSelfCheckActionResult actionResult;
        switch (normalizedActionId)
        {
            case "enable-auto-maintenance":
                actionResult = ToSelfCheckActionResult(normalizedActionId, ApplyConfigurationChange(
                    "AllowAutomaticMaintenanceInspection",
                    "true",
                    normalizedActor,
                    "self-check action: enable automatic maintenance inspection after a runtime error"));
                break;
            case "reduce-proactive-intensity":
            {
                AgentControlCenterConfig config = EnsureConfiguration();
                int requestedValue = Math.Max(0, config.ProactiveChatIntensity - 1);
                actionResult = ToSelfCheckActionResult(normalizedActionId, ApplyConfigurationChange(
                    "ProactiveChatIntensity",
                    requestedValue.ToString(),
                    normalizedActor,
                    "self-check action: reduce proactive chat intensity"));
                break;
            }
            case "extend-maintenance-cooldown":
            {
                AgentControlCenterConfig config = EnsureConfiguration();
                int requestedValue = Math.Min(1440, Math.Max(30, config.MaintenanceDuplicateCooldownMinutes * 2));
                actionResult = ToSelfCheckActionResult(normalizedActionId, ApplyConfigurationChange(
                    "MaintenanceDuplicateCooldownMinutes",
                    requestedValue.ToString(),
                    normalizedActor,
                    "self-check action: extend duplicate maintenance cooldown"));
                break;
            }
            case "cleanup-proactive-suggestions":
            {
                AgentProactiveCleanupResult cleanup = CleanupProactiveSuggestionsFromControlCenter(
                    TimeSpan.FromHours(24),
                    TimeSpan.FromDays(30));
                actionResult = new AgentControlCenterSelfCheckActionResult(
                    Applied: true,
                    RequiresOwnerConfirmation: false,
                    normalizedActionId,
                    "ProactiveSuggestions",
                    $"expired_pending={cleanup.ExpiredPendingCount}; removed_completed={cleanup.RemovedCompletedCount}");
                break;
            }
            case "set-owner-user-ids":
                actionResult = ToSelfCheckActionResult(normalizedActionId, ApplyConfigurationChange(
                    "OwnerUserIds",
                    "",
                    normalizedActor,
                    "self-check action: protected owner identity configuration requires owner confirmation"));
                break;
            default:
                throw new InvalidOperationException($"Unknown self-check action: {normalizedActionId}");
        }

        auditLog.Record(
            "agent.self_check.action",
            normalizedActor,
            $"action={normalizedActionId}; key={actionResult.Key}; message={actionResult.Message}",
            actionResult.RequiresOwnerConfirmation ? AgentAuditRiskLevel.High : AgentAuditRiskLevel.Low,
            actionResult.Applied || actionResult.RequiresOwnerConfirmation,
            actionResult.Applied || actionResult.RequiresOwnerConfirmation ? null : actionResult.Message);

        return actionResult;
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

    public AgentMaintenanceArchiveResult ArchiveMaintenanceProposalFromControlCenter(
        string id,
        string resolution = "handled from Agent Control Center")
    {
        return maintenance.ArchiveProposal(id, "agent-control-ui", resolution);
    }

    public AgentMaintenanceInspectionResult InspectMaintenanceFromControlCenter(
        ChatRuntimeState runtimeState,
        TimeSpan duplicateCooldown)
    {
        return maintenance.InspectIssueReport(
            issueReports.BuildSnapshot(runtimeState),
            "agent-control-ui",
            duplicateCooldown);
    }

    public AgentMaintenanceInspectionResult? TryAutomaticMaintenanceInspection(ChatRuntimeState runtimeState)
    {
        AgentControlCenterConfig config = EnsureConfiguration();
        if (config.AllowAutomaticMaintenanceInspection == false)
            return null;

        DateTimeOffset now = clock();
        TimeSpan interval = TimeSpan.FromMinutes(Math.Max(1, config.MaintenanceInspectionIntervalMinutes));
        if (lastAutomaticMaintenanceInspectionAt.HasValue
            && now - lastAutomaticMaintenanceInspectionAt.Value < interval)
            return null;

        lastAutomaticMaintenanceInspectionAt = now;
        TimeSpan duplicateCooldown = TimeSpan.FromMinutes(Math.Max(1, config.MaintenanceDuplicateCooldownMinutes));
        AgentMaintenanceInspectionResult result = InspectMaintenanceFromControlCenter(runtimeState, duplicateCooldown);
        EnsureMaintenanceTask(result.Proposal);
        return result;
    }

    public async Task<AgentProactiveExternalExecutionResult> ExecuteProactiveSuggestionFromControlCenter(string id)
    {
        return await ExecuteProactiveSuggestionFromControlCenter(
            id,
            new AgentPermissionRequest(
                ActorUserId: null,
                Source: AgentRequestSource.System,
                IsMentioned: false,
                RiskLevel: AgentRiskLevel.Low,
                HasExplicitConfirmation: true,
                Action: "proactive.execute"),
            new AgentPermissionConfig());
    }

    public async Task<AgentProactiveExternalExecutionResult> ExecuteProactiveSuggestionFromControlCenter(
        string id,
        AgentPermissionRequest request,
        AgentPermissionConfig config)
    {
        AgentProactiveBehaviorService proactive = GetProactiveBehavior();
        AgentProactivePendingSuggestion? pending = proactive.GetCompletedSuggestion(id);
        if (pending == null)
            return new AgentProactiveExternalExecutionResult(false, "Confirmed proactive suggestion was not found.");
        if (pending.Status == AgentProactivePendingStatus.Executed)
            return new AgentProactiveExternalExecutionResult(false, "Proactive suggestion was already executed.");
        if (pending.Status != AgentProactivePendingStatus.Confirmed)
            return new AgentProactiveExternalExecutionResult(false, "Proactive suggestion must be confirmed before execution.");

        AgentExecutionGatewayDecision gatewayDecision = new AgentActionAuthorizationService().EvaluateExecution(request with
        {
            RiskLevel = ToAgentRiskLevel(pending.Suggestion.RiskLevel),
            Action = string.IsNullOrWhiteSpace(request.Action)
                ? $"proactive.{pending.Suggestion.Kind}"
                : request.Action.Trim()
        }, config);
        if (gatewayDecision.Status == AgentExecutionDecisionStatus.OwnerConfirmationRequired)
        {
            auditLog.Record(
                "agent.proactive.control.blocked",
                "agent-control-ui",
                $"{pending.Suggestion.Kind}: {gatewayDecision.Reason}",
                pending.Suggestion.RiskLevel,
                false,
                gatewayDecision.Reason);
            return new AgentProactiveExternalExecutionResult(false, $"Owner confirmation required: {gatewayDecision.Reason}");
        }
        if (gatewayDecision.Status == AgentExecutionDecisionStatus.Blocked)
        {
            auditLog.Record(
                "agent.proactive.control.blocked",
                "agent-control-ui",
                $"{pending.Suggestion.Kind}: {gatewayDecision.Reason}",
                pending.Suggestion.RiskLevel,
                false,
                gatewayDecision.Reason);
            return new AgentProactiveExternalExecutionResult(false, $"Blocked: {gatewayDecision.Reason}");
        }

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

    static AgentControlCenterAttentionSummary BuildAttentionSummary(
        IReadOnlyList<AgentConfigurationChangeProposal> pendingConfigurationProposals,
        IReadOnlyList<AgentWorkspacePatchProposal> pendingWorkspaceProposals,
        IReadOnlyList<AgentProactivePendingSuggestion> pendingProactiveSuggestions,
        IReadOnlyList<AgentMaintenanceProposal> pendingMaintenanceProposals,
        IReadOnlyList<AgentAuditLogEntry> recentAuditEntries)
    {
        List<string> ownerItems = [];
        ownerItems.AddRange(pendingConfigurationProposals
            .Select(proposal => $"Configuration: {proposal.Key}"));
        ownerItems.AddRange(pendingWorkspaceProposals
            .Select(proposal => $"Workspace: {proposal.RelativePath}"));
        ownerItems.AddRange(pendingMaintenanceProposals
            .Where(proposal => proposal.RequiresOwnerConfirmationForExecution)
            .Select(proposal => $"Maintenance: {proposal.Title}"));
        ownerItems.AddRange(pendingProactiveSuggestions
            .Where(pending => pending.Suggestion.RequiresOwnerConfirmation)
            .Select(pending => $"Proactive: {pending.Suggestion.Kind}"));

        string[] autonomousItems = recentAuditEntries
            .Where(entry => entry.Succeeded
                            && entry.RiskLevel == AgentAuditRiskLevel.Low
                            && entry.Actor.StartsWith("agent", StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(entry => entry.Timestamp)
            .Select(entry => $"{entry.Action}: {entry.Detail}")
            .Take(6)
            .ToArray();

        return new AgentControlCenterAttentionSummary(
            ownerItems.Count,
            autonomousItems.Length,
            ownerItems,
            autonomousItems);
    }

    static AgentControlCenterNotificationSummary BuildNotificationSummary(
        AgentControlCenterAttentionSummary attentionSummary,
        AgentIssueReportSnapshot issueReport)
    {
        List<AgentControlCenterNotification> items = [];
        if (attentionSummary.OwnerConfirmationRequiredCount > 0)
        {
            string preview = string.Join("; ", attentionSummary.OwnerConfirmationItems.Take(3));
            items.Add(new AgentControlCenterNotification(
                "owner-confirmation",
                AgentAuditRiskLevel.High,
                $"{attentionSummary.OwnerConfirmationRequiredCount} item(s) need owner confirmation: {preview}"));
        }

        items.AddRange(issueReport.FailedAuditEntries
            .GroupBy(entry => entry.Action, StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Count() >= 3)
            .Select(group => new AgentControlCenterNotification(
                "repeated-failure",
                group.Any(entry => entry.RiskLevel == AgentAuditRiskLevel.High)
                    ? AgentAuditRiskLevel.High
                    : AgentAuditRiskLevel.Medium,
                $"{group.Key} failed {group.Count()} times. Latest: {group.Last().Error ?? group.Last().Detail}")));

        items.AddRange(issueReport.UnhealthyModules
            .Where(IsQqEnvironmentHealth)
            .Select(health => new AgentControlCenterNotification(
                "qq-environment",
                AgentAuditRiskLevel.Medium,
                $"{health.Name} environment needs attention: {health.Summary}")));

        AgentControlCenterNotification[] snapshot = items
            .Take(8)
            .ToArray();
        return new AgentControlCenterNotificationSummary(snapshot.Length > 0, snapshot);
    }

    public static AgentOwnerNotificationPlan BuildOwnerNotificationPlan(
        AgentControlCenterSnapshot snapshot,
        string ownerPrivateSessionId,
        string? sourceGroupSessionId = null)
    {
        List<string> privateMessages = [];
        privateMessages.AddRange(snapshot.AttentionSummary.OwnerConfirmationItems
            .Select(item => $"Owner confirmation required: {item}"));
        privateMessages.AddRange(snapshot.NotificationSummary.Items
            .Where(item => item.Kind != "owner-confirmation")
            .Select(item => $"{item.Kind}: {item.Message}"));

        bool shouldNotify = privateMessages.Count > 0 || snapshot.SelfCheck.OwnerReviewCount > 0;
        string targetSession = string.IsNullOrWhiteSpace(ownerPrivateSessionId)
            ? "owner:private"
            : ownerPrivateSessionId.Trim();
        string groupSummary = shouldNotify
            ? "Internal control-center items need owner attention. Details were kept private."
            : "No owner attention is currently required.";

        return new AgentOwnerNotificationPlan(
            shouldNotify,
            targetSession,
            groupSummary,
            privateMessages.Take(8).ToArray(),
            string.IsNullOrWhiteSpace(sourceGroupSessionId) ? null : sourceGroupSessionId.Trim());
    }

    public static string FormatSelfCheckForAgent(AgentControlCenterSelfCheckSnapshot selfCheck)
    {
        StringBuilder builder = new();
        builder.AppendLine("Agent self-check");
        builder.AppendLine($"Owner review: {selfCheck.OwnerReviewCount}");
        builder.AppendLine($"Autonomous recommendations: {selfCheck.AutonomousRecommendationCount}");

        if (selfCheck.Items.Count == 0)
        {
            builder.Append("- no items");
            return builder.ToString();
        }

        foreach (AgentControlCenterSelfCheckItem item in selfCheck.Items)
        {
            string handling = item.CanAgentHandleAutonomously ? "agent-can-handle" : "owner-review";
            builder.AppendLine($"- [{item.RiskLevel}] {item.Category} ({handling}): {item.Summary}");
            builder.AppendLine($"  action: {item.RecommendedAction}");
            if (string.IsNullOrWhiteSpace(item.ActionId) == false)
                builder.AppendLine($"  action_id: {item.ActionId}");
        }

        return builder.ToString().TrimEnd();
    }

    static AgentControlCenterSelfCheckSnapshot BuildSelfCheck(
        AgentControlCenterConfig configuration,
        AgentControlCenterAttentionSummary attentionSummary,
        AgentIssueReportSnapshot issueReport,
        AgentControlCenterRuntimeVisibility runtimeVisibility)
    {
        List<AgentControlCenterSelfCheckItem> items = [];

        items.AddRange(attentionSummary.OwnerConfirmationItems
            .Take(4)
            .Select(item => new AgentControlCenterSelfCheckItem(
                "owner-confirmation",
                AgentAuditRiskLevel.High,
                item,
                "Wait for owner confirmation before applying this change or executing the external action.",
                CanAgentHandleAutonomously: false)));

        string? latestRuntimeError = issueReport.LastError
                                     ?? issueReport.RuntimeErrors.LastOrDefault()?.Detail;
        if (string.IsNullOrWhiteSpace(latestRuntimeError) == false)
        {
            if (configuration.AllowAutomaticMaintenanceInspection == false)
            {
                items.Add(new AgentControlCenterSelfCheckItem(
                    "maintenance-disabled",
                    AgentAuditRiskLevel.Low,
                    "Automatic maintenance inspection is disabled while a runtime error is visible.",
                    "Apply the low-risk control-center action to enable automatic maintenance inspection.",
                    CanAgentHandleAutonomously: true,
                    ActionId: "enable-auto-maintenance"));
            }

            items.Add(new AgentControlCenterSelfCheckItem(
                "runtime-error",
                AgentAuditRiskLevel.Medium,
                latestRuntimeError,
                configuration.AllowAutomaticMaintenanceInspection
                    ? "Run the automatic maintenance inspection path and create a repair task if the issue repeats."
                    : "Report the runtime error to the owner because automatic maintenance inspection is disabled.",
                configuration.AllowAutomaticMaintenanceInspection));
        }

        AgentBackgroundTaskResult? failedBackgroundTask = runtimeVisibility.BackgroundTasks
            .FirstOrDefault(result => result.Status == AgentBackgroundTaskStatus.Failed);
        if (failedBackgroundTask != null)
        {
            items.Add(new AgentControlCenterSelfCheckItem(
                "background-task",
                AgentAuditRiskLevel.Medium,
                $"{failedBackgroundTask.TaskName}: {failedBackgroundTask.Error}",
                "Review the failed background result, summarize it, and retry only through the normal action gateway when safe.",
                CanAgentHandleAutonomously: true));
        }

        if (runtimeVisibility.ChatLatency.LastFirstContentLatencyMs is > 3000)
        {
            items.Add(new AgentControlCenterSelfCheckItem(
                "streaming-latency",
                AgentAuditRiskLevel.Low,
                $"First content latency is {runtimeVisibility.ChatLatency.LastFirstContentLatencyMs} ms.",
                "Keep normal chat on fast context mode and move diagnostics, long memory, and tool work to background tasks.",
                CanAgentHandleAutonomously: true,
                ActionId: "reduce-proactive-intensity"));
        }

        if (runtimeVisibility.ActionGatewayAudit.BlockedCount > 0)
        {
            items.Add(new AgentControlCenterSelfCheckItem(
                "security-gateway",
                AgentAuditRiskLevel.Low,
                $"{runtimeVisibility.ActionGatewayAudit.BlockedCount} external action(s) were blocked by the gateway.",
                "Treat blocked actions as successful safety control; do not retry unless the owner gives explicit confirmation.",
                CanAgentHandleAutonomously: false));
        }

        if (items.Count == 0)
        {
            items.Add(new AgentControlCenterSelfCheckItem(
                "ready",
                AgentAuditRiskLevel.Low,
                "No immediate runtime issues or owner-review items are visible.",
                "Continue normal fast-path chat and use background tasks for heavier work.",
                CanAgentHandleAutonomously: true));
        }

        return new AgentControlCenterSelfCheckSnapshot(
            items.Count(item => item.CanAgentHandleAutonomously == false),
            items.Count(item => item.CanAgentHandleAutonomously),
            items);
    }

    static bool IsQqEnvironmentHealth(ModuleHealth health)
    {
        return health.Name.Contains("QChat", StringComparison.OrdinalIgnoreCase)
               || health.Name.Contains("QQ", StringComparison.OrdinalIgnoreCase)
               || health.Name.Contains("OneBot", StringComparison.OrdinalIgnoreCase)
               || health.Summary.Contains("OneBot", StringComparison.OrdinalIgnoreCase)
               || health.Summary.Contains("QQ", StringComparison.OrdinalIgnoreCase);
    }

    static IReadOnlyList<AgentExecutionGatewayDecision> BuildSecurityGatewayPreview()
    {
        AgentActionAuthorizationService authorization = new();
        AgentPermissionConfig config = new()
        {
            OwnerUserIds = [0],
            AllowGroupLowRisk = true,
            AllowGroupMediumRiskWhenMentioned = true,
            RequireConfirmationForHighRisk = true
        };

        return [
            authorization.EvaluateExecution(
                new AgentPermissionRequest(
                    ActorUserId: null,
                    Source: AgentRequestSource.System,
                    IsMentioned: false,
                    RiskLevel: AgentRiskLevel.Low,
                    HasExplicitConfirmation: false,
                    Action: "maintenance.inspect"),
                config),
            authorization.EvaluateExecution(
                new AgentPermissionRequest(
                    ActorUserId: 0,
                    Source: AgentRequestSource.PrivateChat,
                    IsMentioned: false,
                    RiskLevel: AgentRiskLevel.High,
                    HasExplicitConfirmation: false,
                    Action: "workspace.apply"),
                config),
            authorization.EvaluateExecution(
                new AgentPermissionRequest(
                    ActorUserId: 20002,
                    Source: AgentRequestSource.GroupChat,
                    IsMentioned: true,
                    RiskLevel: AgentRiskLevel.High,
                    HasExplicitConfirmation: true,
                    Action: "qzone.reply"),
                config),
            authorization.EvaluateExecution(
                new AgentPermissionRequest(
                    ActorUserId: 20002,
                    Source: AgentRequestSource.GroupChat,
                    IsMentioned: true,
                    RiskLevel: AgentRiskLevel.High,
                    HasExplicitConfirmation: true,
                    Action: "github.upload"),
                config)
        ];
    }

    AgentControlCenterRuntimeVisibility BuildRuntimeVisibility(
        ChatRuntimeState runtimeState,
        IReadOnlyList<AgentAuditLogEntry> recentAuditEntries)
    {
        AgentAuditLogEntry[] gatewayEntries = recentAuditEntries
            .Where(IsExternalActionAuditEntry)
            .ToArray();

        return new AgentControlCenterRuntimeVisibility(
            BuildStreamingPolicyVisibility(),
            new AgentChatLatencyVisibility(
                ToMilliseconds(runtimeState.Latency.LastFirstContentLatency),
                ToMilliseconds(runtimeState.Latency.LastChatDuration),
                runtimeState.Latency.LastChatStartedAt,
                runtimeState.Latency.LastFirstContentAt,
                runtimeState.Latency.LastChatEndedAt),
            eventPipeline.GetSnapshot(),
            backgroundTaskResults
                .OrderByDescending(result => result.CompletedAt)
                .Take(8)
                .ToArray(),
            new AgentActionGatewayAuditSummary(
                gatewayEntries.Count(entry => entry.Succeeded),
                gatewayEntries.Count(IsBlockedGatewayAuditEntry),
                gatewayEntries.Count(entry => entry.Succeeded == false && IsBlockedGatewayAuditEntry(entry) == false),
                gatewayEntries.TakeLast(8).ToArray()),
            recentRunSessions
                .OrderByDescending(session => session.StartedAt)
                .Take(8)
                .ToArray());
    }

    static IReadOnlyList<AgentStreamingPolicyVisibility> BuildStreamingPolicyVisibility()
    {
        return [
            ToStreamingVisibility("QQ group", "group chat", StreamingOutputPolicy.QqGroupText),
            ToStreamingVisibility("QQ private", "private chat", StreamingOutputPolicy.QqPrivateText),
            ToStreamingVisibility("DeskPet/UI", "local UI", StreamingOutputPolicy.Token)
        ];
    }

    static AgentStreamingPolicyVisibility ToStreamingVisibility(string name, string target, StreamingOutputPolicy policy)
    {
        return new AgentStreamingPolicyVisibility(
            name,
            target,
            policy.Mode,
            policy.MinBufferedCharacters,
            policy.MaxBufferedCharacters);
    }

    static long? ToMilliseconds(TimeSpan? value)
    {
        return value == null ? null : (long)Math.Round(value.Value.TotalMilliseconds);
    }

    static bool IsExternalActionAuditEntry(AgentAuditLogEntry entry)
    {
        return entry.Action.StartsWith("qq.", StringComparison.OrdinalIgnoreCase)
               || entry.Action.StartsWith("qzone.", StringComparison.OrdinalIgnoreCase)
               || entry.Action.StartsWith("github.", StringComparison.OrdinalIgnoreCase)
               || entry.Action.StartsWith("workspace.", StringComparison.OrdinalIgnoreCase)
               || entry.Action.StartsWith("maintenance.", StringComparison.OrdinalIgnoreCase);
    }

    static bool IsBlockedGatewayAuditEntry(AgentAuditLogEntry entry)
    {
        return entry.Succeeded == false
               && (entry.Error?.Contains("Blocked", StringComparison.OrdinalIgnoreCase) == true
                   || entry.Error?.Contains("Owner confirmation required", StringComparison.OrdinalIgnoreCase) == true);
    }

    AgentTaskState? EnsureMaintenanceTask(AgentMaintenanceProposal? proposal)
    {
        if (proposal == null)
            return null;

        AgentTaskState? existing = tasks.GetTasks()
            .Where(task => task.Status is AgentTaskStatus.Planned or AgentTaskStatus.Running)
            .FirstOrDefault(task => task.Events.Any(taskEvent =>
                taskEvent.Detail.Contains(proposal.Id, StringComparison.OrdinalIgnoreCase)));
        if (existing != null)
            return existing;

        AgentTaskState created = tasks.CreateTask(
            "agent-control-ui",
            $"Resolve maintenance proposal: {proposal.Title}",
            [
                $"Review maintenance proposal {proposal.Id}",
                "Prepare owner-confirmed workspace proposal",
                "Run focused verification",
                "Record repair evidence",
                "Archive maintenance proposal"
            ]);
        tasks.RecordProgress(
            created.Id,
            "agent-control-ui",
            $"Linked maintenance proposal {proposal.Id}");
        auditLog.Record(
            "agent.maintenance.task.created",
            "agent-control-ui",
            $"proposal={proposal.Id}; task={created.Id}",
            AgentAuditRiskLevel.Low,
            true);
        return tasks.GetTask(created.Id);
    }

    public AgentControlCenterSelfCheckLoopResult? TryAutomaticSelfCheck(
        ChatRuntimeState runtimeState,
        string characterName,
        string sourceSessionId)
    {
        AgentControlCenterConfig config = EnsureConfiguration();
        if (config.AllowAutomaticMaintenanceInspection == false)
        {
            lastAutomaticSelfCheckSkipReason = "disabled";
            return null;
        }
        if (runtimeState.IsChatting)
        {
            lastAutomaticSelfCheckSkipReason = "chatting";
            return null;
        }

        DateTimeOffset now = clock();
        TimeSpan interval = TimeSpan.FromMinutes(Math.Max(1, config.MaintenanceInspectionIntervalMinutes));
        if (lastAutomaticSelfCheckAt.HasValue && now - lastAutomaticSelfCheckAt.Value < interval)
        {
            lastAutomaticSelfCheckSkipReason = "interval";
            return null;
        }

        lastAutomaticSelfCheckAt = now;
        lastAutomaticSelfCheckSkipReason = "none";
        AgentMaintenanceInspectionResult? maintenanceInspection = TryAutomaticMaintenanceInspection(runtimeState);
        AgentControlCenterSnapshot snapshot = BuildSnapshot(runtimeState, characterName);
        AgentControlCenterSelfCheckItem[] meaningfulItems = snapshot.SelfCheck.Items
            .Where(item => item.Category.Equals("ready", StringComparison.OrdinalIgnoreCase) == false)
            .ToArray();
        string resultText = FormatSelfCheckForAgent(snapshot.SelfCheck);
        AgentBackgroundTaskResult backgroundResult = AgentBackgroundTaskResult.Completed(
            $"agent-self-check-{now:yyyyMMddHHmmss}",
            "agent-self-check",
            string.IsNullOrWhiteSpace(sourceSessionId) ? "agent:control-center" : sourceSessionId.Trim(),
            resultText,
            now);
        RecordBackgroundTaskResult(backgroundResult);

        string fingerprint = BuildSelfCheckFingerprint(meaningfulItems);
        TimeSpan duplicateCooldown = TimeSpan.FromMinutes(Math.Max(1, config.MaintenanceDuplicateCooldownMinutes));
        bool duplicateWake = string.IsNullOrWhiteSpace(fingerprint) == false
                             && fingerprint.Equals(lastAutomaticSelfCheckWakeFingerprint, StringComparison.Ordinal)
                             && lastAutomaticSelfCheckWakeAt.HasValue
                             && now - lastAutomaticSelfCheckWakeAt.Value < duplicateCooldown;
        bool wakeRecommended = meaningfulItems.Length > 0 && duplicateWake == false;
        AgentEvent? wakeEvent = null;
        if (wakeRecommended)
        {
            lastAutomaticSelfCheckWakeFingerprint = fingerprint;
            lastAutomaticSelfCheckWakeAt = now;
            wakeEvent = backgroundResult.ToWakeEvent();
            AgentRunSession runSession = AgentRunSession.Start(wakeEvent, StreamingOutputPolicy.Token, now);
            runSession.MarkFirstContent(now);
            runSession.RecordToolStep("agent-self-check", $"{meaningfulItems.Length} meaningful item(s)", now);
            AgentOwnerNotificationPlan notificationPlan = BuildOwnerNotificationPlan(
                snapshot,
                sourceSessionId,
                sourceSessionId.StartsWith("qq:group:", StringComparison.OrdinalIgnoreCase) ? sourceSessionId : null);
            runSession.RecordToolStep(
                "owner-notification-plan",
                notificationPlan.ShouldNotifyOwner ? notificationPlan.TargetSessionId : "no owner notification needed",
                now);
            runSession.Complete(now);
            RecordAgentRunSession(runSession);
        }

        auditLog.Record(
            "agent.self_check.loop",
            "agent",
            $"items={snapshot.SelfCheck.Items.Count}; meaningful={meaningfulItems.Length}; wake={wakeRecommended}",
            AgentAuditRiskLevel.Low,
            true);

        return new AgentControlCenterSelfCheckLoopResult(
            snapshot.SelfCheck,
            backgroundResult,
            wakeRecommended,
            wakeEvent,
            maintenanceInspection);
    }

    AgentControlCenterSelfCheckSchedulerStatus BuildSelfCheckSchedulerStatus(AgentControlCenterConfig config)
    {
        TimeSpan interval = TimeSpan.FromMinutes(Math.Max(1, config.MaintenanceInspectionIntervalMinutes));
        return new AgentControlCenterSelfCheckSchedulerStatus(
            lastAutomaticSelfCheckAt,
            lastAutomaticSelfCheckWakeAt,
            lastAutomaticSelfCheckAt?.Add(interval),
            lastAutomaticSelfCheckSkipReason);
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

    static AgentRiskLevel ToAgentRiskLevel(AgentAuditRiskLevel riskLevel) => riskLevel switch
    {
        AgentAuditRiskLevel.High => AgentRiskLevel.High,
        AgentAuditRiskLevel.Medium => AgentRiskLevel.Medium,
        _ => AgentRiskLevel.Low
    };

    static void ApplyConfigValue(AgentControlCenterConfig config, string key, string requestedValue)
    {
        System.Reflection.PropertyInfo? property = typeof(AgentControlCenterConfig).GetProperty(key);
        if (property == null || property.CanWrite == false)
            throw new InvalidOperationException($"Unknown configuration key: {key}");

        object value = property.PropertyType == typeof(bool)
            ? bool.Parse(requestedValue)
            : property.PropertyType == typeof(int)
                ? ClampIntegerConfiguration(key, int.Parse(requestedValue))
                : requestedValue;
        property.SetValue(config, value);
    }

    static int ClampIntegerConfiguration(string key, int requestedValue)
    {
        return key.EndsWith("Minutes", StringComparison.OrdinalIgnoreCase)
            ? Math.Clamp(requestedValue, 1, 1440)
            : Math.Clamp(requestedValue, 0, 10);
    }

    static string FormatConfigAuditDetail(string key, string requestedValue, string reason)
    {
        return $"key={key}; value={requestedValue}; reason={reason}";
    }

    static AgentControlCenterSelfCheckActionResult ToSelfCheckActionResult(
        string actionId,
        AgentConfigurationChangeResult configResult)
    {
        return new AgentControlCenterSelfCheckActionResult(
            configResult.Applied,
            configResult.RequiresOwnerConfirmation,
            actionId,
            configResult.Key,
            configResult.Message,
            configResult.Proposal);
    }

    static string BuildSelfCheckFingerprint(IEnumerable<AgentControlCenterSelfCheckItem> items)
    {
        return string.Join("|", items
            .OrderBy(item => item.Category, StringComparer.OrdinalIgnoreCase)
            .ThenBy(item => item.Summary, StringComparer.OrdinalIgnoreCase)
            .Select(item => $"{item.Category}:{item.Summary}:{item.ActionId}"));
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
