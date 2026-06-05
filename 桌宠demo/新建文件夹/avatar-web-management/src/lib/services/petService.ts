import { v4 as uuidv4 } from 'uuid';
import { getPrisma, toSnakeCase } from '@/lib/db';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { createLogger } from '@/lib/logger';

const log = createLogger('pet-service');

// ─── Types ─────────────────────────────────────────────────

export interface PetConfigData {
  petName: string;
  personality: string;
  backstory: string;
  characterExtra?: string;
  animationModel: 'live2d' | 'dragonbones' | 'vrm';
  avatarId?: string;
  ffmpegPath?: string;
  idleTimeout: number;
  wanderInterval: number;
  // Local AI services (aligned with Unity AppConfig.cs)
  ttsLocalUrl?: string;
  sttLocalUrl?: string;
  llmModelPath?: string;
  sovitsUrl?: string;
  sovitsReferenceVoiceId?: string;
  enableWakeWord?: boolean;
  wakeWord?: string;
  wakeSensitivity?: number;
  autoStartServices?: boolean;
  pipelineTimeout?: number;
  modelPath?: string;
}

export interface PetConfigExport {
  version: number;
  petName: string;
  personality: string;
  backstory: string;
  characterExtra?: string;
  animationModel: string;
  ffmpegPath?: string;
  idleTimeout: number;
  wanderInterval: number;
  avatarId?: string;
  modelPath?: string;
  // Local AI services
  ttsLocalUrl?: string;
  sttLocalUrl?: string;
  llmModelPath?: string;
  sovitsUrl?: string;
  sovitsReferenceVoiceId?: string;
  enableWakeWord?: boolean;
  wakeWord?: string;
  wakeSensitivity?: number;
  autoStartServices?: boolean;
  pipelineTimeout?: number;
  // Legacy
  params: { key: string; value: number }[];
  bodyParams: { key: string; value: number }[];
  equippedParts: { slot: string; part_id: string }[];
  materialOverrides: Record<string, unknown>;
  mappedAssets: { slotName: string; assetId: string; assetType: string }[];
}

export interface PetAssetMappingData {
  assetId: string;
  assetType: 'model' | 'texture' | 'animation' | 'sound';
  slotName: string;
}

export interface PetSessionData {
  startTime: string;
  endTime?: string;
  interactionCount: number;
  crashLog?: string;
}

// ─── Helpers ───────────────────────────────────────────────

function decryptConfigFields(config: Record<string, unknown>): Record<string, unknown> {
  return { ...config };
}

function prepareConfigForDb(data: Partial<PetConfigData>): Record<string, unknown> {
  const dbData: Record<string, unknown> = {};
  if (data.petName !== undefined) dbData.petName = data.petName;
  if (data.personality !== undefined) dbData.personality = data.personality;
  if (data.backstory !== undefined) dbData.backstory = data.backstory;
  if (data.animationModel !== undefined) dbData.animationModel = data.animationModel;
  if (data.avatarId !== undefined) dbData.avatarId = data.avatarId;
  if (data.ffmpegPath !== undefined) dbData.ffmpegPath = data.ffmpegPath;
  if (data.idleTimeout !== undefined) dbData.idleTimeout = data.idleTimeout;
  if (data.wanderInterval !== undefined) dbData.wanderInterval = data.wanderInterval;
  return dbData;
}

// ─── Service ───────────────────────────────────────────────

export const petService = {
  // ═══ Config CRUD ══════════════════════════════════════════

  async getConfig(userId: string, workspaceId: string) {
    const prisma = getPrisma();
    const raw = await prisma.petConfig.findUnique({ where: { userId } });
    if (!raw) return null;
    const config = toSnakeCase(raw as unknown as Record<string, unknown>);
    return decryptConfigFields(config);
  },

  async getOrCreateConfig(userId: string, workspaceId: string) {
    const existing = await this.getConfig(userId, workspaceId);
    if (existing) return existing as unknown as PetConfigData & { id: string; createdAt: string; updatedAt: string };

    const prisma = getPrisma();
    const id = uuidv4();
    await prisma.petConfig.create({
      data: { id, userId, workspaceId },
    });
    const raw = await prisma.petConfig.findUnique({ where: { id } });
    return toSnakeCase(raw as unknown as Record<string, unknown>);
  },

  async updateConfig(userId: string, workspaceId: string, data: Partial<PetConfigData>) {
    const prisma = getPrisma();
    const existing = await prisma.petConfig.findUnique({ where: { userId } });
    if (!existing) throw new NotFoundError('PetConfig', userId);

    const updateData = prepareConfigForDb(data);
    if (Object.keys(updateData).length === 0) {
      return toSnakeCase(existing as unknown as Record<string, unknown>);
    }

    updateData.updatedAt = new Date();
    await prisma.petConfig.update({ where: { id: existing.id }, data: updateData });
    const raw = await prisma.petConfig.findUnique({ where: { id: existing.id } });
    return decryptConfigFields(toSnakeCase(raw as unknown as Record<string, unknown>));
  },

  async setAvatarAsPet(userId: string, workspaceId: string, avatarId: string) {
    const prisma = getPrisma();
    // Verify avatar exists and belongs to user
    const avatar = await prisma.avatar.findFirst({ where: { id: avatarId, workspaceId } });
    if (!avatar) throw new NotFoundError('Avatar', avatarId);

    // Get or create pet config
    let config = await prisma.petConfig.findUnique({ where: { userId } });
    if (!config) {
      const id = uuidv4();
      await prisma.petConfig.create({
        data: {
          id,
          userId,
          workspaceId,
          avatarId,
          petName: avatar.name,
        },
      });
    } else {
      await prisma.petConfig.update({
        where: { userId },
        data: { avatarId, petName: avatar.name, updatedAt: new Date() },
      });
    }

    log.info({ userId, avatarId }, 'Avatar set as pet appearance');
    return this.getConfig(userId, workspaceId);
  },

  // ═══ Asset Mapping ════════════════════════════════════════

  async getAssetMappings(petConfigId: string) {
    const prisma = getPrisma();
    const mappings = await prisma.petAssetMapping.findMany({
      where: { petConfigId },
      orderBy: { createdAt: 'desc' },
    });
    return mappings.map((m) => toSnakeCase(m as unknown as Record<string, unknown>));
  },

  async addAssetMapping(petConfigId: string, data: PetAssetMappingData) {
    const prisma = getPrisma();
    const id = uuidv4();

    // Verify asset exists
    const asset = await prisma.asset.findUnique({ where: { id: data.assetId } });
    if (!asset) throw new NotFoundError('Asset', data.assetId);

    // Upsert by unique(petConfigId, slotName)
    const existing = await prisma.petAssetMapping.findFirst({
      where: { petConfigId, slotName: data.slotName },
    });

    if (existing) {
      await prisma.petAssetMapping.update({
        where: { id: existing.id },
        data: { assetId: data.assetId, assetType: data.assetType },
      });
    } else {
      await prisma.petAssetMapping.create({
        data: { id, petConfigId, assetId: data.assetId, assetType: data.assetType, slotName: data.slotName },
      });
    }

    log.info({ petConfigId, slotName: data.slotName, assetId: data.assetId }, 'Pet asset mapping updated');
    return this.getAssetMappings(petConfigId);
  },

  async removeAssetMapping(petConfigId: string, slotName: string) {
    const prisma = getPrisma();
    await prisma.petAssetMapping.deleteMany({ where: { petConfigId, slotName } });
  },

  // ═══ Asset Listing (for pet) ══════════════════════════════

  async getAvailableAssets(workspaceId: string, assetType?: string) {
    const prisma = getPrisma();
    const where: Record<string, unknown> = { workspaceId, status: 'ready' };
    if (assetType) where.assetType = assetType;

    const assets = await prisma.asset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return assets.map((a) => toSnakeCase(a as unknown as Record<string, unknown>));
  },

  // ═══ Session Logging ══════════════════════════════════════

  async startSession(userId: string, petConfigId: string) {
    const prisma = getPrisma();
    const id = uuidv4();
    await prisma.petSessionLog.create({
      data: {
        id,
        userId,
        petConfigId,
        startTime: new Date(),
        interactionCount: 0,
      },
    });
    log.info({ userId, petConfigId, sessionId: id }, 'Pet session started');
    return { sessionId: id };
  },

  async updateSession(sessionId: string, data: { interactionCount?: number; crashLog?: string }) {
    const prisma = getPrisma();
    const existing = await prisma.petSessionLog.findUnique({ where: { id: sessionId } });
    if (!existing) throw new NotFoundError('Session', sessionId);

    const updateData: Record<string, unknown> = {};
    if (data.interactionCount !== undefined) updateData.interactionCount = data.interactionCount;
    if (data.crashLog !== undefined) updateData.crashLog = data.crashLog;
    else if (data.crashLog === null && data.interactionCount === undefined) {
      updateData.endTime = new Date();
    }

    await prisma.petSessionLog.update({ where: { id: sessionId }, data: updateData });
  },

  /**
   * Find pet configs that reference a given asset. Used for takedown notifications.
   */
  async findConfigsByAsset(assetId: string): Promise<{ userId: string; petName: string; slotName: string }[]> {
    const prisma = getPrisma();
    const mappings = await prisma.petAssetMapping.findMany({
      where: { assetId },
      select: {
        slotName: true,
        petConfig: { select: { userId: true, petName: true } },
      },
    });
    return mappings.map((m) => ({
      userId: m.petConfig.userId,
      petName: m.petConfig.petName,
      slotName: m.slotName,
    }));
  },

  async getUserSessions(userId: string, opts?: { page?: number; pageSize?: number }) {
    const prisma = getPrisma();
    const page = opts?.page || 1;
    const pageSize = opts?.pageSize || 20;

    const [items, total] = await Promise.all([
      prisma.petSessionLog.findMany({
        where: { userId },
        orderBy: { startTime: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.petSessionLog.count({ where: { userId } }),
    ]);

    return {
      items: items.map((i) => toSnakeCase(i as unknown as Record<string, unknown>)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  },

  // ═══ Export ═══════════════════════════════════════════════

  async exportConfig(userId: string, workspaceId: string): Promise<PetConfigExport> {
    const config = await this.getConfig(userId, workspaceId);
    if (!config) throw new NotFoundError('PetConfig', userId);

    const cfg = config as Record<string, unknown>;

    // Get linked avatar version for params
    let params: { key: string; value: number }[] = [];
    let bodyParams: { key: string; value: number }[] = [];
    let equippedParts: { slot: string; part_id: string }[] = [];
    let materialOverrides: Record<string, unknown> = {};
    let modelPath: string | undefined;

    if (cfg.avatar_id) {
      try {
        const prisma = getPrisma();
        const avatar = await prisma.avatar.findFirst({ where: { id: cfg.avatar_id as string } });
        if (avatar) {
          const ver = await prisma.avatarVersion.findFirst({
            where: { avatarId: cfg.avatar_id as string },
            orderBy: { versionNumber: 'desc' },
          });
          if (ver) {
            params = typeof ver.blendshapeSnapshot === 'string'
              ? Object.entries(JSON.parse(ver.blendshapeSnapshot)).map(([k, v]) => ({ key: k, value: v as number }))
              : [];
            bodyParams = typeof ver.bodyParams === 'string'
              ? Object.entries(JSON.parse(ver.bodyParams)).map(([k, v]) => ({ key: k, value: v as number }))
              : [];
            equippedParts = typeof ver.equippedParts === 'string' ? JSON.parse(ver.equippedParts) : [];
            materialOverrides = typeof ver.materialOverrides === 'string' ? JSON.parse(ver.materialOverrides) : {};
            modelPath = ver.modelPath;
          }
        }
      } catch (err) {
        log.warn({ err, avatarId: cfg.avatar_id }, 'Failed to load avatar version for export');
      }
    }

    // Get asset mappings
    const prisma = getPrisma();
    const configRecord = await prisma.petConfig.findUnique({ where: { userId } });
    const mappings = configRecord
      ? await prisma.petAssetMapping.findMany({ where: { petConfigId: configRecord.id } })
      : [];

    return {
      version: 1,
      petName: (cfg.pet_name as string) || '星尘',
      personality: (cfg.personality as string) || '',
      backstory: (cfg.backstory as string) || '',
      characterExtra: (cfg.character_extra as string) || '',
      animationModel: (cfg.animation_model as string) || 'live2d',
      ffmpegPath: cfg.ffmpeg_path as string | undefined,
      idleTimeout: (cfg.idle_timeout as number) || 300,
      wanderInterval: (cfg.wander_interval as number) || 15.0,
      avatarId: cfg.avatar_id as string | undefined,
      modelPath,
      ttsLocalUrl: (cfg.tts_local_url as string) || 'http://127.0.0.1:9881',
      sttLocalUrl: (cfg.stt_local_url as string) || 'http://127.0.0.1:9000',
      llmModelPath: (cfg.llm_model_path as string) || 'models/qwen2.5-7b-instruct-q4_k_m.gguf',
      sovitsUrl: (cfg.sovits_url as string) || '',
      sovitsReferenceVoiceId: (cfg.sovits_reference_voice_id as string) || '',
      enableWakeWord: (cfg.enable_wake_word as boolean) ?? true,
      wakeWord: (cfg.wake_word as string) || '小星小星',
      wakeSensitivity: (cfg.wake_sensitivity as number) ?? 0.5,
      autoStartServices: (cfg.auto_start_services as boolean) ?? true,
      pipelineTimeout: (cfg.pipeline_timeout as number) || 30,
      params,
      bodyParams,
      equippedParts,
      materialOverrides,
      mappedAssets: mappings.map((m) => ({
        slotName: m.slotName,
        assetId: m.assetId,
        assetType: m.assetType,
      })),
    };
  },
};
