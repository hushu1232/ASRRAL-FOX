const mockUpstashLimit = jest.fn();

jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow() {
      return {};
    }

    limit = mockUpstashLimit;
  },
}));

import { checkRateLimit, resetUpstashState } from '@/lib/rate-limit';
import { resetMemoryRateLimit } from '@/lib/rate-limit/memory';

describe('rate-limit degraded mode', () => {
  const key = 'rl-degraded:test';

  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.test';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    mockUpstashLimit.mockReset();
    resetUpstashState();
    resetMemoryRateLimit(key);
  });

  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    resetUpstashState();
    resetMemoryRateLimit(key);
  });

  it('keeps the current request inside the configured memory bound when Upstash fails', async () => {
    mockUpstashLimit.mockRejectedValueOnce(new Error('redis unavailable'));

    const first = await checkRateLimit(key, 2, 60_000);
    const second = await checkRateLimit(key, 2, 60_000);
    const third = await checkRateLimit(key, 2, 60_000);

    expect(first).toMatchObject({ allowed: true, remaining: 1, limit: 2 });
    expect(second).toMatchObject({ allowed: true, remaining: 0, limit: 2 });
    expect(third).toMatchObject({ allowed: false, remaining: 0, limit: 2 });
    expect(mockUpstashLimit).toHaveBeenCalledTimes(1);
  });
});
