export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { error, paginated } from '@/lib/api-response';
import { requireRole } from '@/lib/auth/middleware';

export const GET = requireRole('workspace_admin')(async (req) => {
  try {

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    const reviewStatus = url.searchParams.get('status') || 'pending_review';

    const where = { status: reviewStatus };
    const [versions, total] = await Promise.all([
      prisma.avatarVersion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          avatar: {
            select: { id: true, name: true, creatorId: true, status: true, creator: { select: { username: true } } },
          },
        },
      }),
      prisma.avatarVersion.count({ where }),
    ]);

    const enriched = versions.map((v) => ({
      id: v.avatar.id,
      avatar_name: v.avatar.name,
      creator_id: v.avatar.creatorId,
      avatar_status: v.avatar.status,
      version_id: v.id,
      version_number: v.versionNumber,
      review_status: v.status,
      submitted_at: v.createdAt,
      review_comment: v.reviewComment,
      creator: v.avatar.creator.username,
    }));

    return paginated(enriched, total, page, pageSize);
  } catch (err) {
    return error(err);
  }
});
