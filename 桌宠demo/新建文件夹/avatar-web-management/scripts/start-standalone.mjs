import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const env = {};
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const separator = normalized.indexOf('=');
    if (separator === -1) {
      continue;
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
  }

  return env;
}

const fileEnv = {
  ...parseEnvFile(join(rootDir, '.env')),
  ...parseEnvFile(join(rootDir, '.env.local')),
};

for (const [key, value] of Object.entries(fileEnv)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}

function syncDirectory(source, destination) {
  if (!existsSync(source)) {
    return;
  }

  const sourceStats = statSync(source);
  if (!sourceStats.isDirectory()) {
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
    return;
  }

  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const sourceEntry = join(source, entry.name);
    const destinationEntry = join(destination, entry.name);

    if (entry.isDirectory()) {
      syncDirectory(sourceEntry, destinationEntry);
      continue;
    }

    if (entry.isFile()) {
      mkdirSync(dirname(destinationEntry), { recursive: true });
      copyFileSync(sourceEntry, destinationEntry);
    }
  }
}

function prepareStandaloneAssets() {
  const standaloneDir = join(rootDir, '.next', 'standalone');

  syncDirectory(join(rootDir, '.next', 'static'), join(standaloneDir, '.next', 'static'));
  syncDirectory(join(rootDir, 'public'), join(standaloneDir, 'public'));
}

prepareStandaloneAssets();

const serverPath = join(rootDir, '.next', 'standalone', 'server.js');
const server = spawn(process.execPath, [serverPath], {
  cwd: rootDir,
  env: process.env,
  stdio: 'inherit',
  windowsHide: true,
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (server.exitCode === null) {
      server.kill(signal);
    }
  });
}

server.once('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});

server.once('exit', (code, signal) => {
  if (signal) {
    process.exitCode = 1;
    return;
  }

  process.exitCode = code ?? 0;
});
