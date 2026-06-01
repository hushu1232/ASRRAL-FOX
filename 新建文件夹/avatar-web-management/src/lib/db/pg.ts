import { PoolClient } from 'pg';
import { getSharedPool, closeSharedPool } from './pool';
import { createLogger } from '@/lib/logger';

const log = createLogger('db:pg');

export { getSharedPool as getPgPool, closeSharedPool as closePgPool, getPoolStats } from './pool';

export async function pgQuery(
  sql: string,
  params?: unknown[]
): Promise<Record<string, unknown>[]> {
  const client = await getSharedPool().connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function pgQueryOne(
  sql: string,
  params?: unknown[]
): Promise<Record<string, unknown> | null> {
  const rows = await pgQuery(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function pgExecute(
  sql: string,
  params?: unknown[]
): Promise<number> {
  const client = await getSharedPool().connect();
  try {
    const result = await client.query(sql, params);
    return result.rowCount ?? 0;
  } finally {
    client.release();
  }
}

export async function pgTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getSharedPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function pgSetWorkspaceContext(
  client: PoolClient,
  workspaceId: string,
  userId: string
): Promise<void> {
  await client.query('SET app.current_workspace_id = $1', [workspaceId]);
  await client.query('SET app.current_user_id = $1', [userId]);
}
