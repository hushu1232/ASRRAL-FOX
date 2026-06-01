export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';
import { marketService } from '@/lib/services/market.service';
import { withAuth } from '@/lib/auth/middleware';

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId') || user.sub;
    const dashboard = await marketService.getSellerDashboard(userId);
    return success(dashboard);
  } catch (err) {
    return error(err);
  }
});
