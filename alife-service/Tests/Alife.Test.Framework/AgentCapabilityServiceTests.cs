using Alife.Framework;
using Alife.Function.Agent;
using Alife.Function.Interpreter;

namespace Alife.Test.Framework;

public class AgentCapabilityServiceTests
{
    [Test]
    public void DiagnosticsSnapshotIncludesRuntimeHealthAndCapabilities()
    {
        AgentDiagnosticsService service = new(
            [
                new StubHealthReporter("Memory", ModuleHealthStatus.Healthy, "Memory is ready."),
                new StubHealthReporter("Browser", ModuleHealthStatus.Degraded, "Browser is loading.")
            ],
            [
                new StubCapability("Memory", EmbodiedCapabilityKind.Memory, "Persistent memory.", "ready"),
                new StubCapability("Browser", EmbodiedCapabilityKind.Sense, "Real browser.", "loading")
            ]);
        ChatRuntimeState runtime = new(
            IsChatting: true,
            PendingPokeCount: 2,
            ChatHistoryCount: 9,
            LastError: "last failure",
            RecentEvents: [new ChatRuntimeEvent(DateTimeOffset.Parse("2026-06-14T00:00:00Z"), "Error", "last failure")]);

        AgentStateSnapshot snapshot = service.BuildSnapshot(runtime, "Kira");
        string report = AgentDiagnosticsService.FormatSnapshot(snapshot);

        Assert.That(snapshot.CharacterName, Is.EqualTo("Kira"));
        Assert.That(snapshot.IsChatting, Is.True);
        Assert.That(snapshot.PendingPokeCount, Is.EqualTo(2));
        Assert.That(snapshot.ModuleHealth.Select(health => health.Name), Does.Contain("Memory"));
        Assert.That(snapshot.Capabilities.Select(capability => capability.Name), Does.Contain("Browser"));
        Assert.That(report, Does.Contain("Agent state: Kira"));
        Assert.That(report, Does.Contain("Last error: last failure"));
        Assert.That(report, Does.Contain("[Healthy] Memory: Memory is ready."));
        Assert.That(report, Does.Contain("[Sense] Browser: Real browser. State: loading"));
    }

    [Test]
    public void WorkspaceReadAndSearchStayInsideAllowedRoot()
    {
        string root = CreateTempWorkspace();
        string file = Path.Combine(root, "notes", "status.txt");
        Directory.CreateDirectory(Path.GetDirectoryName(file)!);
        File.WriteAllText(file, "alpha\nimportant status\nomega");
        AgentWorkspaceService workspace = new(new AgentWorkspacePolicy([root]));

        AgentWorkspaceReadResult read = workspace.ReadText("notes/status.txt", maxChars: 100);
        IReadOnlyList<AgentWorkspaceSearchMatch> matches = workspace.SearchText("important", ".", maxMatches: 10);

        Assert.That(read.RelativePath, Is.EqualTo("notes/status.txt"));
        Assert.That(read.Content, Does.Contain("important status"));
        Assert.That(matches, Has.Count.EqualTo(1));
        Assert.That(matches[0].LineNumber, Is.EqualTo(2));
        Assert.Throws<UnauthorizedAccessException>(() => workspace.ReadText("../outside.txt"));
    }

    [Test]
    public void WorkspaceListShowsDirectChildrenInsideAllowedRoot()
    {
        string root = CreateTempWorkspace();
        Directory.CreateDirectory(Path.Combine(root, "src"));
        Directory.CreateDirectory(Path.Combine(root, "docs"));
        File.WriteAllText(Path.Combine(root, "README.md"), "hello");
        File.WriteAllText(Path.Combine(root, "src", "Program.cs"), "class Program {}");
        AgentWorkspaceService workspace = new(new AgentWorkspacePolicy([root]));

        IReadOnlyList<AgentWorkspaceEntry> entries = workspace.ListEntries(".", maxEntries: 10);

        Assert.That(entries.Select(entry => entry.RelativePath), Is.EqualTo(new[] { "docs", "src", "README.md" }));
        Assert.That(entries.Single(entry => entry.RelativePath == "src").IsDirectory, Is.True);
        Assert.That(entries.Single(entry => entry.RelativePath == "README.md").IsDirectory, Is.False);
        Assert.That(entries.Single(entry => entry.RelativePath == "README.md").SizeBytes, Is.GreaterThan(0));
        Assert.Throws<UnauthorizedAccessException>(() => workspace.ListEntries("../outside", maxEntries: 10));
    }

    [Test]
    public void WorkspaceReadLinesReturnsLineNumberedRangeInsideAllowedRoot()
    {
        string root = CreateTempWorkspace();
        string file = Path.Combine(root, "src", "Program.cs");
        Directory.CreateDirectory(Path.GetDirectoryName(file)!);
        File.WriteAllText(file, "line one\nline two\nline three\nline four");
        AgentWorkspaceService workspace = new(new AgentWorkspacePolicy([root]));

        AgentWorkspaceLineReadResult result = workspace.ReadLines("src/Program.cs", startLine: 2, lineCount: 2);

        Assert.That(result.RelativePath, Is.EqualTo("src/Program.cs"));
        Assert.That(result.TotalLines, Is.EqualTo(4));
        Assert.That(result.StartLine, Is.EqualTo(2));
        Assert.That(result.EndLine, Is.EqualTo(3));
        Assert.That(result.Truncated, Is.True);
        Assert.That(result.Lines.Select(line => $"{line.LineNumber}:{line.Text}"),
            Is.EqualTo(new[] { "2:line two", "3:line three" }));
        Assert.Throws<UnauthorizedAccessException>(() => workspace.ReadLines("../outside.cs", startLine: 1, lineCount: 2));
    }

    [Test]
    public void WorkspaceWriteAndReplaceRequireAllowedRootAndExactMatch()
    {
        string root = CreateTempWorkspace();
        AgentWorkspaceService workspace = new(new AgentWorkspacePolicy([root]));

        AgentWorkspaceWriteResult write = workspace.WriteText("src/AgentNote.cs", "class AgentNote {}", overwrite: false);
        AgentWorkspaceReplaceResult replace = workspace.ReplaceText("src/AgentNote.cs", "AgentNote", "GeneratedAgentNote");

        Assert.That(write.Created, Is.True);
        Assert.That(replace.ReplacedCount, Is.EqualTo(1));
        Assert.That(File.ReadAllText(Path.Combine(root, "src", "AgentNote.cs")), Does.Contain("GeneratedAgentNote"));
        Assert.Throws<InvalidOperationException>(() => workspace.WriteText("src/AgentNote.cs", "overwrite", overwrite: false));
        Assert.Throws<UnauthorizedAccessException>(() => workspace.WriteText("../escape.cs", "bad", overwrite: true));
    }

    [Test]
    public void WorkspaceMutationsRecordHighRiskAuditEntries()
    {
        string root = CreateTempWorkspace();
        AgentAuditLogService audit = new(Path.Combine(root, "audit.jsonl"));
        AgentWorkspaceService workspace = new(new AgentWorkspacePolicy([root]), auditLog: audit);

        workspace.WriteText("src/AgentNote.cs", "class AgentNote {}", overwrite: false);
        workspace.ReplaceText("src/AgentNote.cs", "AgentNote", "GeneratedAgentNote");
        Assert.Throws<InvalidOperationException>(() =>
            workspace.WriteText("src/AgentNote.cs", "overwrite", overwrite: false));

        IReadOnlyList<AgentAuditLogEntry> entries = audit.GetRecentEntries(10);

        Assert.That(entries.Select(entry => entry.Action), Does.Contain("workspace.write"));
        Assert.That(entries.Select(entry => entry.Action), Does.Contain("workspace.replace"));
        Assert.That(entries.Count(entry => entry.Action == "workspace.write"), Is.EqualTo(2));
        Assert.That(entries.Where(entry => entry.Action.StartsWith("workspace.", StringComparison.Ordinal))
            .All(entry => entry.RiskLevel == AgentAuditRiskLevel.High), Is.True);
        Assert.That(entries.Any(entry => entry.Action == "workspace.write" && entry.Succeeded), Is.True);
        Assert.That(entries.Any(entry => entry.Action == "workspace.write" && entry.Succeeded == false), Is.True);
        Assert.That(entries.Select(entry => entry.Detail), Has.Some.Contains("src/AgentNote.cs"));
    }

    [Test]
    public void WorkspaceReplaceProposalPreviewsBeforeApplyingMutation()
    {
        string root = CreateTempWorkspace();
        string file = Path.Combine(root, "src", "AgentNote.cs");
        Directory.CreateDirectory(Path.GetDirectoryName(file)!);
        File.WriteAllText(file, "namespace Demo;\nclass AgentNote {}\n");
        AgentAuditLogService audit = new(Path.Combine(root, "audit.jsonl"));
        AgentWorkspaceService workspace = new(new AgentWorkspacePolicy([root]), auditLog: audit);

        AgentWorkspacePatchProposal proposal = workspace.ProposeReplace(
            "src/AgentNote.cs",
            "class AgentNote {}",
            "class GeneratedAgentNote {}");

        Assert.That(proposal.RelativePath, Is.EqualTo("src/AgentNote.cs"));
        Assert.That(proposal.Preview, Does.Contain("- class AgentNote {}"));
        Assert.That(proposal.Preview, Does.Contain("+ class GeneratedAgentNote {}"));
        Assert.That(File.ReadAllText(file), Does.Contain("class AgentNote {}"));

        AgentWorkspaceReplaceResult result = workspace.ApplyProposedReplace(proposal.Id);

        Assert.That(result.ReplacedCount, Is.EqualTo(1));
        Assert.That(File.ReadAllText(file), Does.Contain("class GeneratedAgentNote {}"));
        Assert.That(audit.GetRecentEntries(10).Select(entry => entry.Action), Does.Contain("workspace.replace"));
    }

    [Test]
    public void WorkspaceServiceListsPendingReplaceProposals()
    {
        string root = CreateTempWorkspace();
        string file = Path.Combine(root, "src", "AgentNote.cs");
        Directory.CreateDirectory(Path.GetDirectoryName(file)!);
        File.WriteAllText(file, "class AgentNote {}\n");
        AgentWorkspaceService workspace = new(new AgentWorkspacePolicy([root]));

        AgentWorkspacePatchProposal proposal = workspace.ProposeReplace(
            "src/AgentNote.cs",
            "AgentNote",
            "GeneratedAgentNote");

        IReadOnlyList<AgentWorkspacePatchProposal> proposals = workspace.GetPendingProposals();

        Assert.That(proposals.Select(item => item.Id), Does.Contain(proposal.Id));
        Assert.That(proposals[0].RelativePath, Is.EqualTo("src/AgentNote.cs"));
        Assert.That(proposals[0].Preview, Does.Contain("- AgentNote"));
        Assert.That(File.ReadAllText(file), Does.Contain("class AgentNote {}"));
    }

    [Test]
    public void WorkspaceDefaultPolicyIncludesCurrentDirectoryForProjectCodeWork()
    {
        AgentWorkspaceService workspace = new();

        Assert.That(workspace.AllowedRoots, Does.Contain(Path.GetFullPath(Environment.CurrentDirectory)));
    }

    [Test]
    public void AuditLogRecordsRecentEntriesAndPersistsJsonLines()
    {
        string root = CreateTempWorkspace();
        string auditFile = Path.Combine(root, "audit.jsonl");
        AgentAuditLogService audit = new(auditFile, maxRetainedEntries: 2);

        audit.Record("workspace.write", "owner", "created a file", AgentAuditRiskLevel.High, true);
        audit.Record("agent.command", "owner", "ran test command", AgentAuditRiskLevel.High, false, "exit 1");
        audit.Record("agent.state", "system", "read status", AgentAuditRiskLevel.Low, true);

        IReadOnlyList<AgentAuditLogEntry> recent = audit.GetRecentEntries(10);
        string persisted = File.ReadAllText(auditFile);

        Assert.That(recent, Has.Count.EqualTo(2));
        Assert.That(recent[0].Action, Is.EqualTo("agent.command"));
        Assert.That(recent[1].Action, Is.EqualTo("agent.state"));
        Assert.That(persisted, Does.Contain("workspace.write"));
        Assert.That(persisted, Does.Contain("exit 1"));
    }

    [Test]
    public void AuditLogReloadsRecentEntriesFromExistingJsonLines()
    {
        string root = CreateTempWorkspace();
        string auditFile = Path.Combine(root, "audit.jsonl");
        AgentAuditLogService audit = new(auditFile, maxRetainedEntries: 2);
        audit.Record("agent.first", "owner", "first", AgentAuditRiskLevel.Low, true);
        audit.Record("agent.second", "owner", "second", AgentAuditRiskLevel.Medium, true);
        audit.Record("agent.third", "owner", "third", AgentAuditRiskLevel.High, false, "failed");

        AgentAuditLogService reloaded = new(auditFile, maxRetainedEntries: 2);
        IReadOnlyList<AgentAuditLogEntry> recent = reloaded.GetRecentEntries(10);

        Assert.That(recent.Select(entry => entry.Action), Is.EqualTo(new[] { "agent.second", "agent.third" }));
        Assert.That(recent[1].Error, Is.EqualTo("failed"));
    }

    [Test]
    public async Task CommandServiceRunsOnlyWhitelistedCommandsAndAuditsResult()
    {
        AgentAuditLogService audit = new(Path.Combine(CreateTempWorkspace(), "audit.jsonl"));
        FakeCommandRunner runner = new();
        AgentCommandService service = new(
            new AgentCommandPolicy([
                new AgentCommandDefinition("check", "Check project", "dotnet", "test", CreateTempWorkspace(), TimeSpan.FromSeconds(5))
            ]),
            runner,
            audit);

        AgentCommandResult result = await service.RunAllowedCommandAsync("check", "owner", CancellationToken.None);

        Assert.That(result.CommandId, Is.EqualTo("check"));
        Assert.That(result.ExitCode, Is.EqualTo(0));
        Assert.That(result.Output, Is.EqualTo("ok"));
        Assert.That(runner.LastRequest?.FileName, Is.EqualTo("dotnet"));
        Assert.That(runner.LastRequest?.Arguments, Is.EqualTo("test"));
        Assert.That(audit.GetRecentEntries(1)[0].Action, Is.EqualTo("agent.command.check"));
        Assert.ThrowsAsync<UnauthorizedAccessException>(() => service.RunAllowedCommandAsync("unknown", "owner", CancellationToken.None));
    }

    [Test]
    public void CommandServiceDefaultPolicyIncludesBuildAndTestVerificationCommands()
    {
        AgentCommandService service = new();

        string[] commandIds = service.AllowedCommands.Select(command => command.Id).ToArray();

        Assert.That(commandIds, Does.Contain("git-status"));
        Assert.That(commandIds, Does.Contain("git-diff"));
        Assert.That(commandIds, Does.Contain("dotnet-build-solution"));
        Assert.That(commandIds, Does.Contain("dotnet-test-solution"));
        Assert.That(service.AllowedCommands.Single(command => command.Id == "dotnet-test-solution").Arguments,
            Does.Contain("--no-restore"));
    }

    [Test]
    public void CommandServiceDefaultPolicyUsesConfiguredDotnetExecutable()
    {
        string? previous = Environment.GetEnvironmentVariable("ALIFE_AGENT_DOTNET_PATH");
        string configuredDotnet = Path.Combine(CreateTempWorkspace(), "dotnet.exe");
        try
        {
            Environment.SetEnvironmentVariable("ALIFE_AGENT_DOTNET_PATH", configuredDotnet);

            AgentCommandService service = new();

            Assert.That(service.AllowedCommands.Single(command => command.Id == "dotnet-build-solution").FileName,
                Is.EqualTo(configuredDotnet));
            Assert.That(service.AllowedCommands.Single(command => command.Id == "dotnet-test-solution").FileName,
                Is.EqualTo(configuredDotnet));
        }
        finally
        {
            Environment.SetEnvironmentVariable("ALIFE_AGENT_DOTNET_PATH", previous);
        }
    }

    [Test]
    public void PermissionPolicyAllowsOwnerHighRiskOnlyWithExplicitConfirmation()
    {
        AgentPermissionPolicy policy = new(new AgentPermissionConfig
        {
            OwnerUserIds = [10001],
            AllowGroupLowRisk = true,
            AllowGroupMediumRiskWhenMentioned = true,
            RequireConfirmationForHighRisk = true
        });

        AgentPermissionDecision ownerNoConfirm = policy.Evaluate(new AgentPermissionRequest(
            ActorUserId: 10001,
            Source: AgentRequestSource.PrivateChat,
            IsMentioned: false,
            RiskLevel: AgentRiskLevel.High,
            HasExplicitConfirmation: false,
            Action: "agent.run"));
        AgentPermissionDecision ownerConfirmed = policy.Evaluate(new AgentPermissionRequest(
            ActorUserId: 10001,
            Source: AgentRequestSource.PrivateChat,
            IsMentioned: false,
            RiskLevel: AgentRiskLevel.High,
            HasExplicitConfirmation: true,
            Action: "agent.run"));
        AgentPermissionDecision guestGroup = policy.Evaluate(new AgentPermissionRequest(
            ActorUserId: 20002,
            Source: AgentRequestSource.GroupChat,
            IsMentioned: false,
            RiskLevel: AgentRiskLevel.Medium,
            HasExplicitConfirmation: true,
            Action: "workspace.write"));

        Assert.That(ownerNoConfirm.Allowed, Is.False);
        Assert.That(ownerNoConfirm.Reason, Does.Contain("confirmation"));
        Assert.That(ownerConfirmed.Allowed, Is.True);
        Assert.That(ownerConfirmed.Priority, Is.EqualTo(AgentActorPriority.Owner));
        Assert.That(guestGroup.Allowed, Is.False);
    }

    [Test]
    public void TaskServiceTracksLifecycleAndAuditTrail()
    {
        AgentAuditLogService audit = new(Path.Combine(CreateTempWorkspace(), "audit.jsonl"));
        AgentTaskService tasks = new(audit);

        AgentTaskState created = tasks.CreateTask("owner", "Improve agent safety", ["inspect", "implement"]);
        AgentTaskState running = tasks.StartTask(created.Id, "owner");
        AgentTaskState progressed = tasks.RecordProgress(created.Id, "owner", "implemented permission policy");
        AgentTaskState completed = tasks.CompleteTask(created.Id, "owner", "all checks passed");

        Assert.That(created.Status, Is.EqualTo(AgentTaskStatus.Planned));
        Assert.That(running.Status, Is.EqualTo(AgentTaskStatus.Running));
        Assert.That(progressed.Events.Last().Detail, Is.EqualTo("implemented permission policy"));
        Assert.That(completed.Status, Is.EqualTo(AgentTaskStatus.Completed));
        Assert.That(tasks.GetTask(created.Id), Is.EqualTo(completed));
        Assert.That(audit.GetRecentEntries(10).Select(entry => entry.Action), Does.Contain("agent.task.completed"));
        Assert.Throws<InvalidOperationException>(() => tasks.CancelTask(created.Id, "owner", "too late"));
    }

    [Test]
    public void TaskServicePersistsAndReloadsTaskState()
    {
        string root = CreateTempWorkspace();
        string taskStorePath = Path.Combine(root, "agent-tasks.json");
        AgentTaskService tasks = new(taskStorePath: taskStorePath);

        AgentTaskState created = tasks.CreateTask("owner", "Persist agent task", ["inspect", "verify"]);
        AgentTaskState running = tasks.StartTask(created.Id, "owner");
        tasks.RecordProgress(running.Id, "owner", "state written to disk");

        AgentTaskService reloaded = new(taskStorePath: taskStorePath);
        AgentTaskState? restored = reloaded.GetTask(created.Id);

        Assert.That(restored, Is.Not.Null);
        Assert.That(restored!.Goal, Is.EqualTo("Persist agent task"));
        Assert.That(restored.Status, Is.EqualTo(AgentTaskStatus.Running));
        Assert.That(restored.Steps, Is.EqualTo(new[] { "inspect", "verify" }));
        Assert.That(restored.Events.Select(taskEvent => taskEvent.Kind), Does.Contain("progress"));
        Assert.That(reloaded.GetLatestTask()?.Id, Is.EqualTo(created.Id));
    }

    [Test]
    public void TaskServiceXmlToolsExposeLifecycleAndParseStepText()
    {
        AgentTaskService tasks = new();

        AgentTaskState task = tasks.CreateTaskFromText("agent", "Improve agent task tools", "inspect\nimplement; verify");
        AgentTaskState running = tasks.StartTask(task.Id, "agent");
        AgentTaskState progressed = tasks.RecordProgress(running.Id, "agent", "implemented XML methods");

        string[] xmlFunctionNames = typeof(AgentTaskService)
            .GetMethods()
            .Select(method => method.GetCustomAttributes(typeof(XmlFunctionAttribute), inherit: false)
                .OfType<XmlFunctionAttribute>()
                .FirstOrDefault())
            .OfType<XmlFunctionAttribute>()
            .Select(attribute => attribute.Name ?? string.Empty)
            .ToArray();

        Assert.That(task.Steps, Is.EqualTo(new[] { "inspect", "implement", "verify" }));
        Assert.That(progressed.Events.Last().Kind, Is.EqualTo("progress"));
        Assert.That(xmlFunctionNames, Does.Contain("agent_task_create"));
        Assert.That(xmlFunctionNames, Does.Contain("agent_task_start"));
        Assert.That(xmlFunctionNames, Does.Contain("agent_task_progress"));
        Assert.That(xmlFunctionNames, Does.Contain("agent_task_complete"));
        Assert.That(xmlFunctionNames, Does.Contain("agent_task_fail"));
        Assert.That(xmlFunctionNames, Does.Contain("agent_task_cancel"));
    }

    [Test]
    public void ProjectStatusSummarizesWorkspaceCommandsAndRecentAudit()
    {
        string root = CreateTempWorkspace();
        AgentWorkspacePolicy workspacePolicy = new([root]);
        AgentCommandPolicy commandPolicy = new([
            new AgentCommandDefinition("test", "Run focused tests", "dotnet", "test", root, TimeSpan.FromSeconds(30))
        ]);
        AgentAuditLogService audit = new(Path.Combine(root, "audit.jsonl"));
        audit.Record("workspace.read", "agent", "read status", AgentAuditRiskLevel.Low, true);
        AgentProjectStatusService service = new(workspacePolicy, commandPolicy, audit);

        AgentProjectStatusSnapshot snapshot = service.BuildSnapshot(maxAuditEntries: 5);
        string report = AgentProjectStatusService.FormatSnapshot(snapshot);

        Assert.That(snapshot.WorkspaceRoots, Does.Contain(Path.GetFullPath(root)));
        Assert.That(snapshot.AllowedCommands.Select(command => command.Id), Does.Contain("test"));
        Assert.That(snapshot.RecentAuditEntries.Select(entry => entry.Action), Does.Contain("workspace.read"));
        Assert.That(report, Does.Contain("Agent project status"));
        Assert.That(report, Does.Contain("Workspace roots:"));
        Assert.That(report, Does.Contain("test: Run focused tests"));
        Assert.That(report, Does.Contain("workspace.read"));
    }

    [Test]
    public void ProjectStatusDefaultPolicyReportsBuildAndTestVerificationCommands()
    {
        AgentProjectStatusService service = new();

        AgentProjectStatusSnapshot snapshot = service.BuildSnapshot();

        Assert.That(snapshot.AllowedCommands.Select(command => command.Id), Does.Contain("dotnet-build-solution"));
        Assert.That(snapshot.AllowedCommands.Select(command => command.Id), Does.Contain("dotnet-test-solution"));
    }

    [Test]
    public void IssueReportCombinesRuntimeErrorsFailedAuditAndUnhealthyModules()
    {
        string root = CreateTempWorkspace();
        AgentAuditLogService audit = new(Path.Combine(root, "audit.jsonl"));
        audit.Record("agent.command.test", "owner", "dotnet test", AgentAuditRiskLevel.High, false, "exit 1");
        AgentIssueReportService service = new(
            audit,
            [
                new StubHealthReporter("QChat", ModuleHealthStatus.Degraded, "OneBot disconnected."),
                new StubHealthReporter("Memory", ModuleHealthStatus.Healthy, "Memory ready.")
            ]);
        ChatRuntimeState runtime = new(
            IsChatting: false,
            PendingPokeCount: 0,
            ChatHistoryCount: 12,
            LastError: "LLM request failed",
            RecentEvents: [
                new ChatRuntimeEvent(DateTimeOffset.Parse("2026-06-14T01:00:00Z"), "Info", "started"),
                new ChatRuntimeEvent(DateTimeOffset.Parse("2026-06-14T01:01:00Z"), "Error", "LLM request failed")
            ]);

        AgentIssueReportSnapshot snapshot = service.BuildSnapshot(runtime, maxAuditEntries: 5);
        string report = AgentIssueReportService.FormatSnapshot(snapshot);

        Assert.That(snapshot.LastError, Is.EqualTo("LLM request failed"));
        Assert.That(snapshot.RuntimeErrors.Select(runtimeEvent => runtimeEvent.Detail), Does.Contain("LLM request failed"));
        Assert.That(snapshot.FailedAuditEntries.Select(entry => entry.Action), Does.Contain("agent.command.test"));
        Assert.That(snapshot.UnhealthyModules.Select(module => module.Name), Does.Contain("QChat"));
        Assert.That(snapshot.UnhealthyModules.Select(module => module.Name), Does.Not.Contain("Memory"));
        Assert.That(report, Does.Contain("Agent issue report"));
        Assert.That(report, Does.Contain("LLM request failed"));
        Assert.That(report, Does.Contain("agent.command.test"));
        Assert.That(report, Does.Contain("[Degraded] QChat"));
    }

    [Test]
    public void AgentControlCenterBuildsReadOnlySnapshot()
    {
        string root = CreateTempWorkspace();
        AgentAuditLogService audit = new(Path.Combine(root, "audit.jsonl"));
        audit.Record("workspace.replace", "owner", "path=src/AgentNote.cs", AgentAuditRiskLevel.High, true);
        audit.Record("agent.command.test", "owner", "dotnet test", AgentAuditRiskLevel.High, false, "exit 1");
        AgentTaskService tasks = new(audit, taskStorePath: Path.Combine(root, "tasks.json"));
        AgentTaskState task = tasks.CreateTask("owner", "Build control center", ["inspect", "render"]);
        tasks.StartTask(task.Id, "owner");
        AgentWorkspaceService workspace = new(new AgentWorkspacePolicy([root]), auditLog: audit);
        string file = Path.Combine(root, "src", "AgentNote.cs");
        Directory.CreateDirectory(Path.GetDirectoryName(file)!);
        File.WriteAllText(file, "class AgentNote {}\n");
        workspace.ProposeReplace("src/AgentNote.cs", "AgentNote", "GeneratedAgentNote");
        AgentCommandPolicy commandPolicy = new([
            new AgentCommandDefinition("test", "Run tests", "dotnet", "test", root, TimeSpan.FromSeconds(30))
        ]);
        AgentControlCenterService service = new(
            new AgentDiagnosticsService(
                [new StubHealthReporter("QChat", ModuleHealthStatus.Degraded, "OneBot disconnected.")],
                [new StubCapability("Workspace", EmbodiedCapabilityKind.Tool, "Restricted workspace tools.", "ready")]),
            new AgentIssueReportService(
                audit,
                [new StubHealthReporter("QChat", ModuleHealthStatus.Degraded, "OneBot disconnected.")]),
            tasks,
            workspace,
            new AgentWorkspacePolicy([root]),
            commandPolicy,
            audit);
        ChatRuntimeState runtime = new(
            IsChatting: true,
            PendingPokeCount: 1,
            ChatHistoryCount: 5,
            LastError: "LLM request failed",
            RecentEvents: [new ChatRuntimeEvent(DateTimeOffset.Now, "Error", "LLM request failed")]);

        AgentControlCenterSnapshot snapshot = service.BuildSnapshot(runtime, "Kira");

        Assert.That(snapshot.AgentState.CharacterName, Is.EqualTo("Kira"));
        Assert.That(snapshot.AgentState.IsChatting, Is.True);
        Assert.That(snapshot.LatestTask?.Goal, Is.EqualTo("Build control center"));
        Assert.That(snapshot.PendingWorkspaceProposals, Has.Count.EqualTo(1));
        Assert.That(snapshot.AllowedCommands.Select(command => command.Id), Does.Contain("test"));
        Assert.That(snapshot.RecentAuditEntries.Select(entry => entry.Action), Does.Contain("workspace.replace"));
        Assert.That(snapshot.IssueReport.LastError, Is.EqualTo("LLM request failed"));
        Assert.That(snapshot.IssueReport.FailedAuditEntries.Select(entry => entry.Action), Does.Contain("agent.command.test"));
        Assert.That(snapshot.WorkspaceRoots, Does.Contain(Path.GetFullPath(root)));
    }

    [Test]
    public void AgentControlCenterTaskActionsUpdateStateAndAudit()
    {
        string root = CreateTempWorkspace();
        AgentAuditLogService audit = new(Path.Combine(root, "audit.jsonl"));
        AgentTaskService tasks = new(audit, taskStorePath: Path.Combine(root, "tasks.json"));
        AgentTaskState task = tasks.CreateTask("owner", "Operate from control center", ["start", "complete"]);
        AgentControlCenterService service = new(tasks: tasks, auditLog: audit);

        AgentTaskState running = service.StartTaskFromControlCenter(task.Id);
        AgentTaskState completed = service.CompleteTaskFromControlCenter(task.Id, "verified from UI");

        Assert.That(running.Status, Is.EqualTo(AgentTaskStatus.Running));
        Assert.That(completed.Status, Is.EqualTo(AgentTaskStatus.Completed));
        Assert.That(tasks.GetLatestTask()?.Status, Is.EqualTo(AgentTaskStatus.Completed));
        Assert.That(audit.GetRecentEntries(10).Select(entry => entry.Action), Does.Contain("agent.task.completed"));
        Assert.That(audit.GetRecentEntries(10).Select(entry => entry.Actor), Does.Contain("agent-control-ui"));
    }

    [Test]
    public void AgentControlCenterBuildsOwnerConfirmationTextForWorkspaceProposal()
    {
        AgentWorkspacePatchProposal proposal = new(
            "abc123",
            "D:/workspace/src/AgentNote.cs",
            "src/AgentNote.cs",
            "AgentNote",
            "GeneratedAgentNote",
            "- AgentNote\n+ GeneratedAgentNote",
            DateTimeOffset.Now);

        string confirmation = AgentControlCenterService.BuildWorkspaceProposalConfirmationText(proposal);

        Assert.That(confirmation, Does.Contain("confirm execute"));
        Assert.That(confirmation, Does.Contain("workspace_apply_proposal"));
        Assert.That(confirmation, Does.Contain("abc123"));
    }

    static string CreateTempWorkspace()
    {
        string root = Path.Combine(Path.GetTempPath(), "alife-agent-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        return root;
    }

    sealed record StubHealthReporter(
        string Name,
        ModuleHealthStatus Status,
        string Summary) : IModuleHealthReporter
    {
        public ModuleHealth GetHealth() => new(Name, Status, Summary);
    }

    sealed record StubCapability(
        string Name,
        EmbodiedCapabilityKind Kind,
        string SelfDescription,
        string? CurrentState) : IEmbodiedCapability
    {
        public string? GetCurrentState() => CurrentState;
    }

    sealed class FakeCommandRunner : IAgentCommandRunner
    {
        public AgentCommandRequest? LastRequest { get; private set; }

        public Task<AgentCommandResult> RunAsync(AgentCommandRequest request, CancellationToken cancellationToken)
        {
            LastRequest = request;
            return Task.FromResult(new AgentCommandResult(request.CommandId, 0, "ok", "", TimeSpan.FromMilliseconds(5)));
        }
    }
}
