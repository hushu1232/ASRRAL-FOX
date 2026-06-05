#!/usr/bin/env node
/**
 * Database backup script for PostgreSQL.
 *
 * Usage:
 *   node scripts/backup.mjs                    # backup to ./backups/
 *   node scripts/backup.mjs --output ./my-backups  # custom output dir
 *   node scripts/backup.mjs --compress          # gzip the output
 *   node scripts/backup.mjs --retain 7          # keep last 7 backups, delete older
 *
 * Requires pg_dump in PATH. Set BACKUP_PG_URL to override DATABASE_URL.
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { output: null, compress: false, retain: 0 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) {
      opts.output = args[++i];
    } else if (args[i] === '--compress') {
      opts.compress = true;
    } else if (args[i] === '--retain' && args[i + 1]) {
      opts.retain = parseInt(args[++i], 10);
    }
  }
  return opts;
}

function getDbUrl() {
  const url = process.env.BACKUP_PG_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('Error: DATABASE_URL or BACKUP_PG_URL must be set');
    process.exit(1);
  }
  return url;
}

function timestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function pruneBackups(dir, retain) {
  if (retain <= 0) return;
  const files = readdirSync(dir)
    .filter(f => f.endsWith('.sql') || f.endsWith('.sql.gz'))
    .map(f => ({ name: f, mtime: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  const toDelete = files.slice(retain);
  for (const f of toDelete) {
    const path = join(dir, f.name);
    unlinkSync(path);
    console.log(`  Pruned old backup: ${f.name}`);
  }
}

async function backup() {
  const opts = parseArgs();
  const dbUrl = getDbUrl();
  const outputDir = opts.output || join(process.cwd(), 'backups');

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const ts = timestamp();
  const baseName = join(outputDir, `backup-${ts}`);

  console.log(`Backing up database to ${outputDir}...`);

  try {
    // Parse connection info from URL
    const url = new URL(dbUrl);
    const host = url.hostname;
    const port = url.port || '5432';
    const dbname = url.pathname.replace('/', '');
    const user = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password || '');

    const env = { ...process.env, PGPASSWORD: password };
    const pgDumpArgs = [
      '-h', host,
      '-p', port,
      '-U', user,
      '-d', dbname,
      '--no-owner',
      '--no-privileges',
      '-F', 'p', // plain text format
    ];

    if (opts.compress) {
      const sqlFile = `${baseName}.sql`;
      execSync(`pg_dump ${pgDumpArgs.join(' ')} -f "${sqlFile}"`, { env, stdio: 'pipe' });
      console.log(`  Dumped to ${sqlFile}`);

      // Compress
      const { createReadStream } = await import('fs');
      const gzip = createGzip();
      const src = createReadStream(sqlFile);
      const dest = createWriteStream(`${baseName}.sql.gz`);
      await pipeline(src, gzip, dest);
      unlinkSync(sqlFile);
      console.log(`  Compressed to ${baseName}.sql.gz`);
    } else {
      execSync(`pg_dump ${pgDumpArgs.join(' ')} -f "${baseName}.sql"`, { env, stdio: 'pipe' });
      console.log(`  Dumped to ${baseName}.sql`);
    }

    if (opts.retain > 0) {
      pruneBackups(outputDir, opts.retain);
    }

    console.log('Backup complete.');
  } catch (err) {
    console.error('Backup failed:', err.message);
    process.exit(1);
  }
}

backup();
