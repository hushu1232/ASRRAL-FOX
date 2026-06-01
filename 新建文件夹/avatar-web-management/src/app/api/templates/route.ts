export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { error, paginated } from '@/lib/api-response';
import { withAuth } from '@/lib/auth/middleware';
import { tryCacheHit, cacheResponse, buildCacheKey, CACHE_TTL } from '@/lib/cache';

export const revalidate = 60;

export const GET = withAuth(async (req) => {
  try {
    const cacheKey = buildCacheKey('templates', req.url);
    const cached = await tryCacheHit(cacheKey);
    if (cached) {
      cached.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      return cached;
    }

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    const category = url.searchParams.get('category') || '';
    const search = url.searchParams.get('search') || '';

    const where: Record<string, unknown> = { isTemplate: true, status: 'published' };
    if (category) where.style = category;
    if (search) where.name = { contains: search };

    const [items, total] = await Promise.all([
      prisma.avatar.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { creator: { select: { username: true } } },
      }),
      prisma.avatar.count({ where }),
    ]);

    const enriched = items.map((item) => ({
      ...item,
      author: item.creator.username,
    }));

    const response = paginated(enriched, total, page, pageSize);
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    response.headers.set('X-Cache', 'MISS');

    cacheResponse(cacheKey, response, CACHE_TTL.templates);

    return response;
  } catch (err) {
    return error(err);
  }
});
