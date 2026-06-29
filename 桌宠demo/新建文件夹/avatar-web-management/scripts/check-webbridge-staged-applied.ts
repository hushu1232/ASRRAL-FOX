import { existsSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';

type WebBridgeSmokeConfig = {
  baseUrl: string;
  dotnetExe: string;
  alifeRoot: string;
  repoRoot: string;
  projectPath: string;
  packageRoot: string;
};

const DEFAULT_DOTNET_EXE = 'C:\\Users\\hu shu\\.dotnet\\dotnet.exe';
const DEFAULT_ALIFE_ROOT = 'D:\\Alife';

function normalizeBaseUrl(value: string | undefined): string {
  return (value || 'http://localhost:3000').replace(/\/+$/, '');
}

function timestamp(): string {
  return new Date()
    .toISOString()
    .replace(/\D/g, '')
    .slice(0, 14);
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

export function createWebBridgeStagedAppliedSmokeConfig(
  env: Partial<NodeJS.ProcessEnv> = process.env,
  cwd = process.cwd(),
): WebBridgeSmokeConfig {
  const repoRoot = findRepoRoot(cwd);
  const projectPath = join(repoRoot, 'tools', 'webbridge-smoke', 'AlifeWebBridgeSmoke.csproj');
  const packageRoot = env.WEBBRIDGE_PACKAGE_ROOT || join(
    repoRoot,
    '.worktrees',
    '_alife-webbridge-integration',
    timestamp(),
  );

  return {
    baseUrl: normalizeBaseUrl(env.WEBBRIDGE_BASE_URL || env.TEST_BASE_URL || `http://localhost:${env.PORT || '3000'}`),
    dotnetExe: defaultDotnetExe(env),
    alifeRoot: env.ALIFE_ROOT || DEFAULT_ALIFE_ROOT,
    repoRoot,
    projectPath,
    packageRoot,
  };
}

function runCommand(
  label: string,
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<void> {
  console.log(`[webbridge-smoke] ${label}`);
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

export async function runWebBridgeStagedAppliedSmoke(
  config = createWebBridgeStagedAppliedSmokeConfig(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (!existsSync(config.projectPath)) {
    throw new Error(`Smoke project not found: ${config.projectPath}`);
  }
  if (!existsSync(config.alifeRoot)) {
    throw new Error(`Alife root not found: ${config.alifeRoot}`);
  }

  mkdirSync(config.packageRoot, { recursive: true });
  const childEnv: NodeJS.ProcessEnv = {
    ...env,
    WEBBRIDGE_BASE_URL: config.baseUrl,
    WEBBRIDGE_PACKAGE_ROOT: config.packageRoot,
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
    'dotnet run staged-to-applied smoke',
    config.dotnetExe,
    [
      'run',
      '--project',
      config.projectPath,
      '--no-restore',
      alifeRootProperty,
      '--',
      config.baseUrl,
      config.packageRoot,
    ],
    config.repoRoot,
    childEnv,
  );
}

if (require.main === module) {
  runWebBridgeStagedAppliedSmoke().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
