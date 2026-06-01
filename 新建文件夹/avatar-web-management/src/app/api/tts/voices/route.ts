// GET /api/tts/voices — 列出已训练的自定义音色
// DELETE /api/tts/voices?voiceId=xxx — 删除自定义音色
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { ttsService } from '@/lib/services/ttsService';
import { success, error } from '@/lib/api-response';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:tts:voices');

const GPT_SOVITS_URL = process.env.GPT_SOVITS_URL || 'http://localhost:8002';

export const GET = withAuth(async (_req: NextRequest, _user) => {
  try {
    const result = await ttsService.listVoices(GPT_SOVITS_URL);
    return success(result);
  } catch (err) {
    log.error({ err }, 'Failed to list voices');
    return error(err);
  }
});

export const DELETE = withAuth(async (req: NextRequest, _user) => {
  try {
    const url = new URL(req.url);
    const voiceId = url.searchParams.get('voiceId');
    if (!voiceId) {
      return error(new (await import('@/lib/errors')).ValidationError('voiceId is required'));
    }
    await ttsService.deleteVoice(GPT_SOVITS_URL, voiceId);
    return success({ deleted: true, voiceId });
  } catch (err) {
    log.error({ err }, 'Failed to delete voice');
    return error(err);
  }
});
