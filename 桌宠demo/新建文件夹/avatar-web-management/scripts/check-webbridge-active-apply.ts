import { existsSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';

export type ActiveApplyEvidenceConfig = {
  baseUrl: string;
  dotnetExe: string | null;
  alifeRoot: string | null;
  repoRoot: string;
  projectPath: string;
  packageRoot: string | null;
  evidenceEnabled: boolean;
};

type ValidActiveApplyEvidenceConfig = ActiveApplyEvidenceConfig & {
  dotnetExe: string;
  alifeRoot: string;
  packageRoot: string;
};

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
  const baseUrl = normalizeBaseUrl(
    env.WEBBRIDGE_BASE_URL || env.TEST_BASE_URL || `http://localhost:${env.PORT || '3000'}`,
  );

  return {
    baseUrl,
    dotnetExe: env.DOTNET_EXE || null,
    alifeRoot: env.ALIFE_ROOT ? resolve(cwd, env.ALIFE_ROOT) : null,
    repoRoot,
    projectPath,
    packageRoot: env.WEBBRIDGE_PACKAGE_ROOT ? resolve(cwd, env.WEBBRIDGE_PACKAGE_ROOT) : null,
    evidenceEnabled: env.ALIFE_ACTIVE_APPLY_EVIDENCE === 'true',
  };
}

export function validateActiveApplyEvidenceConfig(config: ActiveApplyEvidenceConfig): ValidActiveApplyEvidenceConfig {
  if (!config.evidenceEnabled) {
    throw new Error('ALIFE_ACTIVE_APPLY_EVIDENCE must be set to true before active apply evidence can run.');
  }

  if (!config.packageRoot) {
    throw new Error('WEBBRIDGE_PACKAGE_ROOT is required for active apply evidence.');
  }

  if (!config.dotnetExe) {
    throw new Error('DOTNET_EXE is required for active apply evidence.');
  }

  if (!config.alifeRoot) {
    throw new Error('ALIFE_ROOT is required for active apply evidence.');
  }

  if (!existsSync(config.projectPath)) {
    throw new Error(`Active apply evidence project not found: ${config.projectPath}`);
  }

  if (!existsSync(config.alifeRoot)) {
    throw new Error(`Alife root not found: ${config.alifeRoot}`);
  }

  return {
    ...config,
    dotnetExe: config.dotnetExe,
    alifeRoot: config.alifeRoot,
    packageRoot: config.packageRoot,
  };
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
  const validConfig = validateActiveApplyEvidenceConfig(config);

  mkdirSync(validConfig.packageRoot, { recursive: true });
  const childEnv: NodeJS.ProcessEnv = {
    ...env,
    WEBBRIDGE_BASE_URL: validConfig.baseUrl,
    WEBBRIDGE_PACKAGE_ROOT: validConfig.packageRoot,
  };
  const alifeRootProperty = `-p:AlifeRoot=${validConfig.alifeRoot}`;

  if (env.WEBBRIDGE_SKIP_DOTNET_RESTORE !== '1') {
    await runCommand(
      'dotnet restore',
      validConfig.dotnetExe,
      ['restore', validConfig.projectPath, alifeRootProperty, '-v:minimal'],
      validConfig.repoRoot,
      childEnv,
    );
  }

  await runCommand(
    'dotnet run active apply evidence',
    validConfig.dotnetExe,
    [
      'run',
      '--project',
      validConfig.projectPath,
      '--no-restore',
      alifeRootProperty,
      '--',
      validConfig.baseUrl,
      validConfig.packageRoot,
      validConfig.alifeRoot,
    ],
    validConfig.repoRoot,
    childEnv,
  );
}

if (require.main === module) {
  runWebBridgeActiveApplyEvidence().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
