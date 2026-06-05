export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { success, error, paginated } from '@/lib/api-response';
import { marketService } from '@/lib/services/market.service';
import { withAuth } from '@/lib/auth/middleware';

export const GET = withAuth(async (req, user) => {
  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');

    const result = await marketService.getSellerItems(user.sub, page, pageSize);
    return paginated(result.items, result.total, result.page, result.pageSize);
  } catch (err) {
    return error(err);
  }
});
