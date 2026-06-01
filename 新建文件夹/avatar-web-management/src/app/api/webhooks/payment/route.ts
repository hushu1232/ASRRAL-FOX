import { NextRequest, NextResponse } from 'next/server';
import { getPaymentProvider } from '@/lib/payment';
import { getPrisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';

const log = createLogger('webhook:payment');

/**
 * POST /api/webhooks/payment
 * Receives payment confirmation webhooks from Stripe or other providers.
 */
export async function POST(req: NextRequest) {
  try {
    const prisma = getPrisma();
    const payload = await req.text();
    const signature = req.headers.get('stripe-signature') ?? '';

    const provider = getPaymentProvider();
    const event = await provider.verifyWebhook(payload, signature);

    if (!event) {
      return NextResponse.json({ received: true, status: 'ignored' });
    }

    log.info({ type: event.type, tx: event.providerTxId, status: event.status }, 'Webhook received');

    const tx = await prisma.transaction.findFirst({
      where: { providerTxId: event.providerTxId },
      include: { order: true },
    });

    if (!tx) {
      log.warn({ providerTxId: event.providerTxId }, 'Webhook: transaction not found');
      return NextResponse.json({ received: true, status: 'unknown_transaction' });
    }

    await prisma.transaction.update({
      where: { id: tx.id },
      data: {
        status: event.status,
        metadata: { ...((tx.metadata as Record<string, unknown>) ?? {}), webhook: event.raw } as never,
      },
    });

    const orderStatus = event.status === 'completed' ? 'paid'
      : event.status === 'refunded' ? 'refunded' : 'pending';

    await prisma.order.update({ where: { id: tx.orderId }, data: { status: orderStatus } });

    if (event.status === 'completed') {
      await prisma.marketItem.update({
        where: { id: tx.order.itemId },
        data: { downloadCount: { increment: 1 } },
      });
    }

    return NextResponse.json({ received: true, status: 'processed' });
  } catch (err) {
    log.error({ err }, 'Webhook error');
    return NextResponse.json({ received: false, error: 'Internal error' }, { status: 500 });
  }
}
