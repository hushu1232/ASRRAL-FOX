export const runtime = 'nodejs';

import { withAuth } from '@/lib/auth/middleware';
import { petService } from '@/lib/services/petService';
import { success, error } from '@/lib/api-response';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:pet:sync');

async function exportForDesktop(userId: string, workspaceId: string) {
  return petService.exportConfig(userId, workspaceId);
}

export const GET = withAuth(async (_req, user) => {
  try {
    const config = await exportForDesktop(user.sub, user.workspaceId);
    return success(config);
  } catch (err) {
    log.error({ err }, 'Pet sync failed');
    return error(err);
  }
});

export const POST = withAuth(async (req, user) => {
  try {
    await req.json().catch(() => ({}));
    const config = await exportForDesktop(user.sub, user.workspaceId);
    return success(config);
  } catch (err) {
    log.error({ err }, 'Pet sync failed');
    return error(err);
  }
});
