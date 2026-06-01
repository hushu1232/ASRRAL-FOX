// SQLite → PostgreSQL 数据迁移脚本
//
// 用法:
//   1. 确保 PostgreSQL 运行: docker compose up -d postgres
//   2. 设置环境变量: DATABASE_URL=postgresql://avatar:avatar_dev_2024@localhost:5432/avatar_management
//   3. 运行: node scripts/migrate-to-pg.mjs
//
// 注意: 此脚本读取 SQLite 数据并插入 PostgreSQL

import Database from 'better-sqlite3';
import pg from 'pg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

const SQLITE_PATH = process.env.SQLITE_PATH || path.join(__dirname, '..', 'database', 'data.db');
const PG_URL = process.env.DATABASE_URL || 'postgresql://avatar:avatar_dev_2024@localhost:5432/avatar_management';

async function main() {
  console.log('🔄 SQLite → PostgreSQL 数据迁移\n');

  // 连接 SQLite
  if (!fs.existsSync(SQLITE_PATH)) {
    console.error(`❌ SQLite 数据库不存在: ${SQLITE_PATH}`);
    process.exit(1);
  }
  const sqlite = new Database(SQLITE_PATH);
  sqlite.pragma('journal_mode = WAL');
  console.log(`✅ SQLite 已连接: ${SQLITE_PATH}`);

  // 连接 PostgreSQL
  const pool = new Pool({ connectionString: PG_URL });
  try {
    await pool.query('SELECT 1');
    console.log(`✅ PostgreSQL 已连接: ${PG_URL}\n`);
  } catch (e) {
    console.error('❌ 无法连接到 PostgreSQL:', e.message);
    console.log('请先启动 PostgreSQL: docker compose up -d postgres');
    process.exit(1);
  }

  // 初始化 PG Schema
  console.log('📦 初始化 PostgreSQL Schema...');
  const schemaPath = path.join(__dirname, '..', 'database', 'schema.pg.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  // 移除 psql 特有命令（pg 驱动不支持 \set 等）
  const cleanSchema = schema
    .replace(/\\set\s+\w+\s+'.*'/g, '')
    .replace(/\\ir\s+.*/g, '')
    .replace(/\\echo\s+.*/g, '');
  await pool.query(cleanSchema);
  console.log('✅ Schema 已应用\n');

  // ============================================================
  // 表迁移（按依赖顺序）
  // ============================================================

  const migrations = [
    {
      name: 'workspaces',
      sqliteSql: 'SELECT id, name, plan, sso_config, storage_quota_bytes, member_count, created_at FROM workspaces',
      pgInsert: `INSERT INTO workspaces (id, name, plan, sso_config, storage_quota_bytes, member_count, created_at)
                  VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
      map: (r) => [r.id, r.name, r.plan, r.sso_config, r.storage_quota_bytes, r.member_count, r.created_at],
    },
    {
      name: 'users',
      sqliteSql: 'SELECT id, workspace_id, email, username, password_hash, role, sso_provider, sso_subject, totp_secret, status, last_login_at, created_at FROM users',
      pgInsert: `INSERT INTO users (id, workspace_id, email, username, password_hash, role, sso_provider, sso_subject, totp_secret, status, last_login_at, created_at)
                  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING`,
      map: (r) => [r.id, r.workspace_id, r.email, r.username, r.password_hash, r.role, r.sso_provider || null, r.sso_subject || null, r.totp_secret || null, r.status, r.last_login_at, r.created_at],
    },
    {
      name: 'refresh_tokens',
      sqliteSql: 'SELECT id, user_id, token_hash, expires_at, revoked, created_at FROM refresh_tokens',
      pgInsert: `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked, created_at)
                  VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
      map: (r) => [r.id, r.user_id, r.token_hash, r.expires_at, r.revoked ? true : false, r.created_at],
    },
    {
      name: 'avatars',
      sqliteSql: 'SELECT id, workspace_id, creator_id, name, style, base_model, thumbnail_url, status, current_version_id, is_template, created_at, updated_at FROM avatars',
      pgInsert: `INSERT INTO avatars (id, workspace_id, creator_id, name, style, base_model, thumbnail_url, status, current_version_id, is_template, created_at, updated_at)
                  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING`,
      map: (r) => [r.id, r.workspace_id, r.creator_id, r.name, r.style, r.base_model, r.thumbnail_url, r.status, r.current_version_id, r.is_template ? true : false, r.created_at, r.updated_at],
    },
    {
      name: 'avatar_versions',
      sqliteSql: 'SELECT id, avatar_id, version_number, blendshape_snapshot, body_params, equipped_parts, material_overrides, model_path, preview_screenshot_url, status, review_comment, parent_version_id, created_at FROM avatar_versions',
      pgInsert: `INSERT INTO avatar_versions (id, avatar_id, version_number, blendshape_snapshot, body_params, equipped_parts, material_overrides, model_path, preview_screenshot_url, status, review_comment, parent_version_id, created_at)
                  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO NOTHING`,
      map: (r) => [r.id, r.avatar_id, r.version_number, r.blendshape_snapshot, r.body_params, r.equipped_parts, r.material_overrides || '{}', r.model_path, r.preview_screenshot_url, r.status, r.review_comment, r.parent_version_id, r.created_at],
    },
    {
      name: 'parts',
      sqliteSql: 'SELECT id, asset_id, name, category, slot, gender, style_tags, prefab_url, default_material, created_at FROM parts',
      pgInsert: `INSERT INTO parts (id, asset_id, name, category, slot, gender, style_tags, prefab_url, default_material, created_at)
                  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
      map: (r) => [r.id, r.asset_id, r.name, r.category, r.slot, r.gender, r.style_tags, r.prefab_url, r.default_material, r.created_at],
    },
    {
      name: 'part_rules',
      sqliteSql: 'SELECT id, rule_type, part_a_id, part_b_id, message FROM part_rules',
      pgInsert: `INSERT INTO part_rules (id, rule_type, part_a_id, part_b_id, message)
                  VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      map: (r) => [r.id, r.rule_type, r.part_a_id, r.part_b_id, r.message],
    },
    {
      name: 'assets',
      sqliteSql: 'SELECT id, workspace_id, uploader_id, filename, file_size, mime_type, storage_path, thumbnail_url, asset_type, format, license, metadata, tags, version, status, created_at FROM assets',
      pgInsert: `INSERT INTO assets (id, workspace_id, uploader_id, filename, file_size, mime_type, storage_path, thumbnail_url, asset_type, format, license, metadata, tags, version, status, created_at)
                  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT (id) DO NOTHING`,
      map: (r) => [r.id, r.workspace_id, r.uploader_id, r.filename, r.file_size, r.mime_type, r.storage_path, r.thumbnail_url, r.asset_type, r.format, r.license, r.metadata, r.tags, r.version, r.status, r.created_at],
    },
    {
      name: 'audit_logs',
      sqliteSql: 'SELECT id, user_id, action, resource_type, resource_id, ip_address, user_agent, details, created_at FROM audit_logs',
      pgInsert: `INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, ip_address, user_agent, details, created_at)
                  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
      map: (r) => [r.id, r.user_id, r.action, r.resource_type, r.resource_id, r.ip_address, r.user_agent, r.details || '{}', r.created_at],
    },
    {
      name: 'api_keys',
      sqliteSql: 'SELECT id, user_id, name, key_hash, key_prefix, last_used_at, expires_at, revoked, created_at FROM api_keys',
      pgInsert: `INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, last_used_at, expires_at, revoked, created_at)
                  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
      map: (r) => [r.id, r.user_id, r.name, r.key_hash, r.key_prefix, r.last_used_at, r.expires_at, r.revoked ? true : false, r.created_at],
    },
    {
      name: 'notifications',
      sqliteSql: 'SELECT id, user_id, type, title, body, resource_type, resource_id, is_read, created_at FROM notifications',
      pgInsert: `INSERT INTO notifications (id, user_id, type, title, body, resource_type, resource_id, is_read, created_at)
                  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
      map: (r) => [r.id, r.user_id, r.type, r.title, r.body, r.resource_type, r.resource_id, r.is_read ? true : false, r.created_at],
    },
    {
      name: 'password_reset_tokens',
      sqliteSql: 'SELECT id, user_id, token, expires_at, used, created_at FROM password_reset_tokens',
      pgInsert: `INSERT INTO password_reset_tokens (id, user_id, token, expires_at, used, created_at)
                  VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
      map: (r) => [r.id, r.user_id, r.token, r.expires_at, r.used ? true : false, r.created_at],
    },
  ];

  let totalRows = 0;

  for (const mig of migrations) {
    try {
      // 清空表（保留结构，CASCADE 处理外键依赖）
      await pool.query(`TRUNCATE TABLE ${mig.name} CASCADE`);

      // 从 SQLite 读取
      const rows = sqlite.prepare(mig.sqliteSql).all();
      if (rows.length === 0) {
        console.log(`  ⏭  ${mig.name}: 0 行 (跳过)`);
        continue;
      }

      // 批量插入 PostgreSQL
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const row of rows) {
          const values = mig.map(row);
          await client.query(mig.pgInsert, values);
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }

      totalRows += rows.length;
      console.log(`  ✅ ${mig.name}: ${rows.length} 行`);
    } catch (e) {
      console.error(`  ❌ ${mig.name}: ${e.message}`);
    }
  }

  // 同步自增序列
  console.log('\n🔧 同步序列...');
  const seqTables = ['avatars', 'assets', 'avatar_versions', 'audit_logs', 'notifications', 'api_keys'];
  for (const t of seqTables) {
    try {
      await pool.query(`SELECT setval('${t}_id_seq', COALESCE((SELECT MAX(id::text::bigint) FROM ${t} WHERE id ~ '^[0-9]+$'), 1))`);
    } catch { /* UUID 表没有序列 */ }
  }
  console.log('✅ 序列同步完成');

  sqlite.close();
  await pool.end();

  console.log(`\n🎉 迁移完成！共迁移 ${totalRows} 行数据到 PostgreSQL`);
  console.log('\n接下来:');
  console.log('  1. 在 .env.local 中设置 DATABASE_URL=' + PG_URL);
  console.log('  2. 重启开发服务器: npm run dev');
  console.log('  3. 访问 http://localhost:3000 验证功能');
}

main().catch((e) => {
  console.error('迁移失败:', e);
  process.exit(1);
});
