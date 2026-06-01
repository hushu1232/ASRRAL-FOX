// Rigging 模型详情/删除
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { getStorageAdapter } from '@/lib/storage';
import { requireRole } from '@/lib/auth/middleware';

export const GET = requireRole('workspace_admin')(async (_req, _user, ctx) => {
  const prisma = getPrisma();
  const params = await ctx!.params!;
  const id = (params as { id: string }).id;

  const asset = await prisma.asset.findFirst({
    where: { id, assetType: 'live2d_model', status: 'ready' },
  });

  if (!asset) {
    return NextResponse.json(
      { success: false, error: `Model not found: ${id}` },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, data: asset });
});

export const DELETE = requireRole('workspace_admin')(async (_req, _user, ctx) => {
  const prisma = getPrisma();
  const storage = getStorageAdapter();
  const params = await ctx!.params!;
  const id = (params as { id: string }).id;

  const asset = await prisma.asset.findFirst({
    where: { id, assetType: 'live2d_model' },
  });

  if (!asset) {
    return NextResponse.json(
      { success: false, error: `Model not found: ${id}` },
      { status: 404 },
    );
  }

  // Delete model files from storage
  try {
    const meta = typeof asset.metadata === 'string'
      ? JSON.parse(asset.metadata) as Record<string, unknown>
      : (asset.metadata as unknown as Record<string, unknown> | null);
    const modelFiles = meta?.modelFiles as Record<string, unknown> | null;
    if (modelFiles) {
      const keys = [modelFiles.moc3, modelFiles.model3Json, modelFiles.physics3Json, ...((modelFiles.textures as string[]) || [])];
      for (const key of keys) {
        if (typeof key === 'string') {
          await storage.delete(key).catch(() => { /* best-effort */ });
        }
      }
    }
  } catch { /* best-effort cleanup */ }

  await prisma.asset.update({
    where: { id },
    data: { status: 'deleted' },
  });

  return NextResponse.json({ success: true, data: { deleted: true } });
});
