import { PrismaClient } from '@prisma/client';
import { createLogger } from '@/lib/logger';

const log = createLogger('prisma');

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Module-level pool reference for metrics collection
let _pool: { idleCount: number; totalCount: number; waitingCount: number } | null = null;

function createPrismaClient(): PrismaClient {
  const dbUrl = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL || 'postgresql://avatar:avatar_dev_2024@localhost:5432/avatar_management';

  const logLevels: Array<'warn' | 'error'> = process.env.NODE_ENV === 'development'
    ? ['warn', 'error']
    : ['error'];

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaPg } = require('@prisma/adapter-pg');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require('pg');
  const poolMax = parseInt(process.env.PG_POOL_MAX || '20', 10);
  const pool = new Pool({
    connectionString: dbUrl,
    max: poolMax,
    idleTimeoutMillis: parseInt(process.env.PG_POOL_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.PG_CONNECTION_TIMEOUT || '5000', 10),
  });
  _pool = pool;

  const client = new PrismaClient({ adapter: new PrismaPg(pool), log: logLevels });

  if (typeof window === 'undefined') {
    client.$connect()
      .then(() => log.info('Prisma connected (PostgreSQL, pool max: %d)', poolMax))
      .catch((err: Error) => log.error({ err }, 'Prisma connection failed'));
  }

  return client;
}

export function getDbPoolStats(): { idleCount: number; totalCount: number; waitingCount: number } | null {
  if (!_pool) return null;
  return {
    idleCount: _pool.idleCount,
    totalCount: _pool.totalCount,
    waitingCount: _pool.waitingCount,
  };
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
