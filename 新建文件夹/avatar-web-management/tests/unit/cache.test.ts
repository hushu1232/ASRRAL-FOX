import { tryCacheHit, cacheResponse, invalidateCache, buildCacheKey, CACHE_TTL } from '@/lib/cache';

// Mock the redis module
jest.mock('@/lib/redis', () => ({
  cacheGet: jest.fn(),
  cacheSet: jest.fn(),
  cacheDelPattern: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  }),
}));

import { cacheGet, cacheSet, cacheDelPattern } from '@/lib/redis';
import { NextResponse } from 'next/server';

const mockedCacheGet = cacheGet as jest.MockedFunction<typeof cacheGet>;
const mockedCacheSet = cacheSet as jest.MockedFunction<typeof cacheSet>;
const mockedCacheDelPattern = cacheDelPattern as jest.MockedFunction<typeof cacheDelPattern>;

describe('cache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CACHE_TTL', () => {
    it('has TTL values for all resource types', () => {
      expect(CACHE_TTL.assets).toBeGreaterThan(0);
      expect(CACHE_TTL.avatars).toBeGreaterThan(0);
      expect(CACHE_TTL.avatarDetail).toBeGreaterThan(0);
      expect(CACHE_TTL.templates).toBeGreaterThan(0);
      expect(CACHE_TTL.parts).toBeGreaterThan(0);
    });

    it('avatarDetail TTL is longer than avatars list', () => {
      expect(CACHE_TTL.avatarDetail).toBeGreaterThan(CACHE_TTL.avatars);
    });
  });

  describe('tryCacheHit', () => {
    it('returns NextResponse with X-Cache: HIT on cache hit', async () => {
      mockedCacheGet.mockResolvedValue({ status: 200, body: { id: '1' } });
      const result = await tryCacheHit('avatar:cache:test:key');
      expect(result).not.toBeNull();
      expect(result!.headers.get('X-Cache')).toBe('HIT');
      const body = await result!.json();
      expect(body).toEqual({ id: '1' });
    });

    it('returns null on cache miss', async () => {
      mockedCacheGet.mockResolvedValue(null);
      const result = await tryCacheHit('missing:key');
      expect(result).toBeNull();
    });
  });

  describe('cacheResponse', () => {
    it('caches successful 200 responses', async () => {
      const response = NextResponse.json({ data: 'test' });
      await cacheResponse('test:key', response, 60);
      expect(mockedCacheSet).toHaveBeenCalledWith(
        'test:key',
        { status: 200, body: { data: 'test' } },
        60,
      );
    });

    it('does not cache error responses (status >= 400)', async () => {
      const response = NextResponse.json({ error: 'bad' }, { status: 400 });
      await cacheResponse('test:key', response, 60);
      expect(mockedCacheSet).not.toHaveBeenCalled();
    });

    it('does not cache 3xx responses', async () => {
      const response = NextResponse.json(null, { status: 301 });
      await cacheResponse('test:key', response, 60);
      expect(mockedCacheSet).not.toHaveBeenCalled();
    });

    it('handles non-JSON body gracefully', async () => {
      // Create a response whose .json() will fail
      const response = new Response('plain text', { status: 200 });
      const nextRes = new NextResponse(response.body, { status: 200 });
      await expect(cacheResponse('test:key', nextRes, 60)).resolves.toBeUndefined();
    });
  });

  describe('invalidateCache', () => {
    it('calls cacheDelPattern with correct pattern', async () => {
      await invalidateCache('avatars');
      expect(mockedCacheDelPattern).toHaveBeenCalledWith('avatar:cache:avatars:*');
    });

    it('does not throw when redis fails', async () => {
      mockedCacheDelPattern.mockRejectedValue(new Error('connection refused'));
      await expect(invalidateCache('avatars')).resolves.toBeUndefined();
    });
  });

  describe('buildCacheKey', () => {
    it('builds key from prefix and URL', () => {
      const key = buildCacheKey('avatars', 'http://localhost:3000/api/avatars?page=1');
      expect(key).toBe('avatar:cache:avatars:/api/avatars?page=1');
    });

    it('handles URL without query params', () => {
      const key = buildCacheKey('assets', 'http://localhost:3000/api/assets');
      expect(key).toBe('avatar:cache:assets:/api/assets');
    });
  });
});
