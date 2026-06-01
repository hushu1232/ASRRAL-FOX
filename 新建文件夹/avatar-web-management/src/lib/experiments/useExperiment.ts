'use client';

import { useAuthStore } from '@/stores/authStore';
import type { ExperimentVariant } from './index';

interface ExperimentConfig {
  key: string;
  enabled: boolean;
  traffic: number;
  variants: ExperimentVariant[];
}

interface UseExperimentResult {
  variant: string;
  config: Record<string, unknown> | undefined;
  isInExperiment: boolean;
}

function getBucket(experimentKey: string, userId: string): number {
  // Simple client-side hash for bucketing
  let hash = 0;
  const str = `${experimentKey}:${userId}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit int
  }
  return Math.abs(hash) % 100;
}

/**
 * Client-side A/B experiment hook.
 * Reads experiment config from window.__EXPERIMENTS__ (populated by server).
 * Falls back to deterministic client-side bucketing.
 */
export function useExperiment(experimentKey: string): UseExperimentResult {
  const userId = useAuthStore((s) => s.user?.id);

  // Try server-provided experiments first
  const experiments: Record<string, { variant: string; config?: Record<string, unknown> }> =
    typeof window !== 'undefined'
      ? ((window as unknown as Record<string, unknown>).__EXPERIMENTS__ as Record<string, { variant: string; config?: Record<string, unknown> }>) ?? {}
      : {};

  if (experiments[experimentKey]) {
    const exp = experiments[experimentKey];
    return {
      variant: exp.variant,
      config: exp.config,
      isInExperiment: true,
    };
  }

  // Fallback: check inline experiment config
  const configs: ExperimentConfig[] =
    typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>).__EXPERIMENT_CONFIGS__ as ExperimentConfig[] || [] : [];

  const config = configs.find((c) => c.key === experimentKey);
  if (!config || !config.enabled || !userId) {
    return { variant: 'control', config: undefined, isInExperiment: false };
  }

  const bucket = getBucket(experimentKey, userId);
  if (bucket >= config.traffic) {
    return { variant: 'control', config: undefined, isInExperiment: false };
  }

  let cumulative = 0;
  for (const variant of config.variants) {
    cumulative += variant.weight;
    if (bucket < cumulative) {
      return {
        variant: variant.key,
        config: variant.config,
        isInExperiment: variant.key !== 'control',
      };
    }
  }

  return { variant: 'control', config: undefined, isInExperiment: false };
}
