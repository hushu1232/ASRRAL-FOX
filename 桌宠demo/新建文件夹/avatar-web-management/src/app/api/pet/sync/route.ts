export const runtime = 'nodejs';

import { withAuth } from '@/lib/auth/middleware';
import { petService } from '@/lib/services/petService';
import { success, error } from '@/lib/api-response';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:pet:sync');

export const GET = withAuth(async (_req, user) => {
  try {
    const config = await petService.exportConfig(user.sub, user.workspaceId);
    return success(config);
  } catch (err) {
    log.error({ err }, 'Pet sync failed');
    return error(err);
  }
});
