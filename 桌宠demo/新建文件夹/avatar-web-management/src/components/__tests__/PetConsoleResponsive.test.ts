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

    expect(source).toContain('flex flex-wrap items-center gap-2 w-full sm:w-auto');
  });

  it('keeps WebBridge scenario switching inside the card width on narrow screens', () => {
    const source = readSource('src/components/pet/sync/WebBridgeMockStatusPanel.tsx');

    expect(source).toContain("overflowX: 'auto'");
    expect(source).toContain("maxWidth: '100%'");
    expect(source).toContain("minWidth: 'max-content'");
  });
});
