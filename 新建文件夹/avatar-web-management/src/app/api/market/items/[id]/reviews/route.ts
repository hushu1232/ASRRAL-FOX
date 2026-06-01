export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { success, error, paginated } from '@/lib/api-response';
import { marketService } from '@/lib/services/market.service';
import { withAuth } from '@/lib/auth/middleware';
import { ValidationError } from '@/lib/errors';
import { logAudit } from '@/lib/audit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:market:reviews');

// Public: list reviews
export const GET = async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await ctx.params;
    const result = await marketService.listReviews(id);
    return paginated(result.items, result.total, result.page, result.pageSize);
  } catch (err) {
    return error(err);
  }
};

// Auth'd buyer: create review
export const POST = withAuth(async (req, user, ctx) => {
  try {
    const { id } = await (ctx!.params as Promise<{ id: string }>);
    const body = await req.json();

    if (!body.rating || body.rating < 1 || body.rating > 5) {
      return error(new ValidationError('rating must be 1-5'));
    }

    const review = await marketService.createReview(id, user.sub, {
      rating: body.rating,
      comment: body.comment || '',
      petScreenshot: body.petScreenshot,
    });

    logAudit({
      userId: user.sub,
      action: 'market.review',
      resourceType: 'market_item',
      resourceId: id,
      details: { reviewId: review.id, rating: body.rating },
      req,
    });

    log.info({ userId: user.sub, itemId: id }, 'Review created');
    return success(review, 201);
  } catch (err) {
    return error(err);
  }
});
