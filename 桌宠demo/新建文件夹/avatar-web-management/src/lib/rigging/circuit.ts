// AI Rigging 熔断器 — 超时+熔断配置
import { createCircuitBreaker } from '@/lib/circuit-breaker';
import { getEnv } from '@/env';

const env = getEnv();

export const riggingBreaker = createCircuitBreaker({
  name: 'rigging-service',
  failureThreshold: env.RIGGING_CIRCUIT_BREAKER_THRESHOLD,
  resetTimeoutMs: 30_000,
  successThreshold: 2,
});

export const RIGGING_TIMEOUT_MS = env.RIGGING_TIMEOUT_MS;
export const RIGGING_BASE_URL = env.RIGGING_SERVICE_URL;
