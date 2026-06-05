import { getPrisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import type { ExperimentDefinition, ExperimentVariant } from './index';

const log = createLogger('experiments:store');

function parseVariants(raw: string | unknown): ExperimentVariant[] {
  if (Array.isArray(raw)) return raw as ExperimentVariant[];
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

function toCamel(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, l: string) => l.toUpperCase());
    out[camelKey] = typeof value === 'bigint' ? Number(value) : value;
  }
  return out;
}

export async function loadExperimentsFromDb(): Promise<ExperimentDefinition[]> {
  try {
    const prisma = getPrisma();
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      'SELECT * FROM experiments WHERE enabled = true ORDER BY created_at DESC',
    );
    return rows.map((row) => {
      const r = toCamel(row);
      return {
        id: r.id as string,
        name: r.name as string,
        key: r.key as string,
        enabled: (r.enabled as number) === 1,
        traffic: (r.traffic as number) || 100,
        variants: parseVariants(r.variants),
        createdAt: r.createdAt as string,
        updatedAt: r.updatedAt as string,
      };
    });
  } catch {
    log.warn('Failed to load experiments from DB — table may not exist yet');
    return [];
  }
}

export async function createExperiment(data: {
  name: string;
  key: string;
  traffic?: number;
  variants: ExperimentVariant[];
}): Promise<ExperimentDefinition | null> {
  try {
    const prisma = getPrisma();
    const id = crypto.randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO experiments (id, name, key, enabled, traffic, variants)
       VALUES ($1, $2, $3, 1, $4, $5)`,
      id,
      data.name,
      data.key,
      data.traffic ?? 100,
      JSON.stringify(data.variants),
    );

    return {
      id,
      name: data.name,
      key: data.key,
      enabled: true,
      traffic: data.traffic ?? 100,
      variants: data.variants,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    log.error({ err }, 'Failed to create experiment');
    return null;
  }
}

export async function updateExperiment(
  id: string,
  data: Partial<{ enabled: boolean; traffic: number; variants: ExperimentVariant[] }>,
): Promise<boolean> {
  try {
    const prisma = getPrisma();
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (data.enabled !== undefined) {
      sets.push(`enabled = $${idx++}`);
      params.push(data.enabled ? 1 : 0);
    }
    if (data.traffic !== undefined) {
      sets.push(`traffic = $${idx++}`);
      params.push(data.traffic);
    }
    if (data.variants !== undefined) {
      sets.push(`variants = $${idx++}`);
      params.push(JSON.stringify(data.variants));
    }

    if (sets.length === 0) return false;

    sets.push('updated_at = NOW()');
    params.push(id);

    await prisma.$executeRawUnsafe(
      `UPDATE experiments SET ${sets.join(', ')} WHERE id = $${idx}`,
      ...params,
    );
    return true;
  } catch (err) {
    log.error({ err }, 'Failed to update experiment');
    return false;
  }
}

export async function deleteExperiment(id: string): Promise<boolean> {
  try {
    const prisma = getPrisma();
    const result = await prisma.$executeRawUnsafe(
      'DELETE FROM experiments WHERE id = $1',
      id,
    );
    return result > 0;
  } catch (err) {
    log.error({ err }, 'Failed to delete experiment');
    return false;
  }
}
