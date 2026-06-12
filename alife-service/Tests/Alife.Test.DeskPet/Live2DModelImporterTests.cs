using System.IO;
using System.Text.Json;
using Alife.Function.DeskPet;

namespace Alife.Test.DeskPet;

public class Live2DModelImporterTests
{
    [Test]
    public void ImportCopiesWebAssetsWritesManifestAndRegistersPreviewActionsInModelFile()
    {
        string tempRoot = Path.Combine(Path.GetTempPath(), "alife-live2d-import-tests", Guid.NewGuid().ToString("N"));
        string sourceRoot = Path.Combine(tempRoot, "source", "YouXiaoMiao");
        string destinationRoot = Path.Combine(tempRoot, "dest");
        Directory.CreateDirectory(sourceRoot);
        try
        {
            WriteModelFixture(sourceRoot);

            Live2DModelImportResult result = Live2DModelImporter.Import(sourceRoot, destinationRoot, "YouXiaoMiao");

            string importedRoot = Path.Combine(destinationRoot, "YouXiaoMiao");
            string manifestPath = Path.Combine(importedRoot, "alife.model.json");
            Assert.That(result.ManifestPath, Is.EqualTo(manifestPath));
            Assert.That(File.Exists(manifestPath), Is.True);
            Assert.That(File.Exists(Path.Combine(importedRoot, "Mao.model3.json")), Is.True);
            Assert.That(File.Exists(Path.Combine(importedRoot, "Mao.moc3")), Is.True);
            Assert.That(File.Exists(Path.Combine(importedRoot, "exp", "cry.exp3.json")), Is.True);
            Assert.That(File.Exists(Path.Combine(importedRoot, "motion", "idle.motion3.json")), Is.True);
            Assert.That(File.Exists(Path.Combine(importedRoot, "Mao.asset")), Is.False);
            Assert.That(File.Exists(Path.Combine(importedRoot, "Mao.prefab")), Is.False);
            Assert.That(File.Exists(Path.Combine(importedRoot, "Mao.controller")), Is.False);
            Assert.That(File.Exists(Path.Combine(importedRoot, "Mao.model3.json.meta")), Is.False);

            Live2DModelManifest manifest = JsonSerializer.Deserialize<Live2DModelManifest>(
                File.ReadAllText(manifestPath),
                PetProcess.JsonOptions)!;

            Assert.That(manifest.Id, Is.EqualTo("YouXiaoMiao"));
            Assert.That(manifest.DisplayName, Is.EqualTo("Mao"));
            Assert.That(manifest.ModelFile, Is.EqualTo("Mao.model3.json"));
            Assert.That(manifest.Expressions.Select(expression => expression.Name), Does.Contain("cry"));
            Assert.That(manifest.Motions.Select(motion => motion.Name), Does.Contain("idle"));
            Live2DModelMotionEntry motion = manifest.Motions.Single(item => item.Name == "idle");
            Assert.That(motion.Group, Is.EqualTo("motion"));
            Assert.That(motion.Index, Is.EqualTo(0));
            Assert.That(motion.File, Is.EqualTo("motion/idle.motion3.json"));
            Assert.That(manifest.Actions.Select(action => action.Name), Does.Contain("cry"));
            Assert.That(manifest.Actions.Select(action => action.Name), Does.Contain("idle"));

            Live2DModelExpressionEntry expression = manifest.Expressions.Single();
            using JsonDocument importedModel = JsonDocument.Parse(File.ReadAllText(Path.Combine(importedRoot, manifest.ModelFile)));
            JsonElement refs = importedModel.RootElement.GetProperty("FileReferences");
            JsonElement importedExpressions = refs.GetProperty("Expressions");
            JsonElement importedMotions = refs.GetProperty("Motions");
            Assert.That(importedExpressions.EnumerateArray().Select(item => item.GetProperty("Name").GetString()), Does.Contain(expression.Name));
            Assert.That(importedExpressions.EnumerateArray().Select(item => item.GetProperty("File").GetString()), Does.Contain(expression.File));
            Assert.That(importedMotions.GetProperty(motion.Group).EnumerateArray().Select(item => item.GetProperty("File").GetString()), Does.Contain(motion.File));
        }
        finally
        {
            if (Directory.Exists(tempRoot))
                Directory.Delete(tempRoot, recursive: true);
        }
    }

    [Test]
    public void ImportReportsMissingReferencedAssets()
    {
        string tempRoot = Path.Combine(Path.GetTempPath(), "alife-live2d-import-tests", Guid.NewGuid().ToString("N"));
        string sourceRoot = Path.Combine(tempRoot, "source", "BrokenModel");
        string destinationRoot = Path.Combine(tempRoot, "dest");
        Directory.CreateDirectory(sourceRoot);
        try
        {
            File.WriteAllText(
                Path.Combine(sourceRoot, "Broken.model3.json"),
                """
                {
                  "Version": 3,
                  "FileReferences": {
                    "Moc": "missing.moc3",
                    "Textures": ["texture_00.png"],
                    "Physics": "missing.physics3.json"
                  }
                }
                """);
            File.WriteAllText(Path.Combine(sourceRoot, "texture_00.png"), "png");

            Live2DModelImportResult result = Live2DModelImporter.Import(sourceRoot, destinationRoot, "BrokenModel");

            Assert.That(result.Diagnostics.Any(d => d.Level == "warning" && d.Path == "missing.moc3"), Is.True);
            Assert.That(result.Diagnostics.Any(d => d.Level == "warning" && d.Path == "missing.physics3.json"), Is.True);
        }
        finally
        {
            if (Directory.Exists(tempRoot))
                Directory.Delete(tempRoot, recursive: true);
        }
    }

    [Test]
    public void ImportUsesDefaultGroupForRootLevelMotions()
    {
        string tempRoot = Path.Combine(Path.GetTempPath(), "alife-live2d-import-tests", Guid.NewGuid().ToString("N"));
        string sourceRoot = Path.Combine(tempRoot, "source", "RootMotionModel");
        string destinationRoot = Path.Combine(tempRoot, "dest");
        Directory.CreateDirectory(sourceRoot);
        try
        {
            File.WriteAllText(
                Path.Combine(sourceRoot, "Root.model3.json"),
                """
                {
                  "Version": 3,
                  "FileReferences": {
                    "Moc": "Root.moc3",
                    "Textures": []
                  }
                }
                """);
            File.WriteAllText(Path.Combine(sourceRoot, "Root.moc3"), "moc");
            File.WriteAllText(Path.Combine(sourceRoot, "Scene1.motion3.json"), """{ "Version": 3, "Meta": { "Loop": true } }""");

            Live2DModelImportResult result = Live2DModelImporter.Import(sourceRoot, destinationRoot, "RootMotionModel");

            Assert.That(result.Manifest.Motions.Single().Group, Is.EqualTo("default"));
        }
        finally
        {
            if (Directory.Exists(tempRoot))
                Directory.Delete(tempRoot, recursive: true);
        }
    }

    [Test]
    public void ImportWritesStarterActionProfileForKnownShortExpressionNames()
    {
        string tempRoot = Path.Combine(Path.GetTempPath(), "alife-live2d-import-tests", Guid.NewGuid().ToString("N"));
        string sourceRoot = Path.Combine(tempRoot, "source", "MoNv");
        string destinationRoot = Path.Combine(tempRoot, "dest");
        Directory.CreateDirectory(sourceRoot);
        try
        {
            File.WriteAllText(Path.Combine(sourceRoot, "MoNv.model3.json"), """{ "Version": 3, "FileReferences": { "Moc": "MoNv.moc3", "Textures": [] } }""");
            File.WriteAllText(Path.Combine(sourceRoot, "MoNv.moc3"), "moc");
            File.WriteAllText(Path.Combine(sourceRoot, "ku.exp3.json"), "{}");
            File.WriteAllText(Path.Combine(sourceRoot, "mz.exp3.json"), "{}");
            File.WriteAllText(Path.Combine(sourceRoot, "Scene1.motion3.json"), """{ "Version": 3, "Meta": { "Loop": true } }""");

            Live2DModelImporter.Import(sourceRoot, destinationRoot, "MoNv");

            string profilePath = Path.Combine(destinationRoot, "MoNv", "alife.actions.json");
            Assert.That(File.Exists(profilePath), Is.True);
            string profileJson = File.ReadAllText(profilePath);
            Assert.That(profileJson, Does.Contain("\"cry\""));
            Assert.That(profileJson, Does.Contain("\"ku\""));
            Assert.That(profileJson, Does.Contain("\"shy\""));
            Assert.That(profileJson, Does.Contain("\"mz\""));
            Assert.That(profileJson, Does.Contain("\"idle\""));
            Assert.That(profileJson, Does.Contain("\"default\""));
        }
        finally
        {
            if (Directory.Exists(tempRoot))
                Directory.Delete(tempRoot, recursive: true);
        }
    }

    static void WriteModelFixture(string sourceRoot)
    {
        Directory.CreateDirectory(Path.Combine(sourceRoot, "exp"));
        Directory.CreateDirectory(Path.Combine(sourceRoot, "motion"));
        Directory.CreateDirectory(Path.Combine(sourceRoot, "Mao.8192"));
        File.WriteAllText(
            Path.Combine(sourceRoot, "Mao.model3.json"),
            """
            {
              "Version": 3,
              "FileReferences": {
                "Moc": "Mao.moc3",
                "Textures": [
                  "Mao.8192/texture_00.png"
                ],
                "Physics": "Mao.physics3.json",
                "DisplayInfo": "Mao.cdi3.json"
              }
            }
            """);
        File.WriteAllText(Path.Combine(sourceRoot, "Mao.moc3"), "moc");
        File.WriteAllText(Path.Combine(sourceRoot, "Mao.physics3.json"), "{}");
        File.WriteAllText(Path.Combine(sourceRoot, "Mao.cdi3.json"), "{}");
        File.WriteAllText(Path.Combine(sourceRoot, "Mao.8192", "texture_00.png"), "png");
        File.WriteAllText(Path.Combine(sourceRoot, "exp", "cry.exp3.json"), "{}");
        File.WriteAllText(
            Path.Combine(sourceRoot, "motion", "idle.motion3.json"),
            """
            {
              "Version": 3,
              "Meta": {
                "Loop": true
              }
            }
            """);
        File.WriteAllText(Path.Combine(sourceRoot, "Mao.asset"), "unity");
        File.WriteAllText(Path.Combine(sourceRoot, "Mao.prefab"), "unity");
        File.WriteAllText(Path.Combine(sourceRoot, "Mao.controller"), "unity");
        File.WriteAllText(Path.Combine(sourceRoot, "Mao.model3.json.meta"), "unity");
    }
}
