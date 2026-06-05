// TTS 引擎服务 — 封装 sherpa-onnx 和 GPT-SoVITS 调用，根据配置动态选择引擎
import { createLogger } from '@/lib/logger';
import { createCircuitBreaker } from '@/lib/circuit-breaker';

const log = createLogger('tts-service');

// ─── Types ─────────────────────────────────────────────────

export type TTSEngine = 'sherpa-onnx' | 'gpt-sovits';

export interface TTSServiceConfig {
  ttsEngine: TTSEngine;
  gptSovitsUrl: string;
  customVoiceId?: string;
}

export interface SynthesizeRequest {
  text: string;
  speed?: number;
  speakerId?: number;
}

export interface SynthesizeResult {
  audioBytes: Buffer;
  sampleRate: number;
  durationMs: number;
  engine: TTSEngine;
  voiceId?: string;
}

export interface TrainTaskStatus {
  taskId: string;
  status: string;
  progress: number;
  message: string;
  voiceId?: string;
  startedAt: number;
  completedAt?: number;
  error?: string;
}

export interface VoiceEntry {
  voiceId: string;
  hasReferenceAudio: boolean;
  promptText: string;
  gptModelSizeMb: number;
  sovitsModelSizeMb: number;
}

export class SynthesizeError extends Error {
  constructor(
    message: string,
    public readonly recoverable: boolean,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'SynthesizeError';
  }
}

// ─── Circuit Breakers ─────────────────────────────────────

const gptSovitsBreaker = createCircuitBreaker({
  name: 'gpt-sovits',
  failureThreshold: 3,
  resetTimeoutMs: 30000,
});

// ─── Retry with exponential backoff ────────────────────────

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const PER_ATTEMPT_TIMEOUT_MS = 15000;

async function retryWithBackoff<T>(
  fn: (attempt: number) => Promise<T>,
  label: string,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        log.warn({ attempt, delay, err }, `${label} attempt ${attempt} failed, retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError;
}

// ─── Service ───────────────────────────────────────────────

export const ttsService = {
  /**
   * Synthesize speech. Routes to the configured TTS engine.
   */
  async synthesize(config: TTSServiceConfig, params: SynthesizeRequest): Promise<SynthesizeResult> {
    if (config.ttsEngine === 'gpt-sovits') {
      return this.synthesizeGptSovits(config, params);
    }
    return this.synthesizeSherpaOnnx(params);
  },

  /**
   * Call GPT-SoVITS service for synthesis with retry + backoff.
   */
  async synthesizeGptSovits(config: TTSServiceConfig, params: SynthesizeRequest): Promise<SynthesizeResult> {
    const url = `${config.gptSovitsUrl}/api/synthesize`;

    try {
      return await gptSovitsBreaker.execute(async () => {
        return retryWithBackoff(async (attempt) => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), PER_ATTEMPT_TIMEOUT_MS);

          try {
            const resp = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: params.text,
                voice_id: config.customVoiceId || null,
                speed: params.speed || 1.0,
              }),
              signal: controller.signal,
            });

            if (!resp.ok) {
              const detail = await resp.text();
              const statusCode = resp.status;
              // 4xx errors are non-recoverable (bad request, voice not found, etc.)
              if (statusCode >= 400 && statusCode < 500) {
                throw new SynthesizeError(
                  `GPT-SoVITS returned ${statusCode}: ${detail}`,
                  false,
                  statusCode,
                );
              }
              // 5xx are recoverable — let retryWithBackoff handle them
              throw new Error(`GPT-SoVITS returned ${statusCode}: ${detail}`);
            }

            const sampleRate = parseInt(resp.headers.get('X-Sample-Rate') || '32000', 10);
            const durationMs = parseInt(resp.headers.get('X-Processing-Time-Ms') || '0', 10);
            const voiceId = resp.headers.get('X-Voice-Id') || undefined;
            const audioBytes = Buffer.from(await resp.arrayBuffer());

            log.info(
              { textLen: params.text.length, durationMs, attempt, engine: 'gpt-sovits' },
              'TTS synthesis completed',
            );

            return {
              audioBytes,
              sampleRate,
              durationMs,
              engine: 'gpt-sovits' as TTSEngine,
              voiceId,
            };
          } finally {
            clearTimeout(timeout);
          }
        }, 'gpt-sovits-synthesize');
      });
    } catch (err) {
      if (err instanceof SynthesizeError) {
        throw err;
      }
      throw new SynthesizeError(
        `TTS synthesis failed after ${MAX_RETRIES} retries: ${err instanceof Error ? err.message : err}`,
        true,
      );
    }
  },

  /**
   * Sherpa-onnx fallback — returns empty result so the desktop client
   * handles it with its own local sherpa-onnx process.
   */
  async synthesizeSherpaOnnx(params: SynthesizeRequest): Promise<SynthesizeResult> {
    log.info({ textLen: params.text.length }, 'Delegating to desktop sherpa-onnx');
    return {
      audioBytes: Buffer.alloc(0),
      sampleRate: 22050,
      durationMs: 0,
      engine: 'sherpa-onnx',
    };
  },

  /**
   * Get GPT-SoVITS service health.
   */
  async healthCheck(gptSovitsUrl: string): Promise<{ ok: boolean; message: string }> {
    try {
      const resp = await fetch(`${gptSovitsUrl}/health`, { signal: AbortSignal.timeout(5000) });
      if (resp.ok) {
        const body = await resp.json();
        return { ok: true, message: `GPT-SoVITS v${body.version} ready (${body.device})` };
      }
      return { ok: false, message: `GPT-SoVITS returned ${resp.status}` };
    } catch (err) {
      return { ok: false, message: `GPT-SoVITS unreachable: ${err instanceof Error ? err.message : err}` };
    }
  },

  /**
   * Start voice cloning training.
   */
  async startTraining(gptSovitsUrl: string, formData: FormData): Promise<{ taskId: string; status: string; message: string }> {
    return gptSovitsBreaker.execute(async () => {
      const resp = await fetch(`${gptSovitsUrl}/api/train`, {
        method: 'POST',
        body: formData,
      });

      if (!resp.ok) {
        const detail = await resp.text();
        throw new Error(`Training start failed: ${resp.status} — ${detail}`);
      }

      return resp.json();
    });
  },

  /**
   * Get training task status.
   */
  async getTrainingStatus(gptSovitsUrl: string, taskId: string): Promise<TrainTaskStatus> {
    const resp = await fetch(`${gptSovitsUrl}/api/train/${taskId}/status`);
    if (!resp.ok) {
      const detail = await resp.text();
      throw new Error(`Status check failed: ${resp.status} — ${detail}`);
    }
    return resp.json();
  },

  /**
   * List custom trained voices.
   */
  async listVoices(gptSovitsUrl: string): Promise<{ voices: VoiceEntry[]; total: number }> {
    try {
      const resp = await fetch(`${gptSovitsUrl}/api/voices`, { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) throw new Error(`Voices list returned ${resp.status}`);
      return resp.json();
    } catch (err) {
      log.warn({ err }, 'Failed to list GPT-SoVITS voices');
      return { voices: [], total: 0 };
    }
  },

  /**
   * Delete a custom voice.
   */
  async deleteVoice(gptSovitsUrl: string, voiceId: string): Promise<void> {
    const resp = await fetch(`${gptSovitsUrl}/api/voices/${voiceId}`, { method: 'DELETE' });
    if (!resp.ok) {
      const detail = await resp.text();
      throw new Error(`Delete voice failed: ${resp.status} — ${detail}`);
    }
  },
};
