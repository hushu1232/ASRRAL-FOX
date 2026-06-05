export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isRedisAvailable } from '@/lib/redis/client';
import type { PoolStats } from '@/lib/db/pool';

type ServiceStatus = 'healthy' | 'degraded' | 'unhealthy';

interface HealthResponse {
  status: ServiceStatus;
  uptime: number;
  memory: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
  };
  services: {
    prisma: { status: ServiceStatus; latencyMs?: number };
    redis: { status: ServiceStatus; available: boolean };
    storage: { status: ServiceStatus };
  };
  pool?: PoolStats;
  counts: {
    users: number;
    avatars: number;
    assets: number;
  };
  timestamp: string;
}

function memoryMB(bytes: number) {
  return Math.round((bytes / 1024 / 1024) * 100) / 100;
}

async function checkPrismaAndCounts(): Promise<{
  status: ServiceStatus;
  latencyMs: number;
  users: number;
  avatars: number;
  assets: number;
}> {
  try {
    const start = Date.now();
    const [userCount, avatarCount, assetCount] = await Promise.all([
      prisma.user.count(),
      prisma.avatar.count(),
      prisma.asset.count(),
    ]);
    return { status: 'healthy', latencyMs: Date.now() - start, users: userCount, avatars: avatarCount, assets: assetCount };
  } catch {
    return { status: 'unhealthy', latencyMs: 0, users: 0, avatars: 0, assets: 0 };
  }
}

async function getHealth(): Promise<HealthResponse> {
  const mem = process.memoryUsage();

  const prismaResult = await checkPrismaAndCounts();

  const redisAvailable = isRedisAvailable();

  let poolStats: PoolStats | undefined;
  try {
    const { getPoolStats } = await import('@/lib/db/pool');
    poolStats = getPoolStats();
  } catch { /* pool stats unavailable */ }

  return {
    status: prismaResult.status === 'healthy' ? 'healthy' : 'degraded',
    uptime: Math.floor(process.uptime()),
    memory: {
      heapUsedMB: memoryMB(mem.heapUsed),
      heapTotalMB: memoryMB(mem.heapTotal),
      rssMB: memoryMB(mem.rss),
    },
    ...(poolStats ? { pool: poolStats } : {}),
    services: {
      prisma: {
        status: prismaResult.status,
        latencyMs: prismaResult.latencyMs,
      },
      redis: {
        status: redisAvailable ? 'healthy' : 'degraded',
        available: redisAvailable,
      },
      storage: {
        status: 'healthy',
      },
    },
    counts: {
      users: prismaResult.users,
      avatars: prismaResult.avatars,
      assets: prismaResult.assets,
    },
    timestamp: new Date().toISOString(),
  };
}

export async function GET() {
  try {
    const health = await getHealth();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    return NextResponse.json(health, { status: statusCode });
  } catch (err) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: String(err),
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
