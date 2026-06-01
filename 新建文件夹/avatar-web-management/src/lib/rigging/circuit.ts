// AI Rigging 熔断器 — 超时+熔断配置
import { createCircuitBreaker } from '@/lib/circuit-breaker';

export const riggingBreaker = createCircuitBreaker({
  name: 'rigging-service',
  failureThreshold: parseInt(process.env.RIGGING_CIRCUIT_BREAKER_THRESHOLD || '5', 10),
  resetTimeoutMs: 30_000,
  successThreshold: 2,
});

export const RIGGING_TIMEOUT_MS = parseInt(process.env.RIGGING_TIMEOUT_MS || '130000', 10);
export const RIGGING_BASE_URL = process.env.RIGGING_SERVICE_URL || 'http://localhost:8001';
