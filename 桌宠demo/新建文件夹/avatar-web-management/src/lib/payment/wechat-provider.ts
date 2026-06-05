import crypto from 'crypto';
import type { IPaymentProvider, WebhookEvent } from './provider';
import type { PaymentRequest, PaymentResult, PayoutRequest, PayoutResult } from './types';
import { createLogger } from '@/lib/logger';

const log = createLogger('payment:wechat');

interface WeChatConfig {
  appId: string;              // 微信公众号/小程序 AppID
  mchId: string;              // 商户号
  apiV3Key: string;           // APIv3 密钥（32字节）
  privateKey: string;         // 商户私钥（PEM格式）
  certSerialNo: string;       // 证书序列号
  notifyUrl: string;          // 回调地址
  mode: 'sandbox' | 'live';
}

const SANDBOX_BASE = 'https://api.mch.weixin.qq.com/v3';
const LIVE_BASE = 'https://api.mch.weixin.qq.com/v3';

/**
 * WeChat Pay APIv3 direct integration.
 *
 * Flow:
 *   Native (PC QR):   POST /pay/transactions/native  → 返回 code_url → 生成二维码
 *   JSAPI (in-app):   POST /pay/transactions/jsapi    → 返回 prepay_id → 前端调起支付
 *   Notification:     POST {notifyUrl} ← 微信异步通知支付结果
 */
export class WeChatPayProvider implements IPaymentProvider {
  readonly name = 'wechat';
  readonly isMock = false;

  private config: WeChatConfig;
  private baseUrl: string;

  constructor(config: WeChatConfig) {
    this.config = config;
    this.baseUrl = config.mode === 'sandbox' ? SANDBOX_BASE : LIVE_BASE;
  }

  get isConfigured(): boolean {
    return !!(this.config.appId && this.config.mchId && this.config.apiV3Key);
  }

  // ─── Payment ─────────────────────────────────────────────

  async createPayment(req: PaymentRequest): Promise<PaymentResult> {
    if (!this.isConfigured) {
      return { success: false, transactionId: '', status: 'failed', error: 'WeChat Pay not configured' };
    }

    try {
      const outTradeNo = `WX${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
      const body = {
        appid: this.config.appId,
        mchid: this.config.mchId,
        description: req.description.slice(0, 127),
        out_trade_no: outTradeNo,
        amount: { total: req.amount, currency: req.currency === 'cny' ? 'CNY' : 'USD' },
        notify_url: this.config.notifyUrl,
      };

      const resp = await this.request('POST', '/pay/transactions/native', body);
      const data = await resp.json() as Record<string, unknown>;

      if (!resp.ok) {
        log.error({ data }, 'WeChat Pay creation failed');
        return { success: false, transactionId: outTradeNo, status: 'failed', error: String(data.message ?? 'unknown') };
      }

      // code_url is the QR code link
      const codeUrl = data.code_url as string;

      return {
        success: true,
        transactionId: outTradeNo,
        providerTxId: outTradeNo,
        status: 'pending',
        receiptUrl: codeUrl,     // ← 前端用此URL生成二维码
      };
    } catch (err) {
      log.error({ err }, 'WeChat Pay error');
      return { success: false, transactionId: '', status: 'failed', error: String(err) };
    }
  }

  async confirmPayment(providerTxId: string): Promise<PaymentResult> {
    // Query order status from WeChat
    try {
      const resp = await this.request('GET', `/pay/transactions/out-trade-no/${providerTxId}?mchid=${this.config.mchId}`);
      const data = await resp.json() as Record<string, unknown>;

      const tradeState = data.trade_state as string;
      const status = tradeState === 'SUCCESS' ? 'completed'
        : tradeState === 'CLOSED' || tradeState === 'REVOKED' ? 'failed'
        : 'pending';

      return { success: resp.ok, transactionId: providerTxId, status };
    } catch (err) {
      return { success: false, transactionId: providerTxId, status: 'failed', error: String(err) };
    }
  }

  async refundPayment(providerTxId: string, amount?: number): Promise<PaymentResult> {
    try {
      const outRefundNo = `RF${Date.now()}`;
      const body: Record<string, unknown> = { out_trade_no: providerTxId, out_refund_no: outRefundNo };
      if (amount) body.amount = { total: amount, currency: 'CNY' };

      const resp = await this.request('POST', '/refund/domestic/refunds', body);
      const data = await resp.json() as Record<string, unknown>;

      return {
        success: resp.ok,
        transactionId: outRefundNo,
        status: resp.ok ? 'refunded' : 'failed',
      };
    } catch (err) {
      return { success: false, transactionId: '', status: 'failed', error: String(err) };
    }
  }

  async createPayout(req: PayoutRequest): Promise<PayoutResult> {
    try {
      const outBatchNo = `PO${Date.now()}`;
      const body = {
        appid: this.config.appId,
        out_batch_no: outBatchNo,
        batch_name: req.description.slice(0, 32),
        batch_remark: 'AstralFox seller payout',
        total_amount: req.amount,
        total_num: 1,
        transfer_detail_list: [{
          out_detail_no: `${outBatchNo}_1`,
          transfer_amount: req.amount,
          transfer_remark: 'Seller earnings',
          openid: '', // ← Requires seller's WeChat openid (collect during seller onboarding)
        }],
      };

      const resp = await this.request('POST', '/transfer/batches', body);
      const data = await resp.json() as Record<string, unknown>;

      return {
        success: resp.ok,
        payoutRef: outBatchNo,
        error: resp.ok ? undefined : String(data.message ?? 'payout failed'),
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async verifyWebhook(payload: string, signature: string): Promise<WebhookEvent | null> {
    try {
      // Verify WeChat Pay signature
      // signature format: WECHATPAY2-SHA256-RSA2048 timestamp=xxx,nonce=xxx,signature=xxx
      const parts = parseWeChatSignature(signature);
      if (!parts) return null;

      const message = `${parts.timestamp}\n${parts.nonce}\n${payload}\n`;
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(message);
      const valid = verify.verify(this.config.privateKey, parts.signature, 'base64');
      if (!valid) return null;

      const event = JSON.parse(payload) as Record<string, unknown>;
      return {
        type: event.event_type as string ?? 'TRANSACTION.SUCCESS',
        providerTxId: (event.resource as Record<string, unknown>)?.out_trade_no as string,
        status: 'completed',
        raw: event,
      };
    } catch {
      return null;
    }
  }

  // ─── HTTP Helpers ────────────────────────────────────────

  private async request(method: string, path: string, body?: Record<string, unknown>): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    const bodyStr = body ? JSON.stringify(body) : '';

    const signature = this.sign(method, path, timestamp, nonce, bodyStr);

    return fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `WECHATPAY2-SHA256-RSA2048 mchid="${this.config.mchId}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${this.config.certSerialNo}"`,
        'User-Agent': 'AstralFox/1.0',
      },
      body: body ? bodyStr : undefined,
    });
  }

  private sign(method: string, path: string, timestamp: string, nonce: string, body: string): string {
    const message = `${method}\n${path}\n${timestamp}\n${nonce}\n${body}\n`;
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(message);
    return sign.sign(this.config.privateKey, 'base64');
  }
}

function parseWeChatSignature(header: string) {
  const m = header.match(/timestamp="(\d+)",nonce_str="(\w+)",signature="([^"]+)"/);
  if (!m) return null;
  return { timestamp: m[1], nonce: m[2], signature: m[3] };
}

/** Factory — loads config from PaymentGatewayConfig DB record. */
export function createWeChatProvider(config: {
  appId: string; mchId: string; apiV3Key: string;
  privateKey: string; certSerialNo: string; notifyUrl: string;
  mode?: 'sandbox' | 'live';
}): WeChatPayProvider {
  return new WeChatPayProvider({ ...config, mode: config.mode ?? 'sandbox' });
}
