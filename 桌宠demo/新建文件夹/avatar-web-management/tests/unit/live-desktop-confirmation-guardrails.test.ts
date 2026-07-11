import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const appRoot = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(join(appRoot, relativePath), 'utf8');
}

function listSourceFiles(relativeRoot: string): string[] {
  const root = join(appRoot, relativeRoot);
  const results: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const fullPath = join(directory, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (entry === '__tests__' || entry === 'node_modules') {
          continue;
        }
        visit(fullPath);
        continue;
      }
      if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(entry)) {
        continue;
      }
      if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
        results.push(fullPath);
      }
    }
  };
  visit(root);
  return results;
}

describe('live desktop confirmation guardrails', () => {
  it('does not expose a Web route that applies or confirms local packages', () => {
    const apiRoot = join(appRoot, 'src', 'app', 'api');
    const files = listSourceFiles('src/app/api');
    const forbiddenRoute = files.find((file) =>
      /[\\\/](apply|confirm)[\\\/]route\.(ts|js)$/.test(file.slice(apiRoot.length)),
    );

    expect(forbiddenRoute).toBeUndefined();
  });

  it('does not add browser-side child_process usage or direct Alife loopback calls', () => {
    const files = [
      ...listSourceFiles('src/app'),
      ...listSourceFiles('src/components'),
    ];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('child_process');
      expect(source).not.toContain('127.0.0.1:8787');
      expect(source).not.toContain('localhost:8787');
      expect(source).not.toContain('/api/alife/health');
      expect(source).not.toContain('/api/alife/status');
    }
  });

  it('keeps live desktop runner separate from active-service apply evidence', () => {
    const runner = readSource('scripts/check-webbridge-live-desktop-confirmation.ts');

    expect(runner).not.toContain('check-webbridge-active-apply');
    expect(runner).not.toContain('webbridge-active-apply-evidence');
    expect(runner).not.toContain('ApplyPackage');
    expect(runner).not.toContain('LocalApiApplyEndpointUsed: true');
    expect(runner).toContain('LocalApiApplyEndpointUsed: false');
  });

  it('does not create a live desktop C# helper that could call ApplyPackage', () => {
    expect(existsSync(join(appRoot, '..', '..', '..', 'tools', 'webbridge-live-desktop-confirmation'))).toBe(false);
  });
});
