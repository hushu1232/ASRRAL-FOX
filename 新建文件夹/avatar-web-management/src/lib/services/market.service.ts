import { v4 as uuidv4 } from 'uuid';
import { getPrisma, toSnakeCase } from '@/lib/db';
import { NotFoundError, ForbiddenError } from '@/lib/errors';
import { createLogger } from '@/lib/logger';

const log = createLogger('market-service');

export interface CreateMarketItemInput {
  title: string;
  description: string;
  category: string;
  price: number;
  currency?: string;
  files: string[];
  previewImages: string[];
  thumbnailUrl?: string;
  avatarId?: string;
}

export interface MarketItemListParams {
  page?: number;
  pageSize?: number;
  category?: string;
  search?: string;
  sort?: 'latest' | 'popular' | 'rating' | 'price_asc' | 'price_desc';
  status?: string;
  sellerId?: string;
}

export const marketService = {
  // ═══ Items CRUD ═══════════════════════════════════════════

  async listItems(params: MarketItemListParams) {
    const prisma = getPrisma();
    const page = params.page || 1;
    const pageSize = Math.min(params.pageSize || 20, 50);
    const offset = (page - 1) * pageSize;

    const where: Record<string, unknown> = params.sellerId
      ? { sellerId: params.sellerId, status: 'approved' }
      : { status: 'approved' };
    if (params.category && params.category !== 'all') {
      where.category = params.category;
    }
    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    let orderBy: Record<string, string> = { createdAt: 'desc' };
    switch (params.sort) {
      case 'popular': orderBy = { downloadCount: 'desc' }; break;
      case 'rating': orderBy = { rating: 'desc' }; break;
      case 'price_asc': orderBy = { price: 'asc' }; break;
      case 'price_desc': orderBy = { price: 'desc' }; break;
    }

    const [items, total] = await Promise.all([
      prisma.marketItem.findMany({
        where,
        orderBy,
        skip: offset,
        take: pageSize,
        include: { seller: { select: { id: true, username: true } } },
      }),
      prisma.marketItem.count({ where }),
    ]);

    return {
      items: items.map((i) => ({
        ...toSnakeCase(i as unknown as Record<string, unknown>),
        seller_username: i.seller.username,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  },

  async getItem(id: string) {
    const prisma = getPrisma();
    const item = await prisma.marketItem.findUnique({
      where: { id },
      include: {
        seller: { select: { id: true, username: true } },
        reviews: {
          include: { user: { select: { id: true, username: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        _count: { select: { orders: true } },
      },
    });
    if (!item) throw new NotFoundError('MarketItem', id);

    const result = toSnakeCase(item as unknown as Record<string, unknown>);
    result.seller_username = item.seller.username;
    result.review_count = item.reviews.length;
    result.purchase_count = item._count.orders;
    result.reviews = item.reviews.map((r) => ({
      id: r.id,
      user_id: r.userId,
      username: r.user.username,
      rating: r.rating,
      comment: r.comment,
      pet_screenshot: r.petScreenshot,
      created_at: r.createdAt,
    }));
    return result;
  },

  async createItem(sellerId: string, data: CreateMarketItemInput) {
    const prisma = getPrisma();
    const id = uuidv4();

    const item = await prisma.marketItem.create({
      data: {
        id,
        sellerId,
        title: data.title,
        description: data.description || '',
        category: data.category,
        price: data.price,
        currency: data.currency || 'CNY',
        files: data.files,
        previewImages: data.previewImages,
        thumbnailUrl: data.thumbnailUrl || null,
        avatarId: data.avatarId || null,
        status: 'pending',
      },
    });

    log.info({ id, sellerId, title: data.title }, 'Market item created');
    return toSnakeCase(item as unknown as Record<string, unknown>);
  },

  async updateItem(id: string, userId: string, data: Partial<CreateMarketItemInput>) {
    const prisma = getPrisma();
    const existing = await prisma.marketItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('MarketItem', id);
    if (existing.sellerId !== userId) throw new ForbiddenError('Not item owner');

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.files !== undefined) updateData.files = data.files;
    if (data.previewImages !== undefined) updateData.previewImages = data.previewImages;
    if (data.thumbnailUrl !== undefined) updateData.thumbnailUrl = data.thumbnailUrl;
    if (data.avatarId !== undefined) updateData.avatarId = data.avatarId;

    await prisma.marketItem.update({ where: { id }, data: updateData });

    log.info({ id, userId }, 'Market item updated');
    const updated = await prisma.marketItem.findUnique({ where: { id } });
    return toSnakeCase(updated as unknown as Record<string, unknown>);
  },

  async deleteItem(id: string, userId: string, isAdmin: boolean) {
    const prisma = getPrisma();
    const existing = await prisma.marketItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('MarketItem', id);
    if (existing.sellerId !== userId && !isAdmin) throw new ForbiddenError('Not item owner');

    await prisma.marketItem.delete({ where: { id } });
    log.info({ id, userId }, 'Market item deleted');
  },

  // ═══ Purchase ══════════════════════════════════════════════

  async purchaseItem(itemId: string, buyerId: string) {
    const prisma = getPrisma();
    const item = await prisma.marketItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundError('MarketItem', itemId);
    if (item.status !== 'approved') throw new ForbiddenError('Item not available for purchase');

    // Check for duplicate purchase
    const existing = await prisma.order.findFirst({
      where: { buyerId, itemId, status: 'completed' },
    });
    if (existing) {
      // Already purchased — return the order
      return {
        order: toSnakeCase(existing as unknown as Record<string, unknown>),
        item: toSnakeCase(item as unknown as Record<string, unknown>),
        alreadyPurchased: true,
      };
    }

    const platformFee = Math.round(item.price * 0.15); // 15% platform fee
    const sellerPayout = item.price - platformFee;

    const order = await prisma.$transaction(async (tx) => {
      const o = await tx.order.create({
        data: {
          id: uuidv4(),
          buyerId,
          itemId,
          amount: item.price,
          platformFee,
          sellerPayout,
          status: 'completed',
        },
      });

      await tx.marketItem.update({
        where: { id: itemId },
        data: {
          downloadCount: { increment: 1 },
          updatedAt: new Date(),
        },
      });

      return o;
    });

    log.info({ itemId, buyerId, orderId: order.id }, 'Item purchased');
    return {
      order: toSnakeCase(order as unknown as Record<string, unknown>),
      item: toSnakeCase(item as unknown as Record<string, unknown>),
      alreadyPurchased: false,
    };
  },

  async hasUserPurchased(itemId: string, userId: string): Promise<boolean> {
    const prisma = getPrisma();
    const order = await prisma.order.findFirst({
      where: { buyerId: userId, itemId, status: 'completed' },
    });
    return !!order;
  },

  // ═══ Reviews ═══════════════════════════════════════════════

  async listReviews(itemId: string, page = 1, pageSize = 20) {
    const prisma = getPrisma();
    const offset = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where: { itemId },
        include: { user: { select: { id: true, username: true } } },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: pageSize,
      }),
      prisma.review.count({ where: { itemId } }),
    ]);

    return {
      items: items.map((r) => ({
        id: r.id,
        user_id: r.userId,
        username: r.user.username,
        rating: r.rating,
        comment: r.comment,
        pet_screenshot: r.petScreenshot,
        created_at: r.createdAt,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  },

  async createReview(itemId: string, userId: string, data: { rating: number; comment: string; petScreenshot?: string }) {
    const prisma = getPrisma();

    // Must have purchased to review
    const purchased = await this.hasUserPurchased(itemId, userId);
    if (!purchased) throw new ForbiddenError('Must purchase before reviewing');

    // One review per user per item
    const existing = await prisma.review.findFirst({ where: { itemId, userId } });
    if (existing) throw new ForbiddenError('Already reviewed this item');

    const id = uuidv4();
    const review = await prisma.review.create({
      data: {
        id,
        itemId,
        userId,
        rating: data.rating,
        comment: data.comment,
        petScreenshot: data.petScreenshot || null,
      },
    });

    // Update average rating
    const agg = await prisma.review.aggregate({
      where: { itemId },
      _avg: { rating: true },
    });
    await prisma.marketItem.update({
      where: { id: itemId },
      data: { rating: agg._avg.rating || 0, updatedAt: new Date() },
    });

    log.info({ id, itemId, userId }, 'Review created');
    return toSnakeCase(review as unknown as Record<string, unknown>);
  },

  // ═══ Seller ═════════════════════════════════════════════════

  async getSellerDashboard(sellerId: string) {
    const prisma = getPrisma();

    const [items, orders] = await Promise.all([
      prisma.marketItem.findMany({
        where: { sellerId },
        select: { id: true, downloadCount: true, rating: true, status: true },
      }),
      prisma.order.findMany({
        where: { item: { sellerId } },
        select: { amount: true, platformFee: true, sellerPayout: true, createdAt: true, status: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const totalItems = items.length;
    const approvedItems = items.filter((i) => i.status === 'approved').length;
    const totalDownloads = items.reduce((sum, i) => sum + i.downloadCount, 0);
    const completedOrders = orders.filter((o) => o.status === 'completed');

    const totalRevenue = completedOrders.reduce((sum, o) => sum + o.sellerPayout, 0);
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    const monthlyRevenue = completedOrders
      .filter((o) => new Date(o.createdAt) >= thisMonth)
      .reduce((sum, o) => sum + o.sellerPayout, 0);

    return {
      totalItems,
      approvedItems,
      totalDownloads,
      totalOrders: completedOrders.length,
      totalRevenue,
      monthlyRevenue,
      pendingPayout: totalRevenue, // simplified — no actual payout system yet
    };
  },

  async getSellerItems(sellerId: string, page = 1, pageSize = 20) {
    const prisma = getPrisma();
    const offset = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.marketItem.findMany({
        where: { sellerId },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: pageSize,
        include: { _count: { select: { orders: true } } },
      }),
      prisma.marketItem.count({ where: { sellerId } }),
    ]);

    return {
      items: items.map((i) => ({
        ...toSnakeCase(i as unknown as Record<string, unknown>),
        order_count: i._count.orders,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  },
};
