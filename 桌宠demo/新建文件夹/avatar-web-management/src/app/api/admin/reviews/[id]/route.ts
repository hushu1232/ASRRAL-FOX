export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth/middleware';
import { logAudit } from '@/lib/audit';

export const PUT = requireRole('workspace_admin')(async (req: NextRequest, user) => {

  const id = req.url.split('/').pop()!;
  const body = await req.json();
  const { action, comment } = body;

  if (!['approved', 'rejected'].includes(action)) {
    return NextResponse.json({ success: false, error: 'action must be approved or rejected' }, { status: 400 });
  }

  const version = await prisma.avatarVersion.findUnique({
    where: { id },
    select: { id: true, avatarId: true, status: true },
  });
  if (!version) {
    return NextResponse.json({ success: false, error: 'Version not found' }, { status: 404 });
  }
  if (version.status !== 'pending_review') {
    return NextResponse.json({ success: false, error: 'Version is not pending review' }, { status: 400 });
  }

  await prisma.avatarVersion.update({
    where: { id },
    data: { status: action, reviewComment: comment || null },
  });

  logAudit({ userId: user.sub, action: `avatar.review_${action}`, resourceType: 'avatar_version', resourceId: id, details: { avatarId: version.avatarId, comment: comment || null }, req, workspaceId: user.workspaceId });

  return NextResponse.json({ success: true, data: { id, status: action } });
});
