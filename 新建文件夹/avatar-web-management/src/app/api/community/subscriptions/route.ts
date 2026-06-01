export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error } from '@/lib/api-response';
import { withAuth } from '@/lib/auth/middleware';

export const GET = withAuth(async (req, user) => {
  try {
    const url = new URL(req.url);
    const targetType = url.searchParams.get('targetType') || '';

    const where: Record<string, unknown> = { userId: user.sub };
    if (targetType && ['board', 'post'].includes(targetType)) {
      where.targetType = targetType;
    }

    const subscriptions = await prisma.subscription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return success(subscriptions);
  } catch (err) {
    return error(err);
  }
});

export const POST = withAuth(async (req, user) => {
  try {
    const body = await req.json();
    const { targetType, targetId, notifyEmail, notifySite } = body;

    if (!targetType || !targetId || !['board', 'post'].includes(targetType)) {
      return error({ statusCode: 400, message: 'targetType must be "board" or "post"', code: 'VALIDATION_ERROR' } as never);
    }

    const existing = await prisma.subscription.findUnique({
      where: {
        userId_targetType_targetId: { userId: user.sub, targetType, targetId },
      },
    });

    if (existing) {
      await prisma.subscription.delete({ where: { id: existing.id } });
      return success({ subscribed: false });
    }

    const sub = await prisma.subscription.create({
      data: {
        userId: user.sub,
        targetType,
        targetId,
        notifyEmail: notifyEmail ?? false,
        notifySite: notifySite ?? true,
      },
    });

    return success({ subscribed: true, subscription: sub }, 201);
  } catch (err) {
    return error(err);
  }
});
