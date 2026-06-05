// Redis 缓存工具 — JSON 序列化读写 + TTL + 批量操作
import { getRedis, isRedisAvailable } from './client';

const DEFAULT_TTL = 300; // 5 分钟

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isRedisAvailable()) return null;
  try {
    const redis = getRedis();
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttl = DEFAULT_TTL): Promise<void> {
  if (!isRedisAvailable()) return;
  try {
    const redis = getRedis();
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
  } catch {
    // 缓存写入失败不影响业务
  }
}

export async function cacheDel(key: string): Promise<void> {
  if (!isRedisAvailable()) return;
  try {
    const redis = getRedis();
    await redis.del(key);
  } catch {
    // ignore
  }
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  if (!isRedisAvailable()) return;
  try {
    const redis = getRedis();
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // ignore
  }
}

export async function cacheIncr(key: string, ttl?: number): Promise<number> {
  if (!isRedisAvailable()) return 0;
  try {
    const redis = getRedis();
    const val = await redis.incr(key);
    if (ttl) await redis.expire(key, ttl);
    return val;
  } catch {
    return 0;
  }
}

export async function cacheTtl(key: string): Promise<number> {
  if (!isRedisAvailable()) return -1;
  try {
    const redis = getRedis();
    return redis.ttl(key);
  } catch {
    return -1;
  }
}

// 缓存构建 key 的辅助函数
export function cacheKey(...segments: string[]): string {
  return segments.join(':');
}
