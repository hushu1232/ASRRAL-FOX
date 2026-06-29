import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type PackageJson = {
  scripts: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function readPackageJson(): PackageJson {
  return JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as PackageJson;
}

describe('package test scripts', () => {
  it('does not use start-server-and-test for local server-backed checks', () => {
    const pkg = readPackageJson();

    expect(pkg.scripts['test:integration:local']).toBe('tsx scripts/test-integration-local.ts integration');
    expect(pkg.scripts['test:contracts:live']).toBe('tsx scripts/test-integration-local.ts contracts-live');
    expect(pkg.scripts['test:ci:e2e']).toBe('tsx scripts/test-integration-local.ts e2e');
    expect(pkg.scripts['test:ci:e2e:api']).toBe('tsx scripts/test-integration-local.ts e2e-api');

    expect(pkg.scripts['test:ci:e2e']).not.toContain('start-server-and-test');
    expect(pkg.scripts['test:ci:e2e:api']).not.toContain('start-server-and-test');
    expect(pkg.devDependencies).not.toHaveProperty('start-server-and-test');
  });

  it('keeps offline contracts separate from live response snapshots', () => {
    const pkg = readPackageJson();

    expect(pkg.scripts['test:contracts']).not.toContain('response-snapshots');
    expect(pkg.scripts['test:contracts:live']).toContain('contracts-live');
  });

  it('exposes a focused WebBridge readiness check', () => {
    const pkg = readPackageJson();

    expect(pkg.scripts['check:webbridge']).toBe('tsx scripts/test-integration-local.ts webbridge');
  });

  it('exposes a local Alife .NET staged-to-applied WebBridge smoke check', () => {
    const pkg = readPackageJson();

    expect(pkg.scripts['check:webbridge:smoke']).toBe(
      'tsx scripts/test-integration-local.ts webbridge-smoke',
    );
  });
});
