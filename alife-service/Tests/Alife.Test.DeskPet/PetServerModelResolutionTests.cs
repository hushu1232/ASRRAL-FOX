using System.IO;
using Alife.Function.DeskPet;

namespace Alife.Test.DeskPet;

public class PetServerModelResolutionTests
{
    [Test]
    public void ResolveModelJsonPathPrefersAlifeManifest()
    {
        string tempRoot = Path.Combine(Path.GetTempPath(), "alife-petserver-resolution-tests", Guid.NewGuid().ToString("N"));
        string modelRoot = Path.Combine(tempRoot, "Alife.DeskPet.Client", "wwwroot", "model", "YouXiaoMiao");
        Directory.CreateDirectory(modelRoot);
        try
        {
            string manifestPath = Path.Combine(modelRoot, "alife.model.json");
            File.WriteAllText(manifestPath, "{}");
            File.WriteAllText(Path.Combine(modelRoot, "YouXiaoMiao.model3.json"), "{}");

            string resolvedPath = PetServer.ResolveModelJsonPath(tempRoot, "YouXiaoMiao");

            Assert.That(resolvedPath, Is.EqualTo(manifestPath));
        }
        finally
        {
            if (Directory.Exists(tempRoot))
                Directory.Delete(tempRoot, recursive: true);
        }
    }

    [Test]
    public void ResolveModelJsonPathFallsBackToLegacyModelName()
    {
        string tempRoot = Path.Combine(Path.GetTempPath(), "alife-petserver-resolution-tests", Guid.NewGuid().ToString("N"));
        string modelRoot = Path.Combine(tempRoot, "Alife.DeskPet.Client", "wwwroot", "model", "Mao");
        Directory.CreateDirectory(modelRoot);
        try
        {
            string legacyPath = Path.Combine(modelRoot, "Mao.model3.json");
            File.WriteAllText(legacyPath, "{}");

            string resolvedPath = PetServer.ResolveModelJsonPath(tempRoot, "Mao");

            Assert.That(resolvedPath, Is.EqualTo(legacyPath));
        }
        finally
        {
            if (Directory.Exists(tempRoot))
                Directory.Delete(tempRoot, recursive: true);
        }
    }
}
