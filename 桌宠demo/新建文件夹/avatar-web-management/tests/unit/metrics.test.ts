import {
  cacheHitsTotal,
  cacheMissesTotal,
  getMetrics,
  httpRequestsInFlight,
  observeDbQuery,
  observeHttpRequest,
  rateLimitHits,
  setDbPoolMetrics,
  setRedisUp,
  setRiggingUp,
} from '@/lib/metrics';

describe('metrics', () => {
  it('initializes the registry and records application metrics', async () => {
    httpRequestsInFlight.inc();
    httpRequestsInFlight.dec();
    rateLimitHits.inc();
    rateLimitHits.inc({ route: '/api/avatars' });
    cacheHitsTotal.inc();
    cacheHitsTotal.inc({ cache_type: 'memory' });
    cacheMissesTotal.inc();
    cacheMissesTotal.inc({ cache_type: 'memory' });

    observeHttpRequest('GET', '/api/health', 200, 0.01);
    observeDbQuery('findMany', 'Avatar', 12);
    setDbPoolMetrics(2, 4, 1);
    setRedisUp(true);
    setRiggingUp(false);

    const output = await getMetrics();

    expect(output).toContain('avatar_http_requests_total');
    expect(output).toContain('avatar_db_queries_total');
    expect(output).toContain('avatar_redis_up');
    expect(output).toContain('avatar_rigging_up');
  });
});
