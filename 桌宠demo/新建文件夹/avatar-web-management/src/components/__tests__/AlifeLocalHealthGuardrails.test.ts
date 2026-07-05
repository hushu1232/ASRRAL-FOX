import fs from 'node:fs';
import path from 'node:path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function readJson(relativePath: string): unknown {
  return JSON.parse(readSource(relativePath));
}

function expectNonEmptyString(value: unknown): asserts value is string {
  expect(typeof value).toBe('string');
  expect((value as string).length).toBeGreaterThan(0);
}

const localBaseUrl = ['127.0.0.1', '8787'].join(':');
const foxdLocalHealthTokenEnv = ['FOXD_ALIFE_LOCAL_HEALTH', 'TOKEN'].join('_');
const alifeManagementTokenEnv = ['ALIFE_WEB_MANAGEMENT', 'TOKEN'].join('_');

describe('Alife local health source guardrails', () => {
  it('keeps the authenticated node route wired to the server-side adapter', () => {
    const route = readSource('src/app/api/pet/alife/local-health/route.ts');

    expect(route).toContain("export const runtime = 'nodejs'");
    expect(route).toContain('withAuth');
    expect(route).toContain('getAlifeLocalHealth');
    expect(route).toContain('const getLocalHealth = withAuth');
    expect(route).toContain('export async function GET');
    expect(route).toContain("response.headers.set('Cache-Control', NO_STORE)");
  });

  it('keeps local health configuration and loopback validation server-side', () => {
    const adapter = readSource('src/lib/alife/local-health.ts');

    expect(adapter).toContain('FOXD_ALIFE_LOCAL_HEALTH_ENABLED');
    expect(adapter).toContain(foxdLocalHealthTokenEnv);
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
      expect(source).not.toContain(localBaseUrl);
      expect(source).not.toContain(foxdLocalHealthTokenEnv);
    }

    expect(panel).not.toContain(alifeManagementTokenEnv);
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
    const requiredStates = [
      'notConfigured',
      'reachable',
      'unreachable',
      'authRequired',
      'invalidResponse',
      'error',
    ];

    for (const localePath of localePaths) {
      const locale = readJson(localePath) as {
        pet?: {
          alifeLocalHealth?: {
            state?: Record<string, unknown>;
            description?: Record<string, unknown>;
          } & Record<string, unknown>;
        };
      };
      const alifeLocalHealth = locale.pet?.alifeLocalHealth;

      expect(alifeLocalHealth).toEqual(expect.any(Object));
      for (const key of [
        'title',
        'source',
        'loading',
        'advisory',
        'refresh',
        'notReported',
        'agent',
        'version',
        'qchat',
        'vision',
        'tts',
        'outbox',
        'lastChecked',
        'enabled',
        'disabled',
        'ready',
        'notReady',
        'reason',
      ]) {
        expectNonEmptyString(alifeLocalHealth?.[key]);
      }

      for (const state of requiredStates) {
        expectNonEmptyString(alifeLocalHealth?.state?.[state]);
        expectNonEmptyString(alifeLocalHealth?.description?.[state]);
      }
    }
  });
});
