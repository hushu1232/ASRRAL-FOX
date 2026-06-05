export const runtime = 'nodejs';

import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth/middleware';
import { success } from '@/lib/api-response';

export const GET = withAuth(async (_req, user) => {

  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);

  const [totalAvatars, createdThisMonth, pendingReviews, totalStorageRow, recentAvatars] = await Promise.all([
    prisma.avatar.count({ where: { creatorId: user.sub } }),
    prisma.avatar.count({ where: { creatorId: user.sub, createdAt: { gte: thisMonth } } }),
    prisma.avatarVersion.count({
      where: { avatar: { creatorId: user.sub }, status: 'pending_review' },
    }),
    prisma.asset.aggregate({ where: { uploaderId: user.sub }, _sum: { fileSize: true } }),
    prisma.avatar.findMany({
      where: { creatorId: user.sub },
      select: { id: true, name: true, style: true, status: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
  ]);

  // 7-day creation trend
  const trend: Array<{ date: string; created: number; published: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

    const [created, published] = await Promise.all([
      prisma.avatar.count({
        where: { creatorId: user.sub, createdAt: { gte: dayStart, lt: dayEnd } },
      }),
      prisma.avatarVersion.count({
        where: {
          avatar: { creatorId: user.sub },
          status: 'published',
          createdAt: { gte: dayStart, lt: dayEnd },
        },
      }),
    ]);
    trend.push({ date: dateStr, created, published });
  }

  // Part usage from equipped_parts JSON
  const versionsWithParts = await prisma.avatarVersion.findMany({
    where: { avatar: { creatorId: user.sub } },
    select: { equippedParts: true },
  });

  const partCounts: Record<string, number> = {};
  for (const row of versionsWithParts) {
    try {
      const parts: Array<{ slot: string }> = JSON.parse(row.equippedParts);
      for (const p of parts) {
        partCounts[p.slot] = (partCounts[p.slot] || 0) + 1;
      }
    } catch { /* ignore malformed JSON */ }
  }
  const partUsage = Object.entries(partCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 7)
    .map(([name, count]) => ({ name, count }));

  // Market stats
  let marketItemsCount = 0;
  let marketRevenue = 0;
  try {
    const [itemCount, orderAgg] = await Promise.all([
      prisma.marketItem.count({ where: { sellerId: user.sub, status: 'approved' } }),
      prisma.order.aggregate({
        where: { item: { sellerId: user.sub }, status: 'completed' },
        _sum: { sellerPayout: true },
      }),
    ]);
    marketItemsCount = itemCount;
    marketRevenue = orderAgg._sum.sellerPayout || 0;
  } catch {
    // Market data unavailable
  }

  return success({
    totalAvatars,
    createdThisMonth,
    pendingReviews,
    totalStorage: Number(totalStorageRow._sum.fileSize) || 0,
    marketItemsCount,
    marketRevenue,
    recentAvatars,
    trend,
    partUsage,
  });
});
