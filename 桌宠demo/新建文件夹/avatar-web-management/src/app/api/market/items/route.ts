export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { success, error, paginated } from '@/lib/api-response';
import { marketService } from '@/lib/services/market.service';
import { z } from 'zod';
import { withAuth } from '@/lib/auth/middleware';

const createSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(2000).default(''),
  category: z.enum(['model', 'personality', 'voice', 'animation', 'theme']),
  price: z.number().min(0).default(0),
  currency: z.enum(['CNY', 'USD']).default('CNY'),
  files: z.array(z.string()).default([]),
  previewImages: z.array(z.string()).default([]),
  thumbnailUrl: z.string().optional(),
  avatarId: z.string().optional(),
});

// Public: list items
export const GET = async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    const category = url.searchParams.get('category') || '';
    const search = url.searchParams.get('search') || '';
    const sort = (url.searchParams.get('sort') || 'latest') as 'latest' | 'popular' | 'rating' | 'price_asc' | 'price_desc';
    const sellerId = url.searchParams.get('sellerId') || '';

    const result = await marketService.listItems({ page, pageSize, category, search, sort, sellerId });
    const response = paginated(result.items, result.total, result.page, result.pageSize);
    response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
    return response;
  } catch (err) {
    return error(err);
  }
};

// Auth'd: create item
export const POST = withAuth(async (req, user) => {
  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return error({ statusCode: 400, message: parsed.error.issues[0]?.message || 'Invalid request', code: 'VALIDATION_ERROR' });
    }

    const item = await marketService.createItem(user.sub, parsed.data);
    return success(item, 201);
  } catch (err) {
    return error(err);
  }
});
