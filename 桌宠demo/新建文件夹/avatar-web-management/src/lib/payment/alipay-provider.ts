import crypto from 'crypto';
import type { IPaymentProvider, WebhookEvent } from './provider';
import type { PaymentRequest, PaymentResult, PayoutRequest, PayoutResult } from './types';
import { createLogger } from '@/lib/logger';

const log = createLogger('payment:alipay');

interface AlipayConfig {
  appId: string;              // 支付宝 AppID
  privateKey: string;         // 应用私钥（PEM RSA2）
  alipayPublicKey: string;    // 支付宝公钥
  notifyUrl: string;          // 异步通知地址
  returnUrl?: string;         // 同步跳转地址
  mode: 'sandbox' | 'live';
}

const SANDBOX_URL = 'https://openapi-sandbox.dl.alipaydev.com/gateway.do';
const LIVE_URL = 'https://openapi.alipay.com/gateway.do';

/**
 * Alipay (支付宝) direct integration.
 *
 * Flow:
 *   PC QR:  alipay.trade.precreate  → 返回 qr_code → 前端生成二维码
 *   Mobile: alipay.trade.wap.pay    → 302 跳转支付宝App
 *   Notify: POST {notifyUrl} ← 支付宝异步通知 trade_status=TRADE_SUCCESS
 */
export class AlipayProvider implements IPaymentProvider {
  readonly name = 'alipay';
  readonly isMock = false;

  private config: AlipayConfig;
  private gatewayUrl: string;

  constructor(config: AlipayConfig) {
    this.config = config;
    this.gatewayUrl = config.mode === 'sandbox' ? SANDBOX_URL : LIVE_URL;
  }

  get isConfigured(): boolean {
    return !!(this.config.appId && this.config.privateKey && this.config.alipayPublicKey);
  }

  // ─── Payment ─────────────────────────────────────────────

  async createPayment(req: PaymentRequest): Promise<PaymentResult> {
    if (!this.isConfigured) {
      return { success: false, transactionId: '', status: 'failed', error: 'Alipay not configured' };
    }

    try {
      const outTradeNo = `ALI${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
      const bizContent = JSON.stringify({
        out_trade_no: outTradeNo,
        total_amount: (req.amount / 100).toFixed(2),  // 分 → 元
        subject: req.description.slice(0, 256),
        body: `AstralFox: ${req.description}`.slice(0, 128),
      });

      const params = this.buildParams('alipay.trade.precreate', bizContent);
      const resp = await fetch(this.gatewayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString(),
      });
      const text = await resp.text();
      const data = JSON.parse(text) as Record<string, unknown>;
      const response = data.alipay_trade_precreate_response as Record<string, unknown>;

      if (response?.code !== '10000') {
        log.error({ response }, 'Alipay payment creation failed');
        return { success: false, transactionId: outTradeNo, status: 'failed',
          error: (response?.sub_msg as string) ?? 'unknown' };
      }

      return {
        success: true,
        transactionId: outTradeNo,
        providerTxId: outTradeNo,
        status: 'pending',
        receiptUrl: response.qr_code as string,  // ← QR code URL
      };
    } catch (err) {
      log.error({ err }, 'Alipay payment error');
      return { success: false, transactionId: '', status: 'failed', error: String(err) };
    }
  }

  async confirmPayment(providerTxId: string): Promise<PaymentResult> {
    try {
      const bizContent = JSON.stringify({ out_trade_no: providerTxId });
      const params = this.buildParams('alipay.trade.query', bizContent);
      const resp = await fetch(this.gatewayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString(),
      });
      const data = JSON.parse(await resp.text()) as Record<string, unknown>;
      const response = data.alipay_trade_query_response as Record<string, unknown>;

      return { success: true, transactionId: providerTxId, status: (response?.trade_status === 'TRADE_SUCCESS' ? 'completed' : 'pending') as PaymentResult['status'] };
    } catch {
      return { success: false, transactionId: providerTxId, status: 'failed' };
    }
  }

  async refundPayment(providerTxId: string, amount?: number): Promise<PaymentResult> {
    try {
      const outRequestNo = `RF${Date.now()}`;
      const refundAmount = amount ? (amount / 100).toFixed(2) : undefined;
      const bizContent = JSON.stringify({
        out_trade_no: providerTxId,
        refund_amount: refundAmount,
        out_request_no: outRequestNo,
      });
      const params = this.buildParams('alipay.trade.refund', bizContent);
      const resp = await fetch(this.gatewayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString(),
      });
      const data = JSON.parse(await resp.text()) as Record<string, unknown>;
      const response = data.alipay_trade_refund_response as Record<string, unknown>;

      return {
        success: response?.code === '10000',
        transactionId: outRequestNo,
        status: response?.code === '10000' ? 'refunded' : 'failed',
      };
    } catch (err) {
      return { success: false, transactionId: '', status: 'failed', error: String(err) };
    }
  }

  async createPayout(req: PayoutRequest): Promise<PayoutResult> {
    try {
      const outBizNo = `PO${Date.now()}`;
      const bizContent = JSON.stringify({
        out_biz_no: outBizNo,
        trans_amount: (req.amount / 100).toFixed(2),
        payee_type: 'ALIPAY_LOGONID',  // ← 需卖家支付宝账号
        payee_account: '',              // ← 收集卖家支付宝账号
      });
      const params = this.buildParams('alipay.fund.trans.toaccount.transfer', bizContent);
      const resp = await fetch(this.gatewayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString(),
      });
      const data = JSON.parse(await resp.text()) as Record<string, unknown>;
      const response = data.alipay_fund_trans_toaccount_transfer_response as Record<string, unknown>;

      return {
        success: response?.code === '10000',
        payoutRef: outBizNo,
        error: response?.code === '10000' ? undefined : (response?.sub_msg as string),
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async verifyWebhook(payload: string, _signature: string): Promise<WebhookEvent | null> {
    try {
      const params = new URLSearchParams(payload);
      const sign = params.get('sign');
      params.delete('sign');
      params.delete('sign_type');

      // Verify signature
      const sortedKeys = [...params.keys()].sort();
      const content = sortedKeys.map(k => `${k}=${params.get(k)}`).join('&');
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(content);
      const valid = verify.verify(this.config.alipayPublicKey, sign!, 'base64');
      if (!valid) return null;

      const tradeStatus = params.get('trade_status');
      return {
        type: `TRADE_${tradeStatus}`,
        providerTxId: params.get('out_trade_no') ?? '',
        status: tradeStatus === 'TRADE_SUCCESS' ? 'completed' : 'pending',
        raw: Object.fromEntries(params),
      };
    } catch {
      return null;
    }
  }

  // ─── Helpers ─────────────────────────────────────────────

  private buildParams(method: string, bizContent: string): Record<string, string> {
    const params: Record<string, string> = {
      app_id: this.config.appId,
      method,
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, '+08:00'),
      version: '1.0',
      biz_content: bizContent,
      notify_url: this.config.notifyUrl,
    };
    if (this.config.returnUrl) params.return_url = this.config.returnUrl;

    // Sign
    const sortedKeys = Object.keys(params).sort();
    const content = sortedKeys.map(k => `${k}=${params[k]}`).join('&');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(content);
    params.sign = sign.sign(this.config.privateKey, 'base64');

    return params;
  }
}

/** Factory */
export function createAlipayProvider(config: {
  appId: string; privateKey: string; alipayPublicKey: string;
  notifyUrl: string; returnUrl?: string; mode?: 'sandbox' | 'live';
}): AlipayProvider {
  return new AlipayProvider({ ...config, mode: config.mode ?? 'sandbox' });
}
