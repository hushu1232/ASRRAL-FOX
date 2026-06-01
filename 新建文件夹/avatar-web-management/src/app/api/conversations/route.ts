export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error, paginated } from '@/lib/api-response';
import { withAuth } from '@/lib/auth/middleware';

export const GET = withAuth(async (req, user) => {
  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '30');

    const where = {
      OR: [
        { participant1Id: user.sub },
        { participant2Id: user.sub },
      ],
    };

    const [items, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          participant1: { select: { id: true, username: true, role: true } },
          participant2: { select: { id: true, username: true, role: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, content: true, senderId: true, readAt: true, createdAt: true },
          },
          _count: {
            select: {
              messages: {
                where: {
                  senderId: { not: user.sub },
                  readAt: null,
                },
              },
            },
          },
        },
      }),
      prisma.conversation.count({ where }),
    ]);

    const enriched = items.map((c) => {
      const other = c.participant1Id === user.sub ? c.participant2 : c.participant1;
      return {
        id: c.id,
        otherUser: other,
        lastMessage: c.messages[0] || null,
        unreadCount: c._count.messages,
        lastMessageAt: c.lastMessageAt,
        createdAt: c.createdAt,
      };
    });

    return paginated(enriched, total, page, pageSize);
  } catch (err) {
    return error(err);
  }
});

export const POST = withAuth(async (req, user) => {
  try {
    const body = await req.json();
    const { participantId } = body;

    if (!participantId) {
      return error({ statusCode: 400, message: 'participantId is required', code: 'VALIDATION_ERROR' } as never);
    }
    if (participantId === user.sub) {
      return error({ statusCode: 400, message: 'Cannot message yourself', code: 'VALIDATION_ERROR' } as never);
    }

    // Ensure canonical ordering: smaller id = participant1
    const [p1, p2] = [user.sub, participantId].sort();

    const existing = await prisma.conversation.findUnique({
      where: { participant1Id_participant2Id: { participant1Id: p1, participant2Id: p2 } },
      include: {
        participant1: { select: { id: true, username: true, role: true } },
        participant2: { select: { id: true, username: true, role: true } },
      },
    });

    if (existing) {
      return success(existing);
    }

    const conv = await prisma.conversation.create({
      data: { participant1Id: p1, participant2Id: p2 },
      include: {
        participant1: { select: { id: true, username: true, role: true } },
        participant2: { select: { id: true, username: true, role: true } },
      },
    });

    return success(conv, 201);
  } catch (err) {
    return error(err);
  }
});
