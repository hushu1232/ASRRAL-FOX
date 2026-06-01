export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { petService } from '@/lib/services/petService';
import { success, error } from '@/lib/api-response';
import { ValidationError } from '@/lib/errors';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:pet:config');

export const GET = withAuth(async (_req, user) => {
  try {
    const config = await petService.getOrCreateConfig(user.sub, user.workspaceId);
    return success(config);
  } catch (err) {
    log.error({ err }, 'Failed to get pet config');
    return error(err);
  }
});

export const PUT = withAuth(async (req, user) => {
  try {
    const body = await req.json();
    const allowedFields = [
      'petName', 'personality', 'backstory', 'characterExtra',
      'animationModel', 'avatarId',
      'ffmpegPath',
      'ttsLocalUrl', 'sttLocalUrl', 'llmModelPath',
      'sovitsUrl', 'sovitsReferenceVoiceId',
      'enableWakeWord', 'wakeWord', 'wakeSensitivity',
      'autoStartServices', 'pipelineTimeout',
      'modelPath',
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return error(new ValidationError('No valid fields to update'));
    }

    if (updateData.animationModel && !['live2d', 'dragonbones', 'vrm'].includes(updateData.animationModel as string)) {
      return error(new ValidationError('animationModel must be live2d, dragonbones, or vrm'));
    }

    const config = await petService.updateConfig(user.sub, user.workspaceId, updateData);
    log.info({ userId: user.sub }, 'Pet config updated');
    return success(config);
  } catch (err) {
    log.error({ err }, 'Failed to update pet config');
    return error(err);
  }
});
