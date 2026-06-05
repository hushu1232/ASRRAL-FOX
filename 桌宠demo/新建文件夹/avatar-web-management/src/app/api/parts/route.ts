export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { getPrisma, toSnakeCase } from '@/lib/db';
import { success, error } from '@/lib/api-response';
import { withAuth } from '@/lib/auth/middleware';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:parts');

export const GET = withAuth(async (_req: NextRequest) => {
  try {
    const prisma = getPrisma();
    const parts = await prisma.part.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return success(parts.map((p) => {
      const row = toSnakeCase(p as unknown as Record<string, unknown>);
      row.style_tags = typeof row.style_tags === 'string' ? JSON.parse(row.style_tags as string) : (row.style_tags || []);
      row.default_material = typeof row.default_material === 'string' ? JSON.parse(row.default_material as string) : (row.default_material || {});
      return row;
    }));
  } catch (e) {
    log.error({ err: e }, 'Failed to fetch parts');
    return error('获取部件列表失败');
  }
});
