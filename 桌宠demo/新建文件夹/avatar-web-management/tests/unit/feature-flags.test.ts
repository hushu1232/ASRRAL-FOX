import { isBuildFlagEnabled, getAllBuildFlags } from '@/lib/feature-flags';

describe('feature-flags', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    // Restore env after each test since the module caches values
    process.env = { ...envBackup };
    jest.resetModules();
  });

  describe('getAllBuildFlags', () => {
    it('returns all three flags as booleans', async () => {
      // Force-reload module to pick up current env
      const mod = await import('@/lib/feature-flags');
      const flags = mod.getAllBuildFlags();
      expect(typeof flags.newEditorUI).toBe('boolean');
      expect(typeof flags.aiBlendShape).toBe('boolean');
      expect(typeof flags.exportVRM).toBe('boolean');
    });
  });

  describe('isBuildFlagEnabled', () => {
    it('returns true when flag is enabled', async () => {
      process.env.FF_NEW_EDITOR_UI = 'true';
      const mod = await import('@/lib/feature-flags');
      expect(mod.isBuildFlagEnabled('newEditorUI')).toBe(true);
    });

    it('returns false when flag is disabled', async () => {
      process.env.FF_AI_BLENDSHAPE = 'false';
      const mod = await import('@/lib/feature-flags');
      expect(mod.isBuildFlagEnabled('aiBlendShape')).toBe(false);
    });
  });

  describe('exportVRM default', () => {
    it('defaults to true when env var is unset', async () => {
      delete process.env.FF_EXPORT_VRM;
      const mod = await import('@/lib/feature-flags');
      const flags = mod.getAllBuildFlags();
      expect(flags.exportVRM).toBe(true);
    });

    it('is false when explicitly set to false', async () => {
      process.env.FF_EXPORT_VRM = 'false';
      const mod = await import('@/lib/feature-flags');
      expect(mod.isBuildFlagEnabled('exportVRM')).toBe(false);
    });
  });
});
