using Alife.Framework;
using Alife.Platform;
using Microsoft.Extensions.Logging.Abstractions;

namespace Alife.Test.Framework;

public class ChatActivityActivationDiagnosticsTests
{
    [Test]
    public async Task ActivateWritesDiagnosticsWhenCharacterActivationFails()
    {
        await WithTemporaryStorageAsync(async () => {
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
        });
    }

    [Test]
    public async Task ActivateAutoActivateCharactersAttemptsOnlyAutoActivateCharacters()
    {
        await WithTemporaryStorageAsync(async () => {
            string logPath = Path.Combine(AlifePath.StorageFolderPath, "AgentWorkspace", "activation-diagnostics.jsonl");
            if (File.Exists(logPath))
                File.Delete(logPath);

            StorageSystem storage = new();
            CharacterSystem characterSystem = new(storage);
            ConfigurationSystem configurationSystem = new(storage);
            ModuleSystem moduleSystem = new(storage, new NullLogger<ModuleSystem>());
            ChatActivitySystem activitySystem = new(characterSystem, configurationSystem, moduleSystem, storage);

            Character autoCharacter = characterSystem.CreateCharacter($"AutoActivateProbe-{Guid.NewGuid():N}");
            autoCharacter.AutoActivate = true;
            autoCharacter.Modules.Clear();
            characterSystem.SaveCharacter(autoCharacter);

            Character manualCharacter = characterSystem.CreateCharacter($"ManualActivateProbe-{Guid.NewGuid():N}");
            manualCharacter.AutoActivate = false;
            manualCharacter.Modules.Clear();
            characterSystem.SaveCharacter(manualCharacter);

            await activitySystem.ActivateAutoActivateCharacters();

            Assert.That(File.Exists(logPath), Is.True);
            string diagnostics = await File.ReadAllTextAsync(logPath);
            Assert.That(diagnostics, Does.Contain(autoCharacter.Name));
            Assert.That(diagnostics, Does.Not.Contain(manualCharacter.Name));
        });
    }

    static async Task WithTemporaryStorageAsync(Func<Task> test)
    {
        string previousStorage = AlifePath.StorageFolderPath;
        string storageRoot = Path.Combine(Path.GetTempPath(), "alife-activation-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(storageRoot);
        try
        {
            AlifePath.SetStorageFolderPath(storageRoot, persist: false);
            await test();
        }
        finally
        {
            AlifePath.SetStorageFolderPath(previousStorage, persist: false);
        }
    }
}
