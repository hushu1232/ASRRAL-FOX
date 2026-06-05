import { v4 as uuidv4 } from 'uuid';
import { getPrisma, toSnakeCase } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { getStorageAdapter } from '@/lib/storage';
import { createLogger } from '@/lib/logger';
import { petService } from './petService';

const log = createLogger('asset-service');

const ASSET_LIST_SELECT = {
  id: true, workspaceId: true, uploaderId: true, filename: true, fileSize: true,
  mimeType: true, storagePath: true, assetType: true, format: true, license: true,
  tags: true, thumbnailUrl: true, status: true, version: true, createdAt: true,
} as const;

export const assetService = {
  async list(workspaceId: string, opts?: { page?: number; pageSize?: number; search?: string; type?: string }) {
    const prisma = getPrisma();
    const page = opts?.page || 1;
    const pageSize = opts?.pageSize || 20;
    const search = opts?.search || '';
    const assetType = opts?.type || '';

    const where: Record<string, unknown> = { workspaceId };
    if (search) where.filename = { contains: search };
    if (assetType) where.assetType = assetType;

    const offset = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      prisma.asset.findMany({ where, select: ASSET_LIST_SELECT, orderBy: { createdAt: 'desc' }, skip: offset, take: pageSize }),
      prisma.asset.count({ where }),
    ]);

    return {
      items: items.map((i) => toSnakeCase(i as unknown as Record<string, unknown>)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  },

  async create(data: {
    filename: string; file_size: number; mime_type: string; asset_type: string;
    format: string; license: string; tags: string[];
    storage_path?: string; thumbnail_url?: string;
  }, workspaceId: string, userId: string) {
    const prisma = getPrisma();
    const id = uuidv4();
    const storagePath = data.storage_path || `/uploads/${workspaceId}/${id}/${data.filename}`;

    const asset = await prisma.asset.create({
      data: {
        id,
        workspaceId,
        uploaderId: userId,
        filename: data.filename,
        fileSize: data.file_size,
        mimeType: data.mime_type,
        storagePath,
        assetType: data.asset_type,
        format: data.format,
        license: data.license,
        tags: JSON.stringify(data.tags),
        thumbnailUrl: data.thumbnail_url ?? null,
      },
    });

    return toSnakeCase(asset as unknown as Record<string, unknown>);
  },

  async getById(id: string, workspaceId: string) {
    const prisma = getPrisma();
    const asset = await prisma.asset.findFirst({ where: { id, workspaceId } });
    if (!asset) throw new NotFoundError('Asset', id);
    return toSnakeCase(asset as unknown as Record<string, unknown>);
  },

  async getFileInfo(id: string, workspaceId: string) {
    const prisma = getPrisma();
    const asset = await prisma.asset.findFirst({
      where: { id, workspaceId },
      select: { storagePath: true, mimeType: true, filename: true },
    });
    if (!asset) throw new NotFoundError('Asset', id);

    const storage = getStorageAdapter();
    let fileUrl = await storage.getFileUrl(asset.storagePath);
    return { fileUrl, mimeType: asset.mimeType, filename: asset.filename };
  },

  async batch(action: string, ids: string[], workspaceId: string) {
    const prisma = getPrisma();

    if (action === 'delete') {
      const assets = await prisma.asset.findMany({
        where: { id: { in: ids }, workspaceId },
        select: { id: true, storagePath: true },
      });

      const storage = getStorageAdapter();
      let deletedFiles = 0;
      for (const asset of assets) {
        try { await storage.delete(asset.storagePath); deletedFiles++; } catch { /* already gone */ }
      }

      const result = await prisma.asset.deleteMany({
        where: { id: { in: ids }, workspaceId },
      });

      log.info('Batch deleted %d assets (%d files removed from storage)', result.count, deletedFiles);

      // Notify pet owners if deleted assets were mapped to their pets
      for (const assetId of ids) {
        try {
          const petConfigs = await petService.findConfigsByAsset(assetId);
          for (const pc of petConfigs) {
            await prisma.notification.create({
              data: {
                id: uuidv4(),
                userId: pc.userId,
                type: 'asset_takedown',
                title: `桌宠 "${pc.petName}" 使用的资产已被下架`,
                body: `插槽 "${pc.slotName}" 的资产已不可用，请前往桌宠配置页面替换。`,
                resourceType: 'asset',
                resourceId: assetId,
              },
            });
            log.info({ userId: pc.userId, petName: pc.petName, assetId }, 'Pet asset takedown notification sent');
          }
        } catch (err) { log.warn({ err, assetId }, 'Failed to check pet asset mappings'); }
      }

      return { affected: result.count, deletedFiles };
    }

    if (action === 'archive') {
      const result = await prisma.asset.updateMany({
        where: { id: { in: ids }, workspaceId },
        data: { status: 'archived' },
      });
      log.info('Batch archived %d assets', result.count);
      return { affected: result.count };
    }

    throw new Error(`Unknown batch action: ${action}`);
  },
};
