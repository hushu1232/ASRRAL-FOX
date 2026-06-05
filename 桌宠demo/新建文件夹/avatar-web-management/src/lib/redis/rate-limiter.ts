// 路由级速率限制 — Redis 优先，内存回退
import { NextRequest, NextResponse } from 'next/server';
import { cacheIncr } from './cache';
import { isRedisAvailable } from './client';
import { memoryRateLimit } from '@/lib/rate-limit/memory';

interface RateLimitOptions {
  windowSec: number;
  max: number;
}

/**
 * 创建速率限制中间件包装器
 * 用法: export const POST = withRateLimit({ windowSec: 60, max: 30 }, async (req) => { ... })
 */
export function withRateLimit(
  options: RateLimitOptions,
  handler: (req: NextRequest, ...args: unknown[]) => Promise<NextResponse>,
) {
  return async (req: NextRequest, ...args: unknown[]) => {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    const user = (req as unknown as Record<string, unknown>).user as { sub?: string } | undefined;
    const identifier = user?.sub || ip;
    const route = req.nextUrl.pathname.replace(/\//g, '_').slice(0, 50);

    const key = `ratelimit:${route}:${identifier}`;
    const windowMs = options.windowSec * 1000;

    let exceeded = false;

    if (isRedisAvailable()) {
      const count = await cacheIncr(key, options.windowSec);
      exceeded = count > options.max;
    } else {
      const result = memoryRateLimit(key, options.max, windowMs);
      exceeded = !result.allowed;
    }

    if (exceeded) {
      return NextResponse.json(
        { success: false, error: '请求过于频繁，请稍后再试', retryAfter: options.windowSec },
        {
          status: 429,
          headers: {
            'Retry-After': String(options.windowSec),
            'X-RateLimit-Limit': String(options.max),
            'X-RateLimit-Remaining': '0',
          },
        },
      );
    }

    const response = await handler(req, ...args);
    if (response && response.headers) {
      response.headers.set('X-RateLimit-Limit', String(options.max));
    }
    return response;
  };
}
