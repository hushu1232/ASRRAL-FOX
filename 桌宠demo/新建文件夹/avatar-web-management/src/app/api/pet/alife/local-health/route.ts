export const runtime = 'nodejs';

import { withAuth } from '@/lib/auth/middleware';
import { success, error } from '@/lib/api-response';
import { getAlifeLocalHealth } from '@/lib/alife/local-health';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:pet:alife:local-health');

export const GET = withAuth(async (_req, _user) => {
  try {
    const localHealth = await getAlifeLocalHealth();
    return success(localHealth);
  } catch (err) {
    log.error({ err }, 'Alife local health failed');
    return error(err);
  }
});
