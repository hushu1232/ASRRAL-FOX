export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { getUserTitleStatuses, equipTitle } from '@/lib/titles/service';
import prisma from '@/lib/prisma';

// GET /api/user/titles — list all titles with unlock status
export const GET = withAuth(async (_req, user) => {
  const u = await prisma.user.findUniqueOrThrow({
    where: { id: user.sub },
    select: { unlockedTitles: true, activeTitle: true },
  });

  const statuses = getUserTitleStatuses(u.unlockedTitles);

  return NextResponse.json({
    success: true,
    data: {
      activeTitle: u.activeTitle,
      titles: statuses,
    },
  });
});

// PUT /api/user/titles — equip a title
export const PUT = withAuth(async (req, user) => {
  const body = await req.json();
  const { activeTitle } = body; // string | null

  try {
    const newTitle = await equipTitle(user.sub, activeTitle ?? null);
    return NextResponse.json({ success: true, data: { activeTitle: newTitle } });
  } catch (err) {
    if (err instanceof Error && err.message === 'Title not unlocked') {
      return NextResponse.json(
        { success: false, error: 'Title not unlocked' },
        { status: 403 },
      );
    }
    throw err;
  }
});
