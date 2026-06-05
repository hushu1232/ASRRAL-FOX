/**
 * 统一 Feature Flag 系统
 *
 * 整合两个来源的标志位：
 * 1. Build-time flags (来自环境变量, 需重新部署才能切换) — 用于基础设施级开关
 * 2. Runtime experiments (来自 A/B 实验系统, 运行时切换) — 用于产品功能灰度
 *
 * 使用指南:
 * - 基础设施开关 (CDN迁移、数据库切换)  → 用 build-time flag
 * - 产品功能灰度 (新UI、AI功能)        → 用 runtime experiment
 * - 不确定该用哪个                     → 用 useFeatureFlag(), 它会先查 runtime, 回退到 build-time
 */

// ─── Build-time flags (from env vars, baked at build time) ─────

const buildFlags = {
  newEditorUI: process.env.FF_NEW_EDITOR_UI === 'true',
  aiBlendShape: process.env.FF_AI_BLENDSHAPE === 'true',
  exportVRM: process.env.FF_EXPORT_VRM !== 'false',
} as const;

export type BuildFeatureFlag = keyof typeof buildFlags;

// ─── Runtime-experiment-backed flags ───────────────────────────

/**
 * 这些 feature flag 同时存在于 A/B 实验系统中，
 * 可以在运行时通过实验配置切换，无需重新部署。
 */
const RUNTIME_EXPERIMENT_MAP: Record<string, string> = {
  newEditorUI: 'new_editor_ui',
  aiBlendShape: 'ai_blendshape',
  exportVRM: 'export_vrm',
};

// ─── Public API ────────────────────────────────────────────────

/**
 * 检查 build-time flag（仅环境变量，需重新部署切换）。
 */
export function isBuildFlagEnabled(flag: BuildFeatureFlag): boolean {
  return buildFlags[flag] === true;
}

/**
 * 获取所有 build-time flags 的快照。
 */
export function getAllBuildFlags(): Record<BuildFeatureFlag, boolean> {
  return { ...buildFlags };
}

/**
 * 获取 flag 对应的 A/B 实验 key。
 * 如果该 flag 未接入实验系统，返回 null。
 */
export function getExperimentKeyForFlag(flag: BuildFeatureFlag): string | null {
  return RUNTIME_EXPERIMENT_MAP[flag] ?? null;
}

/**
 * 检查 flag 是否支持运行时切换（即已接入 A/B 实验系统）。
 */
export function isRuntimeToggleable(flag: BuildFeatureFlag): boolean {
  return flag in RUNTIME_EXPERIMENT_MAP;
}

/**
 * 获取所有 flag 的状态摘要（用于调试面板）。
 */
export function getFlagsDebugInfo(): Array<{
  flag: string;
  buildTime: boolean;
  runtimeExperimentKey: string | null;
  runtimeToggleable: boolean;
}> {
  return (Object.keys(buildFlags) as BuildFeatureFlag[]).map((flag) => ({
    flag,
    buildTime: buildFlags[flag],
    runtimeExperimentKey: RUNTIME_EXPERIMENT_MAP[flag] ?? null,
    runtimeToggleable: flag in RUNTIME_EXPERIMENT_MAP,
  }));
}
