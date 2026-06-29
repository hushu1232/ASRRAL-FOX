import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLocalServerRunConfig } from '../../scripts/test-integration-local';

describe('test:integration:local runner', () => {
  it('uses a local runner instead of start-server-and-test', () => {
    const config = createLocalServerRunConfig('integration');

    expect(config.server.command).toContain('scripts');
    expect(config.server.command).toContain('start-standalone.mjs');
    expect(config.server.args).toEqual([]);
    expect(config.server.healthUrl).toBe('http://localhost:3000/api/health');
    expect(config.server.env?.JWT_SECRET).toBeTruthy();

    expect(config.test.command).toContain('jest');
    expect(config.test.args).toEqual([
      '--verbose',
      '--runInBand',
      '--testMatch',
      '**/tests/*.test.ts',
      '**/tests/contracts/**/*.test.ts',
      '**/tests/contract/**/*.test.ts',
    ]);
  });

  it('provides a local-only JWT secret when no environment file defines one', () => {
    const previousSecret = process.env.JWT_SECRET;
    const rootDir = mkdtempSync(join(tmpdir(), 'foxd-local-runner-'));

    delete process.env.JWT_SECRET;

    try {
      const config = createLocalServerRunConfig('integration', rootDir);

      expect(config.server.env?.JWT_SECRET).toBe(
        'local-integration-runner-secret-do-not-use-in-production',
      );
    } finally {
      if (previousSecret === undefined) {
        delete process.env.JWT_SECRET;
      } else {
        process.env.JWT_SECRET = previousSecret;
      }
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('injects local-only RSA keys when no RSA environment or file keys are available', () => {
    const previousPrivateKey = process.env.JWT_PRIVATE_KEY;
    const previousPublicKey = process.env.JWT_PUBLIC_KEY;
    const previousKeyId = process.env.JWT_KEY_ID;
    const rootDir = mkdtempSync(join(tmpdir(), 'foxd-local-runner-'));

    delete process.env.JWT_PRIVATE_KEY;
    delete process.env.JWT_PUBLIC_KEY;
    delete process.env.JWT_KEY_ID;

    try {
      const config = createLocalServerRunConfig('webbridge-smoke', rootDir);

      expect(config.server.env?.JWT_PRIVATE_KEY).toContain('BEGIN PRIVATE KEY');
      expect(config.server.env?.JWT_PUBLIC_KEY).toContain('BEGIN PUBLIC KEY');
      expect(config.server.env?.JWT_KEY_ID).toBeTruthy();
    } finally {
      if (previousPrivateKey === undefined) {
        delete process.env.JWT_PRIVATE_KEY;
      } else {
        process.env.JWT_PRIVATE_KEY = previousPrivateKey;
      }

      if (previousPublicKey === undefined) {
        delete process.env.JWT_PUBLIC_KEY;
      } else {
        process.env.JWT_PUBLIC_KEY = previousPublicKey;
      }

      if (previousKeyId === undefined) {
        delete process.env.JWT_KEY_ID;
      } else {
        process.env.JWT_KEY_ID = previousKeyId;
      }

      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('supports live contract snapshots as an explicit server-backed mode', () => {
    const config = createLocalServerRunConfig('contracts-live');

    expect(config.test.command).toContain('jest');
    expect(config.test.args).toEqual([
      '--verbose',
      '--runInBand',
      '--testMatch',
      '**/tests/contracts/response-snapshots.test.ts',
    ]);
  });

  it('supports e2e modes without start-server-and-test', () => {
    const e2e = createLocalServerRunConfig('e2e');
    const e2eApi = createLocalServerRunConfig('e2e-api');

    expect(e2e.test.command).toContain('playwright');
    expect(e2e.test.args).toEqual(['test']);
    expect(e2eApi.test.command).toContain('playwright');
    expect(e2eApi.test.args).toEqual(['test', '--project=chromium', 'e2e/api.spec.ts']);
  });

  it('passes extra test args through to the selected mode', () => {
    const config = createLocalServerRunConfig('e2e', process.cwd(), [
      '--project=chromium',
      'e2e/approval-flow.spec.ts',
    ]);

    expect(config.test.args).toEqual(['test', '--project=chromium', 'e2e/approval-flow.spec.ts']);
  });

  it('supports WebBridge preflight checks against the local standalone server', () => {
    const config = createLocalServerRunConfig('webbridge');

    expect(config.test.command).toContain('tsx');
    expect(config.test.args).toEqual(['scripts/check-webbridge-ready.ts']);
  });

  it('supports Alife .NET WebBridge staged-to-applied smoke checks against the local standalone server', () => {
    const config = createLocalServerRunConfig('webbridge-smoke');

    expect(config.test.command).toContain('tsx');
    expect(config.test.args).toEqual(['scripts/check-webbridge-staged-applied.ts']);
  });
});
