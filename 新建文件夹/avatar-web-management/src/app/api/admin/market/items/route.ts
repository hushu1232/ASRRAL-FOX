export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { success, error, paginated } from '@/lib/api-response';
import { requireRole } from '@/lib/auth/middleware';
import { getPrisma } from '@/lib/db';

export const GET = requireRole('super_admin')(async (req) => {
  try {
    const prisma = getPrisma();
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    const status = url.searchParams.get('status') || '';
    const category = url.searchParams.get('category') || '';
    const offset = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (category) where.category = category;

    const [items, total] = await Promise.all([
      prisma.marketItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: pageSize,
        include: { seller: { select: { id: true, username: true, email: true } } },
      }),
      prisma.marketItem.count({ where }),
    ]);

    const mapped = items.map((i) => ({
      id: i.id,
      title: i.title,
      category: i.category,
      price: i.price,
      currency: i.currency,
      status: i.status,
      rating: i.rating,
      download_count: i.downloadCount,
      created_at: i.createdAt,
      seller_name: i.seller.username,
      seller_email: i.seller.email,
    }));

    return paginated(mapped, total, page, pageSize);
  } catch (err) {
    return error(err);
  }
});
