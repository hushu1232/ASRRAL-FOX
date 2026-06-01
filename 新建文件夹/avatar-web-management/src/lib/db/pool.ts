import { Pool } from 'pg';
import { createLogger } from '@/lib/logger';

const log = createLogger('db:pool');

let pool: Pool | null = null;
let configuredMax = 20;

export interface PoolStats {
  total: number;
  idle: number;
  waiting: number;
  active: number;
  max: number;
}

export function getSharedPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is required for PostgreSQL mode');
    }
    configuredMax = parseInt(process.env.PG_POOL_MAX || '20', 10);
    const idleTimeout = parseInt(process.env.PG_POOL_IDLE_TIMEOUT || '30000', 10);
    const connectionTimeout = parseInt(process.env.PG_CONNECTION_TIMEOUT || '5000', 10);

    pool = new Pool({
      connectionString: url,
      max: configuredMax,
      idleTimeoutMillis: idleTimeout,
      connectionTimeoutMillis: connectionTimeout,
      min: parseInt(process.env.PG_POOL_MIN || '1', 10),
      allowExitOnIdle: true,
    });

    pool.on('connect', () => {
      log.debug('New client connected to pool');
    });

    pool.on('remove', () => {
      log.debug('Client removed from pool');
    });

    pool.on('error', (err: Error) => {
      log.error({ err }, 'Unexpected pool client error');
    });

    if (process.env.NODE_ENV !== 'test') {
      setInterval(() => {
        if (!pool) return;
        const s = getPoolStats();
        log.info(
          { pool: s },
          'Pool stats: %d/%d active, %d idle, %d waiting',
          s.active, s.max, s.idle, s.waiting
        );
      }, 300000);
    }
  }
  return pool;
}

export function getPoolStats(): PoolStats {
  if (!pool) return { total: 0, idle: 0, waiting: 0, active: 0, max: 0 };
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    active: pool.totalCount - pool.idleCount,
    max: configuredMax,
  };
}

export async function closeSharedPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    log.info('Pool closed');
  }
}
