export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';
import { marketService } from '@/lib/services/market.service';
import { z } from 'zod';
import { withAuth } from '@/lib/auth/middleware';

const updateSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
  category: z.enum(['model', 'personality', 'voice', 'animation', 'theme']).optional(),
  price: z.number().min(0).optional(),
  files: z.array(z.string()).optional(),
  previewImages: z.array(z.string()).optional(),
  thumbnailUrl: z.string().nullable().optional(),
});

// Public: get item detail
export const GET = async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await ctx.params;
    const item = await marketService.getItem(id);
    return success(item);
  } catch (err) {
    return error(err);
  }
};

// Auth'd owner: update item
export const PUT = withAuth(async (req, user, ctx) => {
  try {
    const { id } = await (ctx!.params as Promise<{ id: string }>);
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return error({ statusCode: 400, message: parsed.error.issues[0]?.message || 'Invalid request', code: 'VALIDATION_ERROR' });
    }

    const item = await marketService.updateItem(id, user.sub, parsed.data as Record<string, unknown> as Parameters<typeof marketService.updateItem>[2]);
    return success(item);
  } catch (err) {
    return error(err);
  }
});

// Auth'd owner/admin: delete item
export const DELETE = withAuth(async (req, user, ctx) => {
  try {
    const { id } = await (ctx!.params as Promise<{ id: string }>);
    const isAdmin = user.role === 'super_admin' || user.role === 'workspace_admin';
    await marketService.deleteItem(id, user.sub, isAdmin);
    return success({ deleted: true });
  } catch (err) {
    return error(err);
  }
});
