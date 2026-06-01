export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { error } from '@/lib/api-response';
import { notificationService } from '@/lib/services/notification.service';

export const PUT = withAuth(async (_req, user) => {
  try {
    await notificationService.markAllRead(user.sub);
    return NextResponse.json({ success: true, data: null });
  } catch (e) {
    return error(e);
  }
});
