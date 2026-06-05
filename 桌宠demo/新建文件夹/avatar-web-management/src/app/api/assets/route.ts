export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { success, error, paginated } from '@/lib/api-response';
import { withAuth } from '@/lib/auth/middleware';
import { assetCreateSchema } from '@/lib/validators';
import { ValidationError } from '@/lib/errors';
import { tryCacheHit, cacheResponse, buildCacheKey, invalidateCache, CACHE_TTL } from '@/lib/cache';
import { logAudit } from '@/lib/audit';
import { assetService } from '@/lib/services/asset.service';

export const GET = withAuth(async (req, user) => {
  try {
    const cacheKey = buildCacheKey('assets', req.url);
    const cached = await tryCacheHit(cacheKey);
    if (cached) return cached;

    const url = new URL(req.url);
    const result = await assetService.list(user.workspaceId, {
      page: parseInt(url.searchParams.get('page') || '1'),
      pageSize: parseInt(url.searchParams.get('pageSize') || '20'),
      search: url.searchParams.get('search') || '',
      type: url.searchParams.get('type') || '',
    });

    const response = paginated(result.items, result.total, result.page, result.pageSize);
    response.headers.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');
    response.headers.set('X-Cache', 'MISS');

    cacheResponse(cacheKey, response, CACHE_TTL.assets);

    return response;
  } catch (err) {
    return error(err);
  }
});

export const POST = withAuth(async (req, user) => {
  try {
    const body = await req.json();
    const parsed = assetCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map(e => e.message).join(', '));
    }

    const asset = await assetService.create(
      {
        filename: parsed.data.filename,
        file_size: parsed.data.file_size,
        mime_type: parsed.data.mime_type,
        asset_type: parsed.data.asset_type,
        format: parsed.data.format,
        license: parsed.data.license,
        tags: parsed.data.tags,
        storage_path: body.storage_path,
        thumbnail_url: body.thumbnail_url,
      },
      user.workspaceId,
      user.sub
    );

    await invalidateCache('assets');

    logAudit({ userId: user.sub, action: 'asset.create', resourceType: 'asset', resourceId: asset.id as string, details: { filename: parsed.data.filename, assetType: parsed.data.asset_type, fileSize: parsed.data.file_size }, req, workspaceId: user.workspaceId });

    return success(asset, 201);
  } catch (err) {
    return error(err);
  }
});
