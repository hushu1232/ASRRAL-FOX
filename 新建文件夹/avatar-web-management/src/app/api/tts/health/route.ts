// GET /api/tts/health — GPT-SoVITS 服务健康检查
export const runtime = 'nodejs';

import { withAuth } from '@/lib/auth/middleware';
import { ttsService } from '@/lib/services/ttsService';
import { success } from '@/lib/api-response';

const GPT_SOVITS_URL = process.env.GPT_SOVITS_URL || 'http://localhost:8002';

export const GET = withAuth(async () => {
  const health = await ttsService.healthCheck(GPT_SOVITS_URL);
  return success(health);
});
