# WebBridge Package Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reframe Alife WebBridge as a package installer that downloads plugins, Live2D assets, and character cards from the Web app, writes local install metadata and configuration drafts, and never auto-enables or auto-starts installed content.

**Architecture:** Web exposes package manifests and downloadable asset metadata; Alife consumes those manifests through WebBridge, downloads into a staging directory, verifies hashes and paths, installs into a WebBridge package root, and writes a pending configuration draft. Activation remains a separate local Alife action outside this plan.

**Tech Stack:** C#/.NET 9 in `D:\Alife\sources\Alife.Function\Alife.Function.WebBridge`; NUnit tests in `D:\Alife\Tests\Alife.Test.Framework`; existing TypeScript/Next.js Web app in `D:\FOXD\桌宠demo\新建文件夹\avatar-web-management` for later server-side manifest endpoints.

---

## Scope Guard

Do not modify these Alife areas during this plan:

- `D:\Alife\sources\Alife.Function\Alife.Function.Speech`
- `D:\Alife\sources\Alife.Function\Alife.Function.SpeechModel`
- `D:\Alife\sources\Alife.Function\Alife.Function.QChat`
- `D:\Alife\sources\Alife.DeskPet`

Only modify:

- `D:\Alife\sources\Alife.Function\Alife.Function.WebBridge`
- `D:\Alife\Tests\Alife.Test.Framework\WebBridgeServiceTests.cs`
- Optional Web documentation or manifest endpoint files after Alife-side installer is green.

## File Structure

- Create `D:\Alife\sources\Alife.Function\Alife.Function.WebBridge\WebBridgePackageManifest.cs`  
  Manifest and file entry DTOs received from Web.

- Create `D:\Alife\sources\Alife.Function\Alife.Function.WebBridge\WebBridgeInstallModels.cs`  
  Install request, result, package status, and config draft models.

- Create `D:\Alife\sources\Alife.Function\Alife.Function.WebBridge\WebBridgePackageInstaller.cs`  
  Downloads files, validates paths/hashes, writes staging/package directories, writes catalog and draft JSON.

- Modify `D:\Alife\sources\Alife.Function\Alife.Function.WebBridge\WebApiClient.cs`  
  Add package manifest retrieval only. Do not add enable/start operations.

- Modify `D:\Alife\sources\Alife.Function\Alife.Function.WebBridge\WebBridgeService.cs`  
  Add `InstallPackage` method that delegates to client + installer and returns pending activation result.

- Modify `D:\Alife\sources\Alife.Function\Alife.Function.WebBridge\WebBridgeServiceConfig.cs`  
  Add package storage root override only if needed; do not change TTS/QChat settings.

- Modify `D:\Alife\Tests\Alife.Test.Framework\WebBridgeServiceTests.cs`  
  Add tests for manifest parsing, safe install, hash failure, path traversal rejection, draft generation, and no auto activation.

---

### Task 1: Define Package Manifest and Install Models

**Files:**
- Create: `D:\Alife\sources\Alife.Function\Alife.Function.WebBridge\WebBridgePackageManifest.cs`
- Create: `D:\Alife\sources\Alife.Function\Alife.Function.WebBridge\WebBridgeInstallModels.cs`
- Test: `D:\Alife\Tests\Alife.Test.Framework\WebBridgeServiceTests.cs`

- [x] **Step 1: Write failing tests for manifest model shape**

Add this test to `WebBridgeServiceTests`:

```csharp
[Test]
public void WebBridgePackageManifestCarriesInstallOnlyActivationPolicy()
{
    WebBridgePackageManifest manifest = new()
    {
        SchemaVersion = 1,
        PackageId = "xiayu-character-bundle",
        PackageType = "characterBundle",
        DisplayName = "夏雨角色包",
        Version = "1.0.0",
        Files =
        [
            new WebBridgePackageFile
            {
                Kind = "characterCard",
                Url = "https://foxd.example/downloads/xiayu/card.json",
                RelativePath = "characters/xiayu/card.json",
                Sha256 = "sha256-placeholder",
                Size = 12
            }
        ],
        ConfigDraft = new WebBridgeConfigDraft
        {
            CharacterName = "夏雨",
            CharacterCardPath = "characters/xiayu/card.json",
            Live2DModelPath = "live2d/xiayu/model3.json"
        },
        ActivationPolicy = new WebBridgeActivationPolicy
        {
            AutoApply = false,
            RequiresLocalConfirmation = true
        }
    };

    Assert.That(manifest.PackageType, Is.EqualTo("characterBundle"));
    Assert.That(manifest.ActivationPolicy.AutoApply, Is.False);
    Assert.That(manifest.ActivationPolicy.RequiresLocalConfirmation, Is.True);
}
```

- [x] **Step 2: Run the test and verify it fails**

Run:

```powershell
C:\Users\hu shu\.dotnet\dotnet.exe test D:\Alife\Tests\Alife.Test.Framework\Alife.Test.Framework.csproj --filter WebBridgePackageManifestCarriesInstallOnlyActivationPolicy
```

Expected: compile failure for missing `WebBridgePackageManifest`, `WebBridgePackageFile`, `WebBridgeConfigDraft`, and `WebBridgeActivationPolicy`.

- [x] **Step 3: Add manifest DTOs**

Create `WebBridgePackageManifest.cs`:

```csharp
using System.Collections.Generic;

namespace Alife.Function.WebBridge;

public sealed class WebBridgePackageManifest
{
    public int SchemaVersion { get; set; } = 1;
    public string PackageId { get; set; } = string.Empty;
    public string PackageType { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Version { get; set; } = string.Empty;
    public List<WebBridgePackageFile> Files { get; set; } = new();
    public WebBridgeConfigDraft ConfigDraft { get; set; } = new();
    public WebBridgeActivationPolicy ActivationPolicy { get; set; } = new();
}

public sealed class WebBridgePackageFile
{
    public string Kind { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string RelativePath { get; set; } = string.Empty;
    public string Sha256 { get; set; } = string.Empty;
    public long Size { get; set; }
}

public sealed class WebBridgeConfigDraft
{
    public string CharacterName { get; set; } = string.Empty;
    public string CharacterCardPath { get; set; } = string.Empty;
    public string Live2DModelPath { get; set; } = string.Empty;
}

public sealed class WebBridgeActivationPolicy
{
    public bool AutoApply { get; set; }
    public bool RequiresLocalConfirmation { get; set; } = true;
}
```

- [x] **Step 4: Add install result models**

Create `WebBridgeInstallModels.cs`:

```csharp
using System;
using System.Collections.Generic;

namespace Alife.Function.WebBridge;

public sealed class WebBridgeInstallRequest
{
    public string PackageId { get; set; } = string.Empty;
}

public sealed class WebBridgeInstallResult
{
    public string PackageId { get; set; } = string.Empty;
    public string Status { get; set; } = WebBridgePackageStatus.PendingActivation;
    public string PackageRootPath { get; set; } = string.Empty;
    public string ManifestPath { get; set; } = string.Empty;
    public string ConfigDraftPath { get; set; } = string.Empty;
    public int InstalledFiles { get; set; }
    public List<string> Warnings { get; set; } = new();
}

public static class WebBridgePackageStatus
{
    public const string Downloaded = "downloaded";
    public const string Verified = "verified";
    public const string Installed = "installed";
    public const string PendingActivation = "pendingActivation";
    public const string Failed = "failed";
}

public sealed class WebBridgeInstalledPackageRecord
{
    public string PackageId { get; set; } = string.Empty;
    public string PackageType { get; set; } = string.Empty;
    public string Version { get; set; } = string.Empty;
    public string Status { get; set; } = WebBridgePackageStatus.PendingActivation;
    public DateTimeOffset InstalledAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public string PackageRootPath { get; set; } = string.Empty;
    public string ManifestPath { get; set; } = string.Empty;
    public string ConfigDraftPath { get; set; } = string.Empty;
}

public sealed class WebBridgeLocalCatalog
{
    public List<WebBridgeInstalledPackageRecord> InstalledPackages { get; set; } = new();
}
```

- [x] **Step 5: Run targeted test**

Run:

```powershell
C:\Users\hu shu\.dotnet\dotnet.exe test D:\Alife\Tests\Alife.Test.Framework\Alife.Test.Framework.csproj --filter WebBridgePackageManifestCarriesInstallOnlyActivationPolicy
```

Expected: PASS.

---

### Task 2: Add Safe Installer Path and Hash Validation

**Files:**
- Create: `D:\Alife\sources\Alife.Function\Alife.Function.WebBridge\WebBridgePackageInstaller.cs`
- Test: `D:\Alife\Tests\Alife.Test.Framework\WebBridgeServiceTests.cs`

- [x] **Step 1: Write failing path traversal test**

Add this test:

```csharp
[Test]
public async Task WebBridgePackageInstallerRejectsPathTraversal()
{
    string root = Path.Combine(Path.GetTempPath(), "alife-webbridge-installer", Guid.NewGuid().ToString("N"));
    WebBridgePackageInstaller installer = new(root, _ => Task.FromResult(Array.Empty<byte>()));
    WebBridgePackageManifest manifest = new()
    {
        PackageId = "unsafe-package",
        PackageType = "live2d",
        Version = "1.0.0",
        Files =
        [
            new WebBridgePackageFile
            {
                Kind = "live2d",
                Url = "https://foxd.example/unsafe",
                RelativePath = "../escape.txt",
                Sha256 = "",
                Size = 0
            }
        ]
    };

    Assert.ThrowsAsync<InvalidOperationException>(() => installer.Install(manifest, CancellationToken.None));
}
```

- [x] **Step 2: Run and verify failure**

Run:

```powershell
C:\Users\hu shu\.dotnet\dotnet.exe test D:\Alife\Tests\Alife.Test.Framework\Alife.Test.Framework.csproj --filter WebBridgePackageInstallerRejectsPathTraversal
```

Expected: compile failure for missing `WebBridgePackageInstaller`.

- [x] **Step 3: Implement installer skeleton with path validation**

Create `WebBridgePackageInstaller.cs`:

```csharp
using System;
using System.IO;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace Alife.Function.WebBridge;

public sealed class WebBridgePackageInstaller(
    string rootDirectory,
    Func<WebBridgePackageFile, Task<byte[]>> downloadFile)
{
    public async Task<WebBridgeInstallResult> Install(
        WebBridgePackageManifest manifest,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(manifest.PackageId))
            throw new InvalidOperationException("PackageId is required.");

        string packageRoot = Path.Combine(rootDirectory, "Packages", SanitizeSegment(manifest.PackageId));
        string manifestPath = Path.Combine(rootDirectory, "Manifests", $"{SanitizeSegment(manifest.PackageId)}.json");
        string draftPath = Path.Combine(rootDirectory, "ConfigDrafts", $"{SanitizeSegment(manifest.PackageId)}.json");

        Directory.CreateDirectory(packageRoot);
        Directory.CreateDirectory(Path.GetDirectoryName(manifestPath)!);
        Directory.CreateDirectory(Path.GetDirectoryName(draftPath)!);

        int installedFiles = 0;
        foreach (WebBridgePackageFile file in manifest.Files)
        {
            string targetPath = ResolveSafePath(packageRoot, file.RelativePath);
            Directory.CreateDirectory(Path.GetDirectoryName(targetPath)!);
            byte[] content = await downloadFile(file);
            await File.WriteAllBytesAsync(targetPath, content, cancellationToken);
            installedFiles++;
        }

        await File.WriteAllTextAsync(manifestPath, JsonSerializer.Serialize(manifest, JsonOptions), cancellationToken);
        await File.WriteAllTextAsync(draftPath, JsonSerializer.Serialize(manifest.ConfigDraft, JsonOptions), cancellationToken);

        return new WebBridgeInstallResult
        {
            PackageId = manifest.PackageId,
            Status = WebBridgePackageStatus.PendingActivation,
            PackageRootPath = packageRoot,
            ManifestPath = manifestPath,
            ConfigDraftPath = draftPath,
            InstalledFiles = installedFiles
        };
    }

    static string ResolveSafePath(string root, string relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath))
            throw new InvalidOperationException("RelativePath is required.");

        string fullRoot = Path.GetFullPath(root);
        string fullPath = Path.GetFullPath(Path.Combine(fullRoot, relativePath));
        if (fullPath.StartsWith(fullRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) == false &&
            string.Equals(fullPath, fullRoot, StringComparison.OrdinalIgnoreCase) == false)
            throw new InvalidOperationException($"Package file escapes install root: {relativePath}");

        return fullPath;
    }

    static string SanitizeSegment(string value)
    {
        foreach (char invalid in Path.GetInvalidFileNameChars())
            value = value.Replace(invalid, '-');
        return value.Trim();
    }

    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true
    };
}
```

- [x] **Step 4: Run traversal test**

Run:

```powershell
C:\Users\hu shu\.dotnet\dotnet.exe test D:\Alife\Tests\Alife.Test.Framework\Alife.Test.Framework.csproj --filter WebBridgePackageInstallerRejectsPathTraversal
```

Expected: PASS.

- [x] **Step 5: Write failing hash validation test**

Add this test:

```csharp
[Test]
public void WebBridgePackageInstallerRejectsHashMismatch()
{
    string root = Path.Combine(Path.GetTempPath(), "alife-webbridge-installer", Guid.NewGuid().ToString("N"));
    WebBridgePackageInstaller installer = new(root, _ => Task.FromResult(new byte[] { 1, 2, 3 }));
    WebBridgePackageManifest manifest = new()
    {
        PackageId = "hash-package",
        PackageType = "live2d",
        Version = "1.0.0",
        Files =
        [
            new WebBridgePackageFile
            {
                Kind = "live2d",
                Url = "https://foxd.example/model3.json",
                RelativePath = "live2d/model3.json",
                Sha256 = "0000000000000000000000000000000000000000000000000000000000000000",
                Size = 3
            }
        ]
    };

    Assert.ThrowsAsync<InvalidOperationException>(() => installer.Install(manifest, CancellationToken.None));
}
```

- [x] **Step 6: Run and verify failure**

Run:

```powershell
C:\Users\hu shu\.dotnet\dotnet.exe test D:\Alife\Tests\Alife.Test.Framework\Alife.Test.Framework.csproj --filter WebBridgePackageInstallerRejectsHashMismatch
```

Expected: FAIL because hash is not checked yet.

- [x] **Step 7: Add SHA-256 validation**

Modify `WebBridgePackageInstaller.cs`:

```csharp
using System.Security.Cryptography;
```

After `byte[] content = await downloadFile(file);`, add:

```csharp
ValidateHash(file, content);
```

Add methods:

```csharp
static void ValidateHash(WebBridgePackageFile file, byte[] content)
{
    if (string.IsNullOrWhiteSpace(file.Sha256))
        return;

    string actual = Convert.ToHexString(SHA256.HashData(content)).ToLowerInvariant();
    if (string.Equals(actual, file.Sha256, StringComparison.OrdinalIgnoreCase) == false)
        throw new InvalidOperationException($"SHA-256 mismatch for package file: {file.RelativePath}");
}
```

- [x] **Step 8: Run installer tests**

Run:

```powershell
C:\Users\hu shu\.dotnet\dotnet.exe test D:\Alife\Tests\Alife.Test.Framework\Alife.Test.Framework.csproj --filter "WebBridgePackageInstallerRejectsPathTraversal|WebBridgePackageInstallerRejectsHashMismatch"
```

Expected: PASS.

---

### Task 3: Install Package and Generate Pending Config Draft

**Files:**
- Modify: `D:\Alife\Tests\Alife.Test.Framework\WebBridgeServiceTests.cs`
- Modify: `D:\Alife\sources\Alife.Function\Alife.Function.WebBridge\WebBridgePackageInstaller.cs`

- [x] **Step 1: Write failing successful install test**

Add:

```csharp
[Test]
public async Task WebBridgePackageInstallerWritesFilesManifestAndConfigDraftWithoutActivating()
{
    string root = Path.Combine(Path.GetTempPath(), "alife-webbridge-installer", Guid.NewGuid().ToString("N"));
    byte[] content = [1, 2, 3];
    string hash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(content)).ToLowerInvariant();
    WebBridgePackageInstaller installer = new(root, _ => Task.FromResult(content));
    WebBridgePackageManifest manifest = new()
    {
        PackageId = "xiayu-character-bundle",
        PackageType = "characterBundle",
        Version = "1.0.0",
        Files =
        [
            new WebBridgePackageFile
            {
                Kind = "live2d",
                Url = "https://foxd.example/live2d/model3.json",
                RelativePath = "live2d/xiayu/model3.json",
                Sha256 = hash,
                Size = content.Length
            }
        ],
        ConfigDraft = new WebBridgeConfigDraft
        {
            CharacterName = "夏雨",
            CharacterCardPath = "characters/xiayu/card.json",
            Live2DModelPath = "live2d/xiayu/model3.json"
        },
        ActivationPolicy = new WebBridgeActivationPolicy
        {
            AutoApply = false,
            RequiresLocalConfirmation = true
        }
    };

    WebBridgeInstallResult result = await installer.Install(manifest, CancellationToken.None);

    Assert.That(result.Status, Is.EqualTo(WebBridgePackageStatus.PendingActivation));
    Assert.That(result.InstalledFiles, Is.EqualTo(1));
    Assert.That(File.Exists(Path.Combine(result.PackageRootPath, "live2d", "xiayu", "model3.json")), Is.True);
    Assert.That(File.Exists(result.ManifestPath), Is.True);
    Assert.That(File.Exists(result.ConfigDraftPath), Is.True);
    Assert.That(File.ReadAllText(result.ConfigDraftPath), Does.Contain("夏雨"));
}
```

- [x] **Step 2: Run and verify failure or partial failure**

Run:

```powershell
C:\Users\hu shu\.dotnet\dotnet.exe test D:\Alife\Tests\Alife.Test.Framework\Alife.Test.Framework.csproj --filter WebBridgePackageInstallerWritesFilesManifestAndConfigDraftWithoutActivating
```

Expected: PASS if Task 2 implementation already satisfies it; otherwise FAIL on missing output path/content.

- [x] **Step 3: Adjust installer only if needed**

If test fails because files are not written, ensure `Install()` writes:

```csharp
await File.WriteAllBytesAsync(targetPath, content, cancellationToken);
await File.WriteAllTextAsync(manifestPath, JsonSerializer.Serialize(manifest, JsonOptions), cancellationToken);
await File.WriteAllTextAsync(draftPath, JsonSerializer.Serialize(manifest.ConfigDraft, JsonOptions), cancellationToken);
```

- [x] **Step 4: Run successful install test**

Run:

```powershell
C:\Users\hu shu\.dotnet\dotnet.exe test D:\Alife\Tests\Alife.Test.Framework\Alife.Test.Framework.csproj --filter WebBridgePackageInstallerWritesFilesManifestAndConfigDraftWithoutActivating
```

Expected: PASS.

---

### Task 4: Add Catalog Persistence

**Files:**
- Modify: `D:\Alife\sources\Alife.Function\Alife.Function.WebBridge\WebBridgePackageInstaller.cs`
- Test: `D:\Alife\Tests\Alife.Test.Framework\WebBridgeServiceTests.cs`

- [x] **Step 1: Write failing catalog test**

Add:

```csharp
[Test]
public async Task WebBridgePackageInstallerRecordsPendingPackageInCatalog()
{
    string root = Path.Combine(Path.GetTempPath(), "alife-webbridge-installer", Guid.NewGuid().ToString("N"));
    byte[] content = [7, 8, 9];
    WebBridgePackageInstaller installer = new(root, _ => Task.FromResult(content));
    WebBridgePackageManifest manifest = new()
    {
        PackageId = "catalog-package",
        PackageType = "characterCard",
        Version = "1.2.3",
        Files =
        [
            new WebBridgePackageFile
            {
                Kind = "characterCard",
                Url = "https://foxd.example/card.json",
                RelativePath = "characters/card.json",
                Size = content.Length
            }
        ]
    };

    await installer.Install(manifest, CancellationToken.None);

    string catalogPath = Path.Combine(root, "catalog.json");
    Assert.That(File.Exists(catalogPath), Is.True);
    string catalog = File.ReadAllText(catalogPath);
    Assert.That(catalog, Does.Contain("catalog-package"));
    Assert.That(catalog, Does.Contain("pendingActivation"));
}
```

- [x] **Step 2: Run and verify failure**

Run:

```powershell
C:\Users\hu shu\.dotnet\dotnet.exe test D:\Alife\Tests\Alife.Test.Framework\Alife.Test.Framework.csproj --filter WebBridgePackageInstallerRecordsPendingPackageInCatalog
```

Expected: FAIL because `catalog.json` is not written.

- [x] **Step 3: Add catalog writing**

In `Install()`, after draft write, add:

```csharp
await WriteCatalog(manifest, packageRoot, manifestPath, draftPath, cancellationToken);
```

Add method:

```csharp
async Task WriteCatalog(
    WebBridgePackageManifest manifest,
    string packageRoot,
    string manifestPath,
    string draftPath,
    CancellationToken cancellationToken)
{
    string catalogPath = Path.Combine(rootDirectory, "catalog.json");
    WebBridgeLocalCatalog catalog = new();
    if (File.Exists(catalogPath))
    {
        string existing = await File.ReadAllTextAsync(catalogPath, cancellationToken);
        catalog = JsonSerializer.Deserialize<WebBridgeLocalCatalog>(existing, JsonOptions) ?? new WebBridgeLocalCatalog();
    }

    catalog.InstalledPackages.RemoveAll(package => package.PackageId == manifest.PackageId);
    catalog.InstalledPackages.Add(new WebBridgeInstalledPackageRecord
    {
        PackageId = manifest.PackageId,
        PackageType = manifest.PackageType,
        Version = manifest.Version,
        Status = WebBridgePackageStatus.PendingActivation,
        PackageRootPath = packageRoot,
        ManifestPath = manifestPath,
        ConfigDraftPath = draftPath
    });

    await File.WriteAllTextAsync(catalogPath, JsonSerializer.Serialize(catalog, JsonOptions), cancellationToken);
}
```

- [x] **Step 4: Run catalog test**

Run:

```powershell
C:\Users\hu shu\.dotnet\dotnet.exe test D:\Alife\Tests\Alife.Test.Framework\Alife.Test.Framework.csproj --filter WebBridgePackageInstallerRecordsPendingPackageInCatalog
```

Expected: PASS.

---

### Task 5: Retrieve Manifests Through WebApiClient

**Files:**
- Modify: `D:\Alife\sources\Alife.Function\Alife.Function.WebBridge\WebApiClient.cs`
- Test: `D:\Alife\Tests\Alife.Test.Framework\WebBridgeServiceTests.cs`

- [x] **Step 1: Write failing client test**

Add:

```csharp
[Test]
public async Task WebApiClientPullsPackageManifestEnvelope()
{
    RecordingHandler handler = new() { UsePackageManifestEnvelope = true };
    WebApiClient client = new(new HttpClient(handler)
    {
        BaseAddress = new Uri("https://foxd.example/")
    }, new WebBridgeServiceConfig { ApiToken = "secret-token" });

    WebBridgePackageManifest manifest = await client.PullPackageManifest("xiayu-character-bundle", CancellationToken.None);

    Assert.That(handler.Requests[0].RequestUri?.PathAndQuery, Is.EqualTo("/api/webbridge/packages/xiayu-character-bundle/manifest"));
    Assert.That(handler.Requests[0].Headers.Authorization?.Parameter, Is.EqualTo("secret-token"));
    Assert.That(manifest.PackageId, Is.EqualTo("xiayu-character-bundle"));
    Assert.That(manifest.ActivationPolicy.AutoApply, Is.False);
}
```

Extend `RecordingHandler`:

```csharp
public bool UsePackageManifestEnvelope { get; init; }
```

At the top of `SendAsync` after reading content:

```csharp
if (UsePackageManifestEnvelope)
{
    object webResponse = new
    {
        success = true,
        data = new WebBridgePackageManifest
        {
            PackageId = "xiayu-character-bundle",
            PackageType = "characterBundle",
            Version = "1.0.0",
            ActivationPolicy = new WebBridgeActivationPolicy { AutoApply = false, RequiresLocalConfirmation = true }
        }
    };
    return new HttpResponseMessage(HttpStatusCode.OK)
    {
        Content = new StringContent(JsonSerializer.Serialize(webResponse))
    };
}
```

- [x] **Step 2: Run and verify failure**

Run:

```powershell
C:\Users\hu shu\.dotnet\dotnet.exe test D:\Alife\Tests\Alife.Test.Framework\Alife.Test.Framework.csproj --filter WebApiClientPullsPackageManifestEnvelope
```

Expected: compile failure for missing `PullPackageManifest`.

- [x] **Step 3: Add client method**

In `WebApiClient.cs`, add:

```csharp
public async Task<WebBridgePackageManifest> PullPackageManifest(
    string packageId,
    CancellationToken cancellationToken = default)
{
    using HttpRequestMessage request = CreateRequest(HttpMethod.Get, $"api/webbridge/packages/{Uri.EscapeDataString(packageId)}/manifest");
    using HttpResponseMessage response = await httpClient.SendAsync(request, cancellationToken);
    response.EnsureSuccessStatusCode();

    string json = await response.Content.ReadAsStringAsync(cancellationToken);
    return DeserializeEnvelope<WebBridgePackageManifest>(json);
}
```

Generalize envelope parsing:

```csharp
static T DeserializeEnvelope<T>(string json) where T : new()
{
    using JsonDocument document = JsonDocument.Parse(json);
    JsonElement payload = document.RootElement;
    if (payload.ValueKind == JsonValueKind.Object &&
        payload.TryGetProperty("data", out JsonElement data) &&
        data.ValueKind == JsonValueKind.Object)
    {
        payload = data;
    }

    return payload.Deserialize<T>(jsonOptions) ?? new T();
}
```

Change `DeserializeAvatarConfig` fallback to call:

```csharp
return payload.Deserialize<WebAvatarConfig>(jsonOptions) ?? new WebAvatarConfig();
```

- [x] **Step 4: Run client test**

Run:

```powershell
C:\Users\hu shu\.dotnet\dotnet.exe test D:\Alife\Tests\Alife.Test.Framework\Alife.Test.Framework.csproj --filter WebApiClientPullsPackageManifestEnvelope
```

Expected: PASS.

---

### Task 6: Add WebBridgeService InstallPackage Without Activation

**Files:**
- Modify: `D:\Alife\sources\Alife.Function\Alife.Function.WebBridge\WebBridgeService.cs`
- Modify: `D:\Alife\sources\Alife.Function\Alife.Function.WebBridge\WebBridgeServiceConfig.cs`
- Test: `D:\Alife\Tests\Alife.Test.Framework\WebBridgeServiceTests.cs`

- [x] **Step 1: Write failing service-level install test**

Add:

```csharp
[Test]
public async Task WebBridgeServiceInstallsPackageAsPendingActivation()
{
    RecordingHandler handler = new() { UsePackageManifestEnvelope = true };
    string root = Path.Combine(Path.GetTempPath(), "alife-webbridge-service-install", Guid.NewGuid().ToString("N"));
    WebApiClient client = new(new HttpClient(handler)
    {
        BaseAddress = new Uri("https://foxd.example/")
    }, new WebBridgeServiceConfig());
    WebBridgePackageInstaller installer = new(root, _ => Task.FromResult(new byte[] { 1 }));
    WebBridgeService service = new(client, new MemoryCharacterBridgeStore(), assetSync: null, packageInstaller: installer);

    WebBridgeInstallResult result = await service.InstallPackage("xiayu-character-bundle", CancellationToken.None);

    Assert.That(result.PackageId, Is.EqualTo("xiayu-character-bundle"));
    Assert.That(result.Status, Is.EqualTo(WebBridgePackageStatus.PendingActivation));
}
```

- [x] **Step 2: Run and verify failure**

Run:

```powershell
C:\Users\hu shu\.dotnet\dotnet.exe test D:\Alife\Tests\Alife.Test.Framework\Alife.Test.Framework.csproj --filter WebBridgeServiceInstallsPackageAsPendingActivation
```

Expected: compile failure for missing constructor overload or `InstallPackage`.

- [x] **Step 3: Add package installer dependency to service**

Modify constructor in `WebBridgeService.cs`:

```csharp
public WebBridgeService(
    WebApiClient webApiClient,
    ICharacterBridgeStore characterStore,
    WebAssetSync? assetSync = null,
    WebBridgePackageInstaller? packageInstaller = null)
{
    this.webApiClient = webApiClient;
    this.characterStore = characterStore;
    this.assetSync = assetSync;
    this.packageInstaller = packageInstaller;
}
```

Add field:

```csharp
WebBridgePackageInstaller? packageInstaller;
```

- [x] **Step 4: Add InstallPackage method**

In `WebBridgeService.cs`:

```csharp
public async Task<WebBridgeInstallResult> InstallPackage(
    string packageId,
    CancellationToken cancellationToken = default)
{
    WebBridgePackageManifest manifest = await GetClient().PullPackageManifest(packageId, cancellationToken);
    return await GetPackageInstaller().Install(manifest, cancellationToken);
}
```

Add helper:

```csharp
WebBridgePackageInstaller GetPackageInstaller()
{
    packageInstaller ??= new WebBridgePackageInstaller(
        Configuration?.PackageRootPath ?? Path.Combine(AlifePath.StorageFolderPath, "WebBridge"),
        DownloadPackageFile);
    return packageInstaller;
}

async Task<byte[]> DownloadPackageFile(WebBridgePackageFile file)
{
    using HttpClient client = new();
    return await client.GetByteArrayAsync(file.Url);
}
```

Modify `WebBridgeServiceConfig.cs`:

```csharp
public string? PackageRootPath { get; set; }
```

- [x] **Step 5: Run service-level install test**

Run:

```powershell
C:\Users\hu shu\.dotnet\dotnet.exe test D:\Alife\Tests\Alife.Test.Framework\Alife.Test.Framework.csproj --filter WebBridgeServiceInstallsPackageAsPendingActivation
```

Expected: PASS.

---

### Task 7: Full Alife WebBridge Regression

**Files:**
- No new files.

- [x] **Step 1: Run WebBridge and management tests**

Run:

```powershell
C:\Users\hu shu\.dotnet\dotnet.exe test D:\Alife\Tests\Alife.Test.Framework\Alife.Test.Framework.csproj --filter "WebBridgeServiceTests|AlifeManagementApiServiceTests"
```

Expected:

```text
失败: 0
```

- [x] **Step 2: Confirm TTS files were not modified by this plan**

Run:

```powershell
git -C D:\Alife diff -- sources\Alife.Function\Alife.Function.Speech sources\Alife.Function\Alife.Function.SpeechModel
```

Expected: no diff introduced by this plan. If output exists, inspect it; it should be pre-existing user/TTS work and must not be changed or reverted.

- [x] **Step 3: Run Web app bridge preflight**

Run:

```powershell
cd D:\FOXD\桌宠demo\新建文件夹\avatar-web-management
$env:OTEL_TRACES_SAMPLER='parentbased_traceidratio'
$env:OTEL_TRACES_SAMPLER_ARG='0'
$env:LOG_LEVEL='error'
npm run check:webbridge
```

Expected:

```text
[PASS] health HTTP 200 - ok
[PASS] login HTTP 200 - ok
[PASS] refresh HTTP 200 - ok
[PASS] pet config HTTP 200 - ok
[PASS] pet sync HTTP 200 - ok
[PASS] pet export HTTP 200 - ok
```

---

### Task 8: Web Endpoint Plan Gate

**Files:**
- No code changes in this task.

- [x] **Step 1: Decide whether Web package endpoints are needed now**

Use this rule:

- If Alife installer tests only need mocked manifests, stop after Task 7 and do not add Web endpoints yet.
- If immediate end-to-end package download is required, create a separate plan for Web endpoints under `avatar-web-management`.

- [x] **Step 2: Keep first Web endpoint minimal if needed later**

The first Web endpoint should be read-only:

```text
GET /api/webbridge/packages/:id/manifest
```

Do not add:

```text
POST /api/alife/enable
POST /api/alife/start
POST /api/alife/switch-character
```

Those are activation actions and remain local Alife confirmation flows.

---

## Self-Review

- Spec coverage: The plan covers manifest, local install, hash validation, safe path handling, catalog, config draft, pending activation semantics, WebApiClient manifest retrieval, WebBridgeService install orchestration, and verification. It explicitly excludes auto-enable/start and TTS/Speech/QChat changes.
- Placeholder scan: No `TBD`, `TODO`, or unspecified "handle edge cases" steps remain. Each code task contains concrete test or implementation snippets.
- Type consistency: `WebBridgePackageManifest`, `WebBridgePackageFile`, `WebBridgeConfigDraft`, `WebBridgeActivationPolicy`, `WebBridgePackageInstaller`, `WebBridgeInstallResult`, `WebBridgeLocalCatalog`, and `WebBridgePackageStatus` are introduced before use.
