import { getDbPoolStats } from '@/lib/prisma';
import { isRedisAvailable } from '@/lib/redis/client';
import { setDbPoolMetrics, setRedisUp, setRiggingUp } from '@/lib/metrics';

let _interval: ReturnType<typeof setInterval> | null = null;

async function checkRiggingHealth(): Promise<boolean> {
  try {
    const url = process.env.RIGGING_SERVICE_URL || 'http://localhost:8001';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${url}/api/health`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

function collect() {
  // DB pool stats
  const pool = getDbPoolStats();
  if (pool) {
    setDbPoolMetrics(pool.idleCount, pool.totalCount, pool.waitingCount);
  }

  // Redis connectivity
  setRedisUp(isRedisAvailable());

  // Rigging health (async, fire-and-forget)
  checkRiggingHealth().then((up) => setRiggingUp(up));
}

export function startMetricsCollector(): void {
  if (_interval) return;
  collect();
  _interval = setInterval(collect, 30_000);
}

export function stopMetricsCollector(): void {
  if (_interval) {
    clearInterval(_interval);
    _interval = null;
  }
}
