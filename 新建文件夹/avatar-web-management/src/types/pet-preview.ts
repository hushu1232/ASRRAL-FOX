// 桌宠 Web 预览 — 类型定义

// ─── 对话消息 ─────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;          // 纯文本（已剥离标签）
  rawContent?: string;      // LLM 原始输出（含 [happy] 等标签）
  timestamp: number;
}

// ─── 情绪与动作 ───────────────────────────────────────────

export type EmotionTag = 'happy' | 'sad' | 'shy' | 'angry' | 'neutral' | 'surprised';

export interface ParsedResponse {
  text: string;
  emotion: EmotionTag;
  action?: string;          // [action:name]
  memories?: string[];      // [memory:text]
}

// ─── 语音状态 ─────────────────────────────────────────────

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

// ─── 用户输入模式 ─────────────────────────────────────────

export type InputMode = 'text' | 'voice';

// ─── 宠物配置（Web 预览） ─────────────────────────────────

export interface PetPreviewConfig {
  petName: string;
  personality: string;
  backstory: string;
  characterExtra: string;
  animationModel: 'live2d' | 'vrm';
  modelPath: string;        // Live2D: .model3.json URL; VRM: .vrm URL
  ttsEngine: 'sherpa-onnx' | 'gpt-sovits';
  customVoiceId?: string;
  idleTimeout: number;
  wanderInterval: number;
}

// ─── TTS 合成 ─────────────────────────────────────────────

export interface TTSResult {
  audioUrl: string;         // blob: URL
  sampleRate: number;
  durationMs: number;
}

// ─── SSE Streaming ────────────────────────────────────────

export interface StreamEvent {
  token?: string;
  emotion?: string;
  action?: string;
}

export interface StreamDoneEvent {
  text: string;
  emotion: EmotionTag;
  action: string | null;
  memories: string[];
}

// ─── LLM 聊天 ─────────────────────────────────────────────

export interface ChatRequest {
  message: string;
  history: { role: string; content: string }[];
}

export interface ChatResponse {
  reply: string;            // 纯文本（已剥离标签）
  raw: string;              // 完整 LLM 输出
  parsed: ParsedResponse;
  audioUrl?: string;        // TTS 合成后附带的音频
}

// ─── 组件 Props ───────────────────────────────────────────

export interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  disabled: boolean;        // 思考中/说话中时禁用
  voiceState: VoiceState;
  onStartVoice: () => void;
  onStopVoice: () => void;
  voiceSupported: boolean;
  voiceActive: boolean;
  voiceText: string;        // 实时语音识别文字
  className?: string;
}

export interface ModelViewerProps {
  modelType: 'live2d' | 'vrm';
  modelPath: string;
  emotion: EmotionTag;
  action?: string;
  isSpeaking: boolean;
  audioElement?: HTMLAudioElement | null;  // 用于口型同步
  className?: string;
}

export interface VoiceInputProps {
  onStart: () => void;
  onStop: () => void;
  active: boolean;
  supported: boolean;
  voiceText: string;
  className?: string;
}
