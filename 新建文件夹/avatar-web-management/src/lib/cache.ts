// 应用缓存工具 — 基于 Redis 的 GET 缓存 + Cache-Control 响应头
// 配合 ISR 和客户端 SWR 形成三层缓存体系

import { NextResponse } from 'next/server';
import { cacheGet, cacheSet, cacheDelPattern } from '@/lib/redis';
import { createLogger } from '@/lib/logger';
import { cacheHitsTotal, cacheMissesTotal } from '@/lib/metrics';

const log = createLogger('app-cache');

/** 默认缓存 TTL（秒） */
export const CACHE_TTL = {
  assets: 30,
  avatars: 30,
  avatarDetail: 120,
  templates: 60,
  parts: 300,
};

/**
 * 尝试从 Redis 缓存命中 GET 响应
 * 命中则返回带 X-Cache: HIT 的 NextResponse，否则返回 null
 */
export async function tryCacheHit(key: string): Promise<NextResponse | null> {
  const cached = await cacheGet<{ status: number; body: unknown }>(key);
  if (cached) {
    cacheHitsTotal.inc({ cache_type: 'redis' });
    const response = NextResponse.json(cached.body, { status: cached.status });
    response.headers.set('X-Cache', 'HIT');
    return response;
  }
  cacheMissesTotal.inc({ cache_type: 'redis' });
  return null;
}

/**
 * 将成功的 GET 响应写入 Redis 缓存
 */
export async function cacheResponse(key: string, response: NextResponse, ttl: number): Promise<void> {
  if (response.status >= 200 && response.status < 300) {
    const body = await response.clone().json().catch(() => null);
    if (body) {
      await cacheSet(key, { status: response.status, body }, ttl);
    }
  }
}

/**
 * 失效指定 pattern 的缓存
 */
export async function invalidateCache(pattern: string): Promise<void> {
  try {
    await cacheDelPattern(`avatar:cache:${pattern}:*`);
    log.info('Cache invalidated: %s', pattern);
  } catch {
    // 缓存失效失败不影响业务
  }
}

/**
 * 构建缓存 key（基于路径和查询参数）
 */
export function buildCacheKey(prefix: string, url: string): string {
  const parsed = new URL(url);
  return `avatar:cache:${prefix}:${parsed.pathname}${parsed.search}`;
}
