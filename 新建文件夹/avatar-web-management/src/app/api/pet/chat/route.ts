// POST /api/pet/chat — LLM 对话代理（BFF → Ollama）
//
// 流程：
//   1. 接收用户消息 + 对话历史
//   2. 读取宠物配置（角色设定、性格）
//   3. 构建 System Prompt → 调用 Ollama API
//   4. 解析 LLM 输出中的 [emotion] [action:name] [memory:text] 标签
//   5. 调用 TTS 合成音频
//   6. 返回 { reply, raw, parsed, audioUrl }
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { petService } from '@/lib/services/petService';
import { error } from '@/lib/api-response';
import { ValidationError } from '@/lib/errors';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:pet:chat');

// Ollama configuration
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:latest';
const OLLAMA_TIMEOUT_MS = parseInt(process.env.OLLAMA_TIMEOUT_MS || '30000', 10);

// TTS fallback configuration
const GPT_SOVITS_URL = process.env.GPT_SOVITS_URL || 'http://localhost:8002';

// ─── System Prompt Template ──────────────────────────────

function buildSystemPrompt(config: Record<string, unknown>): string {
  const name = (config.pet_name as string) || '星尘';
  const personality = (config.personality as string) || '一只活泼可爱的猫耳精灵';
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

// ─── Tag Parsing ─────────────────────────────────────────

interface ParsedResponse {
  text: string;
  emotion: string;
  action?: string;
  memories: string[];
}

const RE_EMOTION = /\[(happy|sad|shy|angry|neutral|surprised)\]/i;
const RE_ACTION = /\[action:(\w+)\]/gi;
const RE_MEMORY = /\[memory:(.+?)\]/gi;

function parseLLMResponse(raw: string): ParsedResponse {
  let emotion = 'neutral';
  const emMatch = raw.match(RE_EMOTION);
  if (emMatch) {
    emotion = emMatch[1].toLowerCase();
  }

  const actions: string[] = [];
  let actMatch: RegExpExecArray | null;
  RE_ACTION.lastIndex = 0;
  while ((actMatch = RE_ACTION.exec(raw)) !== null) {
    actions.push(actMatch[1]);
  }

  const memories: string[] = [];
  RE_MEMORY.lastIndex = 0;
  let memMatch: RegExpExecArray | null;
  while ((memMatch = RE_MEMORY.exec(raw)) !== null) {
    memories.push(memMatch[1].trim());
  }

  // Strip tags for clean text
  let cleanText = raw
    .replace(RE_EMOTION, '')
    .replace(RE_ACTION, '')
    .replace(RE_MEMORY, '')
    .replace(/\[\/\w+\]/g, '') // closing tags like [/happy]
    .replace(/\[cmd:\w+(?::.+?)?\]/g, '')
    .trim();

  return {
    text: cleanText,
    emotion,
    action: actions[0],
    memories,
  };
}

// ─── Handler ─────────────────────────────────────────────

export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    const body = await req.json();
    const message = (body.message as string)?.trim();
    if (!message) {
      return error(new ValidationError('message is required'));
    }

    // Load pet config for personality
    let config: Record<string, unknown> = {};
    try {
      config = (await petService.getOrCreateConfig(user.sub, user.workspaceId)) as unknown as Record<string, unknown>;
    } catch {
      // Use defaults if config not found
      config = { pet_name: '星尘', personality: '活泼可爱的猫耳精灵', backstory: '' };
    }

    const systemPrompt = buildSystemPrompt(config);
    const history = (body.history as { role: string; content: string }[]) || [];

    // Build messages for Ollama
    const ollamaMessages = [
      { role: 'system', content: systemPrompt },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ];

    log.info({
      userId: user.sub,
      msgLen: message.length,
      historyLen: history.length,
    }, 'LLM chat request');

    // Call Ollama
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

    let rawResponse: string;
    try {
      const ollamaResp = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: ollamaMessages,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            repeat_penalty: 1.1,
          },
        }),
        signal: controller.signal,
      });

      if (!ollamaResp.ok) {
        const errText = await ollamaResp.text();
        throw new Error(`Ollama returned ${ollamaResp.status}: ${errText}`);
      }

      const ollamaJson = await ollamaResp.json();
      rawResponse = ollamaJson.message?.content || '（星尘此时不知道说什么好了...）';
    } catch (err) {
      if (controller.signal.aborted) {
        throw new Error('Ollama request timed out');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    // Parse response for emotion/action/memory tags
    const parsed = parseLLMResponse(rawResponse);

    log.info({
      userId: user.sub,
      emotion: parsed.emotion,
      textLen: parsed.text.length,
    }, 'LLM response received');

    // Try TTS synthesis
    let audioUrl: string | undefined;
    try {
      const ttsController = new AbortController();
      const ttsTimeout = setTimeout(() => ttsController.abort(), 15000);

      const ttsUri = config.tts_engine === 'gpt-sovits'
        ? `${GPT_SOVITS_URL}/api/synthesize`
        : null;

      if (ttsUri) {
        const ttsResp = await fetch(ttsUri, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: parsed.text,
            voice_id: (config.custom_voice_id as string) || null,
          }),
          signal: ttsController.signal,
        });

        clearTimeout(ttsTimeout);

        if (ttsResp.ok) {
          const audioBase64 = Buffer.from(await ttsResp.arrayBuffer()).toString('base64');
          audioUrl = `data:audio/wav;base64,${audioBase64}`;
        }
      }
    } catch (ttsErr) {
      log.warn({ err: ttsErr }, 'TTS synthesis failed, continuing without audio');
    }

    return NextResponse.json({
      success: true,
      data: {
        reply: parsed.text,
        raw: rawResponse,
        parsed: {
          text: parsed.text,
          emotion: parsed.emotion,
          action: parsed.action || null,
          memories: parsed.memories,
        },
        audioUrl: audioUrl || null,
      },
    });

  } catch (err) {
    log.error({ err }, 'Chat request failed');
    return error(err);
  }
});
