import { getPrisma } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { exportAvatar } from '@/lib/export/glb-exporter';
import { exportVRM } from '@/lib/export/vrm-exporter';

function parseJsonField<T>(raw: string, fallback: T): T {
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export const exportService = {
  async exportAvatar(avatarId: string, format: 'glb' | 'vrm', workspaceId: string) {
    const prisma = getPrisma();

    const avatar = await prisma.avatar.findFirst({
      where: { id: avatarId, workspaceId },
      select: { id: true, name: true, baseModel: true },
    });
    if (!avatar) throw new NotFoundError('Avatar', avatarId);

    const version = await prisma.avatarVersion.findFirst({
      where: { avatarId },
      orderBy: { versionNumber: 'desc' },
    });

    const baseModel = avatar.baseModel.includes('male') ? 'male' : 'female';
    const blendShapes = version
      ? parseJsonField<Record<string, number>>(version.blendshapeSnapshot, {})
      : {};
    const equippedParts: { slot: string; partId: string }[] = version
      ? parseJsonField<{ slot: string; part_id: string }[]>(version.equippedParts, []).map(p => ({
          slot: p.slot,
          partId: p.part_id,
        }))
      : [];
    const materialOverrides = version
      ? parseJsonField<Record<string, { albedo: string; roughness: number; metallic: number }>>(version.materialOverrides, {})
      : {};

    if (format === 'vrm') {
      const buffer = await exportVRM({ baseModel, blendShapes, equippedParts, materialOverrides, format: 'vrm', avatarName: avatar.name });
      return { buffer, filename: `${avatar.name}.vrm`, contentType: 'model/vrm' };
    }

    const buffer = await exportAvatar({ baseModel, blendShapes, equippedParts, materialOverrides, format: 'glb' });
    return { buffer, filename: `${avatar.name}.glb`, contentType: 'model/gltf-binary' };
  },
};
