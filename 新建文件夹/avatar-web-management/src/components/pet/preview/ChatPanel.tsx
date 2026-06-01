'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Input, Tooltip } from 'antd';
import {
  SendOutlined, AudioOutlined, AudioMutedOutlined,
  RobotOutlined, UserOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { ChatMessage, VoiceState } from '@/types/pet-preview';

const { TextArea } = Input;

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  disabled: boolean;
  voiceState: VoiceState;
  onStartVoice: () => void;
  onStopVoice: () => void;
  voiceSupported: boolean;
  voiceActive: boolean;
  voiceText: string;
  className?: string;
}

export default function ChatPanel({
  messages,
  onSend,
  disabled,
  voiceState,
  onStartVoice,
  onStopVoice,
  voiceSupported,
  voiceActive,
  voiceText,
  className = '',
}: ChatPanelProps) {
  const t = useTranslations('pet.chat');
  const tv = useTranslations('pet.voiceLabels');

  const VOICE_LABELS: Record<VoiceState, string> = {
    idle: '',
    listening: `${tv('listening')}...`,
    thinking: `${tv('thinking')}...`,
    speaking: `${tv('speaking')}...`,
  };

  const [inputText, setInputText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(() => {
    const text = (inputText || voiceText).trim();
    if (!text || disabled) return;
    onSend(text);
    setInputText('');
  }, [inputText, voiceText, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleVoice = () => {
    if (voiceActive) onStopVoice();
    else onStartVoice();
  };

  return (
    <div
      className={`flex flex-col h-full bg-[var(--ds-colors-surface)] rounded-xl border border-[var(--ds-colors-border)] ${className}`}
    >
      {voiceState !== 'idle' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[var(--ds-colors-primary-soft)] border-b border-[var(--ds-colors-border)]">
          <div className={`w-2 h-2 rounded-full animate-pulse ${
            voiceState === 'listening' ? 'bg-red-500' :
            voiceState === 'thinking' ? 'bg-yellow-500' :
            'bg-green-500'
          }`} />
          <span className="text-sm text-[var(--ds-colors-text-secondary)]">
            {VOICE_LABELS[voiceState]}
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0" aria-live="polite" aria-atomic="true">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 opacity-60">
            <RobotOutlined style={{ fontSize: 48 }} className="text-[var(--ds-colors-primary)]" />
            <div>
              <p className="text-base font-medium text-[var(--ds-colors-text)]">{t('welcomeTitle')}</p>
              <p className="text-sm text-[var(--ds-colors-text-secondary)] mt-1">
                {t('welcomeDesc')}
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))
        )}

        {voiceActive && voiceText && (
          <div className="flex justify-end">
            <div className="max-w-[70%] px-4 py-2.5 rounded-xl rounded-br-sm bg-blue-50 text-blue-700 text-sm italic">
              {voiceText}
              <span className="inline-block w-1.5 h-4 ml-0.5 bg-blue-400 animate-pulse align-middle" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="border-t border-[var(--ds-colors-border)] p-3">
        <div className="flex items-end gap-2">
          <TextArea
            ref={inputRef as React.Ref<any>}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('inputPlaceholder')}
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={disabled}
            className="flex-1"
            style={{ resize: 'none' }}
          />

          {voiceSupported && (
            <Tooltip title={voiceActive ? t('stopRecording') : t('voiceInput')}>
              <Button
                icon={voiceActive ? <AudioMutedOutlined /> : <AudioOutlined />}
                onClick={toggleVoice}
                type={voiceActive ? 'primary' : 'default'}
                danger={voiceActive}
                shape="circle"
                size="middle"
              />
            </Tooltip>
          )}

          <Tooltip title={t('send')}>
            <Button
              icon={<SendOutlined />}
              onClick={handleSend}
              type="primary"
              shape="circle"
              size="middle"
              disabled={disabled || (!inputText.trim() && !voiceText.trim())}
            />
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${
          isUser
            ? 'bg-blue-500 text-white'
            : 'bg-gradient-to-br from-purple-400 to-pink-400 text-white'
        }`}
      >
        {isUser ? <UserOutlined /> : <RobotOutlined />}
      </div>

      <div
        className={`max-w-[70%] px-3.5 py-2.5 rounded-xl text-sm leading-relaxed ${
          isUser
            ? 'rounded-tr-sm bg-blue-500 text-white'
            : 'rounded-tl-sm bg-[var(--ds-colors-surface-secondary)] text-[var(--ds-colors-text)]'
        }`}
      >
        {message.content}
      </div>

      <div className={`flex items-end text-[10px] text-[var(--ds-colors-text-tertiary)] ${
        isUser ? 'flex-row-reverse' : ''
      }`}>
        {new Date(message.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>
    </div>
  );
}
