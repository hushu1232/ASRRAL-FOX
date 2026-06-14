using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Alife.Framework;
using Alife.Platform;

namespace Alife.Function.MessageFilter;

[Module(
    "Unified Self Context",
    "Builds one self-context prompt that explains selected modules as the character's body, senses, memory, communication, and action abilities.",
    defaultCategory: "Alife Official/Living Environment",
    LaunchOrder = -90)]
public class SelfContextService(IEnumerable<IEmbodiedCapability> capabilities) : InteractiveModule<SelfContextService>
    , IContextContributor
{
    public override async Task AwakeAsync(AwakeContext context)
    {
        await base.AwakeAsync(context);
    }

    public IEnumerable<ContextContribution> GetContextContributions()
    {
        IEmbodiedCapability[] selectedCapabilities = capabilities
            .Where(capability => ReferenceEquals(capability, this) == false)
            .ToArray();
        string prompt = EmbodiedCapabilityPromptFormatter.Format(
            selectedCapabilities,
            ex => AlifeTerminal.LogWarning(ex.ToString()));

        if (string.IsNullOrWhiteSpace(prompt))
            return [];

        return [
            new ContextContribution(
                "self-context",
                prompt,
                Priority: 1000,
                MaxLength: 2600)
        ];
    }
}
