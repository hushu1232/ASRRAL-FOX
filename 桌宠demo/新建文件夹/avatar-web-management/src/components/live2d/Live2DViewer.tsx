'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import {
  ensureCoreLoaded,
  createAppDelegate,
  attachCanvas,
  dispatchPointerMove,
  dispatchPointerDown,
  dispatchPointerUp,
  type Live2DAppDelegate,
} from '@/lib/live2d/adapter';

interface Live2DViewerProps {
  modelUrl: string;
  width?: number;
  height?: number;
  interactive?: boolean;
  onError?: (error: Error) => void;
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
  const delegateRef = useRef<Live2DAppDelegate | null>(null);
  const configKey = `${modelUrl}\u0000${width}\u0000${height}`;
  const [result, setResult] = useState<{
    key: string;
    status: 'ready' | 'error';
    errorMsg: string;
  } | null>(null);
  const status = result?.key === configKey ? result.status : 'loading';
  const errorMsg = result?.key === configKey ? result.errorMsg : '';

  const releaseDelegate = useCallback((delegate: Live2DAppDelegate | null) => {
    if (!delegate) return;
    try {
      delegate.stop();
      delegate.release();
    } catch { /* Silently ignore cleanup errors */ }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let delegate: Live2DAppDelegate | null = null;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;

    void (async () => {
      try {
        await ensureCoreLoaded();
        if (cancelled) return;

        delegate = await createAppDelegate();
        if (cancelled) {
          releaseDelegate(delegate);
          delegate = null;
          return;
        }
        delegateRef.current = delegate;

        attachCanvas(delegate, canvas);
        delegate.initialize();
        delegate.changeModel(modelUrl);
        delegate.run();
        setResult({ key: configKey, status: 'ready', errorMsg: '' });
      } catch (err) {
        if (cancelled) {
          releaseDelegate(delegate);
          delegate = null;
          return;
        }
        if (delegateRef.current === delegate) delegateRef.current = null;
        releaseDelegate(delegate);
        delegate = null;
        const msg = err instanceof Error ? err.message : String(err);
        setResult({ key: configKey, status: 'error', errorMsg: msg });
        onError?.(err instanceof Error ? err : new Error(msg));
      }
    })();

    return () => {
      cancelled = true;
      if (delegateRef.current === delegate) delegateRef.current = null;
      releaseDelegate(delegate);
      delegate = null;
    };
  }, [configKey, height, modelUrl, onError, releaseDelegate, width]);

  // ── Pointer event handlers ──────────────────────────────────

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive || !delegateRef.current) return;
    dispatchPointerMove(delegateRef.current, { pageX: e.clientX, pageY: e.clientY });
  }, [interactive]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive || !delegateRef.current) return;
    dispatchPointerDown(delegateRef.current, { pageX: e.clientX, pageY: e.clientY });
  }, [interactive]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive || !delegateRef.current) return;
    dispatchPointerUp(delegateRef.current, { pageX: e.clientX, pageY: e.clientY });
  }, [interactive]);

  // ── Render ──────────────────────────────────────────────────

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
