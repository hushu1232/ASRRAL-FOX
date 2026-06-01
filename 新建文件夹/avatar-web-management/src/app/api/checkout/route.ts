import { NextRequest, NextResponse } from 'next/server';
import { getPaymentProviderAsync } from '@/lib/payment';
import { getPrisma } from '@/lib/db';
import { withAuth } from '@/lib/auth/middleware';
import { success, error as apiError } from '@/lib/api-response';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:checkout');

/**
 * POST /api/checkout
 * Create a payment for a market item purchase.
 */
export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    const prisma = getPrisma();
    const body = await req.json();
    const { itemId } = body;

    if (!itemId) {
      return NextResponse.json({ success: false, error: 'itemId is required' }, { status: 400 });
    }

    // Validate item exists and is approved
    const item = await prisma.marketItem.findUnique({ where: { id: itemId } });
    if (!item) return NextResponse.json({ success: false, error: 'Market item not found' }, { status: 404 });
    if (item.status !== 'approved') return NextResponse.json({ success: false, error: 'Item is not available for purchase' }, { status: 400 });
    if (item.sellerId === user.sub) return NextResponse.json({ success: false, error: 'Cannot purchase your own item' }, { status: 400 });

    // Check for duplicate purchase
    const existing = await prisma.order.findFirst({
      where: { buyerId: user.sub, itemId, status: { not: 'cancelled' } },
    });
    if (existing) return NextResponse.json({ success: false, error: 'You already purchased this item' }, { status: 409 });

    // Calculate fees (15% platform fee)
    const platformFee = Math.ceil(item.price * 0.15);
    const sellerPayout = item.price - platformFee;

    // Create order
    const order = await prisma.order.create({
      data: {
        buyerId: user.sub,
        itemId,
        amount: item.price,
        platformFee,
        sellerPayout,
        status: 'pending',
      },
    });

    // Process payment
    const provider = await getPaymentProviderAsync();
    const result = await provider.createPayment({
      orderId: order.id,
      amount: item.price,
      currency: (item.currency as 'cny' | 'usd') || 'cny',
      description: `Purchase: ${item.title}`,
      buyerId: user.sub,
      sellerId: item.sellerId,
    });

    // Record transaction
    if (result.transactionId) {
      await prisma.transaction.create({
        data: {
          orderId: order.id,
          provider: provider.name,
          providerTxId: result.providerTxId,
          amount: item.price,
          currency: item.currency || 'cny',
          status: result.status,
          paymentMethod: result.paymentMethod,
          metadata: result as never,
        },
      });
    }

    // Update order on success
    if (result.success && result.status === 'completed') {
      await prisma.order.update({ where: { id: order.id }, data: { status: 'paid' } });
      await prisma.marketItem.update({ where: { id: itemId }, data: { downloadCount: { increment: 1 } } });
    }

    log.info({ orderId: order.id, item: item.title, amount: item.price, status: result.status }, 'Checkout completed');

    return success({
      orderId: order.id,
      transactionId: result.transactionId,
      status: result.status,
      receiptUrl: result.receiptUrl,
    });
  } catch (err) {
    log.error({ err }, 'Checkout error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
});
