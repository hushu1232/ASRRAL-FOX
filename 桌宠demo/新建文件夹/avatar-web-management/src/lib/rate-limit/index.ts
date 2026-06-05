// 速率限制 — 统一接口（支持 Upstash Redis + 内存回退，fail-open on timeout）
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { memoryRateLimit } from './memory';
import type { RateLimitResult } from './memory';
import { createLogger } from '@/lib/logger';

const log = createLogger('rate-limit');

// Fail-open: max ms to wait for Upstash before allowing the request
const UPSTASH_TIMEOUT_MS = 200;

// 尝试初始化 Upstash Redis（如果配置了环境变量）
let upstashRedis: Redis | null = null;
let upstashLimiter: Ratelimit | null = null;
let upstashFailed = false; // track persistent failures for circuit-breaker-like behavior

function getUpstashLimiter(): Ratelimit | null {
  if (upstashFailed) return null;
  if (upstashLimiter) return upstashLimiter;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  try {
    upstashRedis = new Redis({ url, token });
    upstashLimiter = new Ratelimit({
      redis: upstashRedis,
      limiter: Ratelimit.slidingWindow(100, '60 s'),
      analytics: false,
    });
    return upstashLimiter;
  } catch {
    upstashFailed = true;
    log.warn('Failed to initialize Upstash — using in-memory rate limiting');
    return null;
  }
}

// 限流结果接口（统一）
export type { RateLimitResult };

// 预定义的限流配置
export const RATE_LIMITS = {
  // 通用 API：每 IP 60s 内 100 次
  api: { limit: 100, windowMs: 60_000 },
  // 登录接口：每 IP 60s 内 5 次
  login: { limit: 5, windowMs: 60_000 },
  // 注册接口：每 IP 60s 内 3 次
  register: { limit: 3, windowMs: 60_000 },
  // 资产上传：每用户 10min 内 20 次
  upload: { limit: 20, windowMs: 600_000 },
  // 形象导出：每用户 5min 内 3 次
  export: { limit: 3, windowMs: 300_000 },
  // 忘记密码：每 IP 60s 内 3 次
  forgotPassword: { limit: 3, windowMs: 60_000 },
} as const;

/** Result indicating the rate limiter itself failed — caller should allow the request */
function failOpenResult(limit: number): RateLimitResult {
  return { allowed: true, remaining: limit, reset: Math.ceil(Date.now() / 1000) + 60, limit };
}

/**
 * 执行速率检查
 * 优先 Upstash Redis（跨实例一致），不可用时回退内存存储。
 * 如果外部服务超时（>200ms），fail-open 允许请求通过。
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const limiter = getUpstashLimiter();
  if (!limiter) {
    return memoryRateLimit(key, limit, windowMs);
  }

  try {
    // Race: Upstash call vs timeout — whichever resolves first wins
    const result = await Promise.race([
      limiter.limit(key),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Upstash timeout')), UPSTASH_TIMEOUT_MS)
      ),
    ]);

    return {
      allowed: result.success,
      remaining: result.remaining,
      reset: Math.ceil(result.reset / 1000),
      limit,
    };
  } catch (err) {
    // Upstash failed or timed out → fail open to avoid self-inflicted outage
    log.warn({ err }, 'Upstash rate limit failed — failing open (allowing request)');
    // Fall back to memory for subsequent requests
    upstashFailed = true;
    return failOpenResult(limit);
  }
}

/** Reset Upstash failure state (for health check recovery) */
export function resetUpstashState(): void {
  upstashFailed = false;
  upstashLimiter = null;
  upstashRedis = null;
}

/**
 * 从 JWT payload 中提取用户标识（不验证签名，仅用于限流）
 */
export function extractUserIdFromAuthHeader(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.slice(7);
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return null;
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf-8'));
    return payload.sub || payload.userId || null;
  } catch {
    return null;
  }
}
