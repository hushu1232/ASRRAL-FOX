// 时间感知引擎 — 平台无关核心逻辑
// Web 端 (TypeScript) 和 Alife 运行时共用同样的算法

import {
  type TimePeriod,
  type TimeAwarenessConfig,
  type ActivityState,
  type GreetingEvent,
  type HourlyInteraction,
  getTimePeriod,
  GREETING_POOLS,
  HOURLY_REMARKS,
  NIGHT_CARE_MESSAGES,
  RETURN_GREETINGS,
  DEFAULT_TIME_AWARENESS_CONFIG,
} from '@/types/pet-behavior';
import type { EmotionTag } from '@/types/pet-preview';

// ─── Helpers ─────────────────────────────────────────────────

let greetingCounter = 0;

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateId(): string {
  greetingCounter += 1;
  return `ta-${Date.now()}-${greetingCounter}`;
}

function hourMatches(hour: number, start: number, end: number): boolean {
  if (start <= end) return hour >= start && hour < end;
  // Overnight range (e.g., 23-6)
  return hour >= start || hour < end;
}

// ─── State Factory ───────────────────────────────────────────

export function createActivityState(): ActivityState {
  return {
    lastActivityTime: Date.now(),
    lastGreetingTime: 0,
    lastHourlyTime: 0,
    lastNightCareTime: 0,
    isUserActive: false,
    idleStartTime: null,
  };
}

// ─── Greeting Selection ──────────────────────────────────────

export function selectGreeting(
  period: TimePeriod,
  config: TimeAwarenessConfig,
  isReturnGreeting: boolean,
): { message: string; emotion: EmotionTag; animation: string } {
  const pool = isReturnGreeting
    ? RETURN_GREETINGS
    : GREETING_POOLS[period];

  const message = randomItem(pool);

  const emotionMap: Record<TimePeriod, EmotionTag> = {
    morning: 'happy',
    afternoon: 'neutral',
    evening: 'happy',
    night: 'sad',
  };

  const animMap: Record<TimePeriod, string> = {
    morning: 'stretch',
    afternoon: 'idle_warm',
    evening: 'wave',
    night: 'yawn',
  };

  return {
    message,
    emotion: isReturnGreeting ? 'surprised' : emotionMap[period],
    animation: isReturnGreeting ? 'jump' : animMap[period],
  };
}

// ─── Hourly Interaction ──────────────────────────────────────

export function shouldTriggerHourly(
  state: ActivityState,
  config: TimeAwarenessConfig,
  now: Date,
): boolean {
  if (!config.hourlyInteraction.enabled) return false;
  if (!config.enabled) return false;

  const currentHour = now.getHours();
  const lastHour = new Date(state.lastHourlyTime).getHours();

  // Don't trigger if same hour or if it just triggered
  if (currentHour === lastHour && state.lastHourlyTime > 0) return false;

  // Don't trigger between midnight and 6 AM (unless user is active)
  if (currentHour >= 0 && currentHour < 6 && !state.isUserActive) return false;

  return true;
}

export function selectHourlyInteraction(now: Date): { message: string; emotion: EmotionTag; animation: string } {
  const hour = now.getHours();
  const hourStr = `${hour}点`;
  const remarks = HOURLY_REMARKS[hour] || [`${hourStr}啦～时间过得好快呢`];
  const message = randomItem(remarks);

  return {
    message,
    emotion: 'neutral',
    animation: 'bounce',
  };
}

// ─── Late Night Care ─────────────────────────────────────────

export function shouldTriggerNightCare(
  state: ActivityState,
  config: TimeAwarenessConfig,
  now: Date,
): boolean {
  if (!config.lateNightCare.enabled || !config.enabled) return false;

  const hour = now.getHours();
  if (!hourMatches(hour, config.lateNightCare.startHour, config.lateNightCare.endHour)) {
    return false;
  }

  const intervalMs = config.lateNightCare.intervalMinutes * 60 * 1000;
  if (state.lastNightCareTime > 0 && now.getTime() - state.lastNightCareTime < intervalMs) {
    return false;
  }

  return state.isUserActive;
}

export function selectNightCareMessage(): { message: string; emotion: EmotionTag; animation: string } {
  return {
    message: randomItem(NIGHT_CARE_MESSAGES),
    emotion: 'sad',
    animation: 'yawn',
  };
}

// ─── Return Greeting (after idle) ────────────────────────────

export function shouldTriggerReturnGreeting(
  state: ActivityState,
  config: TimeAwarenessConfig,
  now: Date,
): boolean {
  if (!config.enabled) return false;
  if (state.idleStartTime === null) return false;

  const idleMs = now.getTime() - state.idleStartTime;
  const thresholdMs = config.idleThresholdMinutes * 60 * 1000;

  return idleMs >= thresholdMs && state.isUserActive;
}

// ─── Morning / Evening Greeting ──────────────────────────────

export function shouldTriggerPeriodGreeting(
  state: ActivityState,
  config: TimeAwarenessConfig,
  now: Date,
): 'morning' | 'evening' | null {
  if (!config.enabled) return null;

  // Only greet once per session window (roughly — once per 4 hours)
  const greetingAge = now.getTime() - state.lastGreetingTime;
  if (greetingAge < 4 * 60 * 60 * 1000) return null;

  // Must have recent activity to greet
  const activityAge = now.getTime() - state.lastActivityTime;
  if (activityAge > 60 * 1000) return null; // activity must be within last minute

  const hour = now.getHours();

  if (
    config.morningGreeting.enabled &&
    hourMatches(hour, config.morningGreeting.startHour, config.morningGreeting.endHour)
  ) {
    return 'morning';
  }

  if (
    config.eveningGreeting.enabled &&
    hourMatches(hour, config.eveningGreeting.startHour, config.eveningGreeting.endHour)
  ) {
    return 'evening';
  }

  return null;
}

// ─── Main Tick — call every ~30s ─────────────────────────────

export interface TimeAwarenessTickResult {
  greeting?: GreetingEvent;
  hourly?: HourlyInteraction;
  nightCare?: GreetingEvent;
  returnGreeting?: GreetingEvent;
}

export function timeAwarenessTick(
  state: ActivityState,
  config: TimeAwarenessConfig,
  now: Date,
): TimeAwarenessTickResult {
  const result: TimeAwarenessTickResult = {};

  if (!config.enabled) return result;

  // 1. Period greeting (morning / evening)
  const period = shouldTriggerPeriodGreeting(state, config, now);
  if (period) {
    const g = selectGreeting(period, config, false);
    result.greeting = {
      id: generateId(),
      type: period === 'morning' ? 'morning_greeting' : 'evening_greeting',
      period,
      message: g.message,
      emotion: g.emotion,
      animation: g.animation,
      timestamp: now.getTime(),
      isLLMGenerated: false,
    };
  }

  // 2. Hourly interaction
  if (shouldTriggerHourly(state, config, now)) {
    const h = selectHourlyInteraction(now);
    result.hourly = {
      hour: now.getHours(),
      message: h.message,
      emotion: h.emotion,
      animation: h.animation,
      timestamp: now.getTime(),
    };
  }

  // 3. Late night care
  if (shouldTriggerNightCare(state, config, now)) {
    const nc = selectNightCareMessage();
    result.nightCare = {
      id: generateId(),
      type: 'night_care',
      period: 'night',
      message: nc.message,
      emotion: nc.emotion,
      animation: nc.animation,
      timestamp: now.getTime(),
      isLLMGenerated: false,
    };
  }

  // 4. Return greeting
  if (shouldTriggerReturnGreeting(state, config, now)) {
    const period = getTimePeriod(now.getHours());
    const g = selectGreeting(period, config, true);
    result.returnGreeting = {
      id: generateId(),
      type: 'return_greeting',
      period,
      message: g.message,
      emotion: g.emotion,
      animation: g.animation,
      timestamp: now.getTime(),
      isLLMGenerated: false,
    };
  }

  return result;
}
