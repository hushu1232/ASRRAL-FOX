export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth/middleware';
import { hashPassword } from '@/lib/auth/password';
import { profileUpdateSchema } from '@/lib/validators';
import { LEVEL_EXP_TABLE, LEVEL_BENEFITS, MAX_LEVEL, LEVEL_PREFIX } from '@/lib/constants';

export const GET = withAuth(async (_req, user) => {
  const u = await prisma.user.findUniqueOrThrow({
    where: { id: user.sub },
    select: {
      id: true, email: true, username: true, role: true, status: true, createdAt: true,
      level: true, exp: true, activeTitle: true, unlockedTitles: true,
      monthlyCloneUsed: true, totalLoginDays: true, lastLoginAt: true,
    },
  });
  const nextLevel = u.level < MAX_LEVEL ? u.level + 1 : u.level;
  return NextResponse.json({
    success: true,
    data: {
      ...u,
      levelPrefix: LEVEL_PREFIX[u.level],
      nextLevelExp: LEVEL_EXP_TABLE[nextLevel]?.total || null,
      benefits: LEVEL_BENEFITS[u.level],
    },
  });
});

export const PUT = withAuth(async (req, user) => {
  const body = await req.json();
  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues.map(e => e.message).join(', ') }, { status: 400 });
  }
  const { username, currentPassword, newPassword } = body;

  if (username) {
    const exists = await prisma.user.findFirst({
      where: { username, id: { not: user.sub } },
      select: { id: true },
    });
    if (exists) {
      return NextResponse.json({ success: false, error: 'Username already taken' }, { status: 409 });
    }
    await prisma.user.update({ where: { id: user.sub }, data: { username } });
  }

  if (currentPassword && newPassword) {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.sub },
      select: { passwordHash: true },
    });
    if (!dbUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    const argon2 = await import('argon2');
    const valid = await argon2.verify(dbUser.passwordHash, currentPassword);
    if (!valid) {
      return NextResponse.json({ success: false, error: 'Current password is incorrect' }, { status: 400 });
    }
    const newHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: user.sub }, data: { passwordHash: newHash } });
  }

  const updated = await prisma.user.findUnique({
    where: { id: user.sub },
    select: {
      id: true, email: true, username: true, role: true, status: true, createdAt: true,
      level: true, exp: true, activeTitle: true, unlockedTitles: true,
      monthlyCloneUsed: true, totalLoginDays: true,
    },
  });
  const nextLevel = updated!.level < MAX_LEVEL ? updated!.level + 1 : updated!.level;
  return NextResponse.json({
    success: true,
    data: {
      ...updated,
      levelPrefix: LEVEL_PREFIX[updated!.level],
      nextLevelExp: LEVEL_EXP_TABLE[nextLevel]?.total || null,
      benefits: LEVEL_BENEFITS[updated!.level],
    },
  });
});
