export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/auth/middleware';
import { logAudit } from '@/lib/audit';

export const DELETE = withAuth(async (req, user) => {

  const id = req.url.split('/').pop()!;

  const key = await prisma.apiKey.findFirst({
    where: { id, userId: user.sub },
    select: { id: true },
  });
  if (!key) {
    return NextResponse.json({ success: false, error: 'API key not found' }, { status: 404 });
  }

  await prisma.apiKey.update({ where: { id }, data: { revoked: true } });
  logAudit({ userId: user.sub, action: 'api_key.revoke', resourceType: 'api_key', resourceId: id, req, workspaceId: user.workspaceId });
  return NextResponse.json({ success: true, data: { id, revoked: true } });
});
