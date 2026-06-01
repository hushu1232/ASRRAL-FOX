import { NextRequest, NextResponse } from 'next/server';
import { getPaymentProvider } from '@/lib/payment';
import { getPrisma } from '@/lib/db';
import { withAuth } from '@/lib/auth/middleware';
import { success, error as apiError } from '@/lib/api-response';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seller:payouts');

/**
 * GET /api/seller/payouts
 * List seller's payout history and accumulated balance.
 */
export const GET = withAuth(async (_req: NextRequest, user) => {
  const prisma = getPrisma();
  const payouts = await prisma.sellerPayout.findMany({
    where: { sellerId: user.sub },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const orders = await prisma.order.findMany({
    where: { item: { sellerId: user.sub }, status: 'paid' },
    select: { sellerPayout: true },
  });

  const pendingBalance = orders.reduce((sum, o) => sum + o.sellerPayout, 0);
  const totalPaid = await prisma.sellerPayout.aggregate({
    where: { sellerId: user.sub, status: 'paid' },
    _sum: { amount: true },
  });

  return success({ pendingBalance, totalPaid: totalPaid._sum.amount ?? 0, payouts });
});

/**
 * POST /api/seller/payouts
 * Request a payout of accumulated earnings.
 */
export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    const prisma = getPrisma();
    const orders = await prisma.order.findMany({
      where: { item: { sellerId: user.sub }, status: 'paid' },
      select: { sellerPayout: true },
    });

    const balance = orders.reduce((sum, o) => sum + o.sellerPayout, 0);
    if (balance <= 0) return NextResponse.json({ success: false, error: 'No balance available for payout' }, { status: 400 });

    const provider = getPaymentProvider();
    const result = await provider.createPayout({
      sellerId: user.sub,
      amount: balance,
      currency: 'cny',
      description: `Seller payout — ${balance / 100} CNY`,
    });

    if (!result.success) return NextResponse.json({ success: false, error: result.error ?? 'Payout failed' }, { status: 500 });

    const payout = await prisma.sellerPayout.create({
      data: {
        sellerId: user.sub,
        amount: balance,
        currency: 'cny',
        status: provider.isMock ? 'paid' : 'processing',
        periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        periodEnd: new Date(),
        payoutRef: result.payoutRef,
      },
    });

    await prisma.order.updateMany({
      where: { item: { sellerId: user.sub }, status: 'paid' },
      data: { status: 'completed' },
    });

    log.info({ sellerId: user.sub, amount: balance, ref: result.payoutRef }, 'Payout processed');

    return success({ payout, payoutRef: result.payoutRef });
  } catch (err) {
    log.error({ err }, 'Payout error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
});
