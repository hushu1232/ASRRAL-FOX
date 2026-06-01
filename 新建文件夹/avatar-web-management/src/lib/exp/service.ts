import prisma from '@/lib/prisma';
import { LEVEL_EXP_TABLE, EXP_ACTIONS, MAX_LEVEL, LEVEL_BENEFITS } from '@/lib/constants';
import { createLogger } from '@/lib/logger';
import { getRedis, isRedisAvailable } from '@/lib/redis/client';

const log = createLogger('exp');

interface AddExpResult {
  gained: number;
  currentExp: number;
  currentLevel: number;
  levelUp: boolean;
  newLevel?: number;
  nextLevelExp: number;
}

/** Anti-abuse: sliding window per user per action using Redis */
async function checkDailyLimit(userId: string, action: string, limit: number): Promise<boolean> {
  if (!isRedisAvailable()) return true; // Degrade: allow if no Redis
  try {
    const key = `exp:limit:${userId}:${action}:${new Date().toISOString().slice(0, 10)}`;
    const current = await getRedis().incr(key);
    if (current === 1) {
      await getRedis().expire(key, 86400); // 24h TTL
    }
    return current <= limit;
  } catch (err) {
    log.warn({ err, userId, action }, 'Redis anti-abuse check failed, allowing');
    return true;
  }
}

export async function addExp(
  userId: string,
  action: string,
  metadata?: Record<string, unknown>,
): Promise<AddExpResult> {
  const actionDef = EXP_ACTIONS[action];
  if (!actionDef) {
    throw new Error(`Unknown EXP action: ${action}`);
  }

  // Anti-abuse: check daily limit
  const allowed = await checkDailyLimit(userId, action, actionDef.dailyLimit);
  if (!allowed) {
    log.warn({ userId, action }, 'Daily EXP limit reached');
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { exp: true, level: true } });
    const nextInfo = user.level < MAX_LEVEL ? LEVEL_EXP_TABLE[user.level + 1] : { total: user.exp };
    return { gained: 0, currentExp: user.exp, currentLevel: user.level, levelUp: false, nextLevelExp: nextInfo.total };
  }

  const gained = actionDef.exp;

  // Update user EXP and check level-up
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, exp: true, level: true },
  });

  let newExp = user.exp + gained;
  let newLevel = user.level;
  let levelUp = false;

  // Check for level-ups (may chain multiple levels)
  while (newLevel < MAX_LEVEL && newExp >= LEVEL_EXP_TABLE[newLevel + 1].total) {
    newLevel++;
    levelUp = true;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { exp: newExp, level: newLevel },
  });

  const nextLevelExp = newLevel < MAX_LEVEL ? LEVEL_EXP_TABLE[newLevel + 1].total : newExp;

  if (levelUp) {
    log.info({ userId, from: user.level, to: newLevel, exp: newExp }, 'User leveled up');
  }

  return {
    gained,
    currentExp: newExp,
    currentLevel: newLevel,
    levelUp,
    newLevel: levelUp ? newLevel : undefined,
    nextLevelExp,
  };
}

export function getLimits(level: number) {
  return LEVEL_BENEFITS[level] || LEVEL_BENEFITS[1];
}

export { checkDailyLimit };
