using System;
using System.Collections.Generic;
using System.Linq;

namespace Alife.Framework;

public sealed record ContextContribution(
    string Key,
    string Content,
    int Priority = 0,
    int MaxLength = 1024);

public interface IContextContributor
{
    IEnumerable<ContextContribution> GetContextContributions();
}

public static class ContextBudgetComposer
{
    public static string Compose(IEnumerable<ContextContribution> contributions, int maxLength)
    {
        if (maxLength <= 0)
            return string.Empty;

        List<string> parts = new();
        int used = 0;
        foreach (ContextContribution contribution in contributions
                     .Where(contribution => string.IsNullOrWhiteSpace(contribution.Content) == false)
                     .OrderByDescending(contribution => contribution.Priority)
                     .ThenBy(contribution => contribution.Key, StringComparer.OrdinalIgnoreCase))
        {
            int separatorLength = parts.Count == 0 ? 0 : 1;
            int remaining = maxLength - used - separatorLength;
            if (remaining <= 0)
                break;

            string content = TrimTo(contribution.Content.Trim(), Math.Min(Math.Max(1, contribution.MaxLength), remaining));
            if (content.Length == 0)
                continue;

            parts.Add(content);
            used += separatorLength + content.Length;
        }

        return string.Join('\n', parts);
    }

    static string TrimTo(string content, int maxLength)
    {
        if (maxLength <= 0)
            return string.Empty;
        if (content.Length <= maxLength)
            return content;
        if (maxLength <= 3)
            return content[..maxLength];

        return content[..(maxLength - 3)] + "...";
    }
}
