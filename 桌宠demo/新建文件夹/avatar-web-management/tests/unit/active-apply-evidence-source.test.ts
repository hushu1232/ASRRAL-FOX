import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

function repoRoot(): string {
  let current = resolve(process.cwd());

  while (!existsSync(join(current, '.git'))) {
    const parent = dirname(current);
    if (parent === current) {
      throw new Error(`Could not find repository root from ${process.cwd()}`);
    }
    current = parent;
  }

  return current;
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
    expect(program).toContain('WebStatus: staged/localConfirmationRequired/confirmInDesktop');
    expect(program).toContain('WebStatus: applied/upToDate/none/requiresLocalConfirmation=false');
    expect(program).toContain('active-apply-evidence-');
  });

  it('uses WebBridgeService apply and disables asset sync', () => {
    const program = readRepoFile('tools/webbridge-active-apply-evidence/Program.cs');

    expect(program).toContain('new WebBridgeService');
    expect(program).toContain('PackageRootPath = packageRoot');
    expect(program).toContain('AutoSyncEnabled = false');
    expect(program).toContain('SyncAssetsEnabled = false');
    expect(program).toContain('InstallPackage(PackageId');
    expect(program).toContain('ApplyPackage(PackageId');
    expect(program).not.toContain('AlifePath.StorageFolderPath');
  });

  it('requires an explicit package root and accepts the package root as an install result path', () => {
    const program = readRepoFile('tools/webbridge-active-apply-evidence/Program.cs');

    expect(program).toContain('WEBBRIDGE_PACKAGE_ROOT is required.');
    expect(program).toContain('PackageRootPath escaped explicit evidence root');
    expect(program).toContain('string.Equals(fullPath, fullRoot, StringComparison.OrdinalIgnoreCase)');
  });
});
