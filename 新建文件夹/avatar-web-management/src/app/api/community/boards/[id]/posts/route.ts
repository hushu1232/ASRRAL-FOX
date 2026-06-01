export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, paginated } from '@/lib/api-response';
import { withAuth } from '@/lib/auth/middleware';

export const GET = withAuth(async (req, _user, ctx) => {
  try {
    const { id: boardId } = await (ctx?.params as Promise<{ id: string }>);
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    const sort = url.searchParams.get('sort') || 'latest';
    const tag = url.searchParams.get('tag') || '';

    const where: Record<string, unknown> = { boardId };
    if (tag) {
      where.tags = { contains: tag };
    }

    let orderBy: Record<string, string>;
    switch (sort) {
      case 'hot':
        orderBy = { voteScore: 'desc' };
        break;
      case 'top':
        orderBy = { replyCount: 'desc' };
        break;
      default:
        orderBy = { createdAt: 'desc' };
    }

    const [items, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy: [
          { isPinned: 'desc' },
          orderBy as never,
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, username: true, role: true } },
        },
      }),
      prisma.post.count({ where }),
    ]);

    return paginated(items, total, page, pageSize);
  } catch (err) {
    return error(err);
  }
});

export const POST = withAuth(async (req, user, ctx) => {
  try {
    const { id: boardId } = await (ctx?.params as Promise<{ id: string }>);
    const body = await req.json();
    const { title, content, type, tags } = body;

    if (!title || !content) {
      return error({ statusCode: 400, message: 'title and content are required', code: 'VALIDATION_ERROR' } as never);
    }

    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) {
      return error({ statusCode: 404, message: 'Board not found', code: 'NOT_FOUND' } as never);
    }

    const post = await prisma.post.create({
      data: {
        boardId,
        userId: user.sub,
        title,
        content,
        type: type || 'discussion',
        tags: tags || '[]',
      },
      include: {
        user: { select: { id: true, username: true, role: true } },
      },
    });

    await prisma.board.update({
      where: { id: boardId },
      data: { postCount: { increment: 1 } },
    });

    return success(post, 201);
  } catch (err) {
    return error(err);
  }
});
