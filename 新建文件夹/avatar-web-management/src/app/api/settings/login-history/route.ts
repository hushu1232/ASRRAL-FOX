export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth/middleware';

export const GET = withAuth(async (req, user) => {

  const { searchParams } = new URL(req.url);
  const limit = Math.min(20, parseInt(searchParams.get('limit') || '10'));

  const logs = await prisma.auditLog.findMany({
    where: { userId: user.sub, action: 'login' },
    select: { action: true, ipAddress: true, userAgent: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const items = logs.map(log => ({
    ip: log.ipAddress || 'unknown',
    location: '未知',
    device: log.userAgent?.slice(0, 60) || 'Unknown',
    time: log.createdAt.toISOString(),
  }));

  return NextResponse.json({ success: true, data: items });
});
