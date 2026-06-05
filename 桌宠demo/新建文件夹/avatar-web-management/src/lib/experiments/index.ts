import crypto from 'crypto';

export interface ExperimentVariant {
  key: string;
  name: string;
  weight: number; // 0-100, sum of all variants should be 100
  config?: Record<string, unknown>;
}

export interface ExperimentDefinition {
  id: string;
  name: string;
  key: string;
  enabled: boolean;
  traffic: number; // 0-100 percentage of users exposed
  variants: ExperimentVariant[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Deterministic hash-based bucketing.
 * Same (experimentKey, userId) always maps to the same bucket (0-99).
 */
function getBucket(experimentKey: string, userId: string): number {
  const hash = crypto.createHash('sha256').update(`${experimentKey}:${userId}`).digest();
  // Use first 4 bytes as uint32, mod 100
  const num = hash.readUInt32BE(0);
  return num % 100;
}

/**
 * Resolve which variant a user sees for a given experiment.
 * Returns null if the experiment is disabled or user is not in the traffic cohort.
 */
export function resolveExperiment(
  experiment: ExperimentDefinition,
  userId: string,
): { variant: ExperimentVariant; experiment: ExperimentDefinition } | null {
  if (!experiment.enabled) return null;

  const bucket = getBucket(experiment.key, userId);

  // Check if user is in the traffic allocation
  if (bucket >= experiment.traffic) return null;

  // Determine variant based on weighted distribution
  let cumulative = 0;
  for (const variant of experiment.variants) {
    cumulative += variant.weight;
    if (bucket < cumulative) {
      return { variant, experiment };
    }
  }

  // Fallback to first variant
  return { variant: experiment.variants[0], experiment };
}

/**
 * Simple in-memory experiment store.
 * In production, use the database-backed experiments from Prisma.
 */
const memoryStore = new Map<string, ExperimentDefinition>();

export function registerExperiment(experiment: ExperimentDefinition): void {
  memoryStore.set(experiment.key, experiment);
}

export function getExperimentByKey(key: string): ExperimentDefinition | undefined {
  return memoryStore.get(key);
}

export function getAllExperiments(): ExperimentDefinition[] {
  return Array.from(memoryStore.values());
}

export function clearExperiments(): void {
  memoryStore.clear();
}

/**
 * Get variant key for a user. Shortcut for UI conditional rendering.
 * Returns the variant key string, or "control" if not in experiment.
 */
export function getVariantKey(experimentKey: string, userId: string): string | null {
  const experiment = memoryStore.get(experimentKey);
  if (!experiment) return null;
  const result = resolveExperiment(experiment, userId);
  return result?.variant.key ?? null;
}
