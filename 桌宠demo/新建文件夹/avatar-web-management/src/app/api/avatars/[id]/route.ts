export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { success, error } from '@/lib/api-response';
import { withAuth } from '@/lib/auth/middleware';
import { avatarUpdateSchema } from '@/lib/validators';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { tryCacheHit, cacheResponse, buildCacheKey, invalidateCache, CACHE_TTL } from '@/lib/cache';
import { logAudit } from '@/lib/audit';
import { avatarService } from '@/lib/services/avatar.service';

export const GET = withAuth(async (req, user, ctx) => {
  try {
    const params = (await ctx?.params) as { id: string } | undefined;
    const id = params?.id || '';

    const cacheKey = buildCacheKey(`avatar-detail:${id}`, req.url);
    const cached = await tryCacheHit(cacheKey);
    if (cached) return cached;

    const result = await avatarService.getById(id, user.workspaceId);

    const response = success(result);
    response.headers.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
    response.headers.set('X-Cache', 'MISS');

    cacheResponse(cacheKey, response, CACHE_TTL.avatarDetail);

    return response;
  } catch (err) {
    return error(err);
  }
});

export const PUT = withAuth(async (req, user, ctx) => {
  try {
    const body = await req.json();
    const parsed = avatarUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map(e => e.message).join(', '));
    }

    const params = (await ctx?.params) as { id: string } | undefined;
    const id = params?.id || '';

    const updated = await avatarService.update(id, parsed.data as Record<string, unknown>, user.workspaceId);

    await invalidateCache(`avatar-detail:${id}`);
    await invalidateCache('avatars');
    logAudit({ userId: user.sub, action: 'avatar.update', resourceType: 'avatar', resourceId: id, details: parsed.data, req, workspaceId: user.workspaceId });
    return success(updated);
  } catch (err) {
    return error(err);
  }
});

export const DELETE = withAuth(async (req, user, ctx) => {
  try {
    const params = (await ctx?.params) as { id: string } | undefined;
    const id = params?.id || '';

    await avatarService.delete(id, user.workspaceId);
    await invalidateCache(`avatar-detail:${id}`);
    await invalidateCache('avatars');
    logAudit({ userId: user.sub, action: 'avatar.delete', resourceType: 'avatar', resourceId: id, req, workspaceId: user.workspaceId });
    return success({ deleted: true });
  } catch (err) {
    return error(err);
  }
});
