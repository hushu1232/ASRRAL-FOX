'use client';

import { useExperiment } from '@/lib/experiments/useExperiment';
import {
  isBuildFlagEnabled,
  getExperimentKeyForFlag,
  type BuildFeatureFlag,
} from '@/lib/feature-flags';

interface UseFeatureFlagResult {
  /** 最终是否启用该功能 */
  enabled: boolean;
  /** 变体名称（如果是 A/B 实验） */
  variant: string | null;
  /** 标志来源 */
  source: 'build-time' | 'runtime-experiment' | 'fallback';
  /** 实验配置（如果有） */
  config: Record<string, unknown> | undefined;
}

/**
 * 统一的 Feature Flag hook。
 *
 * 优先级: Runtime experiment > Build-time env var > false
 *
 * @example
 * const { enabled, source } = useFeatureFlag('newEditorUI');
 * if (enabled) return <NewEditor />;
 * return <LegacyEditor />;
 */
export function useFeatureFlag(flag: BuildFeatureFlag): UseFeatureFlagResult {
  const experimentKey = getExperimentKeyForFlag(flag);
  const experiment = useExperiment(experimentKey ?? '__nonexistent__');

  // 1. Runtime experiment takes priority
  if (experimentKey && experiment.isInExperiment) {
    const enabled = experiment.variant !== 'control';
    return {
      enabled,
      variant: experiment.variant,
      source: 'runtime-experiment',
      config: experiment.config,
    };
  }

  // 2. Fall back to build-time flag
  const buildEnabled = isBuildFlagEnabled(flag);
  return {
    enabled: buildEnabled,
    variant: buildEnabled ? 'enabled' : 'control',
    source: buildEnabled ? 'build-time' : 'fallback',
    config: undefined,
  };
}
