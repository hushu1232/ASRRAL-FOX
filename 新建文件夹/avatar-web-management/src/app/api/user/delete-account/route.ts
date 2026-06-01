export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import prisma from '@/lib/prisma';
import { createLogger } from '@/lib/logger';
import { logAudit } from '@/lib/audit';

const log = createLogger('gdpr-delete');

// POST /api/user/delete-account — GDPR right to erasure (soft delete + 30-day grace)
export const POST = withAuth(async (req: NextRequest, user) => {
  const userId = user.sub;

  let body: { confirm?: boolean; reason?: string } = {};
  try {
    body = await req.json();
  } catch { /* defaults */ }

  if (!body.confirm) {
    return NextResponse.json(
      { success: false, error: 'Must confirm account deletion by sending { confirm: true }' },
      { status: 400 },
    );
  }

  // Verify user exists and is active
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true },
  });

  if (!existing || existing.status === 'deleted') {
    return NextResponse.json(
      { success: false, error: 'Account not found or already deleted' },
      { status: 404 },
    );
  }

  // Soft delete: set status to 'deleted'
  // Retention cron job in helm/templates/retention-cronjob.yaml will hard-delete after 30 days
  await prisma.user.update({
    where: { id: userId },
    data: {
      status: 'deleted',
      // Store deletion metadata as JSON in a field we can query
      // The retention cron can check status='deleted' + updatedAt > 30 days
    },
  });

  // Mark associated data for cleanup
  await Promise.all([
    // Revoke all refresh tokens
    prisma.refreshToken.deleteMany({ where: { userId } }),
    // Expire API keys
    prisma.apiKey.updateMany({
      where: { userId },
      data: { revoked: true },
    }),
    // De-list market items
    prisma.marketItem.updateMany({
      where: { sellerId: userId },
      data: { status: 'unlisted' },
    }),
  ]);

  await logAudit({
    userId,
    action: 'account.delete',
    resourceType: 'user',
    resourceId: userId,
    details: { reason: body.reason || 'user_requested' },
    req,
  });

  log.info({ userId, reason: body.reason }, 'Account deletion requested');

  return NextResponse.json({
    success: true,
    data: {
      message: 'Account scheduled for deletion. Data will be permanently removed within 30 days. Contact support to cancel before then.',
      deletedAt: new Date().toISOString(),
      gracePeriodDays: 30,
    },
  });
});
