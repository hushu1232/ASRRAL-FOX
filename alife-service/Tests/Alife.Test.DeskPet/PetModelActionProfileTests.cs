using System.IO;
using System.Text.Json;
using Alife.Function.DeskPet;

namespace Alife.Test.DeskPet;

public class PetModelActionProfileTests
{
    [Test]
    public void LoadManifestReadsSemanticActionProfile()
    {
        string tempRoot = Path.Combine(Path.GetTempPath(), "alife-action-profile-tests", Guid.NewGuid().ToString("N"));
        string modelRoot = Path.Combine(tempRoot, "wwwroot", "model", "MoNv");
        Directory.CreateDirectory(modelRoot);
        try
        {
            File.WriteAllText(Path.Combine(modelRoot, "alife.model.json"), JsonSerializer.Serialize(new Live2DModelManifest
            {
                Id = "MoNv",
                DisplayName = "MoNv",
                ModelFile = "MoNv.model3.json",
                Expressions =
                [
                    new Live2DModelExpressionEntry { Name = "ku", File = "ku.exp3.json" },
                    new Live2DModelExpressionEntry { Name = "mz", File = "mz.exp3.json" },
                ],
                Motions =
                [
                    new Live2DModelMotionEntry { Name = "Scene1", Group = "default", Index = 0, File = "Scene1.motion3.json", Loop = true },
                ],
            }));
            File.WriteAllText(Path.Combine(modelRoot, "alife.actions.json"),
                """
                {
                  "Actions": [
                    { "Name": "cry", "Expression": "ku" },
                    { "Name": "idle", "Motion": { "Group": "default", "Index": 0 } },
                    { "Name": "shy", "Expression": "mz", "Motion": { "Group": "default", "Index": 0 } }
                  ]
                }
                """);

            PetModelMetadata metadata = PetModelMetadata.Load(Path.Combine(modelRoot, "alife.model.json"));

            Assert.That(metadata.Interactions["cry"].Single().Exp, Is.EqualTo("ku"));
            Assert.That(metadata.Interactions["idle"].Single().Mtn, Is.EqualTo(new MotionRef("default", 0)));
            Assert.That(metadata.Interactions["shy"].Single().Exp, Is.EqualTo("mz"));
            Assert.That(metadata.Interactions["shy"].Single().Mtn, Is.EqualTo(new MotionRef("default", 0)));
        }
        finally
        {
            if (Directory.Exists(tempRoot))
                Directory.Delete(tempRoot, recursive: true);
        }
    }
}
