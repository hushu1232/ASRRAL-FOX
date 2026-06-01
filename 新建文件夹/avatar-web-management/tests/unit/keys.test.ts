// Mock fs before imports
const mockExistsSync = jest.fn();
const mockMkdirSync = jest.fn();
const mockReadFileSync = jest.fn();
const mockWriteFileSync = jest.fn();

jest.mock('fs', () => ({
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

describe('auth keys', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    delete (process.env as unknown as Record<string, string>).JWT_PRIVATE_KEY;
    delete (process.env as unknown as Record<string, string>).JWT_PUBLIC_KEY;
    delete (process.env as unknown as Record<string, string>).JWT_KEY_ID;
    delete (process.env as unknown as Record<string, string>).JWT_KEYS_DIR;
    delete (process.env as unknown as Record<string, string>).JWT_PRIVATE_KEY_PATH;
    delete (process.env as unknown as Record<string, string>).JWT_PUBLIC_KEY_PATH;
    delete (process.env as unknown as Record<string, string>).NODE_ENV;
  });

  async function loadKeys() {
    return import('@/lib/auth/keys');
  }

  describe('generateRsaKeyPair', () => {
    it('generates a valid RSA key pair', async () => {
      const mod = await loadKeys();
      const keys = mod.generateRsaKeyPair();
      expect(keys.privateKey).toContain('BEGIN PRIVATE KEY');
      expect(keys.publicKey).toContain('BEGIN PUBLIC KEY');
    });

    it('generates PEM format keys', async () => {
      const mod = await loadKeys();
      const keys = mod.generateRsaKeyPair();
      expect(keys.privateKey).toMatch(/^-----BEGIN PRIVATE KEY-----\n/);
      expect(keys.publicKey).toMatch(/^-----BEGIN PUBLIC KEY-----\n/);
    });
  });

  describe('generateAndSaveKeys', () => {
    it('generates keys, saves them, and caches them', async () => {
      const mod = await loadKeys();
      const result = mod.generateAndSaveKeys();
      expect(result.privateKey).toContain('BEGIN PRIVATE KEY');
      expect(result.publicKey).toContain('BEGIN PUBLIC KEY');
      expect(result.kid).toBeDefined();
      expect(mockMkdirSync).toHaveBeenCalled();
      expect(mockWriteFileSync).toHaveBeenCalledTimes(3); // priv, pub, kid
    });
  });

  describe('getPrivateKey', () => {
    it('returns key from JWT_PRIVATE_KEY env var', async () => {
      process.env.JWT_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----';
      const mod = await loadKeys();
      expect(mod.getPrivateKey()).toContain('test\n');
    });

    it('handles escaped newlines in env var', async () => {
      process.env.JWT_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\ntest\\n-----END PRIVATE KEY-----';
      const mod = await loadKeys();
      expect(mod.getPrivateKey()).toContain('test\n');
    });

    it('caches the env var key for subsequent calls', async () => {
      process.env.JWT_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\ncached\n-----END PRIVATE KEY-----';
      const mod = await loadKeys();
      mod.getPrivateKey();
      delete process.env.JWT_PRIVATE_KEY;
      // Should use cached value
      expect(mod.getPrivateKey()).toContain('cached');
    });

    it('loads keys from filesystem when no env var', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation((path: string) => {
        if (path.includes('private.pem')) return '-----BEGIN PRIVATE KEY-----\nfile-key\n-----END PRIVATE KEY-----';
        if (path.includes('public.pem')) return '-----BEGIN PUBLIC KEY-----\nfile-pub\n-----END PUBLIC KEY-----';
        if (path.includes('kid')) return 'file-kid-123';
        return '';
      });
      const mod = await loadKeys();
      expect(mod.getPrivateKey()).toContain('file-key');
    });

    it('returns null when no keys available (dev mode)', async () => {
      mockExistsSync.mockReturnValue(false);
      (process.env as unknown as Record<string, string>).NODE_ENV = 'development';
      const mod = await loadKeys();
      expect(mod.getPrivateKey()).toBeNull();
    });

    it('throws in production when no keys available', async () => {
      mockExistsSync.mockReturnValue(false);
      (process.env as unknown as Record<string, string>).NODE_ENV = 'production';
      const mod = await loadKeys();
      expect(() => mod.getPrivateKey()).toThrow('No RSA private key found');
    });
  });

  describe('getPublicKey', () => {
    it('returns key from JWT_PUBLIC_KEY env var', async () => {
      process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\npub-env\n-----END PUBLIC KEY-----';
      const mod = await loadKeys();
      expect(mod.getPublicKey()).toContain('pub-env');
    });

    it('handles escaped newlines in env var', async () => {
      process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\\npub-nl\\n-----END PUBLIC KEY-----';
      const mod = await loadKeys();
      expect(mod.getPublicKey()).toContain('pub-nl\n');
    });

    it('returns null when no keys available', async () => {
      mockExistsSync.mockReturnValue(false);
      const mod = await loadKeys();
      expect(mod.getPublicKey()).toBeNull();
    });
  });

  describe('getKeyId', () => {
    it('returns key id from JWT_KEY_ID env var', async () => {
      process.env.JWT_KEY_ID = 'my-key-id';
      const mod = await loadKeys();
      expect(mod.getKeyId()).toBe('my-key-id');
    });

    it('returns dev-hs256 as fallback', async () => {
      const mod = await loadKeys();
      expect(mod.getKeyId()).toBe('dev-hs256');
    });
  });

  describe('isRs256Available', () => {
    it('returns true when both keys are present', async () => {
      process.env.JWT_PRIVATE_KEY = 'priv';
      process.env.JWT_PUBLIC_KEY = 'pub';
      const mod = await loadKeys();
      expect(mod.isRs256Available()).toBe(true);
    });

    it('returns false when keys are missing', async () => {
      mockExistsSync.mockReturnValue(false);
      const mod = await loadKeys();
      expect(mod.isRs256Available()).toBe(false);
    });
  });

  describe('getJwtAlgorithm', () => {
    it('returns RS256 when keys available', async () => {
      process.env.JWT_PRIVATE_KEY = 'priv';
      process.env.JWT_PUBLIC_KEY = 'pub';
      const mod = await loadKeys();
      expect(mod.getJwtAlgorithm()).toBe('RS256');
    });

    it('returns HS256 when no keys', async () => {
      mockExistsSync.mockReturnValue(false);
      const mod = await loadKeys();
      expect(mod.getJwtAlgorithm()).toBe('HS256');
    });
  });

  describe('computeJwkThumbprint', () => {
    it('returns base64url-encoded SHA-256 hash', async () => {
      const mod = await loadKeys();
      const thumb = mod.computeJwkThumbprint({ kty: 'RSA', n: 'abc123', e: 'AQAB' });
      expect(thumb).toBeDefined();
      expect(thumb.length).toBeGreaterThan(0);
      // Base64url encoding does not contain + or /
      expect(thumb).not.toContain('+');
      expect(thumb).not.toContain('/');
    });
  });

  describe('exportJwk', () => {
    it('returns null when no public key', async () => {
      mockExistsSync.mockReturnValue(false);
      const mod = await loadKeys();
      expect(mod.exportJwk()).toBeNull();
    });

    it('exports JWK with kid, use, and alg', async () => {
      const { generateKeyPairSync } = require('crypto');
      const { publicKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      process.env.JWT_PUBLIC_KEY = publicKey;
      process.env.JWT_KEY_ID = 'test-kid-jwk';
      const mod = await loadKeys();
      const jwk = mod.exportJwk();
      expect(jwk).not.toBeNull();
      expect(jwk!.kty).toBe('RSA');
      expect(jwk!.kid).toBe('test-kid-jwk');
      expect(jwk!.use).toBe('sig');
      expect(jwk!.alg).toBe('RS256');
    });
  });
});
