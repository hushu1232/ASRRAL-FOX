# WebBridge Alife .NET 9 Local Integration Runbook

## Purpose

This runbook verifies the FOXD WebBridge package install path against the Alife .NET runtime without touching the active Alife runtime state.

The smoke test is intentionally scoped to:

- FOXD Web package manifest access.
- FOXD Web package file download.
- Alife .NET 9 bearer-authenticated file download.
- SHA-256 validation.
- Local package staging.
- Local catalog and config draft creation.
- `pendingActivation` status.

It must not activate or apply the package.

## Current Runtime Direction

The active desktop/runtime side is Alife .NET, not Unity.

The target framework is inherited from `D:\FOXD\alife-service\Directory.Build.props`:

```xml
<TargetFramework>net9.0-windows10.0.19041.0</TargetFramework>
```

Use the user-local .NET 9 SDK:

```powershell
& "C:\Users\hu shu\.dotnet\dotnet.exe" --list-sdks
```

Expected SDK entry:

```text
9.0.314 [C:\Users\hu shu\.dotnet\sdk]
```

Do not use the system `dotnet` if it resolves to SDK 8. It cannot build the Alife `.NET 9` projects.

## Safety Boundary

If Alife has a long-running task in progress, do not run a live runtime integration against the default Alife storage.

Safe boundaries:

- Do not start or restart the active Alife process.
- Do not enable `AutoSyncEnabled`.
- Do not call an activation or apply step.
- Do not write into the default `AlifePath.StorageFolderPath\WebBridge`.
- Do not delete `Runtime`, `Storage`, `Outputs`, or any live task directories.
- Use an isolated package root under `D:\tmp`.

Recommended isolated root:

```text
D:\tmp\alife-webbridge-integration
```

All smoke-test output should stay inside that directory.

## Repository State Requirement

The WebBridge package download fix is split across two repositories:

- Alife submodule commit:
  - `e96e82f fix: authenticate WebBridge package downloads`
- FOXD parent commit:
  - `70fa192 chore: advance Alife WebBridge submodule`

If pushing before another machine or CI runs the smoke test, push in this order:

```powershell
git -C D:\FOXD\alife-service push origin master
git -C D:\FOXD push origin master
```

The parent repository records only the submodule commit pointer. The Alife commit must exist on the Alife remote before the FOXD parent commit is pushed.

## FOXD Web Preflight

From the Web app root:

```powershell
cd "D:\FOXD\桌宠demo\新建文件夹\avatar-web-management"
npm run check:webbridge
```

Expected checks:

```text
[PASS] health HTTP 200 - ok
[PASS] login HTTP 200 - ok
[PASS] refresh HTTP 200 - ok
[PASS] pet config HTTP 200 - ok
[PASS] pet sync HTTP 200 - ok
[PASS] pet export HTTP 200 - ok
[PASS] package manifest HTTP 200 - ok
```

The package manifest preflight must reject unsafe manifest shapes:

- `activationPolicy.autoApply` must be `false`.
- `activationPolicy.requiresLocalConfirmation` must be `true`.
- The first package file must include non-empty `sha256`.

## Alife .NET 9 Verification

Run focused WebBridge tests with the .NET 9 SDK:

```powershell
& "C:\Users\hu shu\.dotnet\dotnet.exe" test "D:\FOXD\alife-service\Tests\Alife.Test.Framework\Alife.Test.Framework.csproj" --filter "WebBridge"
```

Expected result:

```text
Failed: 0, Passed: 19, Skipped: 0
```

Build the WebBridge function project:

```powershell
& "C:\Users\hu shu\.dotnet\dotnet.exe" build "D:\FOXD\alife-service\sources\Alife.Function\Alife.Function.WebBridge\Alife.Function.WebBridge.csproj" --no-restore
```

Expected result:

```text
0 warnings
0 errors
```

## Isolated Install Smoke

Only run this after confirming the active Alife long task does not depend on the same process, port, or storage.

The smoke should construct `WebBridgeService` with:

```csharp
new WebBridgeServiceConfig
{
    ApiBaseUrl = "http://localhost:3000",
    ApiToken = "<test-access-token>",
    PackageRootPath = @"D:\tmp\alife-webbridge-integration",
    AutoSyncEnabled = false,
    SyncAssetsEnabled = false
}
```

Then call only:

```csharp
await service.InstallPackage("current-pet-character-bundle", CancellationToken.None);
```

Do not call any activation/apply API.

Expected output files:

```text
D:\tmp\alife-webbridge-integration\Packages\current-pet-character-bundle\characters\current-pet\card.json
D:\tmp\alife-webbridge-integration\Manifests\current-pet-character-bundle.json
D:\tmp\alife-webbridge-integration\ConfigDrafts\current-pet-character-bundle.json
D:\tmp\alife-webbridge-integration\catalog.json
```

Expected catalog state:

```json
{
  "status": "pendingActivation"
}
```

The package must stay pending until a local confirmation flow is implemented and explicitly invoked.

## Failure Checks

### HTTP 401 on Package File

Likely cause:

- `ApiToken` is missing or invalid.
- File download is not using `WebApiClient.DownloadPackageFile`.

Expected fixed behavior:

- Manifest request uses bearer auth.
- File request also uses bearer auth.

Regression test:

```powershell
& "C:\Users\hu shu\.dotnet\dotnet.exe" test "D:\FOXD\alife-service\Tests\Alife.Test.Framework\Alife.Test.Framework.csproj" --filter "WebBridgeServiceDownloadsPackageFilesWithBearerToken"
```

### Hash Mismatch

Likely cause:

- The manifest `sha256` does not match downloaded bytes.
- Web generated a manifest from different bytes than the file endpoint returns.

Expected behavior:

- Alife rejects install with `SHA-256 mismatch`.
- No activation occurs.

### Path Traversal

Likely cause:

- Manifest file `relativePath` contains `..` or escapes the package root after path normalization.

Expected behavior:

- Alife rejects install with `Package file escapes install root`.

### Missing Local Confirmation Policy

Likely cause:

- Manifest allows automatic apply.
- Manifest does not require local confirmation.

Expected behavior:

- FOXD Web preflight fails before Alife install smoke.

## Cleanup

After the isolated smoke, remove only the temporary integration root:

```powershell
Remove-Item -LiteralPath "D:\tmp\alife-webbridge-integration" -Recurse -Force
```

Do not remove Alife runtime storage or build outputs as part of this smoke.

## Next UI Work After Smoke

After the isolated install smoke passes, the FOXD Web UI can safely show real WebBridge states:

- Alife runtime health.
- WebBridge preflight checks.
- Package manifest availability.
- Package file hash status.
- `pendingActivation` package state.
- Failure details for 401, hash mismatch, package not found, and local confirmation required.

Until the smoke passes, frontend work should use mock states and must not imply live Alife activation support.
