import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { createLogger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import type { PrismaClient } from '@prisma/client';

const log = createLogger('db');

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'database', 'data.db');
const PG_URL = process.env.DATABASE_URL || '';

let db: Database.Database | null = null;

/** 检测是否使用 PostgreSQL */
export function isPostgres(): boolean {
  return PG_URL.startsWith('postgresql://') || PG_URL.startsWith('postgres://');
}

/** 获取 Prisma 客户端（用于新式查询） */
export function getPrisma(): PrismaClient {
  return prisma;
}

export function getDb(): Database.Database {
  if (isPostgres()) {
    throw new Error(
      'PostgreSQL is active. Use pgQuery/pgExecute from @/lib/db/pg instead of getDb(). ' +
      'Check isPostgres() before calling getDb().'
    );
  }
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

let migrated = false;
let seeded = false;

export function initDb(): void {
  if (isPostgres()) {
    log.info('PostgreSQL mode — skipping SQLite migration. Run schema.pg.sql manually.');
    // PG 模式下跳过 SQLite 种子（PG 有自己的 seed）
    return;
  }

  const database = getDb();
  if (!migrated) {
    migrated = true;
    const schemaPath = path.join(process.cwd(), 'database', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      database.exec(schema);
      log.info('Schema migrated successfully');
    }
  }
  if (!seeded) {
    seeded = true;
    import('./seed').then(m => m.seedDatabase()).catch(() => {});
  }
}

/** 将 Prisma 返回的 camelCase 对象转换为 snake_case，保持与 raw SQL 响应格式一致 */
export function toSnakeCase<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const snakeKey = key.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
    out[snakeKey] = typeof value === 'bigint' ? Number(value) : value;
  }
  return out;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
