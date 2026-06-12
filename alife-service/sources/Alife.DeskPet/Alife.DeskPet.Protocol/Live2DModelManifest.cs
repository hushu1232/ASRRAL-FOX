using System.Collections.Generic;

namespace Alife.Function.DeskPet;

public record Live2DModelManifest
{
    public string Id { get; init; } = string.Empty;
    public string DisplayName { get; init; } = string.Empty;
    public string ModelFile { get; init; } = string.Empty;
    public List<Live2DModelExpressionEntry> Expressions { get; init; } = new();
    public List<Live2DModelMotionEntry> Motions { get; init; } = new();
    public List<Live2DModelActionEntry> Actions { get; init; } = new();
}

public record Live2DActionProfile
{
    public List<Live2DModelActionEntry> Actions { get; init; } = new();
}

public record Live2DModelExpressionEntry
{
    public string Name { get; init; } = string.Empty;
    public string File { get; init; } = string.Empty;
}

public record Live2DModelMotionEntry
{
    public string Name { get; init; } = string.Empty;
    public string Group { get; init; } = string.Empty;
    public int Index { get; init; }
    public string File { get; init; } = string.Empty;
    public bool Loop { get; init; }
}

public record Live2DModelActionEntry
{
    public string Name { get; init; } = string.Empty;
    public string? Expression { get; init; }
    public Live2DModelMotionRef? Motion { get; init; }
}

public record Live2DModelMotionRef
{
    public string Group { get; init; } = string.Empty;
    public int Index { get; init; }
}

public record Live2DModelImportDiagnostic(string Level, string Message, string? Path = null);

public record Live2DModelImportResult(string ManifestPath, Live2DModelManifest Manifest, IReadOnlyList<Live2DModelImportDiagnostic> Diagnostics);
