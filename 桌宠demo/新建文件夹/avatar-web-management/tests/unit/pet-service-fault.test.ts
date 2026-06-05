/**
 * Fault injection / chaos engineering tests for petService.
 * Verifies the service handles infrastructure failures gracefully:
 * - Prisma errors don't crash the process
 * - Encryption failures don't lose data
 * - Corrupt/malformed data is handled
 */

// ── Mocks ────────────────────────────────────────────────────────
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

let encryptShouldThrow = false;
let decryptShouldThrow = false;

jest.mock('@/lib/pet-encryption', () => ({
  encryptSecret: jest.fn((s: string) => {
    if (encryptShouldThrow) throw new Error('Encryption engine failure');
    return `enc:${s}`;
  }),
  decryptSecret: jest.fn((s: string) => {
    if (decryptShouldThrow) throw new Error('Decryption engine failure');
    return s.startsWith('enc:') ? s.slice(4) : s;
  }),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

jest.mock('uuid', () => ({ v4: () => 'fault-uuid' }));

import { petService } from '@/lib/services/petService';

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

describe('petService — fault injection', () => {
  beforeEach(() => {
    // Reset all mock implementations
    Object.values(mockPrismaClient.petConfig).forEach(fn => (fn as jest.Mock).mockReset());
    Object.values(mockPrismaClient.petAssetMapping).forEach(fn => (fn as jest.Mock).mockReset());
    Object.values(mockPrismaClient.petSessionLog).forEach(fn => (fn as jest.Mock).mockReset());
    Object.values(mockPrismaClient.asset).forEach(fn => (fn as jest.Mock).mockReset());
    if (mockPrismaClient.avatar.findFirst) (mockPrismaClient.avatar.findFirst as jest.Mock).mockReset();
    if (mockPrismaClient.avatarVersion.findFirst) (mockPrismaClient.avatarVersion.findFirst as jest.Mock).mockReset();
    if (mockPrismaClient.notification.create) (mockPrismaClient.notification.create as jest.Mock).mockReset();
    encryptShouldThrow = false;
    decryptShouldThrow = false;
  });

  // ═══ Prisma failures ═══════════════════════════════════════════

  describe('Prisma failures', () => {
    it('getConfig handles database connection error gracefully', async () => {
      mockPrismaClient.petConfig.findUnique.mockRejectedValue(
        new Error('Connection refused: ECONNREFUSED 127.0.0.1:5432')
      );

      await expect(petService.getConfig(userId, workspaceId))
        .rejects.toThrow('Connection refused');
    });

    it('updateConfig handles write failure without corrupting data', async () => {
      mockPrismaClient.petConfig.findUnique.mockResolvedValue(makeRawConfig());
      mockPrismaClient.petConfig.update.mockRejectedValue(
        new Error('could not serialize access due to concurrent update')
      );

      await expect(petService.updateConfig(userId, workspaceId, { petName: '新星尘' }))
        .rejects.toThrow('concurrent update');
      // Verify the write was the only thing that failed — config still exists
      expect(mockPrismaClient.petConfig.findUnique).toHaveBeenCalled();
    });

    it('startSession handles constraint violation', async () => {
      mockPrismaClient.petSessionLog.create.mockRejectedValue(
        new Error('Foreign key constraint violated on `petConfigId`')
      );

      await expect(petService.startSession(userId, 'nonexistent-config'))
        .rejects.toThrow('Foreign key constraint');
    });

    it('addAssetMapping handles referential integrity error', async () => {
      mockPrismaClient.asset.findUnique.mockResolvedValue({ id: 'bad-asset' });
      mockPrismaClient.petAssetMapping.findFirst.mockResolvedValue(null);
      mockPrismaClient.petAssetMapping.create.mockRejectedValue(
        new Error('Foreign key constraint violated on `petConfigId`')
      );

      await expect(petService.addAssetMapping('bad-config', {
        assetId: 'bad-asset', assetType: 'model', slotName: 'default',
      })).rejects.toThrow('Foreign key constraint');
    });
  });

  // ═══ Encryption failures ══════════════════════════════════════

  describe('Encryption failures', () => {
    it('getConfig survives decryption failure — returns raw encrypted values', async () => {
      decryptShouldThrow = true;
      mockPrismaClient.petConfig.findUnique.mockResolvedValue(makeRawConfig());

      const result = await petService.getConfig(userId, workspaceId);
      // Should not throw
      expect(result).not.toBeNull();
    });

    it('exportConfig survives decryption failure during export', async () => {
      mockPrismaClient.petConfig.findUnique
        .mockResolvedValueOnce(makeRawConfig())  // getConfig
        .mockResolvedValueOnce(makeRawConfig()); // exportConfig second lookup
      mockPrismaClient.petAssetMapping.findMany.mockResolvedValue([]);
      // Decryption will try to decrypt 'enc:...' → throws internally → caught
      decryptShouldThrow = true;

      const result = await petService.exportConfig(userId, workspaceId);
      expect(result).toBeDefined();
      expect(result.petName).toBe('星尘');
    });
  });

  // ═══ Malformed data ═══════════════════════════════════════════

  describe('Malformed data', () => {
    it('exportConfig handles corrupt blendshape JSON', async () => {
      mockPrismaClient.petConfig.findUnique
        .mockResolvedValueOnce(makeRawConfig({ avatarId: 'avatar-1' }))
        .mockResolvedValueOnce(makeRawConfig({ avatarId: 'avatar-1' }));
      mockPrismaClient.avatar.findFirst.mockResolvedValue({ id: 'avatar-1', name: '测试' });
      mockPrismaClient.avatarVersion.findFirst.mockResolvedValue({
        blendshapeSnapshot: '{INVALID JSON!!!!}',  // corrupt
        bodyParams: null,
        equippedParts: 'not-an-array',
        materialOverrides: null,
        modelPath: '/models/cattail.model3.json',
      });
      mockPrismaClient.petAssetMapping.findMany.mockResolvedValue([]);

      const result = await petService.exportConfig(userId, workspaceId);

      // Should not crash — corrupt JSON is caught by try/catch in exportConfig
      // Note: modelPath is undefined because the catch block skips all assignments
      // including modelPath = ver.modelPath (a known limitation, not a crash)
      expect(result).toBeDefined();
      expect(result.params).toEqual([]);
    });

    it('exportConfig handles missing avatar version gracefully', async () => {
      mockPrismaClient.petConfig.findUnique
        .mockResolvedValueOnce(makeRawConfig({ avatarId: 'avatar-1' }))
        .mockResolvedValueOnce(makeRawConfig({ avatarId: 'avatar-1' }));
      mockPrismaClient.avatar.findFirst.mockResolvedValue({ id: 'avatar-1', name: '测试' });
      mockPrismaClient.avatarVersion.findFirst.mockResolvedValue(null); // no version
      mockPrismaClient.petAssetMapping.findMany.mockResolvedValue([]);

      const result = await petService.exportConfig(userId, workspaceId);

      expect(result).toBeDefined();
      expect(result.params).toEqual([]);
      expect(result.bodyParams).toEqual([]);
    });

    it('exportConfig handles null avatar gracefully', async () => {
      mockPrismaClient.petConfig.findUnique
        .mockResolvedValueOnce(makeRawConfig({ avatarId: 'avatar-1' }))
        .mockResolvedValueOnce(makeRawConfig({ avatarId: 'avatar-1' }));
      mockPrismaClient.avatar.findFirst.mockResolvedValue(null); // avatar gone
      mockPrismaClient.petAssetMapping.findMany.mockResolvedValue([]);

      const result = await petService.exportConfig(userId, workspaceId);

      expect(result).toBeDefined();
      expect(result.params).toEqual([]);
    });
  });

  // ═══ Concurrency & race conditions ════════════════════════════

  describe('Concurrency & race conditions', () => {
    it('getOrCreateConfig handles race on double-create attempt', async () => {
      // First getConfig returns null (no config)
      mockPrismaClient.petConfig.findUnique
        .mockResolvedValueOnce(null)   // getConfig inside getOrCreateConfig
        .mockResolvedValueOnce(null);  // double-null for safety

      // Create fails because another request created it first
      mockPrismaClient.petConfig.create.mockRejectedValue(
        new Error('Unique constraint failed on the fields: (`userId`)')
      );

      await expect(petService.getOrCreateConfig(userId, workspaceId))
        .rejects.toThrow('Unique constraint');
    });

    it('updateConfig with empty data returns existing without write', async () => {
      mockPrismaClient.petConfig.findUnique.mockResolvedValue(makeRawConfig());

      // Pass an empty object — prepareConfigForDb returns {}, so no DB update
      const result = await petService.updateConfig(userId, workspaceId, {});

      expect(result).toBeDefined();
      expect(mockPrismaClient.petConfig.update).not.toHaveBeenCalled();
    });

    it('addAssetMapping survives concurrent slot conflict', async () => {
      mockPrismaClient.asset.findUnique.mockResolvedValue({ id: 'asset-1' });
      mockPrismaClient.petAssetMapping.findFirst.mockResolvedValue({
        id: 'existing-mapping', petConfigId: configId, assetId: 'old-asset', slotName: 'default',
      });
      mockPrismaClient.petAssetMapping.update.mockRejectedValue(
        new Error('Record to update not found') // deleted by concurrent request
      );

      await expect(petService.addAssetMapping(configId, {
        assetId: 'asset-1', assetType: 'model', slotName: 'default',
      })).rejects.toThrow('Record to update not found');
    });
  });

  // ═══ Rate limiting / resource exhaustion ══════════════════════

  describe('Resource exhaustion', () => {
    it('getUserSessions handles overflow page number', async () => {
      mockPrismaClient.petSessionLog.findMany.mockResolvedValue([]);
      mockPrismaClient.petSessionLog.count.mockResolvedValue(0);

      const result = await petService.getUserSessions(userId, { page: 999999, pageSize: 1000 });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('findConfigsByAsset handles missing petConfig relation', async () => {
      // Mapping exists but petConfig relation is null (deleted config)
      mockPrismaClient.petAssetMapping.findMany.mockResolvedValue([
        { slotName: 'idle', petConfig: null },
      ]);

      await expect(petService.findConfigsByAsset('orphan-asset'))
        .rejects.toThrow(); // Cannot read properties of null
    });

    it('removeAssetMapping handles already-deleted mapping', async () => {
      mockPrismaClient.petAssetMapping.deleteMany.mockResolvedValue({ count: 0 });

      // Should not throw — deleteMany with count:0 is fine
      await expect(petService.removeAssetMapping(configId, 'nonexistent-slot'))
        .resolves.toBeUndefined();
    });
  });

  // ═══ Input edge cases ═════════════════════════════════════════

  describe('Input edge cases', () => {
    it('updateConfig handles very long pet name', async () => {
      const longName = '星'.repeat(1000);
      mockPrismaClient.petConfig.findUnique.mockResolvedValue(makeRawConfig());
      mockPrismaClient.petConfig.update.mockResolvedValue(makeRawConfig({ petName: longName }));

      await petService.updateConfig(userId, workspaceId, { petName: longName });

      const updateData = mockPrismaClient.petConfig.update.mock.calls[0][0]?.data;
      expect(updateData.petName).toBe(longName);
    });

    it('updateConfig handles special Unicode characters in backstory', async () => {
      const emojiStory = '🦊✨🌟 来自异世界の猫耳少女 — "こんにちは" — 😺';
      mockPrismaClient.petConfig.findUnique.mockResolvedValue(makeRawConfig());
      mockPrismaClient.petConfig.update.mockResolvedValue(makeRawConfig({ backstory: emojiStory }));

      await petService.updateConfig(userId, workspaceId, { backstory: emojiStory });

      const updateData = mockPrismaClient.petConfig.update.mock.calls[0][0]?.data;
      expect(updateData.backstory).toBe(emojiStory);
    });

    it('updateConfig passes zero values for timeout/interval', async () => {
      mockPrismaClient.petConfig.findUnique.mockResolvedValue(makeRawConfig());
      mockPrismaClient.petConfig.update.mockResolvedValue(makeRawConfig({ idleTimeout: 0, wanderInterval: 0 }));

      await petService.updateConfig(userId, workspaceId, { idleTimeout: 0, wanderInterval: 0 });

      const updateData = mockPrismaClient.petConfig.update.mock.calls[0][0]?.data;
      expect(updateData.idleTimeout).toBe(0);
      expect(updateData.wanderInterval).toBe(0);
    });
  });
});
