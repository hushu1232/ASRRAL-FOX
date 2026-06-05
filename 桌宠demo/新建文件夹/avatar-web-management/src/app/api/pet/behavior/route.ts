// GET/PUT /api/pet/behavior — 桌宠行为配置（时间感知 / 环境交互 / 情感记忆）
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { petService } from '@/lib/services/petService';
import { success, error } from '@/lib/api-response';
import { createLogger } from '@/lib/logger';
import type { TimeAwarenessConfig } from '@/types/pet-behavior';

const log = createLogger('api:pet:behavior');

const ALLOWED_BEHAVIOR_FIELDS = [
  'time_awareness_enabled',
  'morning_greeting_enabled',
  'morning_greeting_start',
  'morning_greeting_end',
  'evening_greeting_enabled',
  'evening_greeting_start',
  'evening_greeting_end',
  'hourly_interaction_enabled',
  'night_care_enabled',
  'night_care_start',
  'night_care_end',
  'night_care_interval_minutes',
  'idle_threshold_minutes',
  'greeting_llm_enabled',
];

export const GET = withAuth(async (_req: NextRequest, user) => {
  try {
    const config = await petService.getConfig(user.sub, user.workspaceId);
    const raw = config as Record<string, unknown>;

    const behaviorConfig: TimeAwarenessConfig = {
      enabled: raw.time_awareness_enabled !== false,
      morningGreeting: {
        enabled: raw.morning_greeting_enabled !== false,
        startHour: (raw.morning_greeting_start as number) || 6,
        endHour: (raw.morning_greeting_end as number) || 12,
      },
      eveningGreeting: {
        enabled: raw.evening_greeting_enabled !== false,
        startHour: (raw.evening_greeting_start as number) || 18,
        endHour: (raw.evening_greeting_end as number) || 23,
      },
      hourlyInteraction: {
        enabled: raw.hourly_interaction_enabled !== false,
      },
      lateNightCare: {
        enabled: raw.night_care_enabled !== false,
        startHour: (raw.night_care_start as number) || 23,
        endHour: (raw.night_care_end as number) || 6,
        intervalMinutes: (raw.night_care_interval_minutes as number) || 45,
      },
      idleThresholdMinutes: (raw.idle_threshold_minutes as number) || 30,
      greetingLLMEnabled: raw.greeting_llm_enabled === true,
    };

    return success(behaviorConfig);
  } catch (err) {
    log.error({ err }, 'Failed to get behavior config');
    return error(err);
  }
});

export const PUT = withAuth(async (req: NextRequest, user) => {
  try {
    const body = await req.json();
    const updates: Record<string, unknown> = {};

    for (const key of ALLOWED_BEHAVIOR_FIELDS) {
      if (key in body) updates[key] = body[key];
    }

    await petService.updateConfig(user.sub, user.workspaceId, updates);

    log.info({ userId: user.sub, updates }, 'Behavior config updated');
    return success({ updated: Object.keys(updates) });
  } catch (err) {
    log.error({ err }, 'Failed to update behavior config');
    return error(err);
  }
});
