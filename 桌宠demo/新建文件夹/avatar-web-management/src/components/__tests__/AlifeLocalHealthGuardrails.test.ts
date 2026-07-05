import fs from 'node:fs';
import path from 'node:path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Alife local health source guardrails', () => {
  it('keeps the authenticated node route wired to the server-side adapter', () => {
    const route = readSource('src/app/api/pet/alife/local-health/route.ts');

    expect(route).toContain("export const runtime = 'nodejs'");
    expect(route).toContain('withAuth');
    expect(route).toContain('getAlifeLocalHealth');
    expect(route).toContain('export const GET = withAuth');
  });

  it('keeps local health configuration and loopback validation server-side', () => {
    const adapter = readSource('src/lib/alife/local-health.ts');

    expect(adapter).toContain('FOXD_ALIFE_LOCAL_HEALTH_ENABLED');
    expect(adapter).toContain('FOXD_ALIFE_LOCAL_HEALTH_TOKEN');
    expect(adapter).toContain('isLoopbackBaseUrl');
  });

  it('wires the dashboard to the sanitized authenticated local-health API and panel', () => {
    const page = readSource('src/app/(auth)/dashboard/pet/page.tsx');

    expect(page).toContain("apiGet<AlifeLocalHealthView>('/api/pet/alife/local-health')");
    expect(page).toContain('<AlifeLocalHealthPanel');
  });

  it('does not expose local endpoint or token details in dashboard browser code', () => {
    const page = readSource('src/app/(auth)/dashboard/pet/page.tsx');
    const panel = readSource('src/components/pet/sync/AlifeLocalHealthPanel.tsx');

    for (const source of [page, panel]) {
      expect(source).not.toContain('127.0.0.1:8787');
      expect(source).not.toContain('FOXD_ALIFE_LOCAL_HEALTH_TOKEN');
    }

    expect(panel).not.toContain('ALIFE_WEB_MANAGEMENT_TOKEN');
  });

  it('does not add browser management actions or shell execution terms to the panel', () => {
    const panel = readSource('src/components/pet/sync/AlifeLocalHealthPanel.tsx');
    const forbiddenTerms = [
      'Start Alife',
      'Stop Alife',
      'Restart Alife',
      'PowerShell',
      'child_process',
      'exec(',
      'spawn(',
    ];

    for (const term of forbiddenTerms) {
      expect(panel).not.toContain(term);
    }
  });

  it('defines required locale keys for every supported locale', () => {
    const localePaths = ['messages/en.json', 'messages/zh-CN.json', 'messages/ja.json'];

    for (const localePath of localePaths) {
      const source = readSource(localePath);

      expect(source).toContain('"alifeLocalHealth"');
      expect(source).toContain('"notConfigured"');
      expect(source).toContain('"reachable"');
      expect(source).toContain('"unreachable"');
      expect(source).toContain('"authRequired"');
      expect(source).toContain('"invalidResponse"');
    }
  });
});
