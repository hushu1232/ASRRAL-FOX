export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { success, error } from '@/lib/api-response';
import { withAuth } from '@/lib/auth/middleware';

export const POST = withAuth(async (req, user) => {
  try {
    const body = await req.json();
    const { targetType, targetId, value } = body;

    if (!targetType || !targetId || !['post', 'reply'].includes(targetType)) {
      return error({ statusCode: 400, message: 'targetType must be "post" or "reply"', code: 'VALIDATION_ERROR' } as never);
    }
    if (value !== 1 && value !== -1) {
      return error({ statusCode: 400, message: 'value must be 1 or -1', code: 'VALIDATION_ERROR' } as never);
    }

    const existing = await prisma.vote.findUnique({
      where: {
        userId_targetType_targetId: { userId: user.sub, targetType, targetId },
      },
    });

    if (existing) {
      if (existing.value === value) {
        await prisma.vote.delete({ where: { id: existing.id } });
        const delta = value === 1 ? -1 : 1;
        await updateVoteScore(targetType, targetId, delta);
        return success({ voted: false, voteScore: null });
      } else {
        await prisma.vote.update({
          where: { id: existing.id },
          data: { value },
        });
        const delta = value === 1 ? 2 : -2;
        await updateVoteScore(targetType, targetId, delta);
        return success({ voted: true, value });
      }
    }

    await prisma.vote.create({
      data: { userId: user.sub, targetType, targetId, value },
    });
    await updateVoteScore(targetType, targetId, value);

    const newScore = await getVoteScore(targetType, targetId);
    return success({ voted: true, value, voteScore: newScore }, 201);
  } catch (err) {
    return error(err);
  }
});

async function updateVoteScore(targetType: string, targetId: string, delta: number) {
  if (targetType === 'post') {
    await prisma.post.update({
      where: { id: targetId },
      data: { voteScore: { increment: delta } },
    });
  } else {
    await prisma.reply.update({
      where: { id: targetId },
      data: { voteScore: { increment: delta } },
    });
  }
}

async function getVoteScore(targetType: string, targetId: string): Promise<number> {
  if (targetType === 'post') {
    const post = await prisma.post.findUnique({ where: { id: targetId }, select: { voteScore: true } });
    return post?.voteScore ?? 0;
  }
  const reply = await prisma.reply.findUnique({ where: { id: targetId }, select: { voteScore: true } });
  return reply?.voteScore ?? 0;
}
