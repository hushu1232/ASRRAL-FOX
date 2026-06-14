using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Alife.Framework;
using Alife.Function.FunctionCaller;
using Alife.Function.Interpreter;

namespace Alife.Function.Agent;

public sealed record AgentSelfModelSnapshot(
    string CharacterName,
    DateTimeOffset Timestamp,
    AgentStateSnapshot RuntimeState,
    IReadOnlyList<AgentCapabilityInfo> Capabilities,
    IReadOnlyList<ModuleHealth> ModuleHealth,
    AgentTaskState? LatestTask,
    IReadOnlyList<string> SafetyBoundaries,
    IReadOnlyList<LifeEvent> RecentExperiences);

[Module(
    "Agent Self Model",
    "Builds a unified self-model from identity, runtime state, capabilities, health, tasks, safety limits, and recent experiences.",
    defaultCategory: "Alife Official/Agent",
    LaunchOrder = -64)]
public class AgentSelfModelService(
    AgentDiagnosticsService? diagnostics = null,
    AgentTaskService? tasks = null,
    AgentControlCenterService? controlCenter = null,
    ILifeEventStream? lifeEvents = null,
    XmlFunctionCaller? functionCaller = null)
    : InteractiveModule<AgentSelfModelService>, IContextContributor
{
    readonly AgentDiagnosticsService diagnostics = diagnostics ?? new AgentDiagnosticsService();
    readonly AgentTaskService? tasks = tasks;
    readonly AgentControlCenterService? controlCenter = controlCenter;
    readonly ILifeEventStream? lifeEvents = lifeEvents;

    [XmlFunction(FunctionMode.OneShot, name: "agent_self_model")]
    [Description("Show the agent's unified self-model: identity, abilities, limits, current task, health, and recent experiences.")]
    public void ShowSelfModel()
    {
        Poke(FormatForPrompt(BuildSnapshot(ChatBot.GetRuntimeState(), Character.Name)));
    }

    public AgentSelfModelSnapshot BuildSnapshot(ChatRuntimeState runtimeState, string characterName)
    {
        AgentStateSnapshot state = diagnostics.BuildSnapshot(runtimeState, characterName);
        return new AgentSelfModelSnapshot(
            characterName,
            DateTimeOffset.Now,
            state,
            state.Capabilities,
            state.ModuleHealth,
            tasks?.GetLatestTask(),
            BuildSafetyBoundaries(controlCenter?.Configuration),
            lifeEvents?.GetRecentEvents(8) ?? []);
    }

    public IEnumerable<ContextContribution> GetContextContributions()
    {
        ChatRuntimeState runtimeState;
        string characterName;
        try
        {
            runtimeState = ChatBot.GetRuntimeState();
            characterName = Character.Name;
        }
        catch (NullReferenceException)
        {
            return [];
        }

        return [
            new ContextContribution(
                "agent-self-model",
                FormatForPrompt(BuildSnapshot(runtimeState, characterName)),
                Priority: 1100,
                MaxLength: 3200)
        ];
    }

    public override async Task AwakeAsync(AwakeContext context)
    {
        await base.AwakeAsync(context);
        functionCaller?.RegisterHandler(this);
    }

    public static string FormatForPrompt(AgentSelfModelSnapshot snapshot)
    {
        StringBuilder builder = new();
        builder.AppendLine("[Self model]");
        builder.AppendLine($"Identity: {snapshot.CharacterName}");
        builder.AppendLine($"Runtime: {(snapshot.RuntimeState.IsChatting ? "chatting" : "idle")}; pending={snapshot.RuntimeState.PendingPokeCount}; history={snapshot.RuntimeState.ChatHistoryCount}; last_error={snapshot.RuntimeState.LastError ?? "none"}");

        builder.AppendLine("Safety boundaries:");
        if (snapshot.SafetyBoundaries.Count == 0)
            builder.AppendLine("- none");
        foreach (string boundary in snapshot.SafetyBoundaries)
            builder.AppendLine($"- {boundary}");

        builder.AppendLine("Current task:");
        if (snapshot.LatestTask == null)
            builder.AppendLine("- none");
        else
            builder.AppendLine($"- [{snapshot.LatestTask.Status}] {snapshot.LatestTask.Goal}");

        builder.AppendLine("Capabilities:");
        if (snapshot.Capabilities.Count == 0)
            builder.AppendLine("- none");
        foreach (AgentCapabilityInfo capability in snapshot.Capabilities.Take(12))
        {
            builder.Append($"- [{capability.Kind}] {capability.Name}: {capability.Description}");
            if (string.IsNullOrWhiteSpace(capability.CurrentState) == false)
                builder.Append($" State: {capability.CurrentState}");
            builder.AppendLine();
        }

        builder.AppendLine("Module health:");
        if (snapshot.ModuleHealth.Count == 0)
            builder.AppendLine("- none");
        foreach (ModuleHealth health in snapshot.ModuleHealth.Take(10))
            builder.AppendLine($"- [{health.Status}] {health.Name}: {health.Summary}");

        builder.AppendLine("Recent experiences:");
        if (snapshot.RecentExperiences.Count == 0)
            builder.AppendLine("- none");
        foreach (LifeEvent lifeEvent in snapshot.RecentExperiences.TakeLast(8))
            builder.AppendLine($"- {lifeEvent.Timestamp:HH:mm} [{lifeEvent.Kind}] {lifeEvent.Source}: {lifeEvent.Summary}");

        builder.Append("[/Self model]");
        return builder.ToString();
    }

    static IReadOnlyList<string> BuildSafetyBoundaries(AgentControlCenterConfig? config)
    {
        AgentControlCenterConfig effective = config ?? new AgentControlCenterConfig();
        List<string> boundaries = [];

        boundaries.Add(effective.RequireOwnerConfirmationForHighRiskConfiguration
            ? "High-risk actions require owner confirmation."
            : "Owner confirmation for high-risk actions is disabled by current configuration.");
        boundaries.Add(effective.AllowAgentLowRiskSelfConfiguration
            ? "The agent may apply allowlisted low-risk self-configuration."
            : "Agent low-risk self-configuration is disabled.");
        boundaries.Add(effective.AllowMentionWakeup
            ? "Mention wakeup is allowed."
            : "Non-owner mention wakeup is disabled.");
        boundaries.Add(effective.AllowPassiveGroupListening
            ? "Passive group listening is allowed within QQ policy."
            : "Passive group listening is disabled.");
        boundaries.Add(effective.AllowProactiveChat
            ? $"Proactive chat is allowed with intensity {effective.ProactiveChatIntensity}."
            : "Proactive chat is disabled.");

        return boundaries;
    }
}
