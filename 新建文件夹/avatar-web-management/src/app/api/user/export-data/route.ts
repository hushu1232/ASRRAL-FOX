export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import prisma from '@/lib/prisma';
import { createLogger } from '@/lib/logger';

const log = createLogger('gdpr-export');

// GET /api/user/export-data — GDPR data portability (machine-readable JSON)
export const GET = withAuth(async (_req, user) => {
  const userId = user.sub;

  const [profile, avatars, assets, petConfig, petSessions, marketItems, apiKeys] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, email: true, username: true, role: true, status: true,
          level: true, exp: true, activeTitle: true, unlockedTitles: true,
          totalLoginDays: true, monthlyCloneUsed: true,
          lastLoginAt: true, createdAt: true,
        },
      }),
      prisma.avatar.findMany({
        where: { creatorId: userId },
        select: { id: true, name: true, style: true, baseModel: true, status: true, createdAt: true },
      }),
      prisma.asset.findMany({
        where: { uploaderId: userId },
        select: { id: true, filename: true, assetType: true, format: true, status: true, createdAt: true },
      }),
      prisma.petConfig.findUnique({
        where: { userId },
        select: { id: true, petName: true, personality: true, animationModel: true, createdAt: true },
      }),
      prisma.petSessionLog.findMany({
        where: { userId },
        select: { id: true, startTime: true, endTime: true, interactionCount: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      }),
      prisma.marketItem.findMany({
        where: { sellerId: userId },
        select: { id: true, title: true, price: true, status: true, createdAt: true },
      }),
      prisma.apiKey.findMany({
        where: { userId },
        select: { id: true, name: true, lastUsedAt: true, createdAt: true },
      }),
    ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    userId,
    profile,
    avatars,
    assets,
    petConfig,
    petSessions: { count: petSessions.length, items: petSessions },
    marketItems,
    apiKeys: apiKeys.map((k) => ({ ...k, key: '[REDACTED]' })),
  };

  log.info({ userId }, 'GDPR data export requested');

  return NextResponse.json({
    success: true,
    data: exportData,
  });
});
