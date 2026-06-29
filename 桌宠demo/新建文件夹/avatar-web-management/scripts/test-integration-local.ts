import { spawn, type ChildProcess } from 'node:child_process';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

type EnvMap = Record<string, string | undefined>;

type NodeScriptCommand = {
  command: string;
  args: string[];
  cwd: string;
  env?: EnvMap;
};

type ServerCommand = NodeScriptCommand & {
  healthUrl: string;
  timeoutMs: number;
};

export type IntegrationLocalRunConfig = {
  server: ServerCommand;
  test: NodeScriptCommand;
};

export type LocalServerMode =
  | 'integration'
  | 'contracts-live'
  | 'e2e'
  | 'e2e-api'
  | 'webbridge'
  | 'webbridge-smoke';

const INTEGRATION_TEST_ARGS = [
  '--verbose',
  '--runInBand',
  '--testMatch',
  '**/tests/*.test.ts',
  '**/tests/contracts/**/*.test.ts',
  '**/tests/contract/**/*.test.ts',
];

const CONTRACTS_LIVE_TEST_ARGS = [
  '--verbose',
  '--runInBand',
  '--testMatch',
  '**/tests/contracts/response-snapshots.test.ts',
];

const LOCAL_RUNNER_JWT_SECRET = 'local-integration-runner-secret-do-not-use-in-production';

function resolvePackageFile(packageName: string, relativePath: string): string {
  return join(dirname(require.resolve(`${packageName}/package.json`)), relativePath);
}

function resolveStandaloneServer(rootDir: string): string {
  return join(rootDir, 'scripts', 'start-standalone.mjs');
}

function parseEnvFile(filePath: string): EnvMap {
  if (!existsSync(filePath)) {
    return {};
  }

  return readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce<EnvMap>((env, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return env;
      }

      const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
      const separator = normalized.indexOf('=');
      if (separator === -1) {
        return env;
      }

      const key = normalized.slice(0, separator).trim();
      let value = normalized.slice(separator + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      env[key] = value.replace(/\\n/g, '\n');
      return env;
    }, {});
}

function loadLocalEnv(rootDir: string): EnvMap {
  const env = {
    ...parseEnvFile(join(rootDir, '.env')),
    ...parseEnvFile(join(rootDir, '.env.local')),
    ...process.env,
  };

  if (!env.JWT_SECRET) {
    env.JWT_SECRET = LOCAL_RUNNER_JWT_SECRET;
  }

  ensureLocalRunnerRsaKeys(rootDir, env);

  return env;
}

function ensureLocalRunnerRsaKeys(rootDir: string, env: EnvMap): void {
  if (env.JWT_PRIVATE_KEY && env.JWT_PUBLIC_KEY) {
    return;
  }

  const fileKeys = readLocalFileRsaKeys(rootDir);
  if (fileKeys) {
    env.JWT_PRIVATE_KEY = fileKeys.privateKey;
    env.JWT_PUBLIC_KEY = fileKeys.publicKey;
    env.JWT_KEY_ID = env.JWT_KEY_ID || fileKeys.keyId;
    return;
  }

  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  env.JWT_PRIVATE_KEY = privateKey;
  env.JWT_PUBLIC_KEY = publicKey;
  env.JWT_KEY_ID = env.JWT_KEY_ID || `local-integration-runner-${randomUUID()}`;
}

function readLocalFileRsaKeys(
  rootDir: string,
): { privateKey: string; publicKey: string; keyId: string } | null {
  const privateKeyPath = join(rootDir, 'keys', 'private.pem');
  const publicKeyPath = join(rootDir, 'keys', 'public.pem');

  if (!existsSync(privateKeyPath) || !existsSync(publicKeyPath)) {
    return null;
  }

  const kidPath = join(rootDir, 'keys', 'kid');
  return {
    privateKey: readFileSync(privateKeyPath, 'utf8'),
    publicKey: readFileSync(publicKeyPath, 'utf8'),
    keyId: existsSync(kidPath) ? readFileSync(kidPath, 'utf8').trim() : 'local-integration-runner',
  };
}

function createTestCommand(
  mode: LocalServerMode,
  rootDir: string,
  extraArgs: string[] = [],
): NodeScriptCommand {
  switch (mode) {
    case 'integration':
      return {
        command: resolvePackageFile('jest', 'bin/jest.js'),
        args: [...INTEGRATION_TEST_ARGS, ...extraArgs],
        cwd: rootDir,
        env: process.env,
      };
    case 'contracts-live':
      return {
        command: resolvePackageFile('jest', 'bin/jest.js'),
        args: [...CONTRACTS_LIVE_TEST_ARGS, ...extraArgs],
        cwd: rootDir,
        env: process.env,
      };
    case 'e2e':
      return {
        command: resolvePackageFile('playwright', 'cli.js'),
        args: ['test', ...extraArgs],
        cwd: rootDir,
        env: process.env,
      };
    case 'e2e-api':
      return {
        command: resolvePackageFile('playwright', 'cli.js'),
        args: ['test', '--project=chromium', 'e2e/api.spec.ts', ...extraArgs],
        cwd: rootDir,
        env: process.env,
      };
    case 'webbridge':
      return {
        command: resolvePackageFile('tsx', 'dist/cli.mjs'),
        args: ['scripts/check-webbridge-ready.ts', ...extraArgs],
        cwd: rootDir,
        env: process.env,
      };
    case 'webbridge-smoke':
      return {
        command: resolvePackageFile('tsx', 'dist/cli.mjs'),
        args: ['scripts/check-webbridge-staged-applied.ts', ...extraArgs],
        cwd: rootDir,
        env: process.env,
      };
  }
}

export function createLocalServerRunConfig(
  mode: LocalServerMode = 'integration',
  rootDir = process.cwd(),
  extraArgs: string[] = [],
): IntegrationLocalRunConfig {
  const port = process.env.PORT || '3000';
  const serverEnv = loadLocalEnv(rootDir);

  return {
    server: {
      command: resolveStandaloneServer(rootDir),
      args: [],
      cwd: rootDir,
      env: {
        ...serverEnv,
        PORT: port,
      },
      healthUrl: `http://localhost:${port}/api/health`,
      timeoutMs: Number(process.env.INTEGRATION_SERVER_TIMEOUT_MS || 60_000),
    },
    test: createTestCommand(mode, rootDir, extraArgs),
  };
}

export function createIntegrationLocalRunConfig(
  rootDir = process.cwd(),
): IntegrationLocalRunConfig {
  return createLocalServerRunConfig('integration', rootDir);
}

function spawnNodeScript(command: NodeScriptCommand): ChildProcess {
  return spawn(process.execPath, [command.command, ...command.args], {
    cwd: command.cwd,
    env: command.env as NodeJS.ProcessEnv | undefined,
    stdio: 'inherit',
    windowsHide: true,
  });
}

function runNodeScript(command: NodeScriptCommand): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawnNodeScript(command);

    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (typeof code === 'number') {
        resolve(code);
        return;
      }

      resolve(signal ? 1 : 0);
    });
  });
}

async function waitForServer(
  server: ChildProcess,
  healthUrl: string,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'server did not respond';

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Next server exited before becoming ready with code ${server.exitCode}`);
    }

    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(5_000) });
      if (response.ok) {
        return;
      }
      lastError = `HTTP ${response.status} from ${healthUrl}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await delay(500);
  }

  throw new Error(`Timed out waiting for ${healthUrl}: ${lastError}`);
}

async function stopServer(server: ChildProcess): Promise<void> {
  if (server.exitCode !== null) {
    return;
  }

  const exited = new Promise<void>((resolve) => {
    server.once('exit', () => resolve());
  });

  server.kill();

  const result = await Promise.race([
    exited.then(() => 'exited' as const),
    delay(5_000).then(() => 'timeout' as const),
  ]);

  if (result === 'timeout' && server.exitCode === null) {
    server.kill('SIGKILL');
    await Promise.race([exited, delay(1_000)]);
  }
}

export async function runWithLocalServer(config = createLocalServerRunConfig()): Promise<number> {
  const server = spawnNodeScript(config.server);

  try {
    await waitForServer(server, config.server.healthUrl, config.server.timeoutMs);
    return await runNodeScript(config.test);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  } finally {
    await stopServer(server);
  }
}

export async function runIntegrationLocal(
  config = createIntegrationLocalRunConfig(),
): Promise<number> {
  return runWithLocalServer(config);
}

function parseMode(argv: string[]): LocalServerMode {
  const raw = argv[2] || 'integration';
  if (
    raw === 'integration' ||
    raw === 'contracts-live' ||
    raw === 'e2e' ||
    raw === 'e2e-api' ||
    raw === 'webbridge' ||
    raw === 'webbridge-smoke'
  ) {
    return raw;
  }

  throw new Error(`Unknown local server test mode: ${raw}`);
}

if (require.main === module) {
  const mode = parseMode(process.argv);
  const extraArgs = process.argv.slice(3);
  runWithLocalServer(createLocalServerRunConfig(mode, process.cwd(), extraArgs)).then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
  );
}
