using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Alife.Function.WebBridge;

const string PackageId = "current-pet-character-bundle";

string baseUrl = (args.Length > 0 ? args[0] : Environment.GetEnvironmentVariable("WEBBRIDGE_BASE_URL"))
    ?? "http://localhost:3000";
baseUrl = baseUrl.TrimEnd('/');

string packageRoot = args.Length > 1
    ? args[1]
    : Environment.GetEnvironmentVariable("WEBBRIDGE_PACKAGE_ROOT")
        ?? Path.Combine(Path.GetTempPath(), "foxd-webbridge-smoke", DateTimeOffset.UtcNow.ToString("yyyyMMddHHmmss"));

string email = Environment.GetEnvironmentVariable("WEBBRIDGE_EMAIL") ?? "demo@example.com";
string password = Environment.GetEnvironmentVariable("WEBBRIDGE_PASSWORD") ?? "demo1234";

using HttpClient webClient = new() { BaseAddress = new Uri(baseUrl + "/") };
using HttpResponseMessage loginResponse = await webClient.PostAsJsonAsync(
    "api/auth/login",
    new { email, password });
loginResponse.EnsureSuccessStatusCode();

string loginJson = await loginResponse.Content.ReadAsStringAsync();
string accessToken = ExtractAccessToken(loginJson);
webClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

string smokeMarker = $"webbridge-smoke-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}";
string characterExtraMarker = $"{smokeMarker}-character-extra";
using HttpResponseMessage configResponse = await webClient.PutAsJsonAsync(
    "api/pet/config",
    new { petName = smokeMarker, characterExtra = characterExtraMarker });
configResponse.EnsureSuccessStatusCode();

WebBridgeServiceConfig config = new()
{
    ApiBaseUrl = baseUrl,
    ApiToken = accessToken,
    PackageRootPath = packageRoot,
    AutoSyncEnabled = false,
    SyncAssetsEnabled = false
};

await using WebBridgeService service = new()
{
    Configuration = config
};

WebBridgeInstallResult installResult = await service.InstallPackage(PackageId, CancellationToken.None);

Require(installResult.PackageId == PackageId, $"Unexpected packageId: {installResult.PackageId}");
Require(installResult.Status == WebBridgePackageStatus.PendingActivation, $"Unexpected install status: {installResult.Status}");
Require(installResult.InstalledFiles > 0, "No package files were installed.");
Require(IsUnderRoot(packageRoot, installResult.PackageRootPath), "PackageRootPath escaped isolated root.");
Require(File.Exists(installResult.ManifestPath), $"Missing manifest: {installResult.ManifestPath}");
Require(File.Exists(installResult.ConfigDraftPath), $"Missing config draft: {installResult.ConfigDraftPath}");
string characterCardPath = Path.Combine(installResult.PackageRootPath, "characters", "current-pet", "card.json");
Require(File.Exists(characterCardPath), $"Missing character card: {characterCardPath}");
Require(File.ReadAllText(characterCardPath).Contains(characterExtraMarker), "Character card does not contain this characterExtra smoke marker.");

string catalogPath = Path.Combine(packageRoot, "catalog.json");
Require(File.Exists(catalogPath), $"Missing catalog: {catalogPath}");
Require(CatalogContainsStatus(catalogPath, PackageId, "pendingActivation"), "Catalog does not contain pendingActivation record.");

using HttpRequestMessage stagedStatusRequest = new(HttpMethod.Get, "api/pet/sync/status");
using HttpResponseMessage stagedStatusResponse = await webClient.SendAsync(stagedStatusRequest);
stagedStatusResponse.EnsureSuccessStatusCode();
string stagedStatusJson = await stagedStatusResponse.Content.ReadAsStringAsync();
Require(WebStatusHasStagedPackage(stagedStatusJson), "Web sync status did not move to staged/localConfirmationRequired.");

WebBridgeInstallResult applyResult = await service.ApplyPackage(PackageId, CancellationToken.None);
Require(applyResult.PackageId == PackageId, $"Unexpected apply packageId: {applyResult.PackageId}");
Require(applyResult.Status == WebBridgePackageStatus.Applied, $"Unexpected apply status: {applyResult.Status}");

string activeConfigPath = Path.Combine(packageRoot, "ActiveConfig", $"{PackageId}.json");
Require(File.Exists(activeConfigPath), $"Missing active config: {activeConfigPath}");
Require(File.ReadAllText(activeConfigPath).Contains(smokeMarker), "Active config does not contain this smoke marker.");
Require(CatalogContainsStatus(catalogPath, PackageId, "applied"), "Catalog does not contain applied record.");

using HttpRequestMessage appliedStatusRequest = new(HttpMethod.Get, "api/pet/sync/status");
using HttpResponseMessage appliedStatusResponse = await webClient.SendAsync(appliedStatusRequest);
appliedStatusResponse.EnsureSuccessStatusCode();
string appliedStatusJson = await appliedStatusResponse.Content.ReadAsStringAsync();
Require(WebStatusHasAppliedPackage(appliedStatusJson), "Web sync status did not move to applied/upToDate.");

Console.WriteLine("Alife WebBridge staged-to-applied smoke passed.");
Console.WriteLine($"BaseUrl: {baseUrl}");
Console.WriteLine($"PackageId: {installResult.PackageId}");
Console.WriteLine($"InstallStatus: {installResult.Status}");
Console.WriteLine($"ApplyStatus: {applyResult.Status}");
Console.WriteLine($"InstalledFiles: {installResult.InstalledFiles}");
Console.WriteLine($"PackageRootPath: {installResult.PackageRootPath}");
Console.WriteLine($"ManifestPath: {installResult.ManifestPath}");
Console.WriteLine($"ConfigDraftPath: {installResult.ConfigDraftPath}");
Console.WriteLine($"CharacterCardPath: {characterCardPath}");
Console.WriteLine($"ActiveConfigPath: {activeConfigPath}");
Console.WriteLine($"CatalogPath: {catalogPath}");
Console.WriteLine("WebStatus: staged/localConfirmationRequired/confirmInDesktop");
Console.WriteLine("WebStatus: applied/upToDate/none/requiresLocalConfirmation=false");

static string ExtractAccessToken(string json)
{
    using JsonDocument document = JsonDocument.Parse(json);
    if (document.RootElement.TryGetProperty("data", out JsonElement data) &&
        data.TryGetProperty("accessToken", out JsonElement token) &&
        token.ValueKind == JsonValueKind.String)
    {
        return token.GetString() ?? throw new InvalidOperationException("Empty accessToken.");
    }

    throw new InvalidOperationException("Login response did not include data.accessToken.");
}

static bool CatalogContainsStatus(string catalogPath, string packageId, string expectedStatus)
{
    using JsonDocument document = JsonDocument.Parse(File.ReadAllText(catalogPath));
    if (!document.RootElement.TryGetProperty("installedPackages", out JsonElement packages) ||
        packages.ValueKind != JsonValueKind.Array)
    {
        return false;
    }

    foreach (JsonElement package in packages.EnumerateArray())
    {
        string? id = package.TryGetProperty("packageId", out JsonElement idElement)
            ? idElement.GetString()
            : null;
        string? status = package.TryGetProperty("status", out JsonElement statusElement)
            ? statusElement.GetString()
            : null;

        if (id == packageId && string.Equals(status, expectedStatus, StringComparison.OrdinalIgnoreCase))
            return true;
    }

    return false;
}

static bool WebStatusHasStagedPackage(string json)
{
    using JsonDocument document = JsonDocument.Parse(json);
    if (!document.RootElement.TryGetProperty("data", out JsonElement data))
        return false;

    return data.TryGetProperty("packageState", out JsonElement packageState) &&
           packageState.GetString() == "staged" &&
           data.TryGetProperty("summaryKind", out JsonElement summaryKind) &&
           summaryKind.GetString() == "localConfirmationRequired" &&
           data.TryGetProperty("primaryAction", out JsonElement primaryAction) &&
           primaryAction.GetString() == "confirmInDesktop";
}

static bool WebStatusHasAppliedPackage(string json)
{
    using JsonDocument document = JsonDocument.Parse(json);
    if (!document.RootElement.TryGetProperty("data", out JsonElement data))
        return false;

    return data.TryGetProperty("packageState", out JsonElement packageState) &&
           packageState.GetString() == "applied" &&
           data.TryGetProperty("summaryKind", out JsonElement summaryKind) &&
           summaryKind.GetString() == "upToDate" &&
           data.TryGetProperty("primaryAction", out JsonElement primaryAction) &&
           primaryAction.GetString() == "none" &&
           data.TryGetProperty("requiresLocalConfirmation", out JsonElement confirmation) &&
           confirmation.ValueKind == JsonValueKind.False;
}

static bool IsUnderRoot(string root, string path)
{
    string fullRoot = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
    string fullPath = Path.GetFullPath(path);
    return fullPath.StartsWith(fullRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase);
}

static void Require(bool condition, string message)
{
    if (!condition)
        throw new InvalidOperationException(message);
}
