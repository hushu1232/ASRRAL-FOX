import type { IPaymentProvider, WebhookEvent } from './provider';
import type { PaymentRequest, PaymentResult, PayoutRequest, PayoutResult } from './types';
import { createLogger } from '@/lib/logger';

const log = createLogger('payment:mock');

/**
 * Mock payment provider for development and testing.
 * All payments succeed immediately. No real money involved.
 */
export class MockPaymentProvider implements IPaymentProvider {
  readonly name = 'mock';
  readonly isMock = true;

  private transactions = new Map<string, { status: string }>();

  async createPayment(req: PaymentRequest): Promise<PaymentResult> {
    const txId = `mock_tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.transactions.set(txId, { status: 'completed' });

    log.info(`[MOCK] Payment created: ${req.amount} ${req.currency} | order=${req.orderId} | tx=${txId}`);

    return {
      success: true,
      transactionId: txId,
      providerTxId: txId,
      status: 'completed',
      paymentMethod: 'card',
    };
  }

  async confirmPayment(providerTxId: string): Promise<PaymentResult> {
    return {
      success: true,
      transactionId: providerTxId,
      status: 'completed',
    };
  }

  async refundPayment(providerTxId: string, _amount?: number): Promise<PaymentResult> {
    this.transactions.set(providerTxId, { status: 'refunded' });
    return {
      success: true,
      transactionId: providerTxId,
      status: 'refunded',
    };
  }

  async createPayout(req: PayoutRequest): Promise<PayoutResult> {
    const ref = `mock_payout_${Date.now()}`;
    log.info(`[MOCK] Payout: ${req.amount} ${req.currency} → seller=${req.sellerId} | ref=${ref}`);
    return { success: true, payoutRef: ref };
  }

  async verifyWebhook(_payload: string, _signature: string): Promise<WebhookEvent | null> {
    return null; // Mock provider has no webhooks
  }
}

/** Singleton for development. */
export const mockPaymentProvider = new MockPaymentProvider();
