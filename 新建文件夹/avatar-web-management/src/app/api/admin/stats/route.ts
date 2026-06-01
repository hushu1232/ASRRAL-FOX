export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth/middleware';

export const GET = requireRole('super_admin')(async () => {

  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    totalAvatars,
    totalAssets,
    pendingReviews,
    totalStorageRow,
    createdThisMonth,
    marketItemsTotal,
    marketItemsPending,
    ordersTotal,
    ordersCompleted,
    revAgg,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.avatar.count(),
    prisma.asset.count(),
    prisma.avatarVersion.count({ where: { status: 'pending_review' } }),
    prisma.asset.aggregate({ _sum: { fileSize: true } }),
    prisma.avatar.count({ where: { createdAt: { gte: thisMonth } } }),
    prisma.marketItem.count(),
    prisma.marketItem.count({ where: { status: 'pending' } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: 'completed' } }),
    prisma.order.aggregate({ where: { status: 'completed' }, _sum: { amount: true } }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      totalUsers,
      totalAvatars,
      totalAssets,
      pendingReviews,
      totalStorage: Number(totalStorageRow._sum.fileSize) || 0,
      createdThisMonth,
      marketItemsTotal,
      marketItemsPending,
      ordersTotal,
      ordersCompleted,
      revenueTotal: revAgg._sum.amount || 0,
    },
  });
});
