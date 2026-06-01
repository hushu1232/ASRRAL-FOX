export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error } from '@/lib/api-response';
import { withAuth } from '@/lib/auth/middleware';

export const POST = withAuth(async (req, user, ctx) => {
  try {
    const { id: postId } = await (ctx?.params as Promise<{ id: string }>);
    const body = await req.json();
    const { content, parentId } = body;

    if (!content) {
      return error({ statusCode: 400, message: 'content is required', code: 'VALIDATION_ERROR' } as never);
    }

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      return error({ statusCode: 404, message: 'Post not found', code: 'NOT_FOUND' } as never);
    }
    if (post.isLocked) {
      return error({ statusCode: 403, message: 'Post is locked', code: 'POST_LOCKED' } as never);
    }

    if (parentId) {
      const parentReply = await prisma.reply.findUnique({ where: { id: parentId } });
      if (!parentReply || parentReply.postId !== postId) {
        return error({ statusCode: 400, message: 'Invalid parent reply', code: 'VALIDATION_ERROR' } as never);
      }
    }

    const reply = await prisma.reply.create({
      data: {
        postId,
        userId: user.sub,
        parentId: parentId || null,
        content,
      },
      include: {
        user: { select: { id: true, username: true, role: true } },
      },
    });

    await prisma.post.update({
      where: { id: postId },
      data: { replyCount: { increment: 1 } },
    });

    return success(reply, 201);
  } catch (err) {
    return error(err);
  }
});
