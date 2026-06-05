// API 响应缓存中间件 — GET 缓存命中即返回，POST/PUT/DELETE 自动失效
import { NextRequest, NextResponse } from 'next/server';
import { cacheGet, cacheSet, cacheDelPattern } from './cache';

interface CacheOptions {
  /** 缓存 key 前缀（如 'avatars'），完整 key = avatar:cache:{prefix}:{url} */
  prefix: string;
  /** 过期时间（秒），默认 300 */
  ttl?: number;
  /** 缓存失效 pattern，仅在写操作时生效（如 'avatars:*'） */
  invalidate?: string[];
}

type NextHandler = (req: NextRequest, ...args: unknown[]) => Promise<NextResponse>;

export function withCache<T extends NextHandler>(options: CacheOptions, handler: T): T {
  const ttl = options.ttl ?? 300;

  return (async (req: NextRequest, ...args: unknown[]) => {
    const method = req.method.toUpperCase();

    // 写操作：先失效相关缓存
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && options.invalidate) {
      for (const pattern of options.invalidate) {
        await cacheDelPattern(pattern);
      }
    }

    // 读操作：尝试缓存命中
    if (method === 'GET') {
      const cacheKey = `${options.prefix}:${req.nextUrl.pathname}${req.nextUrl.search}`;
      const cached = await cacheGet<{ status: number; body: unknown; headers: Record<string, string> }>(cacheKey);

      if (cached) {
        const res = NextResponse.json(cached.body, { status: cached.status });
        for (const [k, v] of Object.entries(cached.headers)) {
          if (k.toLowerCase() !== 'content-type') res.headers.set(k, v);
        }
        res.headers.set('X-Cache', 'HIT');
        return res;
      }

      const response = await handler(req, ...args);

      // 仅缓存成功的 JSON 响应
      if (response.status >= 200 && response.status < 300 && response.headers.get('content-type')?.includes('json')) {
        const body = await response.clone().json().catch(() => null);
        if (body) {
          const headers: Record<string, string> = {};
          response.headers.forEach((v, k) => { headers[k] = v; });
          await cacheSet(cacheKey, { status: response.status, body, headers }, ttl);
          response.headers.set('X-Cache', 'MISS');
        }
      }

      return response;
    }

    return handler(req, ...args);
  }) as T;
}
