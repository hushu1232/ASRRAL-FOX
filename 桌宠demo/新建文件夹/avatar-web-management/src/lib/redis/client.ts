// Redis 客户端 — 连接管理、序列化、健康检查
import Redis from 'ioredis';
import { createLogger } from '@/lib/logger';

const log = createLogger('redis');

let _redis: Redis | null = null;

function getRedisConfig() {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'avatar:',
  };
}

export function getRedis(): Redis {
  if (!_redis) {
    const config = getRedisConfig();
    _redis = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      keyPrefix: config.keyPrefix,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: false,
    });

    _redis.on('error', (err) => {
      log.warn({ err }, 'Connection error');
    });

    _redis.on('connect', () => {
      log.info('Connected to %s:%s', config.host, config.port);
    });

    _redis.on('close', () => {
      log.warn('Connection closed');
    });
  }
  return _redis;
}

export function isRedisAvailable(): boolean {
  try {
    return _redis !== null && _redis.status === 'ready';
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit();
    _redis = null;
  }
}
