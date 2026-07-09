import { EventEmitter } from 'node:events';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import {
  createWebBridgeActiveApplyEvidenceConfig,
  runWebBridgeActiveApplyEvidence,
  validateActiveApplyEvidenceConfig,
} from '../../scripts/check-webbridge-active-apply';

jest.mock('node:child_process', () => ({
  spawn: jest.fn(),
}));

const spawnMock = jest.mocked(spawn);

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return !!value && typeof value === 'object' && 'then' in value && typeof value.then === 'function';
}

function withTempRepo<T>(callback: (repoRoot: string) => T): T {
  const repoRoot = mkdtempSync(join(tmpdir(), 'foxd-active-apply-config-'));
  mkdirSync(join(repoRoot, '.git'));
  mkdirSync(join(repoRoot, 'tools', 'webbridge-active-apply-evidence'), { recursive: true });

  try {
    const result = callback(repoRoot);
    if (isPromiseLike(result)) {
      return result.finally(() => {
        rmSync(repoRoot, { recursive: true, force: true });
      }) as T;
    }

    rmSync(repoRoot, { recursive: true, force: true });
    return result;
  } catch (error) {
    rmSync(repoRoot, { recursive: true, force: true });
    throw error;
  }
}

function createProject(repoRoot: string): void {
  writeFileSync(
    join(repoRoot, 'tools', 'webbridge-active-apply-evidence', 'AlifeWebBridgeActiveApplyEvidence.csproj'),
    '<Project />',
  );
}

function createSuccessfulSpawn(): EventEmitter {
  const child = new EventEmitter();
  setImmediate(() => child.emit('exit', 0, null));
  return child;
}

beforeEach(() => {
  spawnMock.mockReset();
  spawnMock.mockImplementation(() => createSuccessfulSpawn() as ReturnType<typeof spawn>);
});

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

  it('requires an explicit dotnet executable instead of falling back to a local default', () => {
    withTempRepo((repoRoot) => {
      writeFileSync(
        join(repoRoot, 'tools', 'webbridge-active-apply-evidence', 'AlifeWebBridgeActiveApplyEvidence.csproj'),
        '<Project />',
      );

      const config = createWebBridgeActiveApplyEvidenceConfig(
        {
          ALIFE_ACTIVE_APPLY_EVIDENCE: 'true',
          ALIFE_ROOT: repoRoot,
          WEBBRIDGE_PACKAGE_ROOT: 'D:\\tmp\\foxd-active-apply-evidence',
        },
        repoRoot,
      );

      expect(() => validateActiveApplyEvidenceConfig(config)).toThrow(
        'DOTNET_EXE is required for active apply evidence.',
      );
    });
  });

  it('requires an explicit Alife root instead of falling back to a local default', () => {
    withTempRepo((repoRoot) => {
      writeFileSync(
        join(repoRoot, 'tools', 'webbridge-active-apply-evidence', 'AlifeWebBridgeActiveApplyEvidence.csproj'),
        '<Project />',
      );

      const config = createWebBridgeActiveApplyEvidenceConfig(
        {
          ALIFE_ACTIVE_APPLY_EVIDENCE: 'true',
          DOTNET_EXE: 'dotnet-test',
          WEBBRIDGE_PACKAGE_ROOT: 'D:\\tmp\\foxd-active-apply-evidence',
        },
        repoRoot,
      );

      expect(() => validateActiveApplyEvidenceConfig(config)).toThrow(
        'ALIFE_ROOT is required for active apply evidence.',
      );
    });
  });

  it('resolves a relative Alife root before validation and execution', () => {
    withTempRepo((repoRoot) => {
      createProject(repoRoot);
      mkdirSync(join(repoRoot, 'relative-alife'));

      const config = createWebBridgeActiveApplyEvidenceConfig(
        {
          ALIFE_ACTIVE_APPLY_EVIDENCE: 'true',
          DOTNET_EXE: 'dotnet-test',
          ALIFE_ROOT: 'relative-alife',
          WEBBRIDGE_PACKAGE_ROOT: 'D:\\tmp\\foxd-active-apply-evidence',
        },
        repoRoot,
      );

      expect(config.alifeRoot).toBe(join(repoRoot, 'relative-alife'));
      expect(validateActiveApplyEvidenceConfig(config).alifeRoot).toBe(join(repoRoot, 'relative-alife'));
    });
  });

  it('reports a missing resolved Alife root path', () => {
    withTempRepo((repoRoot) => {
      createProject(repoRoot);
      const config = createWebBridgeActiveApplyEvidenceConfig(
        {
          ALIFE_ACTIVE_APPLY_EVIDENCE: 'true',
          DOTNET_EXE: 'dotnet-test',
          ALIFE_ROOT: 'missing-alife',
          WEBBRIDGE_PACKAGE_ROOT: 'D:\\tmp\\foxd-active-apply-evidence',
        },
        repoRoot,
      );

      expect(() => validateActiveApplyEvidenceConfig(config)).toThrow(
        `Alife root not found: ${join(repoRoot, 'missing-alife')}`,
      );
    });
  });
});

describe('check-webbridge-active-apply runner orchestration', () => {
  it('fails before spawning when the active apply evidence project is missing', async () => {
    await withTempRepo(async (repoRoot) => {
      const config = createWebBridgeActiveApplyEvidenceConfig(
        {
          ALIFE_ACTIVE_APPLY_EVIDENCE: 'true',
          DOTNET_EXE: 'dotnet-test',
          ALIFE_ROOT: repoRoot,
          WEBBRIDGE_PACKAGE_ROOT: 'D:\\tmp\\foxd-active-apply-evidence',
        },
        repoRoot,
      );

      await expect(runWebBridgeActiveApplyEvidence(config)).rejects.toThrow(
        `Active apply evidence project not found: ${join(
          repoRoot,
          'tools',
          'webbridge-active-apply-evidence',
          'AlifeWebBridgeActiveApplyEvidence.csproj',
        )}`,
      );
      expect(spawnMock).not.toHaveBeenCalled();
    });
  });

  it('fails before spawning when the resolved Alife root is missing', async () => {
    await withTempRepo(async (repoRoot) => {
      createProject(repoRoot);
      const config = createWebBridgeActiveApplyEvidenceConfig(
        {
          ALIFE_ACTIVE_APPLY_EVIDENCE: 'true',
          DOTNET_EXE: 'dotnet-test',
          ALIFE_ROOT: 'missing-alife',
          WEBBRIDGE_PACKAGE_ROOT: 'D:\\tmp\\foxd-active-apply-evidence',
        },
        repoRoot,
      );

      await expect(runWebBridgeActiveApplyEvidence(config)).rejects.toThrow(
        `Alife root not found: ${join(repoRoot, 'missing-alife')}`,
      );
      expect(spawnMock).not.toHaveBeenCalled();
    });
  });

  it('creates the package root directory before running dotnet', async () => {
    await withTempRepo(async (repoRoot) => {
      createProject(repoRoot);
      const packageRoot = resolve(repoRoot, 'relative-package-root');
      const config = createWebBridgeActiveApplyEvidenceConfig(
        {
          ALIFE_ACTIVE_APPLY_EVIDENCE: 'true',
          DOTNET_EXE: 'dotnet-test',
          ALIFE_ROOT: repoRoot,
          WEBBRIDGE_PACKAGE_ROOT: 'relative-package-root',
        },
        repoRoot,
      );

      await runWebBridgeActiveApplyEvidence(config, {
        ...process.env,
        WEBBRIDGE_SKIP_DOTNET_RESTORE: '1',
      });

      expect(existsSync(packageRoot)).toBe(true);
    });
  });

  it('skips dotnet restore when WEBBRIDGE_SKIP_DOTNET_RESTORE is set to 1', async () => {
    await withTempRepo(async (repoRoot) => {
      createProject(repoRoot);
      const config = createWebBridgeActiveApplyEvidenceConfig(
        {
          ALIFE_ACTIVE_APPLY_EVIDENCE: 'true',
          DOTNET_EXE: 'dotnet-test',
          ALIFE_ROOT: repoRoot,
          WEBBRIDGE_PACKAGE_ROOT: join(repoRoot, 'package-root'),
        },
        repoRoot,
      );

      await runWebBridgeActiveApplyEvidence(config, {
        ...process.env,
        WEBBRIDGE_SKIP_DOTNET_RESTORE: '1',
      });

      expect(spawnMock).toHaveBeenCalledTimes(1);
      expect(spawnMock.mock.calls[0][1]).toEqual(
        expect.arrayContaining(['run', '--project', config.projectPath]),
      );
    });
  });

  it('passes explicit dotnet, resolved AlifeRoot, base URL, and package root to dotnet run', async () => {
    await withTempRepo(async (repoRoot) => {
      createProject(repoRoot);
      mkdirSync(join(repoRoot, 'relative-alife'));
      const packageRoot = resolve(repoRoot, 'relative-package-root');
      const config = createWebBridgeActiveApplyEvidenceConfig(
        {
          ALIFE_ACTIVE_APPLY_EVIDENCE: 'true',
          DOTNET_EXE: 'dotnet-test',
          ALIFE_ROOT: 'relative-alife',
          WEBBRIDGE_PACKAGE_ROOT: 'relative-package-root',
          WEBBRIDGE_BASE_URL: 'http://localhost:3100/',
        },
        repoRoot,
      );

      await runWebBridgeActiveApplyEvidence(config, {
        ...process.env,
        WEBBRIDGE_SKIP_DOTNET_RESTORE: '1',
      });

      const resolvedAlifeRoot = resolve(repoRoot, 'relative-alife');
      expect(spawnMock).toHaveBeenCalledWith(
        'dotnet-test',
        [
          'run',
          '--project',
          config.projectPath,
          '--no-restore',
          `-p:AlifeRoot=${resolvedAlifeRoot}`,
          '--',
          'http://localhost:3100',
          packageRoot,
          resolvedAlifeRoot,
        ],
        expect.objectContaining({
          cwd: repoRoot,
          env: expect.objectContaining({
            WEBBRIDGE_BASE_URL: 'http://localhost:3100',
            WEBBRIDGE_PACKAGE_ROOT: packageRoot,
          }),
        }),
      );
    });
  });
});
