export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error } from '@/lib/api-response';
import { withAuth, requireRole } from '@/lib/auth/middleware';

export const GET = withAuth(async (_req, _user, ctx) => {
  try {
    const { id } = await (ctx?.params as Promise<{ id: string }>);

    const board = await prisma.board.findUnique({
      where: { id },
      include: {
        _count: { select: { posts: true } },
      },
    });

    if (!board) {
      return error({ statusCode: 404, message: 'Board not found', code: 'NOT_FOUND' } as never);
    }

    return success(board);
  } catch (err) {
    return error(err);
  }
});

export const PUT = requireRole('super_admin')(async (req, _user, ctx) => {
  try {
    const { id } = await (ctx?.params as Promise<{ id: string }>);
    const body = await req.json();

    const existing = await prisma.board.findUnique({ where: { id } });
    if (!existing) {
      return error({ statusCode: 404, message: 'Board not found', code: 'NOT_FOUND' } as never);
    }

    const board = await prisma.board.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        slug: body.slug ?? existing.slug,
        description: body.description !== undefined ? body.description : existing.description,
        type: body.type ?? existing.type,
        icon: body.icon !== undefined ? body.icon : existing.icon,
        color: body.color !== undefined ? body.color : existing.color,
        sortOrder: body.sortOrder ?? existing.sortOrder,
        isActive: body.isActive ?? existing.isActive,
      },
    });

    return success(board);
  } catch (err) {
    return error(err);
  }
});

export const DELETE = requireRole('super_admin')(async (_req, _user, ctx) => {
  try {
    const { id } = await (ctx?.params as Promise<{ id: string }>);

    const existing = await prisma.board.findUnique({ where: { id } });
    if (!existing) {
      return error({ statusCode: 404, message: 'Board not found', code: 'NOT_FOUND' } as never);
    }

    await prisma.board.delete({ where: { id } });

    return success({ deleted: true });
  } catch (err) {
    return error(err);
  }
});
