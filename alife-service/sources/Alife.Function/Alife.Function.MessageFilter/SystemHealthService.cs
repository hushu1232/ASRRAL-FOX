using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Alife.Framework;
using Alife.Function.FunctionCaller;
using Alife.Function.Interpreter;

namespace Alife.Function.MessageFilter;

[Module(
    "System Health",
    "Aggregates selected module health reports so the activity can diagnose unavailable or degraded abilities.",
    defaultCategory: "Alife Official/Living Environment",
    LaunchOrder = -75)]
public class SystemHealthService(
    IEnumerable<IModuleHealthReporter> healthReporters,
    XmlFunctionCaller? functionCaller = null) : InteractiveModule<SystemHealthService>
{
    [XmlFunction(FunctionMode.OneShot, name: "system_health")]
    [Description("Show the current health of selected Alife modules and embodied capabilities.")]
    public void SystemHealth()
    {
        Poke(FormatHealthSnapshot(GetHealthSnapshot()));
    }

    public IReadOnlyList<ModuleHealth> GetHealthSnapshot()
    {
        return healthReporters
            .Where(reporter => ReferenceEquals(reporter, this) == false)
            .Select(GetHealthSafely)
            .OrderBy(health => health.Status)
            .ThenBy(health => health.Name, StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    public static string FormatHealthSnapshot(IEnumerable<ModuleHealth> healthSnapshot)
    {
        ModuleHealth[] health = healthSnapshot.ToArray();
        if (health.Length == 0)
            return "No module health reporters are available.";

        StringBuilder builder = new();
        builder.AppendLine("Module health:");
        foreach (ModuleHealth moduleHealth in health)
            builder.AppendLine($"- [{moduleHealth.Status}] {moduleHealth.Name}: {moduleHealth.Summary}");
        return builder.ToString().TrimEnd();
    }

    public override async Task AwakeAsync(AwakeContext context)
    {
        await base.AwakeAsync(context);
        functionCaller?.RegisterHandler(this);
    }

    static ModuleHealth GetHealthSafely(IModuleHealthReporter reporter)
    {
        try
        {
            return reporter.GetHealth();
        }
        catch (Exception ex)
        {
            return new ModuleHealth(
                reporter.GetType().Name,
                ModuleHealthStatus.Unavailable,
                $"health check failed: {ex.Message}");
        }
    }
}
