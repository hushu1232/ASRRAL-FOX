export const runtime = 'nodejs';

import { success, error } from '@/lib/api-response';
import { withAuth } from '@/lib/auth/middleware';
import prisma from '@/lib/prisma';

export const GET = withAuth(async (_req, _user, ctx) => {
  try {
    const { slug } = await (ctx?.params as Promise<{ slug: string }>);

    const board = await prisma.board.findUnique({ where: { slug } });
    if (!board) {
      return error({ statusCode: 404, message: 'Board not found', code: 'NOT_FOUND' } as never);
    }

    return success(board);
  } catch (err) {
    return error(err);
  }
});
