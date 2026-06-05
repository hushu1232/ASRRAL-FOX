import { PrismaClient } from '@prisma/client';

// We need to mock better-sqlite3 before any imports
const mockPrepare = jest.fn();
const mockRun = jest.fn();
const mockGet = jest.fn();
const mockAll = jest.fn();
const mockExec = jest.fn();
const mockPragma = jest.fn();
const mockClose = jest.fn();

const mockStatement = {
  run: mockRun,
  get: mockGet,
  all: mockAll,
};

mockPrepare.mockReturnValue(mockStatement);

const MockDatabase = jest.fn(() => ({
  prepare: mockPrepare,
  exec: mockExec,
  pragma: mockPragma,
  close: mockClose,
}));

jest.mock('better-sqlite3', () => MockDatabase);

jest.mock('@/lib/prisma', () => ({
  prisma: {} as unknown as PrismaClient,
  default: {} as unknown as PrismaClient,
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// Mock seed module
jest.mock('@/lib/db/seed', () => ({
  seedDatabase: jest.fn().mockResolvedValue(undefined),
}));

const mockExistsSync = jest.fn();
const mockReadFileSync = jest.fn();
const mockMkdirSync = jest.fn();
jest.mock('fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  mkdirSync: mockMkdirSync,
}));

describe('db', () => {
  let dbModule: typeof import('@/lib/db');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_PATH;
    mockPrepare.mockReturnValue(mockStatement);
  });

  async function loadModule() {
    dbModule = await import('@/lib/db');
    return dbModule;
  }

  describe('isPostgres', () => {
    it('returns false when DATABASE_URL is empty', async () => {
      process.env.DATABASE_URL = '';
      const mod = await loadModule();
      expect(mod.isPostgres()).toBe(false);
    });

    it('returns true when DATABASE_URL starts with postgresql://', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
      const mod = await loadModule();
      expect(mod.isPostgres()).toBe(true);
    });

    it('returns true when DATABASE_URL starts with postgres://', async () => {
      process.env.DATABASE_URL = 'postgres://localhost:5432/db';
      const mod = await loadModule();
      expect(mod.isPostgres()).toBe(true);
    });

    it('returns false for sqlite DATABASE_URL', async () => {
      process.env.DATABASE_URL = 'file:./data/dev.db';
      const mod = await loadModule();
      expect(mod.isPostgres()).toBe(false);
    });
  });

  describe('getPrisma', () => {
    it('returns the prisma client', async () => {
      const mod = await loadModule();
      const client = mod.getPrisma();
      expect(client).toBeDefined();
    });
  });

  describe('getDb', () => {
    it('throws when in PostgreSQL mode', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/db';
      const mod = await loadModule();
      expect(() => mod.getDb()).toThrow('PostgreSQL is active');
    });

    it('creates a new Database instance on first call', async () => {
      const mod = await loadModule();
      const db = mod.getDb();
      expect(MockDatabase).toHaveBeenCalledTimes(1);
      expect(db).toBeDefined();
    });

    it('returns same instance on subsequent calls', async () => {
      const mod = await loadModule();
      const db1 = mod.getDb();
      const db2 = mod.getDb();
      expect(MockDatabase).toHaveBeenCalledTimes(1);
      expect(db1).toBe(db2);
    });

    it('sets WAL journal mode', async () => {
      const mod = await loadModule();
      mod.getDb();
      expect(mockPragma).toHaveBeenCalledWith('journal_mode = WAL');
    });

    it('enables foreign keys', async () => {
      const mod = await loadModule();
      mod.getDb();
      expect(mockPragma).toHaveBeenCalledWith('foreign_keys = ON');
    });
  });

  describe('initDb', () => {
    it('skips migration in PostgreSQL mode', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost/db';
      const mod = await loadModule();
      expect(() => mod.initDb()).not.toThrow();
    });

    it('runs schema migration when schema.sql exists', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('CREATE TABLE test (id TEXT);');
      const mod = await loadModule();
      mod.initDb();
      expect(mockExec).toHaveBeenCalledWith('CREATE TABLE test (id TEXT);');
    });

    it('skips schema migration when schema.sql does not exist', async () => {
      mockExistsSync.mockReturnValue(false);
      const mod = await loadModule();
      mod.initDb();
      expect(mockExec).not.toHaveBeenCalled();
    });

    it('only runs migration once', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('CREATE TABLE test (id TEXT);');
      const mod = await loadModule();
      mod.initDb();
      mod.initDb();
      expect(mockExec).toHaveBeenCalledTimes(1);
    });
  });

  describe('toSnakeCase', () => {
    it('converts camelCase keys to snake_case', async () => {
      const mod = await loadModule();
      const result = mod.toSnakeCase({ workspaceId: 'ws1', createdAt: '2024-01-01', fileName: 'test.png' });
      expect(result).toEqual({
        workspace_id: 'ws1',
        created_at: '2024-01-01',
        file_name: 'test.png',
      });
    });

    it('converts BigInt values to Number', async () => {
      const mod = await loadModule();
      const result = mod.toSnakeCase({ fileSize: BigInt(9007199254740991) });
      expect(result).toEqual({ file_size: 9007199254740991 });
      expect(typeof result.file_size).toBe('number');
    });

    it('handles consecutive uppercase letters', async () => {
      const mod = await loadModule();
      const result = mod.toSnakeCase({ apiKeyId: 'key1', jwkThumbprint: 'hash' });
      expect(result).toEqual({ api_key_id: 'key1', jwk_thumbprint: 'hash' });
    });

    it('handles already-snake_case keys', async () => {
      const mod = await loadModule();
      const result = mod.toSnakeCase({ already_snake: 'val' });
      expect(result).toEqual({ already_snake: 'val' });
    });

    it('handles empty object', async () => {
      const mod = await loadModule();
      const result = mod.toSnakeCase({});
      expect(result).toEqual({});
    });

    it('preserves non-string, non-bigint values', async () => {
      const mod = await loadModule();
      const result = mod.toSnakeCase({ count: 42, active: true, data: null, items: [1, 2, 3] });
      expect(result).toEqual({ count: 42, active: true, data: null, items: [1, 2, 3] });
    });

    it('handles single word keys', async () => {
      const mod = await loadModule();
      const result = mod.toSnakeCase({ id: '123', name: 'test', email: 'a@b.com' });
      expect(result).toEqual({ id: '123', name: 'test', email: 'a@b.com' });
    });
  });

  describe('closeDb', () => {
    it('calls close on the database if open', async () => {
      const mod = await loadModule();
      mod.getDb();
      mod.closeDb();
      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('does nothing if db was never opened', async () => {
      const mod = await loadModule();
      expect(() => mod.closeDb()).not.toThrow();
    });

    it('does nothing if called twice', async () => {
      const mod = await loadModule();
      mod.getDb();
      mod.closeDb();
      expect(() => mod.closeDb()).not.toThrow();
      expect(mockClose).toHaveBeenCalledTimes(1);
    });
  });
});
