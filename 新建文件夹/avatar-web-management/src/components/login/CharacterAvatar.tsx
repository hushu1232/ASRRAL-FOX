'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';

export type Emotion = 'happy' | 'sad' | 'thinking' | 'surprised' | 'idle';

interface Props {
  emotion?: Emotion;
  size?: number;
  className?: string;
}

const EMOTION_CLASSES: Record<Emotion, string[]> = {
  idle: [],
  happy: ['animate-bounce'],
  sad: ['animate-pulse'],
  thinking: ['animate-spin', '[animation-duration:3s]'],
  surprised: ['animate-bounce', '[animation-duration:0.5s]'],
};

export default function CharacterAvatar({ emotion = 'idle', size = 48, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    // Remove all known animation classes
    const allKnown = Object.values(EMOTION_CLASSES).flat();
    ref.current.classList.remove(...allKnown);
    void ref.current.offsetWidth; // trigger reflow
    // Add current emotion classes
    const next = EMOTION_CLASSES[emotion];
    if (next.length > 0) {
      ref.current.classList.add(...next);
    }
  }, [emotion]);

  // Placeholder: uses logo.svg as character image. Replace with Live2D canvas in future.
  return (
    <div
      ref={ref}
      className={`rounded-full overflow-hidden shrink-0 flex items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, #f59e0b, #d97706, #ea580c)',
        boxShadow: '0 0 16px rgba(217, 119, 6, 0.3)',
      }}
    >
      <Image
        src="/images/logo.svg"
        alt="星尘"
        width={Math.round(size * 0.6)}
        height={Math.round(size * 0.6)}
        priority
        unoptimized
      />
    </div>
  );
}

// Expose for future Live2D integration
export { EMOTION_CLASSES };
