using Alife.Framework;
using Alife.Platform;
using Microsoft.Extensions.Logging.Abstractions;

namespace Alife.Test.Framework;

public class ChatActivityActivationDiagnosticsTests
{
    [Test]
    public async Task ActivateWritesDiagnosticsWhenCharacterActivationFails()
    {
        string logPath = Path.Combine(AlifePath.StorageFolderPath, "AgentWorkspace", "activation-diagnostics.jsonl");
        if (File.Exists(logPath))
            File.Delete(logPath);

        StorageSystem storage = new();
        CharacterSystem characterSystem = new(storage);
        ConfigurationSystem configurationSystem = new(storage);
        ModuleSystem moduleSystem = new(storage, new NullLogger<ModuleSystem>());
        ChatActivitySystem activitySystem = new(characterSystem, configurationSystem, moduleSystem, storage);
        Character character = characterSystem.CreateCharacter($"ActivationFailureProbe-{Guid.NewGuid():N}");
        character.Modules.Clear();
        characterSystem.SaveCharacter(character);

        await activitySystem.Activate(character);

        Assert.That(File.Exists(logPath), Is.True);
        string diagnostics = await File.ReadAllTextAsync(logPath);
        Assert.That(diagnostics, Does.Contain(character.Name));
        Assert.That(diagnostics, Does.Contain("activation-failed"));
    }
}
