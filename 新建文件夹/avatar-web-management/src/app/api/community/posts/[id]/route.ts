export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error } from '@/lib/api-response';
import { withAuth } from '@/lib/auth/middleware';
import { buildReplyTree, flattenReplies } from './tree';

export const GET = withAuth(async (_req, _user, ctx) => {
  try {
    const { id } = await (ctx?.params as Promise<{ id: string }>);

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, role: true } },
        board: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!post) {
      return error({ statusCode: 404, message: 'Post not found', code: 'NOT_FOUND' } as never);
    }

    const allReplies = await prisma.reply.findMany({
      where: { postId: id },
      include: {
        user: { select: { id: true, username: true, role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const replyTree = buildReplyTree(allReplies);

    await prisma.post.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    return success({
      post: { ...post, viewCount: post.viewCount + 1 },
      replies: replyTree,
      replyCount: allReplies.length,
    });
  } catch (err) {
    return error(err);
  }
});

export const PUT = withAuth(async (req, user, ctx) => {
  try {
    const { id } = await (ctx?.params as Promise<{ id: string }>);
    const body = await req.json();

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) {
      return error({ statusCode: 404, message: 'Post not found', code: 'NOT_FOUND' } as never);
    }
    if (post.userId !== user.sub && user.role !== 'admin' && user.role !== 'super_admin') {
      return error({ statusCode: 403, message: 'Forbidden', code: 'FORBIDDEN' } as never);
    }

    const updated = await prisma.post.update({
      where: { id },
      data: {
        title: body.title ?? post.title,
        content: body.content ?? post.content,
        type: body.type ?? post.type,
        tags: body.tags ?? post.tags,
        isPinned: body.isPinned ?? post.isPinned,
        isLocked: body.isLocked ?? post.isLocked,
      },
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

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) {
      return error({ statusCode: 404, message: 'Post not found', code: 'NOT_FOUND' } as never);
    }
    if (post.userId !== user.sub && user.role !== 'admin' && user.role !== 'super_admin') {
      return error({ statusCode: 403, message: 'Forbidden', code: 'FORBIDDEN' } as never);
    }

    await prisma.post.delete({ where: { id } });
    await prisma.board.update({
      where: { id: post.boardId },
      data: { postCount: { decrement: 1 } },
    });

    return success({ deleted: true });
  } catch (err) {
    return error(err);
  }
});
