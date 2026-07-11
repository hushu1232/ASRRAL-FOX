import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import {
  createLocalServerRunConfig,
  getLocalServerModePreconditionError,
  runWithLocalServer,
} from '../../scripts/test-integration-local';

const spawnMock = jest.fn();

jest.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

describe('test:integration:local runner', () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

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

  it('supports opt-in active WebBridge apply evidence checks against the local standalone server', () => {
    const config = createLocalServerRunConfig('webbridge-active-apply');

    expect(config.test.command).toContain('tsx');
    expect(config.test.args).toEqual(['scripts/check-webbridge-active-apply.ts']);
  });

  it('requires active WebBridge apply evidence opt-in before starting the local server', () => {
    expect(getLocalServerModePreconditionError('webbridge-active-apply', {})).toBe(
      'ALIFE_ACTIVE_APPLY_EVIDENCE must be set to true before active apply evidence can run.',
    );
    expect(
      getLocalServerModePreconditionError('webbridge-active-apply', {
        ALIFE_ACTIVE_APPLY_EVIDENCE: 'true',
      }),
    ).toBeNull();
  });

  it('rejects direct active WebBridge apply evidence local runs without spawning the server', async () => {
    const previousOptIn = process.env.ALIFE_ACTIVE_APPLY_EVIDENCE;

    delete process.env.ALIFE_ACTIVE_APPLY_EVIDENCE;

    try {
      const config = createLocalServerRunConfig('webbridge-active-apply');

      await expect(runWithLocalServer(config)).rejects.toThrow(
        'ALIFE_ACTIVE_APPLY_EVIDENCE must be set to true before active apply evidence can run.',
      );
      expect(spawnMock).not.toHaveBeenCalled();
    } finally {
      if (previousOptIn === undefined) {
        delete process.env.ALIFE_ACTIVE_APPLY_EVIDENCE;
      } else {
        process.env.ALIFE_ACTIVE_APPLY_EVIDENCE = previousOptIn;
      }
    }
  });

  it('supports opt-in live desktop manual confirmation checks against the local standalone server', () => {
    const config = createLocalServerRunConfig('webbridge-live-desktop-confirmation');

    expect(config.test.command).toContain('tsx');
    expect(config.test.args).toEqual(['scripts/check-webbridge-live-desktop-confirmation.ts']);
  });

  it('requires live desktop confirmation opt-in before starting the local server', () => {
    expect(getLocalServerModePreconditionError('webbridge-live-desktop-confirmation', {})).toBe(
      'ALIFE_LIVE_DESKTOP_CONFIRMATION must be set to true before live desktop confirmation evidence can run.',
    );
    expect(
      getLocalServerModePreconditionError('webbridge-live-desktop-confirmation', {
        ALIFE_LIVE_DESKTOP_CONFIRMATION: 'true',
      }),
    ).toBeNull();
  });

  it('rejects direct live desktop confirmation local runs without spawning the server', async () => {
    const previousOptIn = process.env.ALIFE_LIVE_DESKTOP_CONFIRMATION;

    delete process.env.ALIFE_LIVE_DESKTOP_CONFIRMATION;

    try {
      const config = createLocalServerRunConfig('webbridge-live-desktop-confirmation');

      await expect(runWithLocalServer(config)).rejects.toThrow(
        'ALIFE_LIVE_DESKTOP_CONFIRMATION must be set to true before live desktop confirmation evidence can run.',
      );
      expect(spawnMock).not.toHaveBeenCalled();
    } finally {
      if (previousOptIn === undefined) {
        delete process.env.ALIFE_LIVE_DESKTOP_CONFIRMATION;
      } else {
        process.env.ALIFE_LIVE_DESKTOP_CONFIRMATION = previousOptIn;
      }
    }
  });

  it('preserves normal local server behavior for other modes', async () => {
    const server = new EventEmitter() as EventEmitter & {
      exitCode: number | null;
      kill: jest.Mock;
    };
    server.exitCode = null;
    server.kill = jest.fn(() => {
      server.exitCode = 0;
      server.emit('exit', 0);
      return true;
    });
    const test = new EventEmitter() as EventEmitter & { exitCode: number | null };
    test.exitCode = null;

    spawnMock
      .mockReturnValueOnce(server)
      .mockImplementationOnce(() => {
        queueMicrotask(() => test.emit('exit', 0));
        return test;
      });

    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
    } as Response);

    try {
      await expect(runWithLocalServer(createLocalServerRunConfig('integration'))).resolves.toBe(0);
      expect(spawnMock).toHaveBeenCalledTimes(2);
    } finally {
      fetchMock.mockRestore();
    }
  });
});
