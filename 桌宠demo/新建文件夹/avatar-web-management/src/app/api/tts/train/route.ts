// POST /api/tts/train — 启动声音克隆训练（代理到 GPT-SoVITS）
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { ttsService } from '@/lib/services/ttsService';
import { success, error } from '@/lib/api-response';
import { ValidationError } from '@/lib/errors';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:tts:train');

const GPT_SOVITS_URL = process.env.GPT_SOVITS_URL || 'http://localhost:8002';

export const POST = withAuth(async (req: NextRequest, _user) => {
  try {
    const formData = await req.formData();
    const audio = formData.get('audio');
    const voiceName = formData.get('voice_name');

    if (!audio || !(audio instanceof File)) {
      return error(new ValidationError('audio file is required'));
    }
    if (!voiceName || typeof voiceName !== 'string') {
      return error(new ValidationError('voice_name is required'));
    }

    // Validate file type
    const validTypes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/flac', 'audio/x-wav'];
    if (!validTypes.includes(audio.type)) {
      return error(new ValidationError(`Unsupported audio format: ${audio.type}. Use WAV, MP3, OGG, or FLAC.`));
    }

    // Forward to GPT-SoVITS service
    const gptForm = new FormData();
    gptForm.append('audio', new Blob([await audio.arrayBuffer()], { type: audio.type }), audio.name);
    gptForm.append('voice_name', voiceName);
    gptForm.append('prompt_text', (formData.get('prompt_text') as string) || '');

    const result = await ttsService.startTraining(GPT_SOVITS_URL, gptForm);
    log.info({ taskId: result.taskId, voiceName }, 'Voice cloning training started');

    return success(result, 202);
  } catch (err) {
    log.error({ err }, 'Failed to start voice training');
    return error(err);
  }
});
