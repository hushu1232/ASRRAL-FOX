// GET /api/tts/train/[taskId]/status — 查询训练进度（代理到 GPT-SoVITS）
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { ttsService } from '@/lib/services/ttsService';
import { success, error } from '@/lib/api-response';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:tts:train-status');

const GPT_SOVITS_URL = process.env.GPT_SOVITS_URL || 'http://localhost:8002';

export const GET = withAuth(async (_req: NextRequest, _user, ctx) => {
  try {
    const { taskId } = (await ctx?.params) as { taskId: string };
    const status = await ttsService.getTrainingStatus(GPT_SOVITS_URL, taskId);
    return success(status);
  } catch (err) {
    log.error({ err }, 'Failed to get training status');
    return error(err);
  }
});
