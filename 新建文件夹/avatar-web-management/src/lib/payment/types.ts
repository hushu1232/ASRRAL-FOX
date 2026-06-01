/** Payment provider abstraction types. */

export type PaymentCurrency = 'cny' | 'usd';
export type PaymentMethod = 'card' | 'alipay' | 'wechat';

export interface PaymentRequest {
  orderId: string;
  amount: number;          // in cents (CNY fen / USD cents)
  currency: PaymentCurrency;
  description: string;
  buyerId: string;
  sellerId: string;
  metadata?: Record<string, string>;
}

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  providerTxId?: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  paymentMethod?: PaymentMethod;
  receiptUrl?: string;
  error?: string;
}

export interface PayoutRequest {
  sellerId: string;
  amount: number;          // in cents
  currency: PaymentCurrency;
  description: string;
  metadata?: Record<string, string>;
}

export interface PayoutResult {
  success: boolean;
  payoutRef?: string;
  error?: string;
}

export type TransactionStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded';

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'completed'
  | 'refunded'
  | 'cancelled';

export type PayoutStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed';
