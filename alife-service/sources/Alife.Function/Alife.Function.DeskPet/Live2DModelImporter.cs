using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Alife.Function.DeskPet;

public static class Live2DModelImporter
{
    static readonly HashSet<string> IgnoredExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".asset",
        ".controller",
        ".mat",
        ".meta",
        ".prefab",
        ".vtube.json",
    };

    static readonly HashSet<string> CopiedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".cdi3.json",
        ".exp3.json",
        ".jpg",
        ".jpeg",
        ".json",
        ".moc3",
        ".motion3.json",
        ".physics3.json",
        ".png",
        ".pose3.json",
        ".webp",
    };

    public static Live2DModelImportResult Import(string sourceFolder, string destinationRoot, string modelId)
    {
        if (Directory.Exists(sourceFolder) == false)
            throw new DirectoryNotFoundException(sourceFolder);
        if (string.IsNullOrWhiteSpace(modelId))
            throw new ArgumentException("Model id cannot be empty.", nameof(modelId));

        string modelFile = Directory.EnumerateFiles(sourceFolder, "*.model3.json", SearchOption.TopDirectoryOnly)
            .OrderBy(Path.GetFileName, StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault()
            ?? throw new FileNotFoundException("No .model3.json file was found.", sourceFolder);

        string importedRoot = Path.Combine(destinationRoot, modelId);
        Directory.CreateDirectory(importedRoot);

        List<Live2DModelExpressionEntry> expressions = DiscoverExpressions(sourceFolder);
        List<Live2DModelMotionEntry> motions = DiscoverMotions(sourceFolder);
        List<Live2DModelImportDiagnostic> diagnostics = new();
        ValidateModelReferences(sourceFolder, modelFile, diagnostics);
        CopyWebAssets(sourceFolder, importedRoot, diagnostics);
        RegisterActionsInModelFile(Path.Combine(importedRoot, Path.GetFileName(modelFile)), expressions, motions);

        Live2DModelManifest manifest = new()
        {
            Id = modelId,
            DisplayName = GetLive2DAssetName(modelFile, ".model3.json"),
            ModelFile = Path.GetFileName(modelFile),
            Expressions = expressions,
            Motions = motions,
            Actions = BuildActions(expressions, motions),
        };

        string manifestPath = Path.Combine(importedRoot, "alife.model.json");
        File.WriteAllText(manifestPath, JsonSerializer.Serialize(manifest, new JsonSerializerOptions { WriteIndented = true }));
        WriteStarterActionProfile(importedRoot, expressions, motions);

        return new Live2DModelImportResult(manifestPath, manifest, diagnostics);
    }

    static void CopyWebAssets(string sourceFolder, string destinationFolder, List<Live2DModelImportDiagnostic> diagnostics)
    {
        foreach (string file in Directory.EnumerateFiles(sourceFolder, "*", SearchOption.AllDirectories))
        {
            string relativePath = Path.GetRelativePath(sourceFolder, file);
            string normalizedRelativePath = relativePath.Replace('\\', '/');
            if (ShouldIgnore(file))
            {
                diagnostics.Add(new Live2DModelImportDiagnostic("info", "Ignored non-Web Live2D asset.", normalizedRelativePath));
                continue;
            }

            if (ShouldCopy(file) == false)
                continue;

            string destinationPath = Path.Combine(destinationFolder, relativePath);
            Directory.CreateDirectory(Path.GetDirectoryName(destinationPath)!);
            File.Copy(file, destinationPath, overwrite: true);
        }
    }

    static bool ShouldIgnore(string path)
    {
        string fileName = Path.GetFileName(path);
        if (fileName.EndsWith(".vtube.json", StringComparison.OrdinalIgnoreCase))
            return true;

        return IgnoredExtensions.Contains(Path.GetExtension(path));
    }

    static bool ShouldCopy(string path)
    {
        string fileName = Path.GetFileName(path);
        if (fileName.EndsWith(".model3.json", StringComparison.OrdinalIgnoreCase)
            || fileName.EndsWith(".physics3.json", StringComparison.OrdinalIgnoreCase)
            || fileName.EndsWith(".cdi3.json", StringComparison.OrdinalIgnoreCase)
            || fileName.EndsWith(".pose3.json", StringComparison.OrdinalIgnoreCase)
            || fileName.EndsWith(".exp3.json", StringComparison.OrdinalIgnoreCase)
            || fileName.EndsWith(".motion3.json", StringComparison.OrdinalIgnoreCase))
            return true;

        return CopiedExtensions.Contains(Path.GetExtension(path));
    }

    static List<Live2DModelExpressionEntry> DiscoverExpressions(string sourceFolder)
    {
        return Directory.EnumerateFiles(sourceFolder, "*.exp3.json", SearchOption.AllDirectories)
            .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
            .Select(path => new Live2DModelExpressionEntry
            {
                Name = GetLive2DAssetName(path, ".exp3.json"),
                File = Path.GetRelativePath(sourceFolder, path).Replace('\\', '/'),
            })
            .ToList();
    }

    static List<Live2DModelMotionEntry> DiscoverMotions(string sourceFolder)
    {
        Dictionary<string, int> groupIndexes = new(StringComparer.OrdinalIgnoreCase);
        List<Live2DModelMotionEntry> motions = new();

        foreach (string path in Directory.EnumerateFiles(sourceFolder, "*.motion3.json", SearchOption.AllDirectories)
            .OrderBy(path => path, StringComparer.OrdinalIgnoreCase))
        {
            string relativePath = Path.GetRelativePath(sourceFolder, path).Replace('\\', '/');
            string? parent = Path.GetDirectoryName(path);
            string group = string.Equals(
                Path.GetFullPath(parent ?? string.Empty).TrimEnd(Path.DirectorySeparatorChar),
                Path.GetFullPath(sourceFolder).TrimEnd(Path.DirectorySeparatorChar),
                StringComparison.OrdinalIgnoreCase)
                ? "default"
                : Path.GetFileName(parent) ?? "default";
            int index = groupIndexes.GetValueOrDefault(group);
            groupIndexes[group] = index + 1;

            motions.Add(new Live2DModelMotionEntry
            {
                Name = GetLive2DAssetName(path, ".motion3.json"),
                Group = group,
                Index = index,
                File = relativePath,
                Loop = ReadMotionLoopFlag(path),
            });
        }

        return motions;
    }

    static void ValidateModelReferences(string sourceFolder, string modelFile, List<Live2DModelImportDiagnostic> diagnostics)
    {
        try
        {
            using JsonDocument jsonDocument = JsonDocument.Parse(File.ReadAllText(modelFile));
            if (jsonDocument.RootElement.TryGetProperty("FileReferences", out JsonElement refs) == false)
                return;

            List<string> paths = new();
            AddReference(paths, refs, "Moc");
            AddReference(paths, refs, "Physics");
            AddReference(paths, refs, "DisplayInfo");

            if (refs.TryGetProperty("Textures", out JsonElement textures))
            {
                foreach (JsonElement texture in textures.EnumerateArray())
                    if (texture.GetString() is { Length: > 0 } path)
                        paths.Add(path);
            }

            foreach (string path in paths.Distinct(StringComparer.OrdinalIgnoreCase))
            {
                string fullPath = Path.Combine(sourceFolder, path.Replace('/', Path.DirectorySeparatorChar));
                if (File.Exists(fullPath) == false)
                    diagnostics.Add(new Live2DModelImportDiagnostic("warning", "Referenced Live2D asset was not found.", path));
            }
        }
        catch (JsonException e)
        {
            diagnostics.Add(new Live2DModelImportDiagnostic("warning", $"Unable to parse model references: {e.Message}", Path.GetFileName(modelFile)));
        }
    }

    static void AddReference(List<string> paths, JsonElement refs, string propertyName)
    {
        if (refs.TryGetProperty(propertyName, out JsonElement property)
            && property.GetString() is { Length: > 0 } path)
            paths.Add(path);
    }

    static void RegisterActionsInModelFile(
        string modelFile,
        IReadOnlyList<Live2DModelExpressionEntry> expressions,
        IReadOnlyList<Live2DModelMotionEntry> motions)
    {
        JsonNode? root = JsonNode.Parse(File.ReadAllText(modelFile));
        if (root is not JsonObject rootObject)
            return;

        if (rootObject["FileReferences"] is not JsonObject refs)
        {
            refs = new JsonObject();
            rootObject["FileReferences"] = refs;
        }

        if (expressions.Count > 0)
        {
            JsonArray expressionArray = new();
            foreach (Live2DModelExpressionEntry expression in expressions)
            {
                expressionArray.Add(new JsonObject
                {
                    ["Name"] = expression.Name,
                    ["File"] = expression.File,
                });
            }
            refs["Expressions"] = expressionArray;
        }

        if (motions.Count > 0)
        {
            JsonObject motionGroups = new();
            foreach (IGrouping<string, Live2DModelMotionEntry> group in motions.GroupBy(motion => motion.Group))
            {
                JsonArray motionArray = new();
                foreach (Live2DModelMotionEntry motion in group.OrderBy(motion => motion.Index))
                {
                    motionArray.Add(new JsonObject
                    {
                        ["File"] = motion.File,
                    });
                }
                motionGroups[group.Key] = motionArray;
            }
            refs["Motions"] = motionGroups;
        }

        File.WriteAllText(modelFile, rootObject.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
    }

    static void WriteStarterActionProfile(
        string importedRoot,
        IReadOnlyCollection<Live2DModelExpressionEntry> expressions,
        IReadOnlyList<Live2DModelMotionEntry> motions)
    {
        Dictionary<string, string> expressionNames = expressions.ToDictionary(
            expression => expression.Name,
            expression => expression.Name,
            StringComparer.OrdinalIgnoreCase);

        List<Live2DModelActionEntry> actions = new();
        AddExpressionAction(actions, expressionNames, "cry", "ku");
        AddExpressionAction(actions, expressionNames, "shy", "mz");
        AddExpressionAction(actions, expressionNames, "surprised", "sq");
        AddExpressionAction(actions, expressionNames, "dizzy", "yj");
        AddExpressionAction(actions, expressionNames, "happy", "x");
        AddExpressionAction(actions, expressionNames, "sad", "xx");

        Live2DModelMotionEntry? firstMotion = motions.FirstOrDefault();
        if (firstMotion != null)
        {
            actions.Add(new Live2DModelActionEntry
            {
                Name = "idle",
                Motion = new Live2DModelMotionRef { Group = firstMotion.Group, Index = firstMotion.Index },
            });
        }

        if (actions.Count == 0)
            return;

        Live2DActionProfile profile = new() { Actions = actions };
        File.WriteAllText(
            Path.Combine(importedRoot, "alife.actions.json"),
            JsonSerializer.Serialize(profile, new JsonSerializerOptions { WriteIndented = true }));
    }

    static void AddExpressionAction(
        List<Live2DModelActionEntry> actions,
        IReadOnlyDictionary<string, string> expressionNames,
        string actionName,
        string expressionName)
    {
        if (expressionNames.TryGetValue(expressionName, out string? expression))
            actions.Add(new Live2DModelActionEntry { Name = actionName, Expression = expression });
    }

    static bool ReadMotionLoopFlag(string path)
    {
        try
        {
            using JsonDocument jsonDocument = JsonDocument.Parse(File.ReadAllText(path));
            return jsonDocument.RootElement.TryGetProperty("Meta", out JsonElement meta)
                && meta.TryGetProperty("Loop", out JsonElement loop)
                && loop.ValueKind == JsonValueKind.True;
        }
        catch
        {
            return false;
        }
    }

    static List<Live2DModelActionEntry> BuildActions(
        IEnumerable<Live2DModelExpressionEntry> expressions,
        IEnumerable<Live2DModelMotionEntry> motions)
    {
        List<Live2DModelActionEntry> actions = expressions
            .Select(expression => new Live2DModelActionEntry
            {
                Name = expression.Name,
                Expression = expression.Name,
            })
            .ToList();

        actions.AddRange(motions.Select(motion => new Live2DModelActionEntry
        {
            Name = motion.Name,
            Motion = new Live2DModelMotionRef { Group = motion.Group, Index = motion.Index },
        }));

        return actions;
    }

    static string GetLive2DAssetName(string path, string suffix)
    {
        string fileName = Path.GetFileName(path);
        return fileName.EndsWith(suffix, StringComparison.OrdinalIgnoreCase)
            ? fileName[..^suffix.Length]
            : Path.GetFileNameWithoutExtension(fileName);
    }
}
