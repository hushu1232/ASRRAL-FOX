import { readFileSync } from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function readMessages(locale: 'en' | 'zh-CN' | 'ja') {
  return JSON.parse(readSource(`messages/${locale}.json`));
}

describe('forms and asset UI guardrails', () => {
  it('uses shared operational surfaces on the asset library page', () => {
    const source = readSource('src/app/(auth)/assets/page.tsx');

    expect(source).toContain("import OperationPanel from '@/components/ui/OperationPanel'");
    expect(source).toContain("import EmptyState from '@/components/ui/EmptyState'");
    expect(source).toContain('data-testid="asset-directory-panel"');
    expect(source).toContain('data-testid="asset-filter-panel"');
    expect(source).toContain('data-testid="asset-empty-panel"');
    expect(source).toContain('data-testid="asset-list-panel"');
    expect(source).toContain('data-testid="asset-grid"');
  });

  it('keeps asset cards responsive and free of broad purple gradient styling', () => {
    const source = readSource('src/app/(auth)/assets/page.tsx');

    expect(source).toContain('repeat(auto-fit, minmax(160px, 1fr))');
    expect(source).toContain("Tooltip title={t('upload.sellOnMarket')}");
    expect(source).not.toContain('!border-purple-500/10');
    expect(source).not.toContain('bg-gradient-to-br');
    expect(source).not.toContain('border-purple-500/20');
  });

  it('normalizes the marketplace listing form shell without a broad submit gradient', () => {
    const source = readSource('src/app/(auth)/marketplace/new/page.tsx');

    expect(source).toContain("import PageHeader from '@/components/layout/PageHeader'");
    expect(source).toContain("import OperationPanel from '@/components/ui/OperationPanel'");
    expect(source).toContain('data-testid="marketplace-listing-form-panel"');
    expect(source).toContain('className="grid grid-cols-1 gap-4 sm:grid-cols-2"');
    expect(source).toContain("placeholder={t('previewImagesPlaceholder')}");
    expect(source).toContain("placeholder={t('filesPlaceholder')}");
    expect(source).not.toContain('bg-gradient-to-r from-purple-600 to-blue-600');
  });

  it('defines localized listing form placeholders in every supported locale', () => {
    for (const locale of ['en', 'zh-CN', 'ja'] as const) {
      const messages = readMessages(locale);

      expect(messages.marketplace.new.previewImagesPlaceholder).toBeTruthy();
      expect(messages.marketplace.new.filesPlaceholder).toBeTruthy();
    }
  });

  it('keeps marketplace listing defaults localized', () => {
    const source = readSource('src/app/(auth)/marketplace/new/page.tsx');

    expect(source).toContain("title: avatarTitle || t('defaultAvatarTitle')");
    expect(source).toContain("title: assetFilename || t('defaultAssetTitle')");
    expect(source).not.toContain("'我的形象'");
    expect(source).not.toContain("'我的资产'");

    for (const locale of ['en', 'zh-CN', 'ja'] as const) {
      const messages = readMessages(locale);

      expect(messages.marketplace.new.defaultAvatarTitle).toBeTruthy();
      expect(messages.marketplace.new.defaultAssetTitle).toBeTruthy();
    }
  });
});
