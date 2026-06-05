import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { withAuth } from '@/lib/auth/middleware';
import { createLogger } from '@/lib/logger';

const log = createLogger('admin:payment');

/** List all payment gateway configs. */
export const GET = withAuth(async (_req: NextRequest, user) => {
  const prisma = getPrisma();
  const configs = await prisma.paymentGatewayConfig.findMany({
    orderBy: [{ provider: 'asc' }, { mode: 'asc' }],
  });

  // Mask sensitive fields in response
  const safe = configs.map(c => ({
    ...c,
    apiKey: c.apiKey ? '••••••••' : null,
    apiSecret: c.apiSecret ? '••••••••' : null,
    publicKey: c.publicKey ? '••••••••' : null,
  }));

  return NextResponse.json({ success: true, data: safe });
});

/** Create or update a payment gateway config. */
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const prisma = getPrisma();
    const body = await req.json();

    const {
      provider, mode, isActive, displayName,
      appId, mchId, apiKey, apiSecret, certPath, publicKey,
      notifyUrl, returnUrl, config,
    } = body;

    if (!provider || !mode) {
      return NextResponse.json({ success: false, error: 'provider and mode are required' }, { status: 400 });
    }

    const existing = await prisma.paymentGatewayConfig.findUnique({
      where: { provider_mode: { provider, mode } },
    });

    let result;
    if (existing) {
      result = await prisma.paymentGatewayConfig.update({
        where: { id: existing.id },
        data: {
          isActive: isActive ?? existing.isActive,
          displayName: displayName ?? existing.displayName,
          appId: appId ?? existing.appId,
          mchId: mchId ?? existing.mchId,
          apiKey: apiKey ?? existing.apiKey,
          apiSecret: apiSecret ?? existing.apiSecret,
          certPath: certPath ?? existing.certPath,
          publicKey: publicKey ?? existing.publicKey,
          notifyUrl: notifyUrl ?? existing.notifyUrl,
          returnUrl: returnUrl ?? existing.returnUrl,
          config: config ?? existing.config,
        },
      });
      log.info({ provider, mode }, 'Payment gateway config updated');
    } else {
      result = await prisma.paymentGatewayConfig.create({
        data: {
          provider, mode, isActive: isActive ?? false, displayName,
          appId, mchId, apiKey, apiSecret, certPath, publicKey, notifyUrl, returnUrl, config,
        },
      });
      log.info({ provider, mode }, 'Payment gateway config created');
    }

    return NextResponse.json({ success: true, data: { id: result.id, provider, mode } });
  } catch (err) {
    log.error({ err }, 'Payment gateway config error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
});
