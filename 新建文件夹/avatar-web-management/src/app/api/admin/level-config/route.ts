export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/middleware';
import { LEVEL_EXP_TABLE, EXP_ACTIONS, MAX_LEVEL, LEVEL_BENEFITS } from '@/lib/constants';
import { getRedis, isRedisAvailable } from '@/lib/redis/client';

const CONFIG_KEY = 'level_config:overrides';

interface LevelConfigData {
  levelExp: Record<number, { exp: number }>;
  expActions: Record<string, { exp: number; dailyLimit: number }>;
  benefits: Record<number, Record<string, unknown>>;
}

async function loadConfig(): Promise<LevelConfigData> {
  if (isRedisAvailable()) {
    try {
      const raw = await getRedis().get(CONFIG_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* degraded */ }
  }
  // Default from constants
  return {
    levelExp: Object.fromEntries(
      Object.entries(LEVEL_EXP_TABLE).map(([k, v]) => [k, { exp: v.exp }]),
    ),
    expActions: EXP_ACTIONS,
    benefits: LEVEL_BENEFITS,
  };
}

async function saveConfig(data: LevelConfigData): Promise<void> {
  if (isRedisAvailable()) {
    await getRedis().set(CONFIG_KEY, JSON.stringify(data));
  }
}

export const GET = requireRole('super_admin')(async () => {
  const config = await loadConfig();
  return NextResponse.json({
    success: true,
    data: {
      maxLevel: MAX_LEVEL,
      levelExp: config.levelExp,
      expActions: config.expActions,
      benefits: config.benefits,
    },
  });
});

export const PUT = requireRole('super_admin')(async (req) => {
  const body = await req.json();
  const { levelExp, expActions, benefits } = body;

  const config: LevelConfigData = {
    levelExp: levelExp || Object.fromEntries(
      Object.entries(LEVEL_EXP_TABLE).map(([k, v]) => [k, { exp: v.exp }]),
    ),
    expActions: expActions || EXP_ACTIONS,
    benefits: benefits || LEVEL_BENEFITS,
  };

  await saveConfig(config);

  return NextResponse.json({ success: true, data: config });
});
