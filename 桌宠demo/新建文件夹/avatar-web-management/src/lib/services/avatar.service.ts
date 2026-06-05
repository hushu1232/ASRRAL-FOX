import { v4 as uuidv4 } from 'uuid';
import { getPrisma, toSnakeCase } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { createLogger } from '@/lib/logger';

const log = createLogger('avatar-service');

function parseVersionJsonFields(v: Record<string, unknown>) {
  const parsed = { ...v };
  for (const field of ['blendshape_snapshot', 'body_params', 'equipped_parts', 'material_overrides']) {
    if (typeof parsed[field] === 'string') {
      try { parsed[field] = JSON.parse(parsed[field] as string); } catch { /* keep raw */ }
    }
  }
  return parsed;
}

export const avatarService = {
  async list(workspaceId: string, opts?: { page?: number; pageSize?: number; search?: string; status?: string }) {
    const prisma = getPrisma();
    const page = opts?.page || 1;
    const pageSize = opts?.pageSize || 20;
    const search = opts?.search || '';
    const status = opts?.status || '';

    const where: Record<string, unknown> = { workspaceId };
    if (search) where.name = { contains: search };
    if (status) where.status = status;

    const offset = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      prisma.avatar.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: offset, take: pageSize }),
      prisma.avatar.count({ where }),
    ]);

    return {
      items: items.map((i) => toSnakeCase(i as unknown as Record<string, unknown>)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  },

  async getById(id: string, workspaceId: string) {
    const prisma = getPrisma();
    const avatar = await prisma.avatar.findFirst({ where: { id, workspaceId } });
    if (!avatar) throw new NotFoundError('Avatar', id);

    const rawVersions = await prisma.avatarVersion.findMany({
      where: { avatarId: id },
      orderBy: { versionNumber: 'desc' },
    });

    const versions = rawVersions.map((v) =>
      parseVersionJsonFields(toSnakeCase(v as unknown as Record<string, unknown>))
    );

    return { ...toSnakeCase(avatar as unknown as Record<string, unknown>), versions };
  },

  async create(data: { name: string; style: string; baseModel: string }, workspaceId: string, userId: string) {
    const prisma = getPrisma();
    const id = uuidv4();
    const avatar = await prisma.avatar.create({
      data: { id, workspaceId, creatorId: userId, name: data.name, style: data.style, baseModel: data.baseModel },
    });
    return toSnakeCase(avatar as unknown as Record<string, unknown>);
  },

  async update(id: string, data: Record<string, unknown>, workspaceId: string) {
    const prisma = getPrisma();
    const existing = await prisma.avatar.findFirst({ where: { id, workspaceId } });
    if (!existing) throw new NotFoundError('Avatar', id);

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.style !== undefined) updateData.style = data.style;
    if (data.status !== undefined) updateData.status = data.status;

    if (Object.keys(updateData).length === 0) {
      return toSnakeCase(existing as unknown as Record<string, unknown>);
    }

    updateData.updatedAt = new Date();
    const updated = await prisma.avatar.update({ where: { id }, data: updateData });
    return toSnakeCase(updated as unknown as Record<string, unknown>);
  },

  async delete(id: string, workspaceId: string) {
    const prisma = getPrisma();
    const existing = await prisma.avatar.findFirst({ where: { id, workspaceId } });
    if (!existing) throw new NotFoundError('Avatar', id);
    await prisma.avatar.delete({ where: { id } });
  },

  async batch(action: string, ids: string[], workspaceId: string) {
    const prisma = getPrisma();
    const statusMap: Record<string, string> = {
      delete: 'deleted',
      publish: 'published',
      unpublish: 'draft',
      archive: 'archived',
    };
    const targetStatus = statusMap[action];
    if (!targetStatus) throw new Error(`Unknown batch action: ${action}`);

    const extraWhere = action === 'publish' ? { status: 'draft' } : action === 'unpublish' ? { status: 'published' } : {};

    const result = await prisma.avatar.updateMany({
      where: { id: { in: ids }, workspaceId, ...extraWhere },
      data: { status: targetStatus, updatedAt: new Date() },
    });

    log.info('Batch %s: %d avatars affected', action, result.count);
    return { affected: result.count };
  },

  async listVersions(avatarId: string, workspaceId: string) {
    const prisma = getPrisma();
    const avatar = await prisma.avatar.findFirst({ where: { id: avatarId, workspaceId } });
    if (!avatar) throw new NotFoundError('Avatar', avatarId);

    const rawVersions = await prisma.avatarVersion.findMany({
      where: { avatarId },
      orderBy: { versionNumber: 'desc' },
    });

    return rawVersions.map((v) =>
      parseVersionJsonFields(toSnakeCase(v as unknown as Record<string, unknown>))
    );
  },

  async createVersion(avatarId: string, data: {
    blendshape_snapshot: Record<string, number>;
    body_params: Record<string, number>;
    equipped_parts: { slot: string; part_id: string }[];
    material_overrides: Record<string, { albedo: string; roughness: number; metallic: number }>;
  }, workspaceId: string) {
    const prisma = getPrisma();
    const avatar = await prisma.avatar.findFirst({ where: { id: avatarId, workspaceId } });
    if (!avatar) throw new NotFoundError('Avatar', avatarId);

    const lastVer = await prisma.avatarVersion.findFirst({
      where: { avatarId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    const versionNumber = (lastVer?.versionNumber || 0) + 1;

    const verId = uuidv4();
    await prisma.avatarVersion.create({
      data: {
        id: verId,
        avatarId,
        versionNumber,
        blendshapeSnapshot: JSON.stringify(data.blendshape_snapshot),
        bodyParams: JSON.stringify(data.body_params),
        equippedParts: JSON.stringify(data.equipped_parts),
        materialOverrides: JSON.stringify(data.material_overrides),
      },
    });

    await prisma.avatar.update({
      where: { id: avatarId },
      data: { currentVersionId: verId, updatedAt: new Date() },
    });

    const rawVer = await prisma.avatarVersion.findUnique({ where: { id: verId } });
    return parseVersionJsonFields(toSnakeCase(rawVer as unknown as Record<string, unknown>));
  },

  async restoreVersion(avatarId: string, versionId: string) {
    const prisma = getPrisma();
    const avatar = await prisma.avatar.findUnique({ where: { id: avatarId } });
    if (!avatar) throw new NotFoundError('Avatar', avatarId);

    const oldVersion = await prisma.avatarVersion.findFirst({
      where: { id: versionId, avatarId },
    });
    if (!oldVersion) throw new NotFoundError('Version', versionId);

    const lastVer = await prisma.avatarVersion.findFirst({
      where: { avatarId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    const versionNumber = (lastVer?.versionNumber || 0) + 1;

    const newVerId = uuidv4();
    await prisma.avatarVersion.create({
      data: {
        id: newVerId,
        avatarId,
        versionNumber,
        blendshapeSnapshot: oldVersion.blendshapeSnapshot,
        bodyParams: oldVersion.bodyParams,
        equippedParts: oldVersion.equippedParts,
        materialOverrides: oldVersion.materialOverrides,
        previewScreenshotUrl: oldVersion.previewScreenshotUrl,
      },
    });

    await prisma.avatar.update({
      where: { id: avatarId },
      data: { currentVersionId: newVerId, updatedAt: new Date() },
    });

    const rawVer = await prisma.avatarVersion.findUnique({ where: { id: newVerId } });
    const version = parseVersionJsonFields(toSnakeCase(rawVer as unknown as Record<string, unknown>));
    return { version, restoredFrom: versionNumber - 1 };
  },
};
