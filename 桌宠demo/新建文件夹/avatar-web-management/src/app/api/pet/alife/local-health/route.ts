export const runtime = 'nodejs';

import type { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { success, error } from '@/lib/api-response';
import { getAlifeLocalHealth } from '@/lib/alife/local-health';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:pet:alife:local-health');
const NO_STORE = 'no-store';

type RouteContext = { params: Promise<unknown> };

const getLocalHealth = withAuth(async (_req, _user) => {
  try {
    const localHealth = await getAlifeLocalHealth();
    return success(localHealth);
  } catch (err) {
    log.error({ err }, 'Alife local health failed');
    return error(err);
  }
});

export async function GET(req: NextRequest, ctx?: RouteContext) {
  const response = ctx ? await getLocalHealth(req, ctx) : await getLocalHealth(req);
  response.headers.set('Cache-Control', NO_STORE);
  return response;
}
