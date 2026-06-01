import { memoryRateLimit, resetMemoryRateLimit } from '@/lib/rate-limit/memory';
import { extractUserIdFromAuthHeader, checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

describe('RATE_LIMITS', () => {
  it('defines limits for all protected endpoints', () => {
    expect(RATE_LIMITS.api.limit).toBe(100);
    expect(RATE_LIMITS.login.limit).toBe(5);
    expect(RATE_LIMITS.register.limit).toBe(3);
    expect(RATE_LIMITS.upload.limit).toBe(20);
    expect(RATE_LIMITS.export.limit).toBe(3);
    expect(RATE_LIMITS.forgotPassword.limit).toBe(3);
  });

  it('api has 60s window', () => {
    expect(RATE_LIMITS.api.windowMs).toBe(60_000);
  });

  it('upload has 10min window', () => {
    expect(RATE_LIMITS.upload.windowMs).toBe(600_000);
  });

  it('export has 5min window', () => {
    expect(RATE_LIMITS.export.windowMs).toBe(300_000);
  });
});

describe('checkRateLimit', () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it('allows request within limit (memory fallback)', async () => {
    const key = 'rl-test:allow';
    const result = await checkRateLimit(key, 10, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
    expect(result.limit).toBe(10);
  });

  it('blocks request exceeding limit (memory fallback)', async () => {
    const key = 'rl-test:block';
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(key, 5, 60_000);
    }
    const result = await checkRateLimit(key, 5, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('returns reset timestamp in the future for allowed request', async () => {
    const key = 'rl-test:reset';
    const result = await checkRateLimit(key, 10, 60_000);
    expect(result.reset).toBeGreaterThan(Date.now() / 1000);
  });
});

describe('memoryRateLimit', () => {
  const key = 'test:ip:127.0.0.1';

  afterEach(() => {
    resetMemoryRateLimit(key);
  });

  it('allows requests within limit', () => {
    for (let i = 0; i < 5; i++) {
      const result = memoryRateLimit(key, 10, 60_000);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10 - i - 1);
    }
  });

  it('blocks requests exceeding limit', () => {
    for (let i = 0; i < 3; i++) {
      memoryRateLimit(key, 3, 60_000);
    }
    const result = memoryRateLimit(key, 3, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.limit).toBe(3);
  });

  it('returns correct reset timestamp', () => {
    const result = memoryRateLimit(key, 5, 60_000);
    expect(result.allowed).toBe(true);
    // Reset time should be in the future
    expect(result.reset).toBeGreaterThan(Date.now() / 1000);
  });

  it('allows requests after window expires', async () => {
    const key2 = 'test:window:expire';
    // Force an entry with old timestamps
    for (let i = 0; i < 5; i++) {
      memoryRateLimit(key2, 5, 10); // 10ms window
    }
    // Blocked
    expect(memoryRateLimit(key2, 5, 10).allowed).toBe(false);

    // Wait for window to expire
    await new Promise((r) => setTimeout(r, 15));

    // Now allowed again
    expect(memoryRateLimit(key2, 5, 10).allowed).toBe(true);
    resetMemoryRateLimit(key2);
  });

  it('different keys have independent counters', () => {
    const keyA = 'test:a';
    const keyB = 'test:b';

    for (let i = 0; i < 3; i++) {
      memoryRateLimit(keyA, 3, 60_000);
    }
    expect(memoryRateLimit(keyA, 3, 60_000).allowed).toBe(false);
    expect(memoryRateLimit(keyB, 3, 60_000).allowed).toBe(true);

    resetMemoryRateLimit(keyA);
    resetMemoryRateLimit(keyB);
  });
});

describe('extractUserIdFromAuthHeader', () => {
  it('returns null for missing header', () => {
    expect(extractUserIdFromAuthHeader(null)).toBeNull();
  });

  it('returns null for non-Bearer token', () => {
    expect(extractUserIdFromAuthHeader('Basic abc123')).toBeNull();
  });

  it('extracts sub claim from JWT payload', () => {
    // Manually crafted JWT with { sub: 'user-123' } payload
    const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'user-123', role: 'user' })).toString('base64url');
    const token = `Bearer ${header}.${payload}.fake-sig`;

    const userId = extractUserIdFromAuthHeader(token);
    expect(userId).toBe('user-123');
  });

  it('returns null for malformed token', () => {
    expect(extractUserIdFromAuthHeader('Bearer invalid')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractUserIdFromAuthHeader('')).toBeNull();
  });

  it('returns null for token with malformed base64 payload', () => {
    // The payload portion is not valid base64url
    expect(extractUserIdFromAuthHeader('Bearer header.!!!invalid$$$.sig')).toBeNull();
  });
});
