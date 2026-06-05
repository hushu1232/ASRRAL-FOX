/**
 * Live2D Cubism SDK 类型适配层
 *
 * 将所有 `(window as unknown as Record<...>)` 类型断言隔离在此模块中。
 * Live2DViewer 通过此模块与 SDK 交互，不直接访问 window 全局变量。
 */
export interface Live2DModelOptions {
  modelUrl: string;
  canvas: HTMLCanvasElement;
  interactive?: boolean;
}

export interface Live2DPointerEvent {
  pageX: number;
  pageY: number;
}

/**
 * Live2D AppDelegate 的强类型接口。
 * 对应 Cubism SDK for Web 的 AppDelegate 类。
 */
export interface Live2DAppDelegate {
  initialize(): void;
  run(): void;
  stop(): void;
  release(): void;
  changeModel(path: string): void;
  onMouseMove?(event: Live2DPointerEvent): void;
  onTap?(event: Live2DPointerEvent): void;
  onMouseEnd?(event: Live2DPointerEvent): void;
}

/**
 * 外部 Cubism SDK 脚本加载的全局命名空间。
 * 由 live2dcubismcore.min.js 提供。
 */
interface Live2DCubismCoreGlobal {
  Live2DCubismCore?: unknown;
}

// ─── SDK Core 加载 ────────────────────────────────────────────

let coreReady = false;
let coreLoadPromise: Promise<void> | null = null;
const CORE_LOAD_TIMEOUT_MS = 15_000;
const CORE_POLL_INTERVAL_MS = 100;

/**
 * 等待 Live2D Cubism Core 加载完成。
 * 轮询 window.Live2DCubismCore 直到可用或超时。
 *
 * @throws {Error} 如果在超时时间内未加载完成
 */
export async function ensureCoreLoaded(): Promise<void> {
  if (coreReady) return;
  if (coreLoadPromise) return coreLoadPromise;

  coreLoadPromise = new Promise<void>((resolve, reject) => {
    const global = window as unknown as Live2DCubismCoreGlobal;

    if (global.Live2DCubismCore) {
      coreReady = true;
      resolve();
      return;
    }

    const start = Date.now();
    const check = setInterval(() => {
      if (global.Live2DCubismCore) {
        clearInterval(check);
        coreReady = true;
        resolve();
        return;
      }
      if (Date.now() - start > CORE_LOAD_TIMEOUT_MS) {
        clearInterval(check);
        coreLoadPromise = null; // allow retry on next call
        reject(new Error('Live2D Cubism Core failed to load within timeout'));
      }
    }, CORE_POLL_INTERVAL_MS);
  });

  return coreLoadPromise;
}

// ─── AppDelegate 创建 ─────────────────────────────────────────

/**
 * 动态导入 Cubism SDK AppDelegate 并创建实例。
 *
 * @throws {Error} 如果 SDK 模块加载失败
 */
export async function createAppDelegate(): Promise<Live2DAppDelegate> {
  // Dynamic import of compiled JS bundle (no type declarations available)
  const module = await import('@/lib/live2d/cubism5.js');
  const AppDelegateClass = module.AppDelegate as new () => Live2DAppDelegate;
  return new AppDelegateClass();
}

/**
 * 将 canvas 注入到 AppDelegate 的渲染管线中。
 * Cubism SDK 使用内部 canvas 列表管理渲染目标。
 */
export function attachCanvas(delegate: Live2DAppDelegate, canvas: HTMLCanvasElement): void {
  const app = delegate as unknown as {
    initializeSubdelegates?: (c: HTMLCanvasElement) => void;
    _canvases?: { pushBack: (c: HTMLCanvasElement) => void };
  };

  const origInit = app.initializeSubdelegates;
  app.initializeSubdelegates = (c: HTMLCanvasElement) => {
    if (app._canvases) {
      app._canvases.pushBack(canvas);
    }
    if (origInit) origInit.call(delegate, c);
  };
}

// ─── Interaction helpers ──────────────────────────────────────

export function dispatchPointerMove(delegate: Live2DAppDelegate, event: Live2DPointerEvent): void {
  delegate.onMouseMove?.(event);
}

export function dispatchPointerDown(delegate: Live2DAppDelegate, event: Live2DPointerEvent): void {
  delegate.onTap?.(event);
}

export function dispatchPointerUp(delegate: Live2DAppDelegate, event: Live2DPointerEvent): void {
  delegate.onMouseEnd?.(event);
}
