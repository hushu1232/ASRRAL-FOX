using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Alife.Framework;
using Alife.Function.FunctionCaller;
using Alife.Function.Interpreter;

namespace Alife.Function.QChat;

public sealed record QChatGroupMemberCacheSnapshot(
    long GroupId,
    DateTimeOffset RefreshedAt,
    IReadOnlyList<OneBotGroupMember> Members);

[Module(
    "QQ Relation Cache",
    "Caches QQ group member lists for safer context-aware interaction planning.",
    defaultCategory: "Alife Official/Interaction",
    LaunchOrder = 9)]
public class QChatRelationCacheService(
    IOneBotRuntime? oneBotRuntime = null,
    XmlFunctionCaller? functionCaller = null)
    : InteractiveModule<QChatRelationCacheService>, IContextContributor, IModuleHealthReporter
{
    readonly IOneBotRuntime? oneBotRuntime = oneBotRuntime;
    readonly Dictionary<long, QChatGroupMemberCacheSnapshot> groupMemberCache = new();
    readonly object syncRoot = new();

    [XmlFunction(FunctionMode.OneShot, name: "qchat_group_members_refresh")]
    [Description("Refresh and cache the QQ group member list for a group. This is read-only and does not send messages.")]
    public async Task RefreshGroupMembers(long groupId)
    {
        try
        {
            QChatGroupMemberCacheSnapshot snapshot = await RefreshGroupMembersAsync(groupId);
            Poke(FormatSnapshot(snapshot, maxMembers: 20));
        }
        catch (Exception exception)
        {
            Poke($"QQ group member refresh failed: {exception.Message}");
        }
    }

    [XmlFunction(FunctionMode.OneShot, name: "qchat_group_members_cache")]
    [Description("Show the cached QQ group member list for a group without contacting OneBot.")]
    public void ShowCachedGroupMembers(long groupId)
    {
        Poke(FormatSnapshot(GetCachedGroupMembers(groupId), maxMembers: 20));
    }

    public async Task<QChatGroupMemberCacheSnapshot> RefreshGroupMembersAsync(long groupId)
    {
        if (groupId == 0)
            throw new ArgumentNullException(nameof(groupId));
        if (oneBotRuntime == null)
            throw new InvalidOperationException("OneBot runtime is unavailable.");

        IReadOnlyList<OneBotGroupMember> members = await oneBotRuntime.GetGroupMemberList(groupId);
        OneBotGroupMember[] normalizedMembers = members
            .Where(member => member.UserId != 0)
            .Select(member => member.GroupId == 0 ? member with { GroupId = groupId } : member)
            .ToArray();
        QChatGroupMemberCacheSnapshot snapshot = new(groupId, DateTimeOffset.Now, normalizedMembers);

        lock (syncRoot)
            groupMemberCache[groupId] = snapshot;

        return snapshot;
    }

    public QChatGroupMemberCacheSnapshot GetCachedGroupMembers(long groupId)
    {
        lock (syncRoot)
        {
            if (groupMemberCache.TryGetValue(groupId, out QChatGroupMemberCacheSnapshot? snapshot))
                return snapshot;
        }

        return new QChatGroupMemberCacheSnapshot(groupId, DateTimeOffset.MinValue, []);
    }

    public IReadOnlyList<QChatGroupMemberCacheSnapshot> GetCachedGroups()
    {
        lock (syncRoot)
            return groupMemberCache.Values.OrderByDescending(snapshot => snapshot.RefreshedAt).ToArray();
    }

    public OneBotGroupMember? TryGetMember(long groupId, long userId)
    {
        return GetCachedGroupMembers(groupId).Members.FirstOrDefault(member => member.UserId == userId);
    }

    public IEnumerable<ContextContribution> GetContextContributions()
    {
        QChatGroupMemberCacheSnapshot[] snapshots;
        lock (syncRoot)
            snapshots = groupMemberCache.Values.OrderByDescending(snapshot => snapshot.RefreshedAt).Take(3).ToArray();

        if (snapshots.Length == 0)
            return [];

        StringBuilder builder = new();
        builder.AppendLine("[QQ relation cache]");
        foreach (QChatGroupMemberCacheSnapshot snapshot in snapshots)
        {
            builder.AppendLine($"Group {snapshot.GroupId}: {snapshot.Members.Count} cached members");
            foreach (OneBotGroupMember member in snapshot.Members.Take(12))
            {
                builder.Append("- ");
                builder.Append(member.UserId);
                builder.Append(' ');
                builder.Append(member.DisplayName);
                if (string.IsNullOrWhiteSpace(member.Role) == false)
                    builder.Append($" ({member.Role})");
                builder.AppendLine();
            }
        }
        builder.Append("[/QQ relation cache]");

        return [
            new ContextContribution(
                "qchat-relation-cache",
                builder.ToString(),
                Priority: 720,
                MaxLength: 1800)
        ];
    }

    public ModuleHealth GetHealth()
    {
        if (oneBotRuntime == null)
            return new ModuleHealth("QChatRelationCache", ModuleHealthStatus.Unavailable, "OneBot runtime is unavailable.");

        int cachedGroups;
        int cachedMembers;
        lock (syncRoot)
        {
            cachedGroups = groupMemberCache.Count;
            cachedMembers = groupMemberCache.Values.Sum(snapshot => snapshot.Members.Count);
        }

        if (oneBotRuntime.IsConnected == false)
        {
            return new ModuleHealth(
                "QChatRelationCache",
                ModuleHealthStatus.Degraded,
                $"OneBot is disconnected; {FormatCacheCounts(cachedGroups, cachedMembers)}.");
        }

        return new ModuleHealth(
            "QChatRelationCache",
            ModuleHealthStatus.Healthy,
            $"OneBot is connected; {FormatCacheCounts(cachedGroups, cachedMembers)}.");
    }

    public override async Task AwakeAsync(AwakeContext context)
    {
        await base.AwakeAsync(context);
        functionCaller?.RegisterHandler(this);
    }

    public static string FormatSnapshot(QChatGroupMemberCacheSnapshot snapshot, int maxMembers = 30)
    {
        StringBuilder builder = new();
        builder.AppendLine($"QQ group members: {snapshot.GroupId}");
        builder.AppendLine(snapshot.RefreshedAt == DateTimeOffset.MinValue
            ? "- cache: empty"
            : $"- refreshed: {snapshot.RefreshedAt:yyyy-MM-dd HH:mm:ss}");
        builder.AppendLine($"- count: {snapshot.Members.Count}");

        foreach (OneBotGroupMember member in snapshot.Members.Take(Math.Max(0, maxMembers)))
        {
            builder.Append("- ");
            builder.Append(member.UserId);
            builder.Append(' ');
            builder.Append(member.DisplayName);
            if (string.IsNullOrWhiteSpace(member.Role) == false)
                builder.Append($" role={member.Role}");
            if (string.IsNullOrWhiteSpace(member.Title) == false)
                builder.Append($" title={member.Title}");
            builder.AppendLine();
        }

        return builder.ToString().TrimEnd();
    }

    static string FormatCacheCounts(int groups, int members)
    {
        return $"{groups} cached {(groups == 1 ? "group" : "groups")}, {members} {(members == 1 ? "member" : "members")} cached";
    }
}
