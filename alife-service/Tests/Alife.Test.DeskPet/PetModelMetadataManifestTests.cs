using System.IO;
using System.Text.Json;
using Alife.Function.DeskPet;

namespace Alife.Test.DeskPet;

public class PetModelMetadataManifestTests
{
    [Test]
    public void LoadReadsAlifeManifestFromWebModelFolder()
    {
        string tempRoot = Path.Combine(Path.GetTempPath(), "alife-live2d-metadata-tests", Guid.NewGuid().ToString("N"));
        string modelRoot = Path.Combine(tempRoot, "wwwroot", "model", "YouXiaoMiao");
        Directory.CreateDirectory(modelRoot);
        try
        {
            Live2DModelManifest manifest = new()
            {
                Id = "YouXiaoMiao",
                DisplayName = "悠小喵",
                ModelFile = "悠小喵.model3.json",
                Expressions =
                [
                    new Live2DModelExpressionEntry { Name = "哭哭", File = "exp/哭哭.exp3.json" },
                    new Live2DModelExpressionEntry { Name = "脸红", File = "exp/脸红.exp3.json" },
                ],
                Motions =
                [
                    new Live2DModelMotionEntry { Name = "常规", Group = "exp", Index = 0, File = "exp/常规.motion3.json", Loop = true },
                ],
                Actions =
                [
                    new Live2DModelActionEntry { Name = "哭哭", Expression = "哭哭" },
                    new Live2DModelActionEntry { Name = "常规", Motion = new Live2DModelMotionRef { Group = "exp", Index = 0 } },
                ],
            };
            string manifestPath = Path.Combine(modelRoot, "alife.model.json");
            File.WriteAllText(manifestPath, JsonSerializer.Serialize(manifest));

            PetModelMetadata metadata = PetModelMetadata.Load(manifestPath);

            Assert.That(metadata.ModelPath, Is.EqualTo("model/YouXiaoMiao/悠小喵.model3.json"));
            Assert.That(metadata.Expressions, Does.Contain("哭哭"));
            Assert.That(metadata.Expressions, Does.Contain("脸红"));
            Assert.That(metadata.Motions["常规"], Is.EqualTo(("exp", 0)));
            Assert.That(metadata.Interactions["哭哭"].Single().Exp, Is.EqualTo("哭哭"));
            Assert.That(metadata.Interactions["常规"].Single().Mtn, Is.EqualTo(new MotionRef("exp", 0)));
        }
        finally
        {
            if (Directory.Exists(tempRoot))
                Directory.Delete(tempRoot, recursive: true);
        }
    }
}
