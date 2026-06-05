export const runtime = 'nodejs';

import { withAuth } from '@/lib/auth/middleware';
import { petService } from '@/lib/services/petService';
import { success, error } from '@/lib/api-response';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:pet:export');

export const GET = withAuth(async (_req, user) => {
  try {
    const exportData = await petService.exportConfig(user.sub, user.workspaceId);
    log.info({ userId: user.sub }, 'Pet config exported');
    return success(exportData);
  } catch (err) {
    log.error({ err }, 'Failed to export pet config');
    return error(err);
  }
});
