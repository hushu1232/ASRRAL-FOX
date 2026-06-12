using Alife.Function.DeskPet;
using System.IO;

namespace Alife.Test.DeskPet;

public class PetServerProcessStartTests
{
    [Test]
    public void ResolveClientStartInfoUsesDllWhenExeIsUnavailable()
    {
        string tempRoot = Path.Combine(Path.GetTempPath(), "alife-pet-start-tests", Guid.NewGuid().ToString("N"));
        string clientRoot = Path.Combine(tempRoot, "Alife.DeskPet.Client");
        Directory.CreateDirectory(clientRoot);
        string dll = Path.Combine(clientRoot, "Alife.DeskPet.Client.dll");
        File.WriteAllText(dll, "dll");
        string modelJson = Path.Combine(clientRoot, "wwwroot", "model", "MoNv", "alife.model.json");

        try
        {
            PetClientStartInfo info = PetServer.ResolveClientStartInfo(tempRoot, modelJson, dotnetPath: "dotnet");

            Assert.That(info.FileName, Is.EqualTo("dotnet"));
            Assert.That(info.Arguments, Does.Contain("Alife.DeskPet.Client.dll"));
            Assert.That(info.Arguments, Does.Contain(modelJson));
            Assert.That(info.WorkingDirectory, Is.EqualTo(clientRoot));
        }
        finally
        {
            if (Directory.Exists(tempRoot))
                Directory.Delete(tempRoot, recursive: true);
        }
    }

    [Test]
    public void ResolveClientStartInfoUsesExeWhenExeExists()
    {
        string tempRoot = Path.Combine(Path.GetTempPath(), "alife-pet-start-tests", Guid.NewGuid().ToString("N"));
        string clientRoot = Path.Combine(tempRoot, "Alife.DeskPet.Client");
        Directory.CreateDirectory(clientRoot);
        string exe = Path.Combine(clientRoot, "Alife.DeskPet.Client.exe");
        File.WriteAllText(exe, "exe");
        string modelJson = Path.Combine(clientRoot, "wwwroot", "model", "MoNv", "alife.model.json");

        try
        {
            PetClientStartInfo info = PetServer.ResolveClientStartInfo(tempRoot, modelJson, dotnetPath: "dotnet");

            Assert.That(info.FileName, Is.EqualTo(exe));
            Assert.That(info.Arguments, Is.EqualTo(modelJson));
            Assert.That(info.WorkingDirectory, Is.EqualTo(clientRoot));
        }
        finally
        {
            if (Directory.Exists(tempRoot))
                Directory.Delete(tempRoot, recursive: true);
        }
    }

    [Test]
    public void ResolveClientStartInfoCanForceDllFallbackWhenExeExists()
    {
        string tempRoot = Path.Combine(Path.GetTempPath(), "alife-pet-start-tests", Guid.NewGuid().ToString("N"));
        string clientRoot = Path.Combine(tempRoot, "Alife.DeskPet.Client");
        Directory.CreateDirectory(clientRoot);
        File.WriteAllText(Path.Combine(clientRoot, "Alife.DeskPet.Client.exe"), "exe");
        File.WriteAllText(Path.Combine(clientRoot, "Alife.DeskPet.Client.dll"), "dll");
        string modelJson = Path.Combine(clientRoot, "wwwroot", "model", "MoNv", "alife.model.json");

        try
        {
            PetClientStartInfo info = PetServer.ResolveClientStartInfo(
                tempRoot,
                modelJson,
                dotnetPath: "dotnet",
                preferDll: true);

            Assert.That(info.FileName, Is.EqualTo("dotnet"));
            Assert.That(info.Arguments, Does.Contain("Alife.DeskPet.Client.dll"));
            Assert.That(info.Arguments, Does.Contain(modelJson));
            Assert.That(info.WorkingDirectory, Is.EqualTo(clientRoot));
        }
        finally
        {
            if (Directory.Exists(tempRoot))
                Directory.Delete(tempRoot, recursive: true);
        }
    }
}
