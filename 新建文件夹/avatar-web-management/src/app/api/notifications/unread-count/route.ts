export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { error } from '@/lib/api-response';
import { notificationService } from '@/lib/services/notification.service';

export const GET = withAuth(async (_req, user) => {
  try {
    const { count } = await notificationService.getUnreadCount(user.sub);
    return NextResponse.json({ success: true, data: { count } });
  } catch (e) {
    return error(e);
  }
});
