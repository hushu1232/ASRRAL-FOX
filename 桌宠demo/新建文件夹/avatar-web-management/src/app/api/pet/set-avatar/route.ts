export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { petService } from '@/lib/services/petService';
import { success, error } from '@/lib/api-response';
import { ValidationError } from '@/lib/errors';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:pet:set-avatar');

export const POST = withAuth(async (req, user) => {
  try {
    const body = await req.json();
    const { avatarId } = body;

    if (!avatarId) {
      return error(new ValidationError('avatarId is required'));
    }

    const config = await petService.setAvatarAsPet(user.sub, user.workspaceId, avatarId);
    log.info({ userId: user.sub, avatarId }, 'Avatar linked to pet');
    return success(config);
  } catch (err) {
    log.error({ err }, 'Failed to set pet avatar');
    return error(err);
  }
});
