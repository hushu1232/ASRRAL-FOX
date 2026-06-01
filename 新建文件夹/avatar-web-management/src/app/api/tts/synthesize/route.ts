// POST /api/tts/synthesize — 语音合成代理（引擎切换）
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { ttsService } from '@/lib/services/ttsService';
import { petService } from '@/lib/services/petService';
import { error } from '@/lib/api-response';
import { ValidationError } from '@/lib/errors';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:tts:synthesize');

export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    const body = await req.json();

    if (!body.text || typeof body.text !== 'string') {
      return error(new ValidationError('text is required'));
    }

    // Load pet config to determine TTS engine
    const config = await petService.getConfig(user.sub, user.workspaceId);
    const ttsConfig = {
      ttsEngine: ((config as Record<string, unknown>).tts_engine as 'sherpa-onnx' | 'gpt-sovits') || 'sherpa-onnx',
      gptSovitsUrl: process.env.GPT_SOVITS_URL || 'http://localhost:8002',
      customVoiceId: (config as Record<string, unknown>).custom_voice_id as string | undefined,
    };

    const result = await ttsService.synthesize(ttsConfig, {
      text: body.text,
      speed: body.speed || 1.0,
      speakerId: body.speaker_id || 0,
    });

    if (result.engine === 'sherpa-onnx') {
      // Desktop client handles sherpa-onnx locally — signal to use local engine
      return NextResponse.json({
        engine: 'sherpa-onnx',
        text: body.text,
        speed: body.speed || 1.0,
        speaker_id: body.speaker_id || 0,
      });
    }

    // Return GPT-SoVITS audio
    return new NextResponse(new Uint8Array(result.audioBytes), {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'X-Sample-Rate': String(result.sampleRate),
        'X-Processing-Time-Ms': String(result.durationMs),
        'X-Engine': 'gpt-sovits',
        'X-Voice-Id': result.voiceId || '',
      },
    });
  } catch (err) {
    log.error({ err }, 'TTS synthesis failed');
    return error(err);
  }
});
