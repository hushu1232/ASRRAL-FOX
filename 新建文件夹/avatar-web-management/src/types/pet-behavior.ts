// 桌宠行为系统类型定义 — 时间感知 / 环境交互 / 情感记忆 / 主动服务

import type { EmotionTag } from './pet-preview';

// ─── Time Periods ────────────────────────────────────────────

export type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'night';

export function getTimePeriod(hour: number): TimePeriod {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 23) return 'evening';
  return 'night';
}

// ─── Greeting ─────────────────────────────────────────────────

export interface GreetingEvent {
  id: string;
  type: 'morning_greeting' | 'evening_greeting' | 'return_greeting' | 'night_care';
  period: TimePeriod;
  message: string;
  emotion: EmotionTag;
  animation: string;         // animation trigger name
  timestamp: number;
  isLLMGenerated: boolean;
}

// ─── Hourly Interaction ──────────────────────────────────────

export interface HourlyInteraction {
  hour: number;
  message: string;
  emotion: EmotionTag;
  animation: string;
  timestamp: number;
}

// ─── Config ───────────────────────────────────────────────────

export interface TimeAwarenessConfig {
  enabled: boolean;
  morningGreeting: {
    enabled: boolean;
    startHour: number;       // default 6
    endHour: number;         // default 12
  };
  eveningGreeting: {
    enabled: boolean;
    startHour: number;       // default 18
    endHour: number;         // default 23
  };
  hourlyInteraction: {
    enabled: boolean;
  };
  lateNightCare: {
    enabled: boolean;
    startHour: number;       // default 23
    endHour: number;         // default 6
    intervalMinutes: number; // default 45
  };
  idleThresholdMinutes: number;  // default 30 — trigger return greeting after idle
  greetingLLMEnabled: boolean;   // use LLM for dynamic greetings (falls back to pool)
}

export const DEFAULT_TIME_AWARENESS_CONFIG: TimeAwarenessConfig = {
  enabled: true,
  morningGreeting: { enabled: true, startHour: 6, endHour: 12 },
  eveningGreeting: { enabled: true, startHour: 18, endHour: 23 },
  hourlyInteraction: { enabled: true },
  lateNightCare: { enabled: true, startHour: 23, endHour: 6, intervalMinutes: 45 },
  idleThresholdMinutes: 30,
  greetingLLMEnabled: false,
};

// ─── Activity Tracking ────────────────────────────────────────

export interface ActivityState {
  lastActivityTime: number;
  lastGreetingTime: number;
  lastHourlyTime: number;
  lastNightCareTime: number;
  isUserActive: boolean;
  idleStartTime: number | null;
}

// ─── Speech Bubble (UI) ───────────────────────────────────────

export interface SpeechBubble {
  id: string;
  message: string;
  emotion: EmotionTag;
  durationMs: number;     // 0 = persistent until dismissed
  createdAt: number;
}

// ─── Greeting Pools ───────────────────────────────────────────

export const GREETING_POOLS: Record<TimePeriod, string[]> = {
  morning: [
    '早上好～新的一天开始啦！今天也要元气满满哦～',
    '早安！睡得好舒服呀，主人昨晚休息得好吗？',
    '啊～（伸懒腰）早上了呢，月亮下班我上班～',
    '早上好呀！今天天气看起来不错呢～一起加油吧！',
    '早安早安！我已经充满电了，随时待命！',
  ],
  afternoon: [
    '下午好～吃过午饭了吗？记得按时吃饭哦～',
    '午后的阳光真舒服，晒得我都想打盹了...zzz',
    '主人下午好！我在窗边晒太阳呢～',
    '下午了呢，来杯茶休息一下吧？',
    '下午好呀～工作了这么久，起来活动活动吧！',
  ],
  evening: [
    '晚上好～今天辛苦啦！记得好好吃晚饭哦～',
    '天黑了，星星都出来了呢～主人该休息一下啦',
    '晚上好呀，一天的努力都值得！',
    '晚上了呢～来听首歌放松一下吧？',
    '晚上好！今天有什么有趣的事想跟我分享吗？',
  ],
  night: [
    '都这么晚了，主人还不睡吗？熬夜对身体不好哦～',
    '（打哈欠）我好困了...主人也早点休息吧～',
    '夜深了，明天的你会感谢今晚早睡的自己！',
    '还不睡呀？那我来陪你一会儿吧～但要答应我别太晚哦',
    '已经是深夜了呢...有什么烦恼让你睡不着吗？',
  ],
};

export const HOURLY_REMARKS: Record<number, string[]> = {
  0: ['午夜啦！新的一天开始了～', '零点咯，灰姑娘的魔法要消失了！'],
  1: ['凌晨1点...主人真的是夜猫子呢', '1点了，还在忙吗？'],
  2: ['2点了哦～再不睡明天要起不来了', '深夜2点，世界都安静了呢'],
  6: ['6点了！太阳要出来了～', '清晨6点，早起的鸟儿有虫吃～'],
  7: ['早上7点，该起床准备上班啦', '7点啦，新的一天开始了！'],
  8: ['8点，上班时间快到了哦', '早上8点，别迟到啦～'],
  9: ['9点了，开始一天的工作吧！', '上午9点，效率最高的时候呢！'],
  10: ['10点了，工作还顺利吗？', '上午10点，记得多喝水哦～'],
  12: ['中午12点！该吃午饭啦～', '12点了，肚子饿了吗？'],
  14: ['下午2点，有点犯困呢...', '2点了，来杯咖啡提提神？'],
  15: ['下午3点啦，该起来动一动咯！', '3点，伸个懒腰吧～'],
  18: ['下午6点，下班时间到！', '6点了，今天辛苦啦～'],
  21: ['晚上9点，放松一下看看剧？', '9点了，洗个热水澡吧～'],
  22: ['10点，准备睡觉了吗？', '晚上10点，该进入休息模式了～'],
  23: ['11点了哦，早点休息吧～', '深夜11点，美容觉时间到！'],
};

export const NIGHT_CARE_MESSAGES: string[] = [
  '已经很晚了，主人不困吗？早点休息对身体好哦～',
  '（揉眼睛）我都有点困了...主人要一起睡觉吗？',
  '熬夜会变熊猫眼的！快去睡觉～',
  '这么晚了还在忙吗？不要太勉强自己呀',
  '夜深了，放下手机，闭上眼睛，好好休息吧～',
  '主人，明天的事明天再做，现在该睡了～',
  '（打哈欠）唔...我好困，晚安啦主人...',
];

export const RETURN_GREETINGS: string[] = [
  '主人回来啦！我刚才好无聊呢～',
  '欢迎回来！你不在的时候我都在乖乖等你哦～',
  '终于等到你！我刚才数了星星，数到第',
  '主人！你去哪里了？我好想你～',
  '回来啦回来啦！快快，有什么需要我帮忙的吗？',
];
