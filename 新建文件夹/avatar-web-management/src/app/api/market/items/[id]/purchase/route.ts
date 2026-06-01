export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { success, error } from '@/lib/api-response';
import { marketService } from '@/lib/services/market.service';
import { petService } from '@/lib/services/petService';
import { withAuth } from '@/lib/auth/middleware';
import { getPrisma } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:market:purchase');

export const POST = withAuth(async (req, user, ctx) => {
  try {
    const { id } = await (ctx!.params as Promise<{ id: string }>);
    const result = await marketService.purchaseItem(id, user.sub);

    if (!result.alreadyPurchased) {
      const prisma = getPrisma();
      const item = result.item as Record<string, unknown>;
      const itemTitle = item.title || '商品';
      const category = item.category as string;
      const avatarId = item.avatar_id as string | undefined;
      const sellerId = item.seller_id as string | undefined;

      // Auto-apply to desktop pet if model-type and linked to an avatar
      let appliedToPet = false;
      if (category === 'model' && avatarId) {
        try {
          await petService.setAvatarAsPet(user.sub, user.workspaceId, avatarId);
          appliedToPet = true;
          await prisma.marketItem.update({
            where: { id },
            data: { appliedCount: { increment: 1 } },
          });
          log.info({ userId: user.sub, itemId: id, avatarId }, 'Model auto-applied to pet');
        } catch (err) {
          log.warn({ err, userId: user.sub, itemId: id }, 'Failed to auto-apply model to pet');
        }
      }

      // Notify buyer
      const buyerBody = appliedToPet
        ? `已自动应用到你的桌面宠物！`
        : category === 'model'
          ? '请在桌宠配置页面手动应用此模型。'
          : '购买成功！商品已添加到你的库中。';

      await prisma.notification.create({
        data: {
          id: uuidv4(),
          userId: user.sub,
          type: appliedToPet ? 'pet_applied' : 'market_purchase',
          title: `已获得 "${itemTitle}"`,
          body: buyerBody,
          resourceType: 'market_item',
          resourceId: id,
        },
      }).catch(() => { /* non-critical */ });

      // Notify seller
      if (sellerId && sellerId !== user.sub) {
        await prisma.notification.create({
          data: {
            id: uuidv4(),
            userId: sellerId,
            type: 'market_sale',
            title: `你的商品 "${itemTitle}" 已售出`,
            body: `有人购买了你的商品，收入 ¥${(item.price as number / 100).toFixed(2)} 已累计到你的账户。`,
            resourceType: 'market_item',
            resourceId: id,
          },
        }).catch(() => { /* non-critical */ });
      }
    }

    logAudit({
      userId: user.sub,
      action: 'market.purchase',
      resourceType: 'market_item',
      resourceId: id,
      details: { orderId: result.order.id, alreadyPurchased: result.alreadyPurchased },
      req,
    });

    log.info({ userId: user.sub, itemId: id, orderId: result.order.id }, 'Item purchased');
    return success({
      ...result,
      message: result.alreadyPurchased ? 'Already owned — downloading again' : 'Purchase completed! Applied to desktop pet.',
    });
  } catch (err) {
    return error(err);
  }
});
