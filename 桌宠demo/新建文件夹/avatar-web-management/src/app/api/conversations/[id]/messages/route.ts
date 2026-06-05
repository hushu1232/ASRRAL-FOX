export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, paginated } from '@/lib/api-response';
import { withAuth } from '@/lib/auth/middleware';
import { broadcastToUser } from '@/lib/ws/server';

export const GET = withAuth(async (req, user, ctx) => {
  try {
    const { id: convId } = await (ctx?.params as Promise<{ id: string }>);
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '50');

    const conv = await prisma.conversation.findUnique({ where: { id: convId } });
    if (!conv) {
      return error({ statusCode: 404, message: 'Conversation not found', code: 'NOT_FOUND' } as never);
    }
    if (conv.participant1Id !== user.sub && conv.participant2Id !== user.sub) {
      return error({ statusCode: 403, message: 'Forbidden', code: 'FORBIDDEN' } as never);
    }

    const [items, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId: convId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          sender: { select: { id: true, username: true, role: true } },
        },
      }),
      prisma.message.count({ where: { conversationId: convId } }),
    ]);

    return paginated(items.reverse(), total, page, pageSize);
  } catch (err) {
    return error(err);
  }
});

export const POST = withAuth(async (req, user, ctx) => {
  try {
    const { id: convId } = await (ctx?.params as Promise<{ id: string }>);
    const body = await req.json();
    const { content } = body;

    if (!content?.trim()) {
      return error({ statusCode: 400, message: 'content is required', code: 'VALIDATION_ERROR' } as never);
    }

    const conv = await prisma.conversation.findUnique({ where: { id: convId } });
    if (!conv) {
      return error({ statusCode: 404, message: 'Conversation not found', code: 'NOT_FOUND' } as never);
    }
    if (conv.participant1Id !== user.sub && conv.participant2Id !== user.sub) {
      return error({ statusCode: 403, message: 'Forbidden', code: 'FORBIDDEN' } as never);
    }

    const [msg] = await Promise.all([
      prisma.message.create({
        data: { conversationId: convId, senderId: user.sub, content: content.trim() },
        include: {
          sender: { select: { id: true, username: true, role: true } },
        },
      }),
      prisma.conversation.update({
        where: { id: convId },
        data: { lastMessageAt: new Date() },
      }),
    ]);

    // Push to the other participant via WebSocket
    const otherId = conv.participant1Id === user.sub ? conv.participant2Id : conv.participant1Id;
    broadcastToUser(otherId, {
      type: 'message:new',
      data: {
        conversationId: convId,
        message: msg,
      },
    });

    return success(msg, 201);
  } catch (err) {
    return error(err);
  }
});
