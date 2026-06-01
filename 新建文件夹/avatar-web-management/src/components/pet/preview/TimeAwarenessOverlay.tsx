'use client';
// TimeAwarenessOverlay — 时间感知气泡提示（叠放在 ModelViewer 上方）

import { useEffect, useState } from 'react';
import { usePetPreviewStore } from '@/stores/petPreviewStore';
import type { EmotionTag } from '@/types/pet-preview';

const EMOTION_ICON: Record<EmotionTag, string> = {
  happy: '😊',
  sad: '😢',
  shy: '😳',
  angry: '😠',
  neutral: '😶',
  surprised: '😲',
};

const EMOTION_BUBBLE_COLOR: Record<EmotionTag, string> = {
  happy: 'border-amber-400/60 bg-amber-50/90',
  sad: 'border-blue-400/60 bg-blue-50/90',
  shy: 'border-pink-400/60 bg-pink-50/90',
  angry: 'border-red-400/60 bg-red-50/90',
  neutral: 'border-gray-400/60 bg-white/90',
  surprised: 'border-purple-400/60 bg-purple-50/90',
};

export default function TimeAwarenessOverlay() {
  const bubbleMessage = usePetPreviewStore((s) => s.bubbleMessage);
  const bubbleEmotion = usePetPreviewStore((s) => s.bubbleEmotion);
  const [visible, setVisible] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (bubbleMessage) {
      setVisible(true);
      // Trigger entrance animation after a frame
      requestAnimationFrame(() => setAnimateIn(true));
    } else {
      setAnimateIn(false);
      const timer = setTimeout(() => setVisible(false), 300); // match exit animation
      return () => clearTimeout(timer);
    }
  }, [bubbleMessage]);

  if (!visible) return null;

  return (
    <div
      className={`
        absolute top-[-60px] left-1/2 -translate-x-1/2 z-20
        pointer-events-none select-none
        transition-all duration-300 ease-out
        ${animateIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
      `}
    >
      <div
        className={`
          relative max-w-[320px] px-4 py-2.5 rounded-2xl
          border shadow-lg backdrop-blur-sm
          ${EMOTION_BUBBLE_COLOR[bubbleEmotion] || EMOTION_BUBBLE_COLOR.neutral}
        `}
      >
        {/* Arrow pointing down */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-inherit border-r border-b border-inherit" />

        <div className="flex items-start gap-2">
          <span className="text-lg leading-none mt-0.5 shrink-0">
            {EMOTION_ICON[bubbleEmotion]}
          </span>
          <p className="text-sm text-gray-800 leading-relaxed">
            {bubbleMessage}
          </p>
        </div>

        {/* Animated dots — indicates auto-dismiss */}
        <div className="flex justify-center gap-1 mt-1.5">
          <span className="w-1 h-1 rounded-full bg-gray-400 animate-[pulse_1s_ease-in-out_infinite]" />
          <span className="w-1 h-1 rounded-full bg-gray-400 animate-[pulse_1s_ease-in-out_infinite_0.2s]" />
          <span className="w-1 h-1 rounded-full bg-gray-400 animate-[pulse_1s_ease-in-out_infinite_0.4s]" />
        </div>
      </div>
    </div>
  );
}
