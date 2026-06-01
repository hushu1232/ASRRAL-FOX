export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { avatarCreateSchema } from '@/lib/validators';
import { ValidationError } from '@/lib/errors';
import { tryCacheHit, cacheResponse, buildCacheKey, invalidateCache, CACHE_TTL } from '@/lib/cache';
import { logAudit } from '@/lib/audit';
import { success, error, paginated } from '@/lib/api-response';
import { avatarService } from '@/lib/services/avatar.service';

export const GET = withAuth(async (req, user) => {
  try {
    const cacheKey = buildCacheKey('avatars', req.url);
    const cached = await tryCacheHit(cacheKey);
    if (cached) return cached;

    const url = new URL(req.url);
    const result = await avatarService.list(user.workspaceId, {
      page: parseInt(url.searchParams.get('page') || '1'),
      pageSize: parseInt(url.searchParams.get('pageSize') || '20'),
      search: url.searchParams.get('search') || '',
      status: url.searchParams.get('status') || '',
    });

    const response = paginated(result.items, result.total, result.page, result.pageSize);
    response.headers.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');
    response.headers.set('X-Cache', 'MISS');

    cacheResponse(cacheKey, response, CACHE_TTL.avatars);

    return response;
  } catch (err) {
    return error(err);
  }
});

export const POST = withAuth(async (req, user) => {
  try {
    const body = await req.json();
    const parsed = avatarCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map(e => e.message).join(', '));
    }

    const baseModel = parsed.data.base_model === 'male' ? '/models/base-male.glb' : '/models/base-female.glb';

    const avatar = await avatarService.create(
      { name: parsed.data.name, style: parsed.data.style, baseModel },
      user.workspaceId,
      user.sub
    );

    await invalidateCache('avatars');

    logAudit({ userId: user.sub, action: 'avatar.create', resourceType: 'avatar', resourceId: avatar.id as string, details: { name: parsed.data.name, style: parsed.data.style }, req, workspaceId: user.workspaceId });

    return success(avatar, 201);
  } catch (err) {
    return error(err);
  }
});
