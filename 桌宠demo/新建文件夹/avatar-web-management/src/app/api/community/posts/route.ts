export const runtime = 'nodejs';

import prisma from '@/lib/prisma';
import { paginated, error } from '@/lib/api-response';
import { withAuth } from '@/lib/auth/middleware';

export const GET = withAuth(async (req) => {
  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '20'), 50);
    const sort = url.searchParams.get('sort') || 'hot';
    const tag = url.searchParams.get('tag') || '';

    const where: Record<string, unknown> = {};
    if (tag) {
      where.tags = { contains: tag };
    }

    const orderBy = sort === 'latest'
      ? { createdAt: 'desc' as const }
      : sort === 'top'
        ? { replyCount: 'desc' as const }
        : { voteScore: 'desc' as const };

    const [items, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, username: true, role: true } },
          board: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.post.count({ where }),
    ]);

    return paginated(items, total, page, pageSize);
  } catch (err) {
    return error(err);
  }
});
