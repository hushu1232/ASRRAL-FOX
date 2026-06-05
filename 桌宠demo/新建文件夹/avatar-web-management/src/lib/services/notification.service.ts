import { getPrisma } from '@/lib/db';

export const notificationService = {
  async list(userId: string, page = 1, pageSize = 20) {
    const prisma = getPrisma();
    const offset = (page - 1) * pageSize;

    const where = { userId };
    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: pageSize,
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      items: items.map((n) => ({
        id: n.id,
        user_id: n.userId,
        type: n.type,
        title: n.title,
        body: n.body,
        resource_type: n.resourceType,
        resource_id: n.resourceId,
        is_read: n.isRead,
        created_at: n.createdAt,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  },

  async markAllRead(userId: string) {
    const prisma = getPrisma();
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  },

  async getUnreadCount(userId: string) {
    const prisma = getPrisma();
    const count = await prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  },

  async markOneRead(id: string, userId: string) {
    const prisma = getPrisma();
    await prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  },
};
