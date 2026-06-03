// TODO: BEM-migrate
'use client';

import { useState, useRef, useEffect } from 'react';
import { SendOutlined, LoadingOutlined } from '@ant-design/icons';

interface Props {
  inputType: 'text' | 'password';
  placeholder: string;
  disabled: boolean;
  onSend: (value: string) => void;
}

export default function ChatInput({ inputType, placeholder, disabled, onSend }: Props) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled, inputType]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="flex items-center gap-2 px-4 py-3 border-t"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <input
        ref={inputRef}
        type={inputType}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 px-4 py-2.5 rounded-full text-sm outline-none transition-colors"
        style={{
          background: 'var(--bg-card-hover)',
          color: 'var(--text-primary)',
          border: `1px solid var(--border-subtle)`,
        }}
        autoComplete={inputType === 'password' ? 'current-password' : 'email'}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all"
        style={{
          background: disabled || !value.trim() ? 'var(--bg-card-hover)' : 'var(--accent)',
          color: disabled || !value.trim() ? 'var(--text-muted)' : '#ffffff',
          cursor: disabled || !value.trim() ? 'not-allowed' : 'pointer',
          border: 'none',
        }}
        aria-label="发送"
      >
        {disabled ? (
          <LoadingOutlined className="animate-spin" />
        ) : (
          <SendOutlined style={{ fontSize: 16 }} />
        )}
      </button>
    </div>
  );
}