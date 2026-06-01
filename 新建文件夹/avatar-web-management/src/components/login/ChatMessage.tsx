'use client';

import CharacterAvatar from './CharacterAvatar';
import type { Emotion } from './CharacterAvatar';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  emotion?: Emotion;
}

interface Props {
  message: Message;
  isLatest: boolean;
}

export default function ChatMessage({ message, isLatest }: Props) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex gap-3 mb-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      style={{
        animation: isLatest
          ? `${isUser ? 'fadeInRight' : 'fadeInUp'} 0.35s ease-out`
          : 'none',
      }}
    >
      {/* Avatar — assistant only */}
      {!isUser && (
        <CharacterAvatar
          emotion={message.emotion || 'idle'}
          size={40}
        />
      )}

      {/* Bubble */}
      <div
        className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'rounded-tr-md'
            : 'rounded-tl-md'
        }`}
        style={
          isUser
            ? {
                background: 'var(--accent)',
                color: '#ffffff',
                borderBottomRightRadius: '4px',
              }
            : {
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                borderBottomLeftRadius: '4px',
              }
        }
      >
        {message.content}
      </div>
    </div>
  );
}
