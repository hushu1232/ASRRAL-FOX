export const runtime = 'nodejs';

import { success, error } from '@/lib/api-response';
import { withAuth } from '@/lib/auth/middleware';
import prisma from '@/lib/prisma';

export const PUT = withAuth(async (_req, user, ctx) => {
  try {
    const { id: convId } = await (ctx?.params as Promise<{ id: string }>);

    const conv = await prisma.conversation.findUnique({ where: { id: convId } });
    if (!conv) {
      return error({ statusCode: 404, message: 'Conversation not found', code: 'NOT_FOUND' } as never);
    }
    if (conv.participant1Id !== user.sub && conv.participant2Id !== user.sub) {
      return error({ statusCode: 403, message: 'Forbidden', code: 'FORBIDDEN' } as never);
    }

    const result = await prisma.message.updateMany({
      where: {
        conversationId: convId,
        senderId: { not: user.sub },
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return success({ marked: result.count });
  } catch (err) {
    return error(err);
  }
});
