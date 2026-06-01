'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import CharacterAvatar from './CharacterAvatar';
import { useLogin } from '@/hooks/useLogin';
import type { Message } from './ChatMessage';
import type { Emotion } from './CharacterAvatar';

type ChatState = 'greeting' | 'email_input' | 'password_input' | 'loading' | 'error' | 'success';

let msgId = 0;
function nextId(): string {
  return `msg_${++msgId}_${Date.now()}`;
}

// ── Role dialogue ─────────────────────────────────────────────
const DIALOGUE = {
  greeting: { content: '主人，你终于来啦！快告诉我你的邮箱，小星帮你开门～', emotion: 'happy' as Emotion },
  askPassword: { content: '收到啦～那再悄悄告诉我暗号吧，小星保证不看～', emotion: 'idle' as Emotion },
  checking: { content: '正在核对身份…', emotion: 'thinking' as Emotion },
  checkingSlow: { content: '主人稍等，小星正在努力核对…', emotion: 'thinking' as Emotion },
  welcome: { content: '欢迎回来，主人！小星好想你～', emotion: 'happy' as Emotion },
  authError: { content: '暗号好像不对哦，再试一次吧～', emotion: 'sad' as Emotion },
  networkError: { content: '哎呀，连接好像出了问题，请检查网络后重试哦～', emotion: 'surprised' as Emotion },
  serverError: { content: '出了点小问题，小星正在努力修复，稍后再试试吧～', emotion: 'sad' as Emotion },
  emailInvalid: { content: '这个邮箱格式好像不太对哦，主人再检查一下？', emotion: 'surprised' as Emotion },
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function ChatLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('callbackUrl') || searchParams.get('returnUrl') || '/dashboard';
  const { login, isLoading: loginLoading, error: loginError, clearError } = useLogin();

  const [state, setState] = useState<ChatState>('greeting');
  const [messages, setMessages] = useState<Message[]>([]);
  const [email, setEmail] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── State machine ───────────────────────────────────────────
  const addMessage = useCallback((role: 'user' | 'assistant', content: string, emotion?: Emotion) => {
    setMessages((prev) => [...prev, { id: nextId(), role, content, emotion }]);
  }, []);

  // Greeting on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      addMessage('assistant', DIALOGUE.greeting.content, DIALOGUE.greeting.emotion);
    }, 600);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // State transitions
  useEffect(() => {
    if (state === 'greeting') {
      const timer = setTimeout(() => setState('email_input'), 1000);
      return () => clearTimeout(timer);
    }
    if (state === 'error') {
      const timer = setTimeout(() => setState('password_input'), 2000);
      return () => clearTimeout(timer);
    }
    if (state === 'success') {
      const timer = setTimeout(() => {
        router.replace(returnUrl);
      }, 1500);
      return () => clearTimeout(timer);
    }
    // Cleanup timers on unmount
    return () => {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      if (stateTimerRef.current) clearTimeout(stateTimerRef.current);
    };
  }, [state, returnUrl, router]);

  // ── Handle user input ───────────────────────────────────────
  const handleSend = useCallback(
    async (value: string) => {
      clearError();

      if (state === 'email_input') {
        if (!isValidEmail(value)) {
          addMessage('assistant', DIALOGUE.emailInvalid.content, DIALOGUE.emailInvalid.emotion);
          return;
        }
        setEmail(value);
        addMessage('user', value);
        addMessage('assistant', DIALOGUE.askPassword.content, DIALOGUE.askPassword.emotion);
        setState('password_input');
        return;
      }

      if (state === 'password_input') {
        // Show password as **** in chat
        addMessage('user', '****');
        addMessage('assistant', DIALOGUE.checking.content, DIALOGUE.checking.emotion);
        setState('loading');

        // Slow response warning
        slowTimerRef.current = setTimeout(() => {
          addMessage('assistant', DIALOGUE.checkingSlow.content, 'thinking');
        }, 3000);

        const result = await login(email, value);

        if (slowTimerRef.current) clearTimeout(slowTimerRef.current);

        if (result.success) {
          addMessage('assistant', DIALOGUE.welcome.content, DIALOGUE.welcome.emotion);
          setState('success');
        } else {
          // Map error type to dialogue
          const errMsg =
            loginError === 'network'
              ? DIALOGUE.networkError
              : loginError === 'server'
                ? DIALOGUE.serverError
                : DIALOGUE.authError;
          addMessage('assistant', errMsg.content, errMsg.emotion);
          setState('error');
        }
        return;
      }
    },
    [state, email, login, addMessage, clearError, loginError],
  );

  // Determine current input state
  const inputType = state === 'password_input' || state === 'loading' ? 'password' : 'text';
  const inputDisabled = state === 'loading' || state === 'success' || state === 'greeting';
  const inputPlaceholder =
    state === 'password_input'
      ? '输入暗号...'
      : state === 'email_input'
        ? '输入邮箱地址...'
        : state === 'loading'
          ? '小星正在核对...'
          : state === 'success'
            ? '已解锁 ✨'
            : '稍等...';

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-deep)' }}>
      {/* Chat window */}
      <div
        className="w-full flex flex-col overflow-hidden rounded-2xl"
        style={{
          maxWidth: 420,
          height: 'min(600px, calc(100dvh - 32px))',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <CharacterAvatar emotion="idle" size={36} />
          <div>
            <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              唤醒星尘
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              登录你的 AI 桌宠伴侣
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.map((msg, i) => (
            <ChatMessage key={msg.id} message={msg} isLatest={i === messages.length - 1} />
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <ChatInput
          inputType={inputType}
          placeholder={inputPlaceholder}
          disabled={inputDisabled}
          onSend={handleSend}
        />

        {/* SSO link */}
        <div
          className="text-center py-3 border-t shrink-0"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            企业用户？{' '}
          </span>
          <button
            onClick={async () => {
              try {
                const res = await fetch('/api/auth/sso');
                const data = await res.json();
                if (data.success && data.data?.redirect_url) {
                  window.location.href = data.data.redirect_url;
                } else if (data.success && !data.data) {
                  // SSO not configured — redirect directly, the API will show info
                  window.location.href = '/api/auth/sso';
                }
              } catch {
                window.location.href = '/api/auth/sso';
              }
            }}
            className="text-xs font-medium hover:underline bg-transparent border-none cursor-pointer"
            style={{ color: 'var(--accent)' }}
          >
            企业单点登录
          </button>
        </div>
      </div>

    </div>
  );
}
