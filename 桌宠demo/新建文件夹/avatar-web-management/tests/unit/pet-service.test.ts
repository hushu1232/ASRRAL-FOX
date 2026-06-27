import { petService } from '@/lib/services/petService';

// ── Mocks ──────────────────────────────────────────────────
const mockPrismaClient = {
  petConfig: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  petAssetMapping: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  petSessionLog: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  asset: { findUnique: jest.fn(), findMany: jest.fn() },
  avatar: { findFirst: jest.fn() },
  avatarVersion: { findFirst: jest.fn() },
  notification: { create: jest.fn() },
};

jest.mock('@/lib/db', () => ({
  getPrisma: jest.fn(() => mockPrismaClient),
  toSnakeCase: jest.fn((row: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      out[k.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`)] = v;
    }
    return out;
  }),
}));

jest.mock('@/lib/pet-encryption', () => ({
  encryptSecret: jest.fn((s: string) => `enc:${s}`),
  decryptSecret: jest.fn((s: string) => s.startsWith('enc:') ? s.slice(4) : s),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

jest.mock('uuid', () => ({ v4: () => 'mock-uuid-123' }));

const userId = 'user-1';
const workspaceId = 'ws-1';
const configId = 'config-1';

function makeRawConfig(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: configId, userId, workspaceId,
    petName: '星尘', personality: '温柔', backstory: '来自异世界',
    animationModel: 'live2d', avatarId: null,
    ffmpegPath: null, idleTimeout: 300, wanderInterval: 15.0,
    createdAt: new Date('2026-05-26'), updatedAt: new Date('2026-05-26'),
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────
describe('petService', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  // ═══ getConfig ════════════════════════════════════════════
  describe('getConfig', () => {
    it('returns null when no config exists', async () => {
      mockPrismaClient.petConfig.findUnique.mockResolvedValue(null);
      const result = await petService.getConfig(userId, workspaceId);
      expect(result).toBeNull();
      expect(mockPrismaClient.petConfig.findUnique).toHaveBeenCalledWith({ where: { userId } });
    });

    it('returns config without API keys', async () => {
      mockPrismaClient.petConfig.findUnique.mockResolvedValue(makeRawConfig());
      const result = await petService.getConfig(userId, workspaceId);
      expect(result).not.toBeNull();
    });
  });

  // ═══ getOrCreateConfig ════════════════════════════════════
  describe('getOrCreateConfig', () => {
    it('returns existing config if present', async () => {
      mockPrismaClient.petConfig.findUnique.mockResolvedValue(makeRawConfig());
      const result = await petService.getOrCreateConfig(userId, workspaceId);
      expect(mockPrismaClient.petConfig.create).not.toHaveBeenCalled();
      expect(result).not.toBeNull();
    });

    it('creates default config if none exists', async () => {
      mockPrismaClient.petConfig.findUnique
        .mockResolvedValueOnce(null)  // first call in getConfig
        .mockResolvedValueOnce(null); // second call in getConfig (double call)
      mockPrismaClient.petConfig.create.mockResolvedValue(makeRawConfig({ petName: '星尘' }));
      mockPrismaClient.petConfig.findUnique.mockResolvedValueOnce(makeRawConfig());

      // Pass null on first call, then return created on second
      mockPrismaClient.petConfig.findUnique
        .mockReset()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeRawConfig({ petName: '星尘' }));

      const result = await petService.getOrCreateConfig(userId, workspaceId);
      expect(mockPrismaClient.petConfig.create).toHaveBeenCalled();
      expect(result).not.toBeNull();
    });
  });

  // ═══ updateConfig ════════════════════════════════════════
  describe('updateConfig', () => {
    it('updates allowed fields', async () => {
      mockPrismaClient.petConfig.findUnique.mockResolvedValue(makeRawConfig());
      mockPrismaClient.petConfig.update.mockResolvedValue(makeRawConfig({ petName: '新星尘', personality: '活泼' }));

      const result = await petService.updateConfig(userId, workspaceId, {
        petName: '新星尘', personality: '活泼',
      });

      expect(mockPrismaClient.petConfig.update).toHaveBeenCalled();
      const updateData = mockPrismaClient.petConfig.update.mock.calls[0][0]?.data;
      expect(updateData.petName).toBe('新星尘');
      expect(updateData.personality).toBe('活泼');
      expect(updateData.updatedAt).toBeInstanceOf(Date);
    });

    it('throws NotFoundError when config does not exist', async () => {
      mockPrismaClient.petConfig.findUnique.mockResolvedValue(null);
      await expect(
        petService.updateConfig('nonexistent', workspaceId, { petName: 'test' })
      ).rejects.toThrow('PetConfig not found');
    });

    it('validates animationModel enum', async () => {
      mockPrismaClient.petConfig.findUnique.mockResolvedValue(makeRawConfig());
      mockPrismaClient.petConfig.update.mockResolvedValue(
        makeRawConfig({ animationModel: 'dragonbones' })
      );

      await petService.updateConfig(userId, workspaceId, {
        animationModel: 'dragonbones' as const,
      });

      const updateData = mockPrismaClient.petConfig.update.mock.calls[0][0]?.data;
      expect(updateData.animationModel).toBe('dragonbones');
    });

    it('persists desktop integration config fields accepted by the API route', async () => {
      mockPrismaClient.petConfig.findUnique.mockResolvedValue(makeRawConfig());
      mockPrismaClient.petConfig.update.mockResolvedValue(makeRawConfig({
        ttsLocalUrl: 'http://127.0.0.1:9881',
        sttLocalUrl: 'http://127.0.0.1:9000',
        llmModelPath: 'models/qwen2.5.gguf',
        sovitsUrl: 'http://127.0.0.1:9880',
        sovitsReferenceVoiceId: 'voice-1',
        enableWakeWord: false,
        wakeWord: 'astral',
        wakeSensitivity: 0.7,
        autoStartServices: false,
        pipelineTimeout: 45,
        modelPath: '/models/default.model3.json',
      }));

      await petService.updateConfig(userId, workspaceId, {
        ttsLocalUrl: 'http://127.0.0.1:9881',
        sttLocalUrl: 'http://127.0.0.1:9000',
        llmModelPath: 'models/qwen2.5.gguf',
        sovitsUrl: 'http://127.0.0.1:9880',
        sovitsReferenceVoiceId: 'voice-1',
        enableWakeWord: false,
        wakeWord: 'astral',
        wakeSensitivity: 0.7,
        autoStartServices: false,
        pipelineTimeout: 45,
        modelPath: '/models/default.model3.json',
      });

      const updateData = mockPrismaClient.petConfig.update.mock.calls[0][0].data;
      expect(updateData).toEqual(expect.objectContaining({
        ttsLocalUrl: 'http://127.0.0.1:9881',
        sttLocalUrl: 'http://127.0.0.1:9000',
        llmModelPath: 'models/qwen2.5.gguf',
        sovitsUrl: 'http://127.0.0.1:9880',
        sovitsReferenceVoiceId: 'voice-1',
        enableWakeWord: false,
        wakeWord: 'astral',
        wakeSensitivity: 0.7,
        autoStartServices: false,
        pipelineTimeout: 45,
        modelPath: '/models/default.model3.json',
      }));
      expect(updateData.updatedAt).toBeInstanceOf(Date);
    });
  });

  // ═══ setAvatarAsPet ═══════════════════════════════════════
  describe('setAvatarAsPet', () => {
    it('links an existing avatar to pet config', async () => {
      mockPrismaClient.avatar.findFirst.mockResolvedValue({ id: 'avatar-1', name: '测试形象' });
      mockPrismaClient.petConfig.findUnique
        .mockResolvedValueOnce(makeRawConfig())
        .mockResolvedValueOnce(makeRawConfig({ avatarId: 'avatar-1', petName: '测试形象' }));

      await petService.setAvatarAsPet(userId, workspaceId, 'avatar-1');

      expect(mockPrismaClient.petConfig.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
          data: expect.objectContaining({ avatarId: 'avatar-1', petName: '测试形象' }),
        })
      );
    });

    it('creates pet config if none exists when linking', async () => {
      mockPrismaClient.avatar.findFirst.mockResolvedValue({ id: 'avatar-1', name: '测试形象' });
      mockPrismaClient.petConfig.findUnique.mockResolvedValue(null);
      mockPrismaClient.petConfig.create.mockResolvedValue(
        makeRawConfig({ avatarId: 'avatar-1', petName: '测试形象' })
      );

      await petService.setAvatarAsPet(userId, workspaceId, 'avatar-1');

      expect(mockPrismaClient.petConfig.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            avatarId: 'avatar-1', petName: '测试形象',
          }),
        })
      );
    });

    it('throws NotFoundError when avatar does not exist', async () => {
      mockPrismaClient.avatar.findFirst.mockResolvedValue(null);
      await expect(
        petService.setAvatarAsPet(userId, workspaceId, 'nonexistent')
      ).rejects.toThrow('Avatar not found');
    });
  });

  // ═══ Asset Mapping ═══════════════════════════════════════
  describe('asset mappings', () => {
    it('getAssetMappings returns mapped assets', async () => {
      mockPrismaClient.petAssetMapping.findMany.mockResolvedValue([
        { id: 'm1', petConfigId: configId, assetId: 'asset-1', assetType: 'model', slotName: 'idle_animation', createdAt: new Date() },
      ]);

      const mappings = await petService.getAssetMappings(configId);
      expect(mappings).toHaveLength(1);
      expect(mappings[0].slot_name).toBe('idle_animation');
      expect(mappings[0].asset_type).toBe('model');
    });

    it('addAssetMapping upserts by slotName', async () => {
      mockPrismaClient.asset.findUnique.mockResolvedValue({ id: 'asset-1', status: 'ready' });
      mockPrismaClient.petAssetMapping.findFirst.mockResolvedValue(null);
      mockPrismaClient.petAssetMapping.create.mockResolvedValue({
        id: 'm1', petConfigId: configId, assetId: 'asset-1', assetType: 'animation', slotName: 'walk_animation', createdAt: new Date(),
      });
      mockPrismaClient.petAssetMapping.findMany.mockResolvedValue([
        { id: 'm1', petConfigId: configId, assetId: 'asset-1', assetType: 'animation', slotName: 'walk_animation', createdAt: new Date() },
      ]);

      const result = await petService.addAssetMapping(configId, {
        assetId: 'asset-1', assetType: 'animation', slotName: 'walk_animation',
      });

      expect(mockPrismaClient.petAssetMapping.create).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('addAssetMapping updates existing slot', async () => {
      mockPrismaClient.asset.findUnique.mockResolvedValue({ id: 'asset-2' });
      mockPrismaClient.petAssetMapping.findFirst.mockResolvedValue({
        id: 'm1', petConfigId: configId, assetId: 'asset-1', assetType: 'model', slotName: 'default',
      });
      mockPrismaClient.petAssetMapping.update.mockResolvedValue({
        id: 'm1', petConfigId: configId, assetId: 'asset-2', assetType: 'model', slotName: 'default',
      });
      mockPrismaClient.petAssetMapping.findMany.mockResolvedValue([]);

      await petService.addAssetMapping(configId, {
        assetId: 'asset-2', assetType: 'model', slotName: 'default',
      });

      expect(mockPrismaClient.petAssetMapping.update).toHaveBeenCalled();
    });

    it('removeAssetMapping deletes by slotName', async () => {
      mockPrismaClient.petAssetMapping.deleteMany.mockResolvedValue({ count: 1 });
      await petService.removeAssetMapping(configId, 'idle_animation');
      expect(mockPrismaClient.petAssetMapping.deleteMany).toHaveBeenCalledWith({
        where: { petConfigId: configId, slotName: 'idle_animation' },
      });
    });
  });

  // ═══ Session Logging ══════════════════════════════════════
  describe('sessions', () => {
    it('startSession creates a session log', async () => {
      mockPrismaClient.petSessionLog.create.mockResolvedValue({ id: 'session-1' });
      const result = await petService.startSession(userId, configId);
      expect(result.sessionId).toBe('mock-uuid-123');
      expect(mockPrismaClient.petSessionLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId, petConfigId: configId, interactionCount: 0,
          }),
        })
      );
    });

    it('updateSession updates interaction count', async () => {
      mockPrismaClient.petSessionLog.findUnique.mockResolvedValue({ id: 'session-1' });
      await petService.updateSession('session-1', { interactionCount: 42 });
      expect(mockPrismaClient.petSessionLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1' },
          data: { interactionCount: 42 },
        })
      );
    });

    it('getUserSessions returns paginated results', async () => {
      mockPrismaClient.petSessionLog.findMany.mockResolvedValue([
        { id: 's1', userId, petConfigId: configId, startTime: new Date(), interactionCount: 5 },
      ]);
      mockPrismaClient.petSessionLog.count.mockResolvedValue(1);

      const result = await petService.getUserSessions(userId, { page: 1, pageSize: 20 });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });
  });

  // ═══ findConfigsByAsset ═══════════════════════════════════
  describe('findConfigsByAsset', () => {
    it('returns pet configs referencing given asset', async () => {
      mockPrismaClient.petAssetMapping.findMany.mockResolvedValue([
        {
          slotName: 'idle_animation',
          petConfig: { userId: 'user-1', petName: '星尘' },
        },
        {
          slotName: 'walk_animation',
          petConfig: { userId: 'user-2', petName: '小狐狸' },
        },
      ]);

      const configs = await petService.findConfigsByAsset('asset-1');
      expect(configs).toHaveLength(2);
      expect(configs[0].userId).toBe('user-1');
      expect(configs[1].petName).toBe('小狐狸');
    });

    it('returns empty array when no pets use the asset', async () => {
      mockPrismaClient.petAssetMapping.findMany.mockResolvedValue([]);
      const configs = await petService.findConfigsByAsset('orphan-asset');
      expect(configs).toEqual([]);
    });
  });

  // ═══ Export ═══════════════════════════════════════════════
  describe('exportConfig', () => {
    it('throws NotFoundError when no config exists', async () => {
      mockPrismaClient.petConfig.findUnique.mockResolvedValue(null);
      await expect(petService.exportConfig(userId, workspaceId)).rejects.toThrow('PetConfig not found');
    });

    it('exports full config with decrypted keys', async () => {
      const updatedAt = new Date('2026-06-27T10:00:00.000Z');
      mockPrismaClient.petConfig.findUnique.mockResolvedValue(makeRawConfig({ updatedAt }));
      mockPrismaClient.petAssetMapping.findMany.mockResolvedValue([
        { slotName: 'idle_animation', assetId: 'asset-1', assetType: 'animation' },
      ]);

      const result = await petService.exportConfig(userId, workspaceId);

      expect(result.version).toBe(updatedAt.getTime());
      expect(result.petName).toBe('星尘');
      expect(result.animationModel).toBe('live2d');
      expect(result.idleTimeout).toBe(300);
      expect(result.wanderInterval).toBe(15.0);
      expect(result.mappedAssets).toHaveLength(1);
      expect(Array.isArray(result.params)).toBe(true);
      expect(Array.isArray(result.bodyParams)).toBe(true);
    });

    it('includes avatar params when avatarId is set', async () => {
      mockPrismaClient.petConfig.findUnique.mockResolvedValue(
        makeRawConfig({ avatarId: 'avatar-1' })
      );
      mockPrismaClient.avatar.findFirst.mockResolvedValue({ id: 'avatar-1', name: '测试' });
      mockPrismaClient.avatarVersion.findFirst.mockResolvedValue({
        blendshapeSnapshot: '{"MouthOpen":0.5,"EyeOpen":1.0}',
        bodyParams: '{"Height":0.3}',
        equippedParts: '[{"slot":"Head","part_id":"hair_01"}]',
        materialOverrides: '{"albedo":"#ffffff"}',
        modelPath: '/models/cattail.model3.json',
      });
      mockPrismaClient.petAssetMapping.findMany.mockResolvedValue([]);

      const result = await petService.exportConfig(userId, workspaceId);

      expect(result.params).toEqual([{ key: 'MouthOpen', value: 0.5 }, { key: 'EyeOpen', value: 1.0 }]);
      expect(result.bodyParams).toEqual([{ key: 'Height', value: 0.3 }]);
      expect(result.equippedParts).toEqual([{ slot: 'Head', part_id: 'hair_01' }]);
      expect(result.modelPath).toBe('/models/cattail.model3.json');
    });
  });
});
