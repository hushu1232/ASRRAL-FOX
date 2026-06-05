export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { error, paginated } from '@/lib/api-response';
import { requireRole } from '@/lib/auth/middleware';

export const GET = requireRole('super_admin')(async (req) => {
  try {

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    const search = url.searchParams.get('search') || '';
    const role = url.searchParams.get('role') || '';
    const status = url.searchParams.get('status') || '';

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { username: { contains: search } },
        { email: { contains: search } },
      ];
    }
    if (role) where.role = role;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, username: true, email: true, role: true, status: true, lastLoginAt: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return paginated(items, total, page, pageSize);
  } catch (err) {
    return error(err);
  }
});
