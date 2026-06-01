export const runtime = 'nodejs';

import { withAuth } from '@/lib/auth/middleware';
import { paginated, error } from '@/lib/api-response';
import { notificationService } from '@/lib/services/notification.service';

export const GET = withAuth(async (req, user) => {
  try {
    const url = req.nextUrl;
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');

    const result = await notificationService.list(user.sub, page, pageSize);
    return paginated(result.items, result.total, result.page, result.pageSize);
  } catch (e) {
    return error(e);
  }
});
