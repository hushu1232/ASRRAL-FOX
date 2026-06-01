/**
 * 轻量级 Feature Flag 系统
 * 基于环境变量，无需第三方服务。用于灰度发布和按 tier 控制功能可见性。
 */

const flags = {
  newEditorUI: process.env.FF_NEW_EDITOR_UI === 'true',
  aiBlendShape: process.env.FF_AI_BLENDSHAPE === 'true',
  exportVRM: process.env.FF_EXPORT_VRM !== 'false',
} as const;

export type FeatureFlag = keyof typeof flags;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return flags[flag] === true;
}

export function getAllFlags(): Record<FeatureFlag, boolean> {
  return { ...flags };
}
