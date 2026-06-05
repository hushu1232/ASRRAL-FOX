export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error } from '@/lib/api-response';
import { withAuth } from '@/lib/auth/middleware';

export const PUT = withAuth(async (req, user, ctx) => {
  try {
    const { id } = await (ctx?.params as Promise<{ id: string }>);
    const body = await req.json();

    const reply = await prisma.reply.findUnique({ where: { id } });
    if (!reply) {
      return error({ statusCode: 404, message: 'Reply not found', code: 'NOT_FOUND' } as never);
    }
    if (reply.userId !== user.sub && user.role !== 'admin' && user.role !== 'super_admin') {
      return error({ statusCode: 403, message: 'Forbidden', code: 'FORBIDDEN' } as never);
    }

    const updated = await prisma.reply.update({
      where: { id },
      data: { content: body.content ?? reply.content },
      include: {
        user: { select: { id: true, username: true, role: true } },
      },
    });

    return success(updated);
  } catch (err) {
    return error(err);
  }
});

export const DELETE = withAuth(async (req, user, ctx) => {
  try {
    const { id } = await (ctx?.params as Promise<{ id: string }>);

    const reply = await prisma.reply.findUnique({ where: { id } });
    if (!reply) {
      return error({ statusCode: 404, message: 'Reply not found', code: 'NOT_FOUND' } as never);
    }
    if (reply.userId !== user.sub && user.role !== 'admin' && user.role !== 'super_admin') {
      return error({ statusCode: 403, message: 'Forbidden', code: 'FORBIDDEN' } as never);
    }

    await prisma.reply.delete({ where: { id } });
    await prisma.post.update({
      where: { id: reply.postId },
      data: { replyCount: { decrement: 1 } },
    });

    return success({ deleted: true });
  } catch (err) {
    return error(err);
  }
});
