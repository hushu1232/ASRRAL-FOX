// GET /api/pet/chat/stream — SSE streaming LLM chat + TTS audio
//
// Streams tokens from Ollama via Server-Sent Events.
// Synthesizes TTS per-sentence as tokens arrive.
// Event types: token, emotion, action, memory, audio, done, error
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { petService } from '@/lib/services/petService';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:pet:chat:stream');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:latest';
const OLLAMA_TIMEOUT_MS = parseInt(process.env.OLLAMA_TIMEOUT_MS || '60000', 10);
const GPT_SOVITS_URL = process.env.GPT_SOVITS_URL || 'http://localhost:8002';
const TTS_ENABLED = process.env.TTS_STREAMING_ENABLED !== 'false';

const RE_EMOTION = /\[(happy|sad|shy|angry|neutral|surprised)\]/i;
const RE_ACTION = /\[action:(\w+)\]/gi;
const RE_MEMORY = /\[memory:(.+?)\]/gi;

// Characters that signal end of a speakable sentence
const RE_SENTENCE_END = /[。！？!?.\n]/;

type TtsContext = {
  voiceId?: string;
  speed: number;
};

async function synthesizeSentence(text: string, ctx: TtsContext): Promise<Uint8Array | null> {
  if (!TTS_ENABLED || !text.trim()) return null;

  try {
    const ttsResp = await fetch(`${GPT_SOVITS_URL}/api/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.trim(),
        voice_id: ctx.voiceId || null,
        speed: ctx.speed,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!ttsResp.ok) {
      log.warn({ status: ttsResp.status, textLen: text.length }, 'TTS synthesis failed for sentence');
      return null;
    }

    return new Uint8Array(await ttsResp.arrayBuffer());
  } catch (err) {
    log.warn({ err }, 'TTS synthesis error');
    return null;
  }
}

/** Split text into speakable sentences, returning unsplit remainder. */
function extractSentences(text: string): { sentences: string[]; remainder: string } {
  const sentences: string[] = [];
  let lastEnd = 0;

  let match: RegExpExecArray | null;
  const re = new RegExp(RE_SENTENCE_END.source, 'g');
  while ((match = re.exec(text)) !== null) {
    sentences.push(text.slice(lastEnd, match.index + 1).trim());
    lastEnd = match.index + 1;
  }

  return {
    sentences: sentences.filter((s) => s.length > 0),
    remainder: text.slice(lastEnd),
  };
}

function buildSystemPrompt(config: Record<string, unknown>): string {
  const name = (config.pet_name as string) || '星尘';
  const personality = (config.personality as string) || '活泼可爱的猫耳精灵';
  const backstory = (config.backstory as string) || '';
  return `你是${name}，${personality}

背景设定：${backstory}

回复规则：
1. 用中文回复，语气自然口语化，带${name}的性格特征
2. 在回复开头用[happy/sad/shy/angry/neutral/surprised]标注情绪
3. 如有动作配合，用[action:动作名]标注
4. 如有需要记住的重要信息，用[memory:内容]标注
5. 回复长度控制在2-4句话，像真实聊天一样
6. 不要重复用户的话，不要说"作为AI"之类的话
7. 不要用markdown格式，纯文本回复`;
}

function sseEvent(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}

function sseDone(): string {
  return 'event: done\ndata: {}\n\n';
}

// @ts-expect-error — SSE stream returns raw Response, not NextResponse. withAuth wrapper accepts this at runtime.
export const GET = withAuth(async (req: NextRequest, user) => {
  const url = new URL(req.url);
  const message = url.searchParams.get('message')?.trim();
  if (!message) {
    return new Response(sseEvent('error', JSON.stringify({ detail: 'message is required' })), {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    });
  }

  // Load pet config
  let config: Record<string, unknown> = {};
  try {
    config = (await petService.getOrCreateConfig(user.sub, user.workspaceId)) as unknown as Record<string, unknown>;
  } catch {
    config = { pet_name: '星尘', personality: '活泼可爱的猫耳精灵', backstory: '' };
  }

  const systemPrompt = buildSystemPrompt(config);

  // Parse history from query params (JSON-encoded)
  let history: { role: string; content: string }[] = [];
  try {
    const raw = url.searchParams.get('history');
    if (raw) history = JSON.parse(raw);
  } catch { /* use empty history */ }

  const ollamaMessages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-20).map((h: { role: string; content: string }) => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ];

  const encoder = new TextEncoder();
  let fullText = '';

  const stream = new ReadableStream({
    async start(controller) {
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), OLLAMA_TIMEOUT_MS);

      try {
        const ollamaResp = await fetch(`${OLLAMA_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: OLLAMA_MODEL,
            messages: ollamaMessages,
            stream: true,
            options: { temperature: 0.7, top_p: 0.9, repeat_penalty: 1.1 },
          }),
          signal: abortController.signal,
        });

        if (!ollamaResp.ok || !ollamaResp.body) {
          controller.enqueue(encoder.encode(sseEvent('error', JSON.stringify({
            detail: `Ollama returned ${ollamaResp.status}`,
          }))));
          controller.enqueue(encoder.encode(sseDone()));
          controller.close();
          return;
        }

        const reader = ollamaResp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const chunk = JSON.parse(line);
              const token = chunk.message?.content || '';
              if (token) {
                fullText += token;
                controller.enqueue(encoder.encode(sseEvent('token', JSON.stringify({ token }))));
              }
            } catch { /* skip malformed JSON lines */ }
          }
        }

        // Parse full response for tags
        const emotionMatch = fullText.match(RE_EMOTION);
        if (emotionMatch) {
          controller.enqueue(encoder.encode(sseEvent('emotion', JSON.stringify({
            emotion: emotionMatch[1].toLowerCase(),
          }))));
        }

        const actions: string[] = [];
        let actMatch: RegExpExecArray | null;
        RE_ACTION.lastIndex = 0;
        while ((actMatch = RE_ACTION.exec(fullText)) !== null) {
          actions.push(actMatch[1]);
        }
        if (actions.length > 0) {
          controller.enqueue(encoder.encode(sseEvent('action', JSON.stringify({ action: actions[0] }))));
        }

        const memories: string[] = [];
        RE_MEMORY.lastIndex = 0;
        let memMatch: RegExpExecArray | null;
        while ((memMatch = RE_MEMORY.exec(fullText)) !== null) {
          memories.push(memMatch[1].trim());
        }

        // Clean text
        const cleanText = fullText
          .replace(RE_EMOTION, '')
          .replace(RE_ACTION, '')
          .replace(RE_MEMORY, '')
          .replace(/\[\/\w+\]/g, '')
          .replace(/\[cmd:\w+(?::.+?)?\]/g, '')
          .trim();

        // Per-sentence TTS synthesis
        const ttsCtx: TtsContext = {
          voiceId: (config.custom_voice_id as string) || undefined,
          speed: (config.tts_speed as number) || 1.0,
        };

        if (TTS_ENABLED && cleanText) {
          const { sentences } = extractSentences(cleanText);
          for (const sentence of sentences) {
            // Flush token events before each audio chunk
            const audioBytes = await synthesizeSentence(sentence, ttsCtx);
            if (audioBytes && audioBytes.length > 0) {
              const base64 = Buffer.from(audioBytes).toString('base64');
              controller.enqueue(encoder.encode(sseEvent('audio', JSON.stringify({
                base64,
              }))));
            }
          }
        }

        controller.enqueue(encoder.encode(sseEvent('done', JSON.stringify({
          text: cleanText,
          emotion: emotionMatch?.[1]?.toLowerCase() || 'neutral',
          action: actions[0] || null,
          memories,
        }))));

      } catch (err) {
        if (abortController.signal.aborted) {
          controller.enqueue(encoder.encode(sseEvent('error', JSON.stringify({ detail: 'Request timed out' }))));
        } else {
          controller.enqueue(encoder.encode(sseEvent('error', JSON.stringify({
            detail: (err as Error).message,
          }))));
        }
        controller.enqueue(encoder.encode(sseDone()));
      } finally {
        clearTimeout(timeout);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});
