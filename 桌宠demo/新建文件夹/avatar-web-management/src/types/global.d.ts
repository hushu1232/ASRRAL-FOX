/**
 * 全局 Window 类型扩展
 *
 * 将项目中所有 `window.__xxx` 全局变量集中声明，
 * 替代散落在各文件中 `(window as unknown as Record<string, unknown>)` 的类型断言。
 */

import type { ExperimentVariant } from '@/lib/experiments';

export {};

declare global {
  // ── Live2D Cubism SDK ───────────────────────────────────────
  /** Live2D Cubism Core SDK 全局命名空间 (由 live2dcubismcore.min.js 注入) */
  var Live2DCubismCore: unknown | undefined;

  // ── Desktop Pet ─────────────────────────────────────────────
  /**
   * Live2D 口型同步开合度 (0-1)
   * 由 ModelViewer AudioContext analyser 写入，Live2D 渲染循环读取
   */
  var __petLipOpenness: number | undefined;

  // ── A/B Experiments ─────────────────────────────────────────
  /**
   * 服务端解析的 A/B 实验分配结果。
   * Key: experimentKey, Value: { variant, config }
   * 由服务端在 SSR 时通过 <script> 标签注入 window。
   */
  var __EXPERIMENTS__: Record<string, { variant: string; config?: Record<string, unknown> }> | undefined;

  /**
   * 服务端下发的实验定义列表。
   * 由服务端在 SSR 时注入，客户端 useExperiment hook 消费。
   */
  var __EXPERIMENT_CONFIGS__:
    | Array<{
        key: string;
        enabled: boolean;
        traffic: number;
        variants: ExperimentVariant[];
      }>
    | undefined;

  // ── Browser Speech Recognition ──────────────────────────────
  /** Chrome/Edge 的 Web Speech API */
  var SpeechRecognition: typeof window.SpeechRecognition | undefined;
  var webkitSpeechRecognition: typeof window.SpeechRecognition | undefined;

  // ── Web Audio ───────────────────────────────────────────────
  /** 旧版 Safari 的 AudioContext 前缀 */
  var webkitAudioContext: typeof window.AudioContext | undefined;
}
