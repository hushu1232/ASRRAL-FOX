import { readFileSync } from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('pet console responsive guardrails', () => {
  it('removes the desktop sidebar offset from the authenticated shell on mobile', () => {
    const source = readSource('src/components/layout/AppLayout/style.scss');

    expect(source).toContain('@media (max-width: var.$breakpoint-sm)');
    expect(source).toContain('&--sidebar-expanded');
    expect(source).toContain('&--sidebar-collapsed');
    expect(source).toContain('margin-left: 0');
  });

  it('lets page header actions use a full-width wrapping row on mobile', () => {
    const source = readSource('src/components/layout/PageHeader.tsx');

    expect(source).toContain(
      'className="flex min-w-0 flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end"',
    );
  });

  it('keeps the shared page header shell shrink-safe and addressable', () => {
    const source = readSource('src/components/layout/PageHeader.tsx');

    expect(source).toContain('data-testid="page-header-shell"');
    expect(source).toContain('className="mb-6 min-w-0"');
    expect(source).toContain(
      'className="flex min-w-0 flex-wrap items-start justify-between gap-4 mb-2"',
    );
    expect(source).toContain('className="min-w-0 flex-1"');
  });

  it('keeps the authenticated shell content shrink-safe inside the viewport', () => {
    const source = readSource('src/components/layout/AppLayout/style.scss');

    expect(source).toContain('&__main {');
    expect(source).toContain('min-width: 0;');
    expect(source).toContain('&__content {');
  });

  it('uses restrained sidebar active states without broad decorative gradients', () => {
    const source = readSource('src/components/layout/Sidebar/style.scss');

    expect(source).not.toContain('linear-gradient(90deg, var(--accent), var(--info))');
    expect(source).toContain('background: var(--accent);');
    expect(source).toContain('background: var(--bg-card-hover);');
    expect(source).toContain('box-shadow: inset 3px 0 0 var(--accent);');
  });

  it('keeps WebBridge scenario switching inside the card width on narrow screens', () => {
    const source = readSource('src/components/pet/sync/WebBridgeMockStatusPanel.tsx');

    expect(source).toContain("overflowX: 'auto'");
    expect(source).toContain("maxWidth: '100%'");
    expect(source).toContain("minWidth: 'max-content'");
  });

  it('keeps diagnostics children out of a card-like wrapper', () => {
    const source = readSource('src/components/pet/sync/PetDiagnosticsSection.tsx');

    expect(source).toContain('pet-diagnostics-toggle-surface');
    expect(source).not.toContain(
      "background: 'var(--bg-card)',\n        border: '1px solid var(--border-subtle)',\n        borderRadius: 'var(--ds-panel-radius)'",
    );
  });

  it('uses the shared EvidenceGrid for primary runtime and sync evidence', () => {
    const runtimeSummary = readSource('src/components/pet/PetRuntimeSummary.tsx');
    const syncStatusPanel = readSource('src/components/pet/sync/PetSyncStatusPanel.tsx');

    for (const source of [runtimeSummary, syncStatusPanel]) {
      expect(source).toContain("import EvidenceGrid from '@/components/ui/EvidenceGrid'");
      expect(source).not.toContain(
        "gridTemplateColumns: 'repeat(auto-fit, minmax(var(--ds-panel-gridMinWidth), 1fr))'",
      );
    }
  });

  it('uses the shared EvidenceGrid for advisory and diagnostic evidence', () => {
    const alifeHealth = readSource('src/components/pet/sync/AlifeLocalHealthPanel.tsx');
    const liveDiagnostics = readSource('src/components/pet/sync/PetSyncDiagnosticsPanel.tsx');
    const mockDiagnostics = readSource('src/components/pet/sync/WebBridgeMockStatusPanel.tsx');

    for (const source of [alifeHealth, liveDiagnostics, mockDiagnostics]) {
      expect(source).toContain("import EvidenceGrid from '@/components/ui/EvidenceGrid'");
      expect(source).not.toContain(
        "gridTemplateColumns: 'repeat(auto-fit, minmax(var(--ds-panel-gridMinWidth), 1fr))'",
      );
    }
  });
});
