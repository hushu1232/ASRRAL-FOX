export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';
import { marketService } from '@/lib/services/market.service';
import { NotFoundError, ForbiddenError } from '@/lib/errors';
import { withAuth } from '@/lib/auth/middleware';

export const GET = withAuth(async (req, user, ctx) => {
  try {
    const { id } = await (ctx!.params as Promise<{ id: string }>);

    // Check purchase
    const purchased = await marketService.hasUserPurchased(id, user.sub);
    if (!purchased) throw new ForbiddenError('Must purchase before downloading');

    // Get item for file info
    const item = await marketService.getItem(id);

    // Return file list with S3 info (actual signed URLs would be generated here in production)
    const files = (item.files as string[]) || [];
    return success({
      itemId: id,
      title: item.title,
      files: files.map((f: string) => ({
        key: f,
        url: `/api/assets/proxy?key=${encodeURIComponent(f)}`,
      })),
    });
  } catch (err) {
    return error(err);
  }
});
