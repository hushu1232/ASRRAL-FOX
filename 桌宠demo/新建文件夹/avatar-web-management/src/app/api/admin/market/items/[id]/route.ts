export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { success, error } from '@/lib/api-response';
import { requireRole } from '@/lib/auth/middleware';
import { getPrisma } from '@/lib/db';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { logAudit } from '@/lib/audit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:admin:market');

// Approve or reject a market item
export const PATCH = requireRole('super_admin')(async (req, user, ctx) => {
  try {
    const { id } = await (ctx!.params as Promise<{ id: string }>);
    const body = await req.json();
    const { status, reason } = body;

    if (!['approved', 'rejected'].includes(status)) {
      return error(new ValidationError('status must be "approved" or "rejected"'));
    }

    const prisma = getPrisma();
    const item = await prisma.marketItem.findUnique({ where: { id } });
    if (!item) return error(new NotFoundError('MarketItem', id));

    await prisma.marketItem.update({
      where: { id },
      data: { status, updatedAt: new Date() },
    });

    // Notify seller
    const msg = status === 'approved'
      ? { title: `商品 "${item.title}" 已通过审核`, body: '你的商品现已上架，在市场中可见。' }
      : { title: `商品 "${item.title}" 未通过审核`, body: reason || '请检查内容后重新提交。' };

    await prisma.notification.create({
      data: {
        id: uuidv4(),
        userId: item.sellerId,
        type: status === 'approved' ? 'market_approved' : 'market_rejected',
        title: msg.title,
        body: msg.body,
        resourceType: 'market_item',
        resourceId: id,
      },
    }).catch(() => { /* non-critical */ });

    logAudit({
      userId: user.sub,
      action: `market.${status}`,
      resourceType: 'market_item',
      resourceId: id,
      details: { reason, sellerId: item.sellerId },
      req,
    });

    log.info({ itemId: id, status, adminId: user.sub }, 'Market item reviewed');
    return success({ id, status });
  } catch (err) {
    return error(err);
  }
});
