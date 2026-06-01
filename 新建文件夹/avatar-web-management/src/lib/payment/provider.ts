import type { PaymentRequest, PaymentResult, PayoutRequest, PayoutResult } from './types';

/**
 * Payment provider abstraction.
 * Implementations: StripeProvider, MockPaymentProvider.
 */
export interface IPaymentProvider {
  readonly name: string;
  readonly isMock: boolean;

  /** Create a payment intent / charge. */
  createPayment(req: PaymentRequest): Promise<PaymentResult>;

  /** Confirm a payment (if two-step flow, e.g. Alipay). */
  confirmPayment(providerTxId: string): Promise<PaymentResult>;

  /** Refund a completed payment. */
  refundPayment(providerTxId: string, amount?: number): Promise<PaymentResult>;

  /** Create a seller payout / transfer. */
  createPayout(req: PayoutRequest): Promise<PayoutResult>;

  /** Verify a webhook signature. Returns parsed event or null if invalid. */
  verifyWebhook(payload: string, signature: string): Promise<WebhookEvent | null>;
}

export interface WebhookEvent {
  type: string;
  providerTxId: string;
  status: 'completed' | 'failed' | 'refunded' | 'pending';
  amount?: number;
  raw: unknown;
}
