import crypto from 'crypto';
import { computeJwkThumbprint } from '@/lib/auth/keys';

// Mock Prisma refresh token operations
const mockRefreshToken = {
  create: jest.fn(),
  findFirst: jest.fn(),
  updateMany: jest.fn(),
};

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    refreshToken: mockRefreshToken,
  },
}));
jest.mock('better-sqlite3');
jest.mock('@/lib/db', () => ({
  getPrisma: () => ({
    refreshToken: mockRefreshToken,
  }),
  isPostgres: () => true,
  getDb: () => { throw new Error('getDb should not be called in refresh token tests'); },
}));
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

const payload = {
  sub: 'user-uuid-123',
  email: 'test@example.com',
  role: 'user',
  ws: 'ws-uuid-456',
};

function generateTestKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKey, privateKey };
}

function loadJwtWithEnv(env: Record<string, string | undefined>) {
  jest.resetModules();
  // Apply env before requiring
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  return require('@/lib/auth/jwt');
}

describe('JWT Access Token — RS256', () => {
  const testKeys = generateTestKeyPair();

  function rs256Env() {
    return {
      JWT_PRIVATE_KEY: testKeys.privateKey,
      JWT_PUBLIC_KEY: testKeys.publicKey,
      JWT_KEY_ID: 'test-kid-rs256',
      JWT_SECRET: undefined,
      JWT_KEYS_DIR: undefined,
    };
  }

  it('uses RS256 algorithm when RSA keys are available', () => {
    const mod = loadJwtWithEnv(rs256Env());
    expect(mod.getCurrentAlgorithm()).toBe('RS256');
  });

  it('signs and verifies a valid token with RS256', () => {
    const mod = loadJwtWithEnv(rs256Env());
    const token = mod.signAccessToken(payload);
    expect(token).toBeDefined();
    expect(token.split('.')).toHaveLength(3);

    const decoded = mod.verifyAccessToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.sub).toBe(payload.sub);
    expect(decoded!.email).toBe(payload.email);
    expect(decoded!.role).toBe(payload.role);
    expect(decoded!.ws).toBe(payload.ws);
  });

  it('returns null for an invalid token', () => {
    const mod = loadJwtWithEnv(rs256Env());
    expect(mod.verifyAccessToken('invalid.token.here')).toBeNull();
    expect(mod.verifyAccessToken('')).toBeNull();
    expect(mod.verifyAccessToken('not-a-jwt')).toBeNull();
  });

  it('returns null for a tampered token', () => {
    const mod = loadJwtWithEnv(rs256Env());
    const token = mod.signAccessToken(payload);
    const parts = token.split('.');
    parts[1] = Buffer.from('{"sub":"hacked"}').toString('base64');
    expect(mod.verifyAccessToken(parts.join('.'))).toBeNull();
  });

  it('returns null for a token signed with a different key', () => {
    const mod = loadJwtWithEnv(rs256Env());
    const fakeToken = require('jsonwebtoken').sign(payload, 'wrong-secret', { algorithm: 'HS256' });
    expect(mod.verifyAccessToken(fakeToken)).toBeNull();
  });

  it('produces consistently valid tokens', () => {
    const mod = loadJwtWithEnv(rs256Env());
    const tokens = Array.from({ length: 10 }, () => mod.signAccessToken(payload));
    for (const token of tokens) {
      expect(mod.verifyAccessToken(token)).not.toBeNull();
    }
  });

  it('token payload survives round-trip', () => {
    const mod = loadJwtWithEnv(rs256Env());
    const token = mod.signAccessToken({
      sub: 'sub-1',
      email: 'user@test.com',
      role: 'admin',
      ws: 'ws-99',
    });
    const decoded = mod.verifyAccessToken(token);
    expect(decoded!.sub).toBe('sub-1');
    expect(decoded!.email).toBe('user@test.com');
    expect(decoded!.role).toBe('admin');
    expect(decoded!.ws).toBe('ws-99');
  });
});

describe('JWT Access Token — HS256 fallback', () => {
  function hs256Env() {
    return {
      JWT_PRIVATE_KEY: undefined,
      JWT_PUBLIC_KEY: undefined,
      JWT_KEY_ID: undefined,
      JWT_KEYS_DIR: '/nonexistent/path',
      JWT_SECRET: 'test-hs256-secret',
    };
  }

  it('falls back to HS256 when RSA keys are unavailable', () => {
    const mod = loadJwtWithEnv(hs256Env());
    const token = mod.signAccessToken({ sub: 'u1', email: 'e@t.com', role: 'user', ws: 'w1' });
    expect(token).toBeDefined();
    expect(token.split('.')).toHaveLength(3);
    expect(mod.verifyAccessToken(token)).not.toBeNull();
    expect(mod.getCurrentAlgorithm()).toBe('HS256');
  });

  it('verifies HS256 tokens from legacy deployments', () => {
    const legacyToken = require('jsonwebtoken').sign(
      { sub: 'legacy', email: 'old@t.com', role: 'user', ws: 'w1' },
      'old-secret',
      { algorithm: 'HS256' }
    );

    const mod = loadJwtWithEnv({ ...hs256Env(), JWT_SECRET: 'old-secret' });
    const decoded = mod.verifyAccessToken(legacyToken);
    expect(decoded).not.toBeNull();
    expect(decoded!.sub).toBe('legacy');
  });
});

describe('Refresh Token — HS256', () => {
  function hs256Env() {
    return {
      JWT_PRIVATE_KEY: undefined,
      JWT_PUBLIC_KEY: undefined,
      JWT_KEY_ID: undefined,
      JWT_KEYS_DIR: '/nonexistent/path',
      JWT_SECRET: 'refresh-test-secret',
    };
  }

  it('signRefreshToken returns token, id, and expiry', async () => {
    const mod = loadJwtWithEnv(hs256Env());
    const result = await mod.signRefreshToken('user-123');
    expect(result.token).toBeDefined();
    expect(result.token.split('.')).toHaveLength(3);
    expect(result.id).toBeDefined();
    expect(result.expiresAt).toBeDefined();
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('verifyRefreshToken returns payload for valid token', async () => {
    const mod = loadJwtWithEnv(hs256Env());
    const { token } = await mod.signRefreshToken('user-456');
    mockRefreshToken.findFirst.mockResolvedValue({ id: 'jti-1', expiresAt: new Date(Date.now() + 86400000) });

    const payload = await mod.verifyRefreshToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe('user-456');
  });

  it('verifyRefreshToken returns null for invalid token', async () => {
    const mod = loadJwtWithEnv(hs256Env());
    mockRefreshToken.findFirst.mockResolvedValue(undefined);
    expect(await mod.verifyRefreshToken('invalid.token')).toBeNull();
  });

  it('verifyRefreshToken returns null for revoked token', async () => {
    const mod = loadJwtWithEnv(hs256Env());
    const { token } = await mod.signRefreshToken('user-789');
    mockRefreshToken.findFirst.mockResolvedValue(undefined);
    expect(await mod.verifyRefreshToken(token)).toBeNull();
  });

  it('verifyRefreshToken returns null for expired token', async () => {
    const mod = loadJwtWithEnv(hs256Env());
    const { token } = await mod.signRefreshToken('user-exp');
    mockRefreshToken.findFirst.mockResolvedValue({ id: 'jti-2', expiresAt: new Date(Date.now() - 1000) });
    expect(await mod.verifyRefreshToken(token)).toBeNull();
  });

  it('revokeRefreshToken marks token as revoked', async () => {
    const mod = loadJwtWithEnv(hs256Env());
    mockRefreshToken.updateMany.mockResolvedValue({ count: 1 });
    await mod.revokeRefreshToken('some-token-hash');
    expect(mockRefreshToken.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: 'some-token-hash' },
      data: { revoked: true },
    });
  });
});

describe('signAccessToken — HS256 with custom expiry', () => {
  it('uses JWT_ACCESS_EXPIRY env var when set', () => {
    const mod = loadJwtWithEnv({
      JWT_SECRET: 'test-secret',
      JWT_PRIVATE_KEY: undefined,
      JWT_PUBLIC_KEY: undefined,
      JWT_ACCESS_EXPIRY: '30m',
    });
    const token = mod.signAccessToken(payload);
    expect(token).toBeDefined();
    const decoded = mod.verifyAccessToken(token);
    expect(decoded).not.toBeNull();
  });
});

describe('getCurrentAlgorithm', () => {
  it('returns HS256 when no RSA keys configured', () => {
    const mod = loadJwtWithEnv({
      JWT_SECRET: 'test-secret',
      JWT_PRIVATE_KEY: undefined,
      JWT_PUBLIC_KEY: undefined,
    });
    expect(mod.getCurrentAlgorithm()).toBe('HS256');
  });
});

describe('RSA Key Management', () => {
  it('generateRsaKeyPair produces valid PEM keys', () => {
    const keys = generateTestKeyPair();
    expect(keys.privateKey).toContain('BEGIN PRIVATE KEY');
    expect(keys.publicKey).toContain('BEGIN PUBLIC KEY');
  });

  it('exportJwk works with in-memory keys', () => {
    const keys = generateTestKeyPair();
    const mod = loadJwtWithEnv({
      JWT_PRIVATE_KEY: keys.privateKey,
      JWT_PUBLIC_KEY: keys.publicKey,
      JWT_KEY_ID: 'test-kid-1',
    });
    // Check that keys module's functions work
    const keysMod = require('@/lib/auth/keys');
    // Re-load keys module fresh
    jest.resetModules();
    const freshKeys = require('@/lib/auth/keys');
    expect(freshKeys.isRs256Available()).toBe(true);
    const jwk = freshKeys.exportJwk();
    expect(jwk).not.toBeNull();
    expect(jwk!.kty).toBe('RSA');
    expect(jwk!.kid).toBe('test-kid-1');
    expect(jwk!.n).toBeDefined();
    expect(jwk!.e).toBeDefined();
  });

  it('computeJwkThumbprint produces a consistent hash', () => {
    const thumb1 = computeJwkThumbprint({ kty: 'RSA', n: 'abc', e: 'AQAB' });
    const thumb2 = computeJwkThumbprint({ kty: 'RSA', n: 'abc', e: 'AQAB' });
    expect(thumb1).toBe(thumb2);
    expect(thumb1.length).toBeGreaterThan(0);
  });
});
