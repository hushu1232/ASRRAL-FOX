// Rigging 模型列表 — 查询用户已生成的 Live2D 模型
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { getPrisma } from '@/lib/db';
import { paginated } from '@/lib/api-response';
import { requireRole } from '@/lib/auth/middleware';

export const GET = requireRole('workspace_admin')(async (req, user) => {
  const prisma = getPrisma();
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20')));

  const offset = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    prisma.asset.findMany({
      where: {
        workspaceId: user.workspaceId,
        assetType: 'live2d_model',
        status: 'ready',
      },
      select: {
        id: true,
        filename: true,
        assetType: true,
        mimeType: true,
        fileSize: true,
        thumbnailUrl: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: pageSize,
    }),
    prisma.asset.count({
      where: {
        workspaceId: user.workspaceId,
        assetType: 'live2d_model',
        status: 'ready',
      },
    }),
  ]);

  return paginated(items, total, page, pageSize);
});
