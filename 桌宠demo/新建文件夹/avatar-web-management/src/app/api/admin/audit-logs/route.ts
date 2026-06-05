export const runtime = 'nodejs';

import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth/middleware';
import { paginated } from '@/lib/api-response';

export const GET = requireRole('super_admin')(async (req) => {

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20')));

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { username: true } },
      },
    }),
    prisma.auditLog.count(),
  ]);

  const items = logs.map((al) => ({
    ...al,
    user_name: al.user?.username || null,
  }));

  return paginated(items, total, page, pageSize);
});
