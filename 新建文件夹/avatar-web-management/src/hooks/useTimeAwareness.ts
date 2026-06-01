'use client';
// useTimeAwareness — 时间感知 hook，监听用户活动 + 定时触发问候/整点/深夜关怀

import { useEffect, useRef, useCallback } from 'react';
import {
  createActivityState,
  timeAwarenessTick,
  type TimeAwarenessTickResult,
} from '@/lib/behavior/time-awareness';
import {
  type TimeAwarenessConfig,
  DEFAULT_TIME_AWARENESS_CONFIG,
} from '@/types/pet-behavior';
import { usePetPreviewStore } from '@/stores/petPreviewStore';

const TICK_INTERVAL_MS = 30_000;       // 30s tick
const ACTIVITY_DEBOUNCE_MS = 5_000;    // 5s no activity → mark inactive

export function useTimeAwareness(config?: Partial<TimeAwarenessConfig>) {
  const mergedConfig: TimeAwarenessConfig = { ...DEFAULT_TIME_AWARENESS_CONFIG, ...config };
  const stateRef = useRef(createActivityState());
  const activityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBubble = usePetPreviewStore((s) => s.showBubble);
  const dismissBubble = usePetPreviewStore((s) => s.dismissBubble);
  const setEmotion = usePetPreviewStore((s) => s.setEmotion);
  const setNightMode = usePetPreviewStore((s) => s.setNightMode);

  // ─── Activity detection ──────────────────────────────

  const markActivity = useCallback(() => {
    const state = stateRef.current;
    const wasIdle = state.idleStartTime !== null;

    state.lastActivityTime = Date.now();
    state.isUserActive = true;
    state.idleStartTime = null;

    // Reset inactivity timer
    if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
    activityTimerRef.current = setTimeout(() => {
      const s = stateRef.current;
      s.isUserActive = false;
      s.idleStartTime = Date.now();
    }, ACTIVITY_DEBOUNCE_MS);
  }, []);

  // ─── Process tick result ─────────────────────────────

  const processResult = useCallback(
    (result: TimeAwarenessTickResult) => {
      const state = stateRef.current;
      const now = Date.now();

      // Bubble display helper
      const displayBubble = (message: string, emotion: typeof result.greeting extends { emotion: infer E } ? E : string, durationMs = 8000) => {
        showBubble(message, emotion as Parameters<typeof showBubble>[1]);
        setEmotion(emotion as Parameters<typeof setEmotion>[0]);
        if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
        bubbleTimerRef.current = setTimeout(() => dismissBubble(), durationMs);
      };

      if (result.greeting) {
        state.lastGreetingTime = now;
        displayBubble(result.greeting.message, result.greeting.emotion, 10000);
      }

      if (result.hourly) {
        state.lastHourlyTime = now;
        displayBubble(result.hourly.message, result.hourly.emotion, 8000);
      }

      if (result.nightCare) {
        state.lastNightCareTime = now;
        setNightMode(true);
        displayBubble(result.nightCare.message, result.nightCare.emotion, 10000);
      }

      if (result.returnGreeting) {
        state.lastGreetingTime = now;
        displayBubble(result.returnGreeting.message, result.returnGreeting.emotion, 10000);
      }
    },
    [showBubble, dismissBubble, setEmotion, setNightMode],
  );

  // ─── Tick loop ───────────────────────────────────────

  useEffect(() => {
    if (!mergedConfig.enabled) return;

    // Run initial tick
    const tick = () => {
      const result = timeAwarenessTick(stateRef.current, mergedConfig, new Date());
      if (result.greeting || result.hourly || result.nightCare || result.returnGreeting) {
        processResult(result);
      }
    };

    tick();
    const interval = setInterval(tick, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [mergedConfig, processResult]);

  // ─── Activity listeners ──────────────────────────────

  useEffect(() => {
    if (!mergedConfig.enabled) return;

    const onPointerMove = () => markActivity();
    const onKeyDown = () => markActivity();
    const onClick = () => markActivity();

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('keydown', onKeyDown, { passive: true });
    window.addEventListener('click', onClick, { passive: true });

    // Initial activity mark
    markActivity();

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('click', onClick);
      if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    };
  }, [mergedConfig.enabled, markActivity]);

  // ─── Night mode cleanup ──────────────────────────────

  useEffect(() => {
    // Exit night mode when morning comes
    const checkNightExit = () => {
      const hour = new Date().getHours();
      if (hour >= 6 && hour < 23) {
        setNightMode(false);
      }
    };
    const nightInterval = setInterval(checkNightExit, 5 * 60 * 1000);
    return () => clearInterval(nightInterval);
  }, [setNightMode]);

  return {
    markActivity,
  };
}
