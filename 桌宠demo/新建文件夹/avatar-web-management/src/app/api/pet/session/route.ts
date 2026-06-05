export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { petService } from '@/lib/services/petService';
import { success, error } from '@/lib/api-response';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:pet:session');

export const POST = withAuth(async (req, user) => {
  try {
    const body = await req.json();
    const { action, sessionId, interactionCount, crashLog } = body;

    if (action === 'start') {
      // Get user's pet config
      const config = await petService.getConfig(user.sub, user.workspaceId);
      if (!config) {
        const created = await petService.getOrCreateConfig(user.sub, user.workspaceId);
        const cfg = created as Record<string, string>;
        const result = await petService.startSession(user.sub, cfg.id);
        return success(result, 201);
      }
      const cfg = config as Record<string, string>;
      const result = await petService.startSession(user.sub, cfg.id);
      return success(result, 201);
    }

    if (action === 'update' && sessionId) {
      await petService.updateSession(sessionId, { interactionCount, crashLog });
      return success({ updated: true });
    }

    if (action === 'end' && sessionId) {
      await petService.updateSession(sessionId, { crashLog });
      return success({ ended: true });
    }

    return error(new (await import('@/lib/errors')).ValidationError(
      'action must be "start", "update", or "end"',
    ));
  } catch (err) {
    log.error({ err }, 'Pet session API error');
    return error(err);
  }
});
