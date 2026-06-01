// 桌宠 Web 预览 — API 客户端函数
import { apiGet, apiPost } from '@/lib/api-client';
import type { ChatResponse, PetPreviewConfig, StreamEvent, StreamDoneEvent } from '@/types/pet-preview';

const logPrefix = '[pet-chat-api]';

/**
 * 发送对话消息，获取 LLM 回复 + 可选 TTS 音频。
 * BFF 负责调用 Ollama LLM → 解析情绪/动作标签 → 调用 TTS → 返回统一响应。
 */
export async function sendChatMessage(
  message: string,
  history: { role: string; content: string }[],
): Promise<ChatResponse> {
  const res = await apiPost<ChatResponse>('/api/pet/chat', {
    message,
    history: history.slice(-20),
  });
  if (!res.success) throw new Error(res.error || 'Chat request failed');
  return res.data!;
}

/**
 * 流式发送对话消息，通过 SSE 逐 token 返回。
 * 返回 AbortController 用于取消。
 */
export function sendChatMessageStream(
  message: string,
  history: { role: string; content: string }[],
  callbacks: {
    onToken: (token: string) => void;
    onEmotion: (emotion: string) => void;
    onAction: (action: string) => void;
    onAudio: (audioBytes: Uint8Array) => void;
    onDone: (data: StreamDoneEvent) => void;
    onError: (error: string) => void;
  },
): AbortController {
  const abortController = new AbortController();
  const params = new URLSearchParams({
    message,
    history: JSON.stringify(history.slice(-20)),
  });

  fetch(`/api/pet/chat/stream?${params.toString()}`, {
    signal: abortController.signal,
  }).then(async (response) => {
    if (!response.ok || !response.body) {
      callbacks.onError(`HTTP ${response.status}`);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let currentEvent = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);
            switch (currentEvent) {
              case 'token':
                callbacks.onToken(parsed.token);
                break;
              case 'emotion':
                callbacks.onEmotion(parsed.emotion);
                break;
              case 'action':
                callbacks.onAction(parsed.action);
                break;
              case 'audio':
                if (parsed.base64) {
                  const binary = atob(parsed.base64);
                  const bytes = new Uint8Array(binary.length);
                  for (let i = 0; i < binary.length; i++) {
                    bytes[i] = binary.charCodeAt(i);
                  }
                  callbacks.onAudio(bytes);
                }
                break;
              case 'done':
                callbacks.onDone(parsed);
                break;
              case 'error':
                callbacks.onError(parsed.detail || 'Unknown error');
                break;
            }
          } catch { /* skip parse errors */ }
          currentEvent = '';
        }
      }
    }
  }).catch((err) => {
    if (err.name !== 'AbortError') {
      callbacks.onError(err.message || 'Stream connection failed');
    }
  });

  return abortController;
}

/**
 * 纯文本转语音。返回音频 Blob URL。
 */
export async function synthesizeSpeech(text: string): Promise<string> {
  const res = await fetch('/api/pet/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    console.error(`${logPrefix} TTS failed: ${res.status}`);
    return '';
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/**
 * 获取宠物预览配置（角色设定、模型路径、TTS 引擎等）。
 */
export async function fetchPetPreviewConfig(): Promise<PetPreviewConfig> {
  const res = await apiGet<Record<string, unknown>>('/api/pet/config');
  if (!res.success || !res.data) throw new Error(res.error || 'Failed to load pet config');

  const cfg = res.data;
  return {
    petName: (cfg.pet_name as string) || '星尘',
    personality: (cfg.personality as string) || '',
    backstory: (cfg.backstory as string) || '',
    characterExtra: '',
    animationModel: (cfg.animation_model as 'live2d' | 'vrm') || 'live2d',
    modelPath: (cfg.model_path as string) || '/models/CatTail/cattail.model3.json',
    ttsEngine: (cfg.tts_engine as 'sherpa-onnx' | 'gpt-sovits') || 'sherpa-onnx',
    customVoiceId: (cfg.custom_voice_id as string) || undefined,
    idleTimeout: (cfg.idle_timeout as number) || 300,
    wanderInterval: (cfg.wander_interval as number) || 15,
  };
}
