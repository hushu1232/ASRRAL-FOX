export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error } from '@/lib/api-response';
import { withAuth } from '@/lib/auth/middleware';

export const PUT = withAuth(async (req, user, ctx) => {
  try {
    const { id: postId } = await (ctx?.params as Promise<{ id: string }>);
    const body = await req.json();
    const { replyId } = body;

    if (!replyId) {
      return error({ statusCode: 400, message: 'replyId is required', code: 'VALIDATION_ERROR' } as never);
    }

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      return error({ statusCode: 404, message: 'Post not found', code: 'NOT_FOUND' } as never);
    }
    if (post.type !== 'qa') {
      return error({ statusCode: 400, message: 'Only Q&A posts can accept answers', code: 'NOT_QA_POST' } as never);
    }
    if (post.userId !== user.sub && user.role !== 'admin' && user.role !== 'super_admin') {
      return error({ statusCode: 403, message: 'Forbidden', code: 'FORBIDDEN' } as never);
    }

    const reply = await prisma.reply.findFirst({
      where: { id: replyId, postId },
    });
    if (!reply) {
      return error({ statusCode: 404, message: 'Reply not found', code: 'NOT_FOUND' } as never);
    }

    await prisma.reply.updateMany({
      where: { postId, isAccepted: true },
      data: { isAccepted: false },
    });

    const updated = await prisma.reply.update({
      where: { id: replyId },
      data: { isAccepted: true },
      include: {
        user: { select: { id: true, username: true, role: true } },
      },
    });

    return success(updated);
  } catch (err) {
    return error(err);
  }
});
