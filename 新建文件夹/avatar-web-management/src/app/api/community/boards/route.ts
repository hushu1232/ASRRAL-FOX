export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, paginated } from '@/lib/api-response';
import { withAuth, requireRole } from '@/lib/auth/middleware';

export const GET = withAuth(async (req) => {
  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '50');

    const [items, total] = await Promise.all([
      prisma.board.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.board.count({ where: { isActive: true } }),
    ]);

    return paginated(items, total, page, pageSize);
  } catch (err) {
    return error(err);
  }
});

export const POST = requireRole('super_admin')(async (req) => {
  try {
    const body = await req.json();
    const { name, slug, description, type, icon, color, sortOrder } = body;

    if (!name || !slug) {
      return error({ statusCode: 400, message: 'name and slug are required', code: 'VALIDATION_ERROR' } as never);
    }

    const board = await prisma.board.create({
      data: {
        name,
        slug,
        description: description || null,
        type: type || 'discussion',
        icon: icon || null,
        color: color || null,
        sortOrder: sortOrder || 0,
      },
    });

    return success(board, 201);
  } catch (err) {
    return error(err);
  }
});
