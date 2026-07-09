# Active WebBridge Apply Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in `npm run check:webbridge:active-apply` verification path that records active Alife WebBridge service apply evidence without touching default runtime storage.

**Architecture:** Keep the existing isolated staged-to-applied smoke unchanged. Add a new Node runner plus a dedicated C# evidence project under `tools/webbridge-active-apply-evidence`; the runner requires explicit opt-in and an explicit package root, starts the existing local FOXD server, and invokes the C# project against canonical `D:\Alife` through an overridable `AlifeRoot` MSBuild property.

**Tech Stack:** TypeScript, Jest, Node child processes, Next.js local standalone runner, .NET 9 C# console project, Alife.Function.WebBridge, Markdown docs.

---

## Design Inputs

- Approved spec: `docs/superpowers/specs/2026-07-08-active-webbridge-apply-evidence-design.md`
- Existing smoke runner: `桌宠demo/新建文件夹/avatar-web-management/scripts/check-webbridge-staged-applied.ts`
- Existing local server runner: `桌宠demo/新建文件夹/avatar-web-management/scripts/test-integration-local.ts`
- Existing package script tests: `桌宠demo/新建文件夹/avatar-web-management/tests/unit/package-scripts.test.ts`
- Existing runner tests: `桌宠demo/新建文件夹/avatar-web-management/tests/unit/test-integration-local.test.ts`
- Existing C# smoke project: `tools/webbridge-smoke`
- Canonical Alife checkout: `D:\Alife`

## Boundaries

- Do not modify `D:\Alife`.
- Do not modify `D:\FOXD\alife-service` or its gitlink.
- Do not use implicit `AlifePath.StorageFolderPath\WebBridge`.
- Do not change Prisma schema or migrations.
- Do not change dashboard UI.
- Do not add browser actions.
- Do not add management API apply endpoints.
- Do not start, stop, restart, repair, apply from browser, delete, or shell out from browser code.
- Do not enable asset sync.
- Do not commit `docs/superpowers/plans/2026-07-03-foxd-next-roadmap.md`.

## File Structure

- Create: `tools/webbridge-active-apply-evidence/AlifeWebBridgeActiveApplyEvidence.csproj`
  - Dedicated .NET 9 console project referencing canonical Alife WebBridge through `$(AlifeRoot)`.
- Create: `tools/webbridge-active-apply-evidence/Program.cs`
  - Runs the opt-in active-service apply evidence flow and prints stable evidence lines.
- Create: `桌宠demo/新建文件夹/avatar-web-management/scripts/check-webbridge-active-apply.ts`
  - Validates opt-in env vars, resolves repo/project paths, runs `dotnet restore`, then runs the C# evidence project.
- Modify: `桌宠demo/新建文件夹/avatar-web-management/scripts/test-integration-local.ts`
  - Adds `webbridge-active-apply` local server mode.
- Modify: `桌宠demo/新建文件夹/avatar-web-management/package.json`
  - Adds `check:webbridge:active-apply`.
- Modify: `桌宠demo/新建文件夹/avatar-web-management/tests/unit/package-scripts.test.ts`
  - Locks the new package script.
- Modify: `桌宠demo/新建文件夹/avatar-web-management/tests/unit/test-integration-local.test.ts`
  - Locks the new local server mode.
- Create: `桌宠demo/新建文件夹/avatar-web-management/tests/unit/check-webbridge-active-apply.test.ts`
  - Unit tests for config creation and disabled-by-default guardrails.
- Create: `桌宠demo/新建文件夹/avatar-web-management/tests/unit/active-apply-evidence-source.test.ts`
  - Source guardrails for the C# evidence project.
- Modify: `docs/webbridge-alife-local-integration.md`
- Modify: `docs/2026-07-03-alife-webbridge-protocol-status.md`
- Modify: `docs/project-status-2026-07-03.md`
  - Records active-service apply evidence separately from live already-running desktop process activation.

## Task 1: Add Failing Node Contract Tests

**Files:**
- Modify: `桌宠demo/新建文件夹/avatar-web-management/tests/unit/package-scripts.test.ts`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/tests/unit/test-integration-local.test.ts`

- [ ] **Step 1: Add the package script assertion**

Append this test inside `describe('package test scripts', () => { ... })` in `tests/unit/package-scripts.test.ts`, before the final closing `});`.

```ts
  it('exposes an opt-in active WebBridge apply evidence check', () => {
    const pkg = readPackageJson();

    expect(pkg.scripts['check:webbridge:active-apply']).toBe(
      'tsx scripts/test-integration-local.ts webbridge-active-apply',
    );
  });
```

- [ ] **Step 2: Add the local runner mode assertion**

Append this test inside `describe('test:integration:local runner', () => { ... })` in `tests/unit/test-integration-local.test.ts`, before the final closing `});`.

```ts
  it('supports opt-in active WebBridge apply evidence checks against the local standalone server', () => {
    const config = createLocalServerRunConfig('webbridge-active-apply');

    expect(config.test.command).toContain('tsx');
    expect(config.test.args).toEqual(['scripts/check-webbridge-active-apply.ts']);
  });
```

- [ ] **Step 3: Run the tests and observe RED**

Run from `桌宠demo\新建文件夹\avatar-web-management`:

```powershell
npx jest tests/unit/package-scripts.test.ts tests/unit/test-integration-local.test.ts --runInBand
```

Expected: FAIL because `check:webbridge:active-apply` and `webbridge-active-apply` do not exist.

## Task 2: Add The Active Apply TypeScript Runner

**Files:**
- Create: `桌宠demo/新建文件夹/avatar-web-management/tests/unit/check-webbridge-active-apply.test.ts`
- Create: `桌宠demo/新建文件夹/avatar-web-management/scripts/check-webbridge-active-apply.ts`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/scripts/test-integration-local.ts`
- Modify: `桌宠demo/新建文件夹/avatar-web-management/package.json`

- [ ] **Step 1: Create failing runner unit tests**

Create `tests/unit/check-webbridge-active-apply.test.ts` with this content:

```ts
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createWebBridgeActiveApplyEvidenceConfig,
  validateActiveApplyEvidenceConfig,
} from '../../scripts/check-webbridge-active-apply';

function withTempRepo<T>(callback: (repoRoot: string) => T): T {
  const repoRoot = mkdtempSync(join(tmpdir(), 'foxd-active-apply-config-'));
  mkdirSync(join(repoRoot, '.git'));
  mkdirSync(join(repoRoot, 'tools', 'webbridge-active-apply-evidence'), { recursive: true });

  try {
    return callback(repoRoot);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
}

describe('check-webbridge-active-apply runner config', () => {
  it('creates config for the dedicated active apply evidence project', () => {
    withTempRepo((repoRoot) => {
      const config = createWebBridgeActiveApplyEvidenceConfig(
        {
          ALIFE_ACTIVE_APPLY_EVIDENCE: 'true',
          DOTNET_EXE: 'dotnet-test',
          ALIFE_ROOT: 'D:\\Alife',
          WEBBRIDGE_PACKAGE_ROOT: 'D:\\tmp\\foxd-active-apply-evidence',
          PORT: '3100',
        },
        repoRoot,
      );

      expect(config.baseUrl).toBe('http://localhost:3100');
      expect(config.dotnetExe).toBe('dotnet-test');
      expect(config.alifeRoot).toBe('D:\\Alife');
      expect(config.packageRoot).toBe('D:\\tmp\\foxd-active-apply-evidence');
      expect(config.projectPath).toBe(
        join(repoRoot, 'tools', 'webbridge-active-apply-evidence', 'AlifeWebBridgeActiveApplyEvidence.csproj'),
      );
      expect(config.evidenceEnabled).toBe(true);
    });
  });

  it('refuses to run unless active apply evidence is explicitly enabled', () => {
    const config = createWebBridgeActiveApplyEvidenceConfig(
      {
        DOTNET_EXE: 'dotnet-test',
        ALIFE_ROOT: 'D:\\Alife',
        WEBBRIDGE_PACKAGE_ROOT: 'D:\\tmp\\foxd-active-apply-evidence',
      },
      process.cwd(),
    );

    expect(() => validateActiveApplyEvidenceConfig(config)).toThrow(
      'ALIFE_ACTIVE_APPLY_EVIDENCE must be set to true before active apply evidence can run.',
    );
  });

  it('requires an explicit package root so default runtime storage is not touched', () => {
    const config = createWebBridgeActiveApplyEvidenceConfig(
      {
        ALIFE_ACTIVE_APPLY_EVIDENCE: 'true',
        DOTNET_EXE: 'dotnet-test',
        ALIFE_ROOT: 'D:\\Alife',
      },
      process.cwd(),
    );

    expect(() => validateActiveApplyEvidenceConfig(config)).toThrow(
      'WEBBRIDGE_PACKAGE_ROOT is required for active apply evidence.',
    );
  });
});
```

- [ ] **Step 2: Run the new runner test and observe RED**

Run from `桌宠demo\新建文件夹\avatar-web-management`:

```powershell
npx jest tests/unit/check-webbridge-active-apply.test.ts --runInBand
```

Expected: FAIL because `scripts/check-webbridge-active-apply.ts` does not exist.

- [ ] **Step 3: Create `scripts/check-webbridge-active-apply.ts`**

Create `scripts/check-webbridge-active-apply.ts` with this content:

```ts
import { existsSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';

type ActiveApplyEvidenceConfig = {
  baseUrl: string;
  dotnetExe: string;
  alifeRoot: string;
  repoRoot: string;
  projectPath: string;
  packageRoot: string | null;
  evidenceEnabled: boolean;
};

const DEFAULT_DOTNET_EXE = 'C:\\Users\\hu shu\\.dotnet\\dotnet.exe';
const DEFAULT_ALIFE_ROOT = 'D:\\Alife';

function normalizeBaseUrl(value: string | undefined): string {
  return (value || 'http://localhost:3000').replace(/\/+$/, '');
}

function findRepoRoot(startDir: string): string {
  let current = resolve(startDir);

  while (true) {
    if (existsSync(join(current, '.git'))) {
      return current;
    }

    const parent = resolve(current, '..');
    if (parent === current) {
      throw new Error(`Could not find repository root from ${startDir}`);
    }
    current = parent;
  }
}

function defaultDotnetExe(env: Partial<NodeJS.ProcessEnv>): string {
  if (env.DOTNET_EXE) {
    return env.DOTNET_EXE;
  }

  if (existsSync(DEFAULT_DOTNET_EXE)) {
    return DEFAULT_DOTNET_EXE;
  }

  return 'dotnet';
}

export function createWebBridgeActiveApplyEvidenceConfig(
  env: Partial<NodeJS.ProcessEnv> = process.env,
  cwd = process.cwd(),
): ActiveApplyEvidenceConfig {
  const repoRoot = findRepoRoot(cwd);
  const projectPath = join(
    repoRoot,
    'tools',
    'webbridge-active-apply-evidence',
    'AlifeWebBridgeActiveApplyEvidence.csproj',
  );

  return {
    baseUrl: normalizeBaseUrl(env.WEBBRIDGE_BASE_URL || env.TEST_BASE_URL || `http://localhost:${env.PORT || '3000'}`),
    dotnetExe: defaultDotnetExe(env),
    alifeRoot: env.ALIFE_ROOT || DEFAULT_ALIFE_ROOT,
    repoRoot,
    projectPath,
    packageRoot: env.WEBBRIDGE_PACKAGE_ROOT || null,
    evidenceEnabled: env.ALIFE_ACTIVE_APPLY_EVIDENCE === 'true',
  };
}

export function validateActiveApplyEvidenceConfig(config: ActiveApplyEvidenceConfig): void {
  if (!config.evidenceEnabled) {
    throw new Error('ALIFE_ACTIVE_APPLY_EVIDENCE must be set to true before active apply evidence can run.');
  }

  if (!config.packageRoot) {
    throw new Error('WEBBRIDGE_PACKAGE_ROOT is required for active apply evidence.');
  }

  if (!existsSync(config.projectPath)) {
    throw new Error(`Active apply evidence project not found: ${config.projectPath}`);
  }

  if (!existsSync(config.alifeRoot)) {
    throw new Error(`Alife root not found: ${config.alifeRoot}`);
  }
}

function runCommand(
  label: string,
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<void> {
  console.log(`[webbridge-active-apply] ${label}`);
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: 'inherit',
      windowsHide: true,
    });

    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(new Error(`${label} failed with ${signal ? `signal ${signal}` : `exit code ${code}`}`));
    });
  });
}

export async function runWebBridgeActiveApplyEvidence(
  config = createWebBridgeActiveApplyEvidenceConfig(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  validateActiveApplyEvidenceConfig(config);

  mkdirSync(config.packageRoot!, { recursive: true });
  const childEnv: NodeJS.ProcessEnv = {
    ...env,
    WEBBRIDGE_BASE_URL: config.baseUrl,
    WEBBRIDGE_PACKAGE_ROOT: config.packageRoot!,
  };
  const alifeRootProperty = `-p:AlifeRoot=${config.alifeRoot}`;

  if (env.WEBBRIDGE_SKIP_DOTNET_RESTORE !== '1') {
    await runCommand(
      'dotnet restore',
      config.dotnetExe,
      ['restore', config.projectPath, alifeRootProperty, '-v:minimal'],
      config.repoRoot,
      childEnv,
    );
  }

  await runCommand(
    'dotnet run active apply evidence',
    config.dotnetExe,
    [
      'run',
      '--project',
      config.projectPath,
      '--no-restore',
      alifeRootProperty,
      '--',
      config.baseUrl,
      config.packageRoot!,
      config.alifeRoot,
    ],
    config.repoRoot,
    childEnv,
  );
}

if (require.main === module) {
  runWebBridgeActiveApplyEvidence().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 4: Add the local server mode**

In `scripts/test-integration-local.ts`, update the `LocalServerMode` union to include `webbridge-active-apply`:

```ts
export type LocalServerMode =
  | 'integration'
  | 'contracts-live'
  | 'e2e'
  | 'e2e-api'
  | 'webbridge'
  | 'webbridge-smoke'
  | 'webbridge-active-apply';
```

Add this case to `createTestCommand(...)` after the `webbridge-smoke` case:

```ts
    case 'webbridge-active-apply':
      return {
        command: resolvePackageFile('tsx', 'dist/cli.mjs'),
        args: ['scripts/check-webbridge-active-apply.ts', ...extraArgs],
        cwd: rootDir,
        env: process.env,
      };
```

Update `parseMode(...)` to accept the new raw value:

```ts
    raw === 'webbridge-smoke' ||
    raw === 'webbridge-active-apply'
```

- [ ] **Step 5: Add the package script**

In `package.json`, add this script next to `check:webbridge:smoke`:

```json
"check:webbridge:active-apply": "tsx scripts/test-integration-local.ts webbridge-active-apply",
```

- [ ] **Step 6: Run the Node tests and observe GREEN**

Run from `桌宠demo\新建文件夹\avatar-web-management`:

```powershell
npx jest tests/unit/package-scripts.test.ts tests/unit/test-integration-local.test.ts tests/unit/check-webbridge-active-apply.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit the Node runner**

Run from `D:\FOXD`:

```powershell
git add "桌宠demo/新建文件夹/avatar-web-management/package.json"
git add "桌宠demo/新建文件夹/avatar-web-management/scripts/test-integration-local.ts"
git add "桌宠demo/新建文件夹/avatar-web-management/scripts/check-webbridge-active-apply.ts"
git add "桌宠demo/新建文件夹/avatar-web-management/tests/unit/package-scripts.test.ts"
git add "桌宠demo/新建文件夹/avatar-web-management/tests/unit/test-integration-local.test.ts"
git add "桌宠demo/新建文件夹/avatar-web-management/tests/unit/check-webbridge-active-apply.test.ts"
git commit -m "test: add active WebBridge apply runner guardrails"
```

Expected: one focused commit.

## Task 3: Add The C# Active Apply Evidence Project

**Files:**
- Create: `tools/webbridge-active-apply-evidence/AlifeWebBridgeActiveApplyEvidence.csproj`
- Create: `tools/webbridge-active-apply-evidence/Program.cs`
- Create: `桌宠demo/新建文件夹/avatar-web-management/tests/unit/active-apply-evidence-source.test.ts`

- [ ] **Step 1: Create failing source guardrail tests**

Create `tests/unit/active-apply-evidence-source.test.ts` with this content:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function repoRoot(): string {
  return join(process.cwd(), '..', '..', '..');
}

function readRepoFile(relativePath: string): string {
  return readFileSync(join(repoRoot(), relativePath), 'utf8');
}

describe('active WebBridge apply evidence project source', () => {
  it('references canonical Alife WebBridge through an overridable AlifeRoot property', () => {
    const project = readRepoFile(
      'tools/webbridge-active-apply-evidence/AlifeWebBridgeActiveApplyEvidence.csproj',
    );

    expect(project).toContain('<AlifeRoot Condition="');
    expect(project).toContain('D:\\Alife');
    expect(project).toContain('Alife.Function.WebBridge.csproj');
  });

  it('prints active-service evidence without default runtime storage claims', () => {
    const program = readRepoFile('tools/webbridge-active-apply-evidence/Program.cs');

    expect(program).toContain('Active WebBridge apply evidence passed.');
    expect(program).toContain('EvidenceMode: active-service-apply');
    expect(program).toContain('DefaultRuntimeStorageTouched: false');
    expect(program).toContain('WebStatus: applied/upToDate/none/requiresLocalConfirmation=false');
  });

  it('uses WebBridgeService apply and disables asset sync', () => {
    const program = readRepoFile('tools/webbridge-active-apply-evidence/Program.cs');

    expect(program).toContain('new WebBridgeService');
    expect(program).toContain('SyncAssetsEnabled = false');
    expect(program).toContain('InstallPackage(PackageId');
    expect(program).toContain('ApplyPackage(PackageId');
    expect(program).not.toContain('AlifePath.StorageFolderPath');
  });
});
```

- [ ] **Step 2: Run source guardrails and observe RED**

Run from `桌宠demo\新建文件夹\avatar-web-management`:

```powershell
npx jest tests/unit/active-apply-evidence-source.test.ts --runInBand
```

Expected: FAIL because the C# project does not exist.

- [ ] **Step 3: Create the C# project file**

Create `tools/webbridge-active-apply-evidence/AlifeWebBridgeActiveApplyEvidence.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net9.0-windows10.0.19041.0</TargetFramework>
    <RootNamespace>AlifeWebBridgeActiveApplyEvidence</RootNamespace>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <AlifeRoot Condition="'$(AlifeRoot)' == ''">D:\Alife</AlifeRoot>
  </PropertyGroup>

  <ItemGroup>
    <ProjectReference Include="$(AlifeRoot)\sources\Alife.Function\Alife.Function.WebBridge\Alife.Function.WebBridge.csproj" />
  </ItemGroup>

</Project>
```

- [ ] **Step 4: Create `Program.cs`**

Create `tools/webbridge-active-apply-evidence/Program.cs`:

```csharp
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Alife.Function.WebBridge;

const string PackageId = "current-pet-character-bundle";

string baseUrl = args.Length > 0
    ? args[0]
    : GetEnvOrDefault("WEBBRIDGE_BASE_URL", "http://localhost:3000");
baseUrl = baseUrl.TrimEnd('/');

string? packageRootValue = args.Length > 1
    ? args[1]
    : Environment.GetEnvironmentVariable("WEBBRIDGE_PACKAGE_ROOT");
if (string.IsNullOrWhiteSpace(packageRootValue))
    throw new InvalidOperationException("WEBBRIDGE_PACKAGE_ROOT is required.");

string packageRoot = packageRootValue;

string alifeRoot = args.Length > 2
    ? args[2]
    : GetEnvOrDefault("ALIFE_ROOT", "D:\\Alife");

string email = GetEnvOrDefault("WEBBRIDGE_EMAIL", "demo@example.com");
string password = GetEnvOrDefault("WEBBRIDGE_PASSWORD", "demo1234");

using HttpClient webClient = new() { BaseAddress = new Uri(baseUrl + "/") };
using HttpResponseMessage loginResponse = await webClient.PostAsJsonAsync(
    "api/auth/login",
    new { email, password });
loginResponse.EnsureSuccessStatusCode();

string loginJson = await loginResponse.Content.ReadAsStringAsync();
string accessToken = ExtractAccessToken(loginJson);
webClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

string evidenceMarker = $"active-apply-evidence-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}";
string characterExtraMarker = $"{evidenceMarker}-character-extra";
using HttpResponseMessage configResponse = await webClient.PutAsJsonAsync(
    "api/pet/config",
    new { petName = evidenceMarker, characterExtra = characterExtraMarker });
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
Require(IsUnderRoot(packageRoot, installResult.PackageRootPath), "PackageRootPath escaped explicit evidence root.");
Require(File.Exists(installResult.ManifestPath), $"Missing manifest: {installResult.ManifestPath}");
Require(File.Exists(installResult.ConfigDraftPath), $"Missing config draft: {installResult.ConfigDraftPath}");

string characterCardPath = Path.Combine(installResult.PackageRootPath, "characters", "current-pet", "card.json");
Require(File.Exists(characterCardPath), $"Missing character card: {characterCardPath}");
Require(File.ReadAllText(characterCardPath).Contains(characterExtraMarker), "Character card does not contain this evidence marker.");

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
Require(File.ReadAllText(activeConfigPath).Contains(evidenceMarker), "Active config does not contain this evidence marker.");
Require(CatalogContainsStatus(catalogPath, PackageId, "applied"), "Catalog does not contain applied record.");

using HttpRequestMessage appliedStatusRequest = new(HttpMethod.Get, "api/pet/sync/status");
using HttpResponseMessage appliedStatusResponse = await webClient.SendAsync(appliedStatusRequest);
appliedStatusResponse.EnsureSuccessStatusCode();
string appliedStatusJson = await appliedStatusResponse.Content.ReadAsStringAsync();
Require(WebStatusHasAppliedPackage(appliedStatusJson), "Web sync status did not move to applied/upToDate.");

Console.WriteLine("Active WebBridge apply evidence passed.");
Console.WriteLine("EvidenceMode: active-service-apply");
Console.WriteLine($"AlifeRoot: {alifeRoot}");
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
Console.WriteLine("DefaultRuntimeStorageTouched: false");
Console.WriteLine("WebStatus: staged/localConfirmationRequired/confirmInDesktop");
Console.WriteLine("WebStatus: applied/upToDate/none/requiresLocalConfirmation=false");

static string ExtractAccessToken(string json)
{
    using JsonDocument document = JsonDocument.Parse(json);
    if (document.RootElement.TryGetProperty("data", out JsonElement data) &&
        data.TryGetProperty("accessToken", out JsonElement token) &&
        token.ValueKind == JsonValueKind.String)
    {
        string? value = token.GetString();
        if (string.IsNullOrWhiteSpace(value))
            throw new InvalidOperationException("Empty accessToken.");

        return value;
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

static string GetEnvOrDefault(string name, string defaultValue)
{
    string? value = Environment.GetEnvironmentVariable(name);
    return string.IsNullOrWhiteSpace(value) ? defaultValue : value;
}

static void Require(bool condition, string message)
{
    if (!condition)
        throw new InvalidOperationException(message);
}
```

- [ ] **Step 5: Run source guardrails and observe GREEN**

Run from `桌宠demo\新建文件夹\avatar-web-management`:

```powershell
npx jest tests/unit/active-apply-evidence-source.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Run focused Node tests together**

Run from `桌宠demo\新建文件夹\avatar-web-management`:

```powershell
npx jest tests/unit/package-scripts.test.ts tests/unit/test-integration-local.test.ts tests/unit/check-webbridge-active-apply.test.ts tests/unit/active-apply-evidence-source.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit the C# evidence project**

Run from `D:\FOXD`:

```powershell
git add tools/webbridge-active-apply-evidence/AlifeWebBridgeActiveApplyEvidence.csproj
git add tools/webbridge-active-apply-evidence/Program.cs
git add "桌宠demo/新建文件夹/avatar-web-management/tests/unit/active-apply-evidence-source.test.ts"
git commit -m "feat: add active WebBridge apply evidence project"
```

Expected: one focused commit.

## Task 4: Verify Disabled Guard And Opt-In Evidence Command Shape

**Files:**
- Verify only unless tests reveal a defect.

- [ ] **Step 1: Run disabled command guard**

Run from `桌宠demo\新建文件夹\avatar-web-management` without setting `ALIFE_ACTIVE_APPLY_EVIDENCE`:

```powershell
npm run check:webbridge:active-apply
```

Expected: command exits non-zero and prints:

```text
ALIFE_ACTIVE_APPLY_EVIDENCE must be set to true before active apply evidence can run.
```

- [ ] **Step 2: Run focused tests after disabled guard**

Run from `桌宠demo\新建文件夹\avatar-web-management`:

```powershell
npx jest tests/unit/package-scripts.test.ts tests/unit/test-integration-local.test.ts tests/unit/check-webbridge-active-apply.test.ts tests/unit/active-apply-evidence-source.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run from `桌宠demo\新建文件夹\avatar-web-management`:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit verification fixes only if needed**

If Steps 1-3 exposed a defect, make the smallest correction, rerun Steps 1-3, then commit:

```powershell
git add "桌宠demo/新建文件夹/avatar-web-management/package.json"
git add "桌宠demo/新建文件夹/avatar-web-management/scripts/test-integration-local.ts"
git add "桌宠demo/新建文件夹/avatar-web-management/scripts/check-webbridge-active-apply.ts"
git add "桌宠demo/新建文件夹/avatar-web-management/tests/unit/package-scripts.test.ts"
git add "桌宠demo/新建文件夹/avatar-web-management/tests/unit/test-integration-local.test.ts"
git add "桌宠demo/新建文件夹/avatar-web-management/tests/unit/check-webbridge-active-apply.test.ts"
git add "桌宠demo/新建文件夹/avatar-web-management/tests/unit/active-apply-evidence-source.test.ts"
git add tools/webbridge-active-apply-evidence/AlifeWebBridgeActiveApplyEvidence.csproj
git add tools/webbridge-active-apply-evidence/Program.cs
git commit -m "fix: harden active WebBridge apply evidence guardrails"
```

Expected: skipped when Steps 1-3 already pass.

## Task 5: Run Opt-In Active Apply Evidence

**Files:**
- Verify live evidence only.

- [ ] **Step 1: Confirm explicit package root is outside default Alife storage**

Use this package root:

```powershell
D:\tmp\foxd-active-apply-evidence
```

Verify it is not under `D:\Alife`:

```powershell
if ('D:\tmp\foxd-active-apply-evidence'.StartsWith('D:\Alife', [System.StringComparison]::OrdinalIgnoreCase)) { throw 'package root must not be under D:\Alife' }
```

Expected: no output and exit code 0.

- [ ] **Step 2: Run the opt-in command**

Run from `桌宠demo\新建文件夹\avatar-web-management`:

```powershell
$env:ALIFE_ACTIVE_APPLY_EVIDENCE='true'
$env:DOTNET_EXE='C:\Users\hu shu\.dotnet\dotnet.exe'
$env:ALIFE_ROOT='D:\Alife'
$env:WEBBRIDGE_PACKAGE_ROOT='D:\tmp\foxd-active-apply-evidence'
npm run check:webbridge:active-apply
```

Expected terminal evidence includes:

```text
Active WebBridge apply evidence passed.
EvidenceMode: active-service-apply
AlifeRoot: D:\Alife
InstallStatus: pendingActivation
ApplyStatus: applied
DefaultRuntimeStorageTouched: false
WebStatus: staged/localConfirmationRequired/confirmInDesktop
WebStatus: applied/upToDate/none/requiresLocalConfirmation=false
```

- [ ] **Step 3: Clear opt-in env vars in the current shell**

Run from `桌宠demo\新建文件夹\avatar-web-management`:

```powershell
Remove-Item Env:\ALIFE_ACTIVE_APPLY_EVIDENCE -ErrorAction SilentlyContinue
Remove-Item Env:\WEBBRIDGE_PACKAGE_ROOT -ErrorAction SilentlyContinue
```

Expected: no output and exit code 0.

## Task 6: Update Documentation

**Files:**
- Modify: `docs/webbridge-alife-local-integration.md`
- Modify: `docs/2026-07-03-alife-webbridge-protocol-status.md`
- Modify: `docs/project-status-2026-07-03.md`

- [ ] **Step 1: Update living runbook**

In `docs/webbridge-alife-local-integration.md`, add this section after `## Current Verified Staged-To-Applied Smoke`:

```markdown
## Active WebBridge Service Apply Evidence

The stronger active-service evidence check is opt-in:

```powershell
$env:ALIFE_ACTIVE_APPLY_EVIDENCE='true'
$env:DOTNET_EXE='C:\Users\hu shu\.dotnet\dotnet.exe'
$env:ALIFE_ROOT='D:\Alife'
$env:WEBBRIDGE_PACKAGE_ROOT='D:\tmp\foxd-active-apply-evidence'
npm run check:webbridge:active-apply
```

Expected evidence:

```text
Active WebBridge apply evidence passed.
EvidenceMode: active-service-apply
InstallStatus: pendingActivation
ApplyStatus: applied
DefaultRuntimeStorageTouched: false
WebStatus: staged/localConfirmationRequired/confirmInDesktop
WebStatus: applied/upToDate/none/requiresLocalConfirmation=false
```

This verifies the canonical Alife .NET WebBridge service apply path through `WebBridgeService.ApplyPackage(...)` and `packageApplied` milestone reporting while using an explicit package root. It still does not claim that an already-running desktop process applied a package in default runtime storage.
```

- [ ] **Step 2: Update protocol status**

In `docs/2026-07-03-alife-webbridge-protocol-status.md`, replace this open gap:

```markdown
1. The active desktop runtime apply path has not been exercised through the real running Alife desktop process.
```

with:

```markdown
1. Active Alife WebBridge service apply evidence is covered by `npm run check:webbridge:active-apply`; live already-running desktop process apply confirmation remains separate.
```

In the protocol matrix, update the `Isolated apply` row note to mention the new evidence command:

```markdown
| Isolated apply | Smoke runner and active evidence runner | Alife WebBridge apply path used by smoke | Implemented and smoke-tested | `check:webbridge:smoke` remains isolated harness evidence; `check:webbridge:active-apply` records opt-in active-service apply evidence with explicit package root. |
```

- [ ] **Step 3: Update project status**

In `docs/project-status-2026-07-03.md`, replace this known gap:

```markdown
2. Active desktop runtime apply evidence remains separate from the isolated staged-to-applied smoke.
```

with:

```markdown
2. Active WebBridge service apply evidence is available through `npm run check:webbridge:active-apply`; live already-running desktop process apply confirmation remains separate.
```

In `## Recommended Next Sequence`, replace:

```markdown
2. Prefer active desktop runtime apply evidence or a dedicated asset-sync smoke; do not combine both.
```

with:

```markdown
2. After active-service apply evidence, choose exactly one remaining gap such as live already-running desktop process confirmation or a dedicated asset-sync smoke.
```

- [ ] **Step 4: Verify documentation anchors**

Run from `D:\FOXD`:

```powershell
Select-String -Path docs\webbridge-alife-local-integration.md,docs\2026-07-03-alife-webbridge-protocol-status.md,docs\project-status-2026-07-03.md -Pattern "check:webbridge:active-apply|active-service-apply|DefaultRuntimeStorageTouched: false|live already-running desktop process"
git diff --check
```

Expected: each document has relevant matches and `git diff --check` exits 0.

- [ ] **Step 5: Commit documentation**

Run from `D:\FOXD`:

```powershell
git add docs/webbridge-alife-local-integration.md
git add docs/2026-07-03-alife-webbridge-protocol-status.md
git add docs/project-status-2026-07-03.md
git commit -m "docs: record active WebBridge apply evidence"
```

Expected: one documentation commit.

## Task 7: Full Verification And Boundary Checks

**Files:**
- Verify only unless commands reveal a defect.

- [ ] **Step 1: Run focused active evidence tests**

Run from `桌宠demo\新建文件夹\avatar-web-management`:

```powershell
npx jest tests/unit/package-scripts.test.ts tests/unit/test-integration-local.test.ts tests/unit/check-webbridge-active-apply.test.ts tests/unit/active-apply-evidence-source.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run full verification**

Run from `桌宠demo\新建文件夹\avatar-web-management`:

```powershell
npm run test -- --runInBand
npm run test:contracts -- --runInBand
npm run typecheck
$env:JWT_SECRET='temporary-verification-secret-at-least-32-chars'; $env:DATABASE_URL='file:./dev.db'; npm run build
```

Expected:

- Jest exits 0.
- Contract tests exit 0.
- Typecheck exits 0.
- Build exits 0 with the temporary production env values.

- [ ] **Step 3: Run boundary scans**

Run from `D:\FOXD`:

```powershell
rg -n "child_process|exec\(|spawn\(|PowerShell|Start Alife|Stop Alife|Restart Alife|Repair Alife|Apply Alife|Delete Alife" "桌宠demo\新建文件夹\avatar-web-management\src" "桌宠demo\新建文件夹\avatar-web-management\scripts"
rg -n "model PetSyncStatus|desktop_known_version|pet_sync_statuses" "桌宠demo\新建文件夹\avatar-web-management\prisma"
git diff --check
git diff --name-only HEAD
git status --short --branch
git -C D:\Alife status --short --branch
```

Expected:

- First `rg` may show the intended Node runner `spawn` usage only under `scripts`; it must not show browser/source UI shell actions under `src`.
- Second `rg` shows only existing Prisma model and migration evidence.
- `git diff --check` exits 0.
- Changed files are limited to runner, tests, C# evidence project, docs, and package script files.
- `D:\Alife` status is unchanged by this FOXD work.

- [ ] **Step 4: Commit verification fixes only if needed**

If Steps 1-3 expose a defect, make the smallest correction, rerun the failed command and any relevant focused tests, then commit:

```powershell
git add "桌宠demo/新建文件夹/avatar-web-management/package.json"
git add "桌宠demo/新建文件夹/avatar-web-management/scripts/test-integration-local.ts"
git add "桌宠demo/新建文件夹/avatar-web-management/scripts/check-webbridge-active-apply.ts"
git add "桌宠demo/新建文件夹/avatar-web-management/tests/unit/package-scripts.test.ts"
git add "桌宠demo/新建文件夹/avatar-web-management/tests/unit/test-integration-local.test.ts"
git add "桌宠demo/新建文件夹/avatar-web-management/tests/unit/check-webbridge-active-apply.test.ts"
git add "桌宠demo/新建文件夹/avatar-web-management/tests/unit/active-apply-evidence-source.test.ts"
git add tools/webbridge-active-apply-evidence/AlifeWebBridgeActiveApplyEvidence.csproj
git add tools/webbridge-active-apply-evidence/Program.cs
git add docs/webbridge-alife-local-integration.md
git add docs/2026-07-03-alife-webbridge-protocol-status.md
git add docs/project-status-2026-07-03.md
git commit -m "fix: verify active WebBridge apply evidence"
```

Expected: skipped when full verification already passes.

## Task 8: Finish Branch

**Files:**
- No source changes unless review or verification finds issues.

- [ ] **Step 1: Review final commit list**

Run from `D:\FOXD`:

```powershell
git log --oneline master..HEAD
git status --short --branch
```

Expected: branch contains this plan's design, implementation, evidence, and documentation commits. Working tree is clean except ignored generated files.

- [ ] **Step 2: Use finishing workflow**

Use `superpowers:finishing-a-development-branch`.

Expected: present integration options to the user. Do not merge, push, delete, or discard unless the user chooses that option.

## Self-Review Checklist

Spec coverage:

- The plan adds `check:webbridge:active-apply`.
- The runner is disabled by default.
- The runner requires explicit `WEBBRIDGE_PACKAGE_ROOT`.
- The C# evidence project references canonical `D:\Alife` through `AlifeRoot`.
- Evidence output includes install status, apply status, explicit package root paths, catalog path, active config path, Web status transitions, and `DefaultRuntimeStorageTouched: false`.
- Documentation distinguishes isolated smoke, active-service apply evidence, and live already-running desktop process confirmation.
- No Alife source, Prisma schema, UI, browser shell actions, or gitlink changes are required.

Marker scan:

- This plan contains no intentionally unfinished implementation markers.

Type consistency:

- `webbridge-active-apply` is used consistently as the local runner mode.
- `check:webbridge:active-apply` is used consistently as the package script.
- `createWebBridgeActiveApplyEvidenceConfig`, `validateActiveApplyEvidenceConfig`, and `runWebBridgeActiveApplyEvidence` are defined by the runner before tests import them.
