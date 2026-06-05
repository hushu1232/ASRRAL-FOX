// POST /api/pet/tts — 文本转语音（优先 GPT-SoVITS → 降级浏览器 TTS）
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { error } from '@/lib/api-response';
import { ValidationError } from '@/lib/errors';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:pet:tts');

const GPT_SOVITS_URL = process.env.GPT_SOVITS_URL || 'http://localhost:8002';
const TTS_TIMEOUT_MS = 15000;

export const POST = withAuth(async (req: NextRequest, _user) => {
  try {
    const body = await req.json();
    const text = (body.text as string)?.trim();
    if (!text) {
      return error(new ValidationError('text is required'));
    }

    // Try GPT-SoVITS first
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);

    try {
      const ttsResp = await fetch(`${GPT_SOVITS_URL}/api/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice_id: body.voice_id || null,
          speed: body.speed || 1.0,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (ttsResp.ok) {
        const audioBytes = await ttsResp.arrayBuffer();
        const sampleRate = ttsResp.headers.get('X-Sample-Rate') || '22050';

        return new NextResponse(audioBytes, {
          status: 200,
          headers: {
            'Content-Type': 'audio/wav',
            'Cache-Control': 'no-cache',
            'X-Sample-Rate': sampleRate,
            'X-Engine': 'gpt-sovits',
          },
        });
      }
    } catch (ttsErr) {
      log.warn({ err: ttsErr }, 'GPT-SoVITS unavailable');
    } finally {
      clearTimeout(timeout);
    }

    // Fallback: return 204 → client uses browser TTS
    return new NextResponse(null, {
      status: 204,
      headers: { 'X-TTS-Status': 'unavailable' },
    });

  } catch (err) {
    log.error({ err }, 'TTS request failed');
    return error(err);
  }
});
