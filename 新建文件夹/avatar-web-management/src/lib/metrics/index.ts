// Metrics are lazily initialized to avoid importing prom-client (a Node.js-only
// package) in Edge Runtime contexts (middleware, etc.).  The module-level exports
// are stubs that no-op until `initMetrics()` is called from the Node.js runtime.
import type * as PromClient from 'prom-client';

let registry: PromClient.Registry | null = null;
let httpRequestDuration: PromClient.Histogram | null = null;
let httpRequestsTotal: PromClient.Counter | null = null;
let _httpRequestsInFlight: PromClient.Gauge | null = null;
let _rateLimitHits: PromClient.Counter | null = null;
let _dbQueryDuration: PromClient.Histogram | null = null;
let _dbQueriesTotal: PromClient.Counter | null = null;
let _cacheHitsTotal: PromClient.Counter | null = null;
let _cacheMissesTotal: PromClient.Counter | null = null;
let _dbPoolIdle: PromClient.Gauge | null = null;
let _dbPoolTotal: PromClient.Gauge | null = null;
let _dbPoolWaiting: PromClient.Gauge | null = null;
let _redisUp: PromClient.Gauge | null = null;
let _riggingUp: PromClient.Gauge | null = null;

function isNodeRuntime(): boolean {
  return typeof process !== 'undefined' && process.release?.name === 'node';
}

function ensure(): boolean {
  if (registry) return true;
  if (!isNodeRuntime()) return false;
  // Dynamic require so bundlers don't pull prom-client into Edge chunks
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const client: typeof PromClient = require('prom-client');
  registry = new client.Registry();
  client.collectDefaultMetrics({ register: registry, prefix: 'avatar_' });

  httpRequestDuration = new client.Histogram({
    name: 'avatar_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [registry],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5, 10],
  });
  httpRequestsTotal = new client.Counter({
    name: 'avatar_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [registry],
  });
  _httpRequestsInFlight = new client.Gauge({
    name: 'avatar_http_requests_in_flight',
    help: 'Number of HTTP requests currently being processed',
    registers: [registry],
  });
  _rateLimitHits = new client.Counter({
    name: 'avatar_rate_limit_hits_total',
    help: 'Total number of rate-limited requests',
    labelNames: ['route'] as const,
    registers: [registry],
  });
  _dbQueryDuration = new client.Histogram({
    name: 'avatar_db_query_duration_seconds',
    help: 'Database query duration in seconds',
    labelNames: ['operation', 'model'] as const,
    registers: [registry],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
  });
  _dbQueriesTotal = new client.Counter({
    name: 'avatar_db_queries_total',
    help: 'Total number of database queries',
    labelNames: ['operation', 'model'] as const,
    registers: [registry],
  });
  _cacheHitsTotal = new client.Counter({
    name: 'avatar_cache_hits_total',
    help: 'Total number of cache hits',
    labelNames: ['cache_type'] as const,
    registers: [registry],
  });
  _cacheMissesTotal = new client.Counter({
    name: 'avatar_cache_misses_total',
    help: 'Total number of cache misses',
    labelNames: ['cache_type'] as const,
    registers: [registry],
  });
  _dbPoolIdle = new client.Gauge({
    name: 'avatar_db_pool_idle',
    help: 'Number of idle database connections in the pool',
    registers: [registry],
  });
  _dbPoolTotal = new client.Gauge({
    name: 'avatar_db_pool_total',
    help: 'Total number of database connections in the pool',
    registers: [registry],
  });
  _dbPoolWaiting = new client.Gauge({
    name: 'avatar_db_pool_waiting',
    help: 'Number of clients waiting for a database connection',
    registers: [registry],
  });
  _redisUp = new client.Gauge({
    name: 'avatar_redis_up',
    help: 'Whether Redis is reachable (1 = up, 0 = down)',
    registers: [registry],
  });
  _riggingUp = new client.Gauge({
    name: 'avatar_rigging_up',
    help: 'Whether the rigging service is reachable (1 = up, 0 = down)',
    registers: [registry],
  });
  return true;
}

// ---- Exports (return no-op stubs until Node.js runtime initializes) ----

export const httpRequestsInFlight = {
  inc() { if (ensure()) _httpRequestsInFlight!.inc(); },
  dec() { if (ensure()) _httpRequestsInFlight!.dec(); },
};

export const rateLimitHits = {
  inc(labels?: Record<string, string>) { if (ensure()) labels ? _rateLimitHits!.inc(labels) : _rateLimitHits!.inc(); },
};

export const cacheHitsTotal = {
  inc(labels?: Record<string, string>) { if (ensure()) labels ? _cacheHitsTotal!.inc(labels) : _cacheHitsTotal!.inc(); },
};

export const cacheMissesTotal = {
  inc(labels?: Record<string, string>) { if (ensure()) labels ? _cacheMissesTotal!.inc(labels) : _cacheMissesTotal!.inc(); },
};

// ---- Helpers ----

export function observeHttpRequest(method: string, route: string, statusCode: number, durationSec: number) {
  if (!ensure()) return;
  httpRequestsTotal!.inc({ method, route, status_code: String(statusCode) });
  httpRequestDuration!.observe({ method, route, status_code: String(statusCode) }, durationSec);
}

export function observeDbQuery(operation: string, model: string, durationMs: number) {
  if (!ensure()) return;
  const sec = durationMs / 1000;
  _dbQueryDuration!.observe({ operation, model }, sec);
  _dbQueriesTotal!.inc({ operation, model });
}

// ---- Infrastructure gauge setters ----

export function setDbPoolMetrics(idle: number, total: number, waiting: number) {
  if (!ensure()) return;
  _dbPoolIdle!.set(idle);
  _dbPoolTotal!.set(total);
  _dbPoolWaiting!.set(waiting);
}

export function setRedisUp(up: boolean) {
  if (!ensure()) return;
  _redisUp!.set(up ? 1 : 0);
}

export function setRiggingUp(up: boolean) {
  if (!ensure()) return;
  _riggingUp!.set(up ? 1 : 0);
}

export async function getMetrics(): Promise<string> {
  if (!ensure()) return '# prom-client not available in this runtime\n';
  return registry!.metrics();
}
