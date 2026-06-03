// TODO: BEM-migrate
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';

interface Live2DViewerProps {
  modelUrl: string;
  width?: number;
  height?: number;
  interactive?: boolean;
  onError?: (error: Error) => void;
}

type AppDelegate = {
  initialize: () => void;
  run: () => void;
  stop: () => void;
  release: () => void;
  changeModel: (path: string) => void;
  _subdelegates: { at: (i: number) => { getCanvas: () => HTMLCanvasElement } };
  new(): AppDelegate;
};

let CubismCoreReady = false;
let coreLoadPromise: Promise<void> | null = null;

function ensureCoreLoaded(): Promise<void> {
  if (CubismCoreReady) return Promise.resolve();
  if (coreLoadPromise) return coreLoadPromise;

  coreLoadPromise = new Promise((resolve) => {
    if ((window as unknown as Record<string, unknown>).Live2DCubismCore) {
      CubismCoreReady = true;
      resolve();
      return;
    }
    const check = setInterval(() => {
      if ((window as unknown as Record<string, unknown>).Live2DCubismCore) {
        clearInterval(check);
        CubismCoreReady = true;
        resolve();
      }
    }, 100);
    setTimeout(() => { clearInterval(check); resolve(); }, 15000);
  });
  return coreLoadPromise;
}

export default function Live2DViewer({
  modelUrl,
  width = 500,
  height = 500,
  interactive = true,
  onError,
}: Live2DViewerProps) {
  const t = useTranslations('live2d');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<AppDelegate | null>(null);
  const frameRef = useRef<number | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const initViewer = useCallback(async () => {
    try {
      await ensureCoreLoaded();

      // @ts-expect-error - compiled JS bundle without type declarations
      const module = await import('@/lib/live2d/cubism5.js');
      const AppDelegateClass = module.AppDelegate as AppDelegate;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const app = new AppDelegateClass();
      appRef.current = app;

      const origInit = (app as unknown as Record<string, (c: HTMLCanvasElement) => void>).initializeSubdelegates;
      (app as unknown as Record<string, unknown>).initializeSubdelegates = () => {
        const subd = app as unknown as { _canvases?: { pushBack: (c: HTMLCanvasElement) => void } };
        if (subd._canvases) {
          subd._canvases.pushBack(canvas);
        }
        if (origInit) origInit.call(app, canvas);
      };

      app.initialize();
      app.changeModel(modelUrl);
      app.run();

      setStatus('ready');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setStatus('error');
      onError?.(err instanceof Error ? err : new Error(msg));
    }
  }, [modelUrl, onError]);

  useEffect(() => {
    initViewer();

    return () => {
      if (appRef.current) {
        try {
          appRef.current.stop();
          appRef.current.release();
        } catch { /* */ }
        appRef.current = null;
      }
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [initViewer]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive || !appRef.current) return;
    const app = appRef.current as unknown as Record<string, (e: { pageX: number; pageY: number }) => void>;
    if (app.onMouseMove) {
      app.onMouseMove({ pageX: e.clientX, pageY: e.clientY });
    }
  }, [interactive]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive || !appRef.current) return;
    const app = appRef.current as unknown as Record<string, (e: { pageX: number; pageY: number }) => void>;
    if (app.onTap) {
      app.onTap({ pageX: e.clientX, pageY: e.clientY });
    }
  }, [interactive]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive || !appRef.current) return;
    const app = appRef.current as unknown as Record<string, (e: { pageX: number; pageY: number }) => void>;
    if (app.onMouseEnd) {
      app.onMouseEnd({ pageX: e.clientX, pageY: e.clientY });
    }
  }, [interactive]);

  return (
    <div className="relative inline-block" style={{ width, height }}>
      {status === 'loading' && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 rounded-lg z-10"
          style={{ width, height }}
        >
          <Spin indicator={<LoadingOutlined style={{ fontSize: 32, color: '#a78bfa' }} spin />} />
          <span className="text-gray-300 text-xs mt-2">{t('loading')}</span>
        </div>
      )}

      {status === 'error' && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg z-10"
          style={{ width, height }}
        >
          <span className="text-red-400 text-xs px-3 text-center">{errorMsg || t('loadFailed')}</span>
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={width * (window.devicePixelRatio || 1)}
        height={height * (window.devicePixelRatio || 1)}
        style={{ width, height, cursor: interactive ? 'grab' : 'default' }}
        className="rounded-lg"
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      />

      {status === 'ready' && (
        <span className="absolute bottom-1 right-2 text-[10px] text-gray-500/60 pointer-events-none select-none">
          Powered by Live2D
        </span>
      )}
    </div>
  );
}