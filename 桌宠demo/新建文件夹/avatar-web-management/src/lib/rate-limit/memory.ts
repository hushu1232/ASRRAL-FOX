// 内存滑动窗口速率限制器 — 适用于 Edge Middleware（无 Redis 时回退）
// 生产环境推荐使用 Upstash Redis 以获得跨实例一致性

interface WindowEntry {
  timestamps: number[];
}

const store = new Map<string, WindowEntry>();

// 定期清理过期条目（每 60 秒）
const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    // 移除超过 10 分钟未活跃的条目
    if (entry.timestamps.length === 0 || entry.timestamps[entry.timestamps.length - 1] < now - 600_000) {
      store.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number; // Unix timestamp (seconds) when the window resets
  limit: number;
}

/**
 * 滑动窗口速率检查
 * @param key 唯一标识（IP + 路由）
 * @param limit 窗口内最大请求数
 * @param windowMs 窗口大小（毫秒）
 */
export function memoryRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  cleanup();

  const now = Date.now();
  const windowStart = now - windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // 移除窗口外的旧时间戳
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  const currentCount = entry.timestamps.length;

  if (currentCount >= limit) {
    // 计算下次重置时间
    const oldestInWindow = entry.timestamps[0];
    const reset = Math.ceil((oldestInWindow + windowMs) / 1000);
    return { allowed: false, remaining: 0, reset, limit };
  }

  // 记录本次请求
  entry.timestamps.push(now);
  const remaining = limit - entry.timestamps.length;
  const reset = Math.ceil((now + windowMs) / 1000);

  return { allowed: true, remaining, reset, limit };
}

export function resetMemoryRateLimit(key: string): void {
  store.delete(key);
}
