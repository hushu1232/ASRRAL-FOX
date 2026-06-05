/**
 * Payment module — provider factory and public API.
 *
 * Provider resolution order:
 *   1. PAYMENT_PROVIDER env var (manual override)
 *   2. Active config in payment_gateway_configs table
 *   3. Stripe if STRIPE_SECRET_KEY is set
 *   4. Mock (development fallback)
 */
import type { IPaymentProvider } from './provider';
import { mockPaymentProvider } from './mock-provider';
import { getStripeProvider } from './stripe-provider';
import { createWeChatProvider } from './wechat-provider';
import { createAlipayProvider } from './alipay-provider';
import { createLogger } from '@/lib/logger';

const log = createLogger('payment');

export type { IPaymentProvider, WebhookEvent } from './provider';
export type {
  PaymentRequest, PaymentResult,
  PayoutRequest, PayoutResult,
  PaymentCurrency, PaymentMethod,
  TransactionStatus, OrderStatus, PayoutStatus,
} from './types';

export { mockPaymentProvider } from './mock-provider';
export { getStripeProvider } from './stripe-provider';
export { createWeChatProvider } from './wechat-provider';
export { createAlipayProvider } from './alipay-provider';

// Cached provider instance
let _cachedProvider: IPaymentProvider | null = null;
let _cacheTime = 0;
const CACHE_TTL = 60_000; // 1 minute

/**
 * Get the active payment provider.
 * Loads configuration from database (payment_gateway_configs table).
 */
export async function getPaymentProviderAsync(): Promise<IPaymentProvider> {
  const now = Date.now();
  if (_cachedProvider && (now - _cacheTime) < CACHE_TTL) return _cachedProvider;

  // 1. Env override
  const forced = process.env.PAYMENT_PROVIDER;
  if (forced === 'mock') return setCache(mockPaymentProvider);

  // 2. Database config
  try {
    const { getPrisma } = await import('@/lib/db');
    const prisma = getPrisma();
    const config = await prisma.paymentGatewayConfig.findFirst({
      where: { isActive: true },
    });

    if (config) {
      const provider = createProviderFromDb(config);
      if (provider) {
        log.info({ provider: config.provider, mode: config.mode }, 'Payment provider loaded from DB');
        return setCache(provider);
      }
    }
  } catch (err) {
    log.warn({ err }, 'Failed to load payment config from DB, falling back');
  }

  // 3. Stripe env fallback
  const stripe = getStripeProvider();
  if (forced === 'stripe' || stripe.isConfigured) {
    return setCache(stripe);
  }

  // 4. Mock
  log.info('Using mock payment provider');
  return setCache(mockPaymentProvider);
}

/** Synchronous version for non-async contexts (returns mock if DB not loaded). */
export function getPaymentProvider(): IPaymentProvider {
  const forced = process.env.PAYMENT_PROVIDER;
  if (forced === 'mock') return mockPaymentProvider;

  const stripe = getStripeProvider();
  if (forced === 'stripe' || stripe.isConfigured) return stripe;

  return mockPaymentProvider;
}

function setCache(p: IPaymentProvider): IPaymentProvider {
  _cachedProvider = p;
  _cacheTime = Date.now();
  return p;
}

function createProviderFromDb(config: Record<string, unknown>): IPaymentProvider | null {
  const { provider, mode, appId, mchId, apiKey, apiSecret, certPath, publicKey, notifyUrl, returnUrl } = config as Record<string, string | null>;

  switch (provider) {
    case 'wechat':
      if (!appId || !mchId || !apiKey || !apiSecret || !notifyUrl) {
        log.warn('WeChat Pay config incomplete');
        return null;
      }
      return createWeChatProvider({
        appId, mchId, apiV3Key: apiKey, privateKey: apiSecret,
        certSerialNo: certPath ?? '', notifyUrl,
        mode: (mode as 'sandbox' | 'live') ?? 'sandbox',
      });

    case 'alipay':
      if (!appId || !apiKey || !publicKey || !notifyUrl) {
        log.warn('Alipay config incomplete');
        return null;
      }
      return createAlipayProvider({
        appId, privateKey: apiKey, alipayPublicKey: publicKey,
        notifyUrl, returnUrl: returnUrl ?? undefined,
        mode: (mode as 'sandbox' | 'live') ?? 'sandbox',
      });

    case 'stripe':
      return getStripeProvider();

    default:
      return null;
  }
}
