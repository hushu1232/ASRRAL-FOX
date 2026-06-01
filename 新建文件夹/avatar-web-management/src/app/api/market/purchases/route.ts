export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { getPrisma } from '@/lib/db';
import { withAuth } from '@/lib/auth/middleware';
import { success } from '@/lib/api-response';

export const GET = withAuth(async (req: NextRequest, user) => {
  const prisma = getPrisma();
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = parseInt(url.searchParams.get('pageSize') || '12');

  const where = { buyerId: user.sub };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        item: {
          select: {
            id: true,
            title: true,
            category: true,
            price: true,
            currency: true,
            thumbnailUrl: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  const items = orders.map(o => ({
    orderId: o.id,
    amount: o.amount,
    platformFee: o.platformFee,
    sellerPayout: o.sellerPayout,
    status: o.status,
    createdAt: o.createdAt,
    item: {
      id: o.item.id,
      title: o.item.title,
      category: o.item.category,
      price: o.item.price,
      currency: o.item.currency,
      thumbnailUrl: o.item.thumbnailUrl,
      status: o.item.status,
    },
  }));

  return success({ items, total, page, pageSize });
});
