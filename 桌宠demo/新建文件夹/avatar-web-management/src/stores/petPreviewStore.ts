// 桌宠 Web 预览 — Zustand 状态管理
'use client';

import { create } from 'zustand';
import type { ChatMessage, EmotionTag, VoiceState, PetPreviewConfig } from '@/types/pet-preview';
import { sendChatMessage, sendChatMessageStream, synthesizeSpeech, fetchPetPreviewConfig } from '@/lib/api/pet-chat';
import { getAudioStreamPlayer } from '@/lib/audio/stream-player';

interface PetPreviewState {
  // ─── Config ───────────────────────────────────────────
  config: PetPreviewConfig | null;
  configLoading: boolean;
  configError: string | null;
  loadConfig: () => Promise<void>;

  // ─── Chat ─────────────────────────────────────────────
  messages: ChatMessage[];
  voiceState: VoiceState;
  isProcessing: boolean;
  streamAbortController: AbortController | null;
  sendMessage: (text: string) => Promise<void>;
  cancelStream: () => void;
  clearMessages: () => void;

  // ─── Model State ──────────────────────────────────────
  currentEmotion: EmotionTag;
  currentAction: string | undefined;
  setEmotion: (e: EmotionTag) => void;
  setAction: (a: string | undefined) => void;

  // ─── Audio ────────────────────────────────────────────
  audioElement: HTMLAudioElement | null;
  setAudioElement: (el: HTMLAudioElement | null) => void;

  // ─── Voice Input ──────────────────────────────────────
  voiceActive: boolean;
  voiceText: string;
  voiceSupported: boolean;
  setVoiceActive: (v: boolean) => void;
  setVoiceText: (v: string) => void;
  setVoiceSupported: (v: boolean) => void;

  // ─── Time Awareness / Behavior ────────────────────────
  bubbleMessage: string | null;
  bubbleEmotion: EmotionTag;
  nightMode: boolean;
  showBubble: (message: string, emotion: EmotionTag) => void;
  dismissBubble: () => void;
  setNightMode: (v: boolean) => void;
}

const STREAM_TIMEOUT_MS = 60000;

let msgCounter = 0;
function nextMsgId(): string {
  return `msg_${++msgCounter}_${Date.now()}`;
}

export const usePetPreviewStore = create<PetPreviewState>((set, get) => ({
  // ─── Config ─────────────────────────────────────────────
  config: null,
  configLoading: false,
  configError: null,

  loadConfig: async () => {
    set({ configLoading: true, configError: null });
    try {
      const config = await fetchPetPreviewConfig();
      set({ config, configLoading: false });
    } catch (err) {
      set({
        configError: err instanceof Error ? err.message : '配置加载失败',
        configLoading: false,
      });
    }
  },

  // ─── Chat ───────────────────────────────────────────────
  messages: [],
  voiceState: 'idle' as VoiceState,
  isProcessing: false,
  streamAbortController: null,

  sendMessage: async (text: string) => {
    const { messages, config } = get();
    if (!text.trim() || get().isProcessing) return;

    const userMsg: ChatMessage = {
      id: nextMsgId(),
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    };

    // Create a placeholder assistant message for streaming
    const assistantId = nextMsgId();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    set((s) => ({
      messages: [...s.messages, userMsg, assistantMsg],
      voiceState: 'thinking',
      isProcessing: true,
    }));

    try {
      const history = get().messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(0, -1)
        .map((m) => ({
          role: m.role,
          content: m.rawContent || m.content,
        }));

      let streamedText = '';
      let streamedEmotion = 'neutral' as EmotionTag;
      let streamedAction: string | undefined;

      const audioPlayer = getAudioStreamPlayer();
      audioPlayer.reset();

      const abortController = sendChatMessageStream(text.trim(), history, {
        onToken: (token) => {
          streamedText += token;
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantId ? { ...m, content: streamedText } : m,
            ),
          }));
        },
        onEmotion: (emotion) => {
          streamedEmotion = emotion as EmotionTag;
          set({ currentEmotion: streamedEmotion });
        },
        onAction: (action) => {
          streamedAction = action;
          set({ currentAction: streamedAction });
        },
        onAudio: (audioBytes) => {
          audioPlayer.enqueue(audioBytes);
          if (!audioPlayer.isPlaying) {
            set({ voiceState: 'speaking' });
          }
        },
        onDone: (data) => {
          streamedText = data.text;
          streamedEmotion = data.emotion;
          streamedAction = data.action || undefined;
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantId
                ? { ...m, content: data.text, rawContent: streamedText }
                : m,
            ),
            currentEmotion: data.emotion,
            currentAction: data.action || undefined,
          }));
        },
        onError: (error) => {
          console.error('[PetPreview] Stream error:', error);
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantId && !m.content
                ? { ...m, content: '喵... 星尘的 AI 大脑暂时短路了，稍等一下再试试吧～' }
                : m,
            ),
          }));
        },
      });

      set({ streamAbortController: abortController });

      // Wait for stream to complete (polling approach)
      await new Promise<void>((resolve) => {
        const check = () => {
          const msg = get().messages.find((m) => m.id === assistantId);
          // Stream is done when we have content that doesn't change, or after timeout
          if (!get().isProcessing) {
            resolve();
          } else {
            setTimeout(check, 100);
          }
        };
        // Also resolve on stream complete via a max wait
        setTimeout(() => {
          set({ isProcessing: false, voiceState: 'idle' });
          resolve();
        }, STREAM_TIMEOUT_MS);
      });

      // After stream completes, if no server-side TTS audio was queued, use browser TTS fallback
      const player = getAudioStreamPlayer();
      if (!player.isPlaying && streamedText) {
        set({ voiceState: 'speaking' });
        try {
          await speakWithBrowserTTS(streamedText);
        } catch { /* browser TTS failed */ }
        set({ voiceState: 'idle' });
      } else if (player.isPlaying) {
        // Wait for audio queue to finish, or timeout after 30s
        const startWait = Date.now();
        while (player.isPlaying && Date.now() - startWait < 30000) {
          await new Promise((r) => setTimeout(r, 200));
        }
        set({ voiceState: 'idle' });
      } else {
        set({ voiceState: 'idle' });
      }
    } catch (err) {
      console.error('[PetPreview] Chat error:', err);
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === assistantId && !m.content
            ? { ...m, content: '喵... 星尘的 AI 大脑暂时短路了，稍等一下再试试吧～' }
            : m,
        ),
        voiceState: 'idle',
      }));
    } finally {
      set({ isProcessing: false, streamAbortController: null });
    }
  },

  cancelStream: () => {
    const { streamAbortController } = get();
    if (streamAbortController) {
      streamAbortController.abort();
      getAudioStreamPlayer().stop();
      set({ isProcessing: false, voiceState: 'idle', streamAbortController: null });
    }
  },

  clearMessages: () => {
    set({ messages: [], voiceState: 'idle', currentEmotion: 'neutral', currentAction: undefined });
  },

  // ─── Model State ────────────────────────────────────────
  currentEmotion: 'neutral',
  currentAction: undefined,
  setEmotion: (e: EmotionTag) => set({ currentEmotion: e }),
  setAction: (a: string | undefined) => set({ currentAction: a }),

  // ─── Audio ──────────────────────────────────────────────
  audioElement: null,
  setAudioElement: (el) => set({ audioElement: el }),

  // ─── Voice Input ────────────────────────────────────────
  voiceActive: false,
  voiceText: '',
  voiceSupported: false,
  setVoiceActive: (v) => set({ voiceActive: v }),
  setVoiceText: (v) => set({ voiceText: v }),
  setVoiceSupported: (v) => set({ voiceSupported: v }),

  // ─── Time Awareness / Behavior ──────────────────────────
  bubbleMessage: null,
  bubbleEmotion: 'neutral' as EmotionTag,
  nightMode: false,
  showBubble: (message, emotion) => set({ bubbleMessage: message, bubbleEmotion: emotion }),
  dismissBubble: () => set({ bubbleMessage: null }),
  setNightMode: (v) => set({ nightMode: v }),
}));

// ─── Browser TTS Fallback ───────────────────────────────────

async function speakWithBrowserTTS(text: string): Promise<void> {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    throw new Error('Browser TTS not supported');
  }

  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 1.0;
    utterance.pitch = 1.1;
    utterance.onend = () => resolve();
    utterance.onerror = (e) => reject(e);
    window.speechSynthesis.speak(utterance);
  });
}
