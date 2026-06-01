// Redis 索引文件 — 统一导出
export { getRedis, isRedisAvailable, closeRedis } from './client';
export { cacheGet, cacheSet, cacheDel, cacheDelPattern, cacheIncr, cacheTtl, cacheKey } from './cache';
