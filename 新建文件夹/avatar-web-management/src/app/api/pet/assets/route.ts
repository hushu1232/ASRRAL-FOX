export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { petService } from '@/lib/services/petService';
import { success, error } from '@/lib/api-response';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:pet:assets');

export const GET = withAuth(async (req, user) => {
  try {
    const url = new URL(req.url);
    const assetType = url.searchParams.get('type') || undefined;
    const assets = await petService.getAvailableAssets(user.workspaceId, assetType);
    return success(assets);
  } catch (err) {
    log.error({ err }, 'Failed to list pet assets');
    return error(err);
  }
});

export const POST = withAuth(async (req, user) => {
  try {
    const body = await req.json();
    const { assetId, assetType, slotName } = body;

    if (!assetId || !assetType || !slotName) {
      return error(new (await import('@/lib/errors')).ValidationError('assetId, assetType, and slotName are required'));
    }

    // Get config to obtain petConfigId
    const config = await petService.getConfig(user.sub, user.workspaceId);
    if (!config) {
      return error(new (await import('@/lib/errors')).NotFoundError('PetConfig', 'create a pet config first'));
    }

    const mappings = await petService.addAssetMapping(
      (config as Record<string, string>).id,
      { assetId, assetType: assetType as 'model' | 'texture' | 'animation' | 'sound', slotName },
    );

    log.info({ userId: user.sub, slotName, assetId }, 'Pet asset mapping added');
    return success(mappings, 201);
  } catch (err) {
    log.error({ err }, 'Failed to add pet asset mapping');
    return error(err);
  }
});
