export const runtime = 'nodejs';

import { withAuth } from '@/lib/auth/middleware';
import { ttsService } from '@/lib/services/ttsService';
import { success } from '@/lib/api-response';
import { getEnv } from '@/env';

export const GET = withAuth(async () => {
  const health = await ttsService.healthCheck(getEnv().GPT_SOVITS_URL);
  return success(health);
});
