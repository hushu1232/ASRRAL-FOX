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
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const initViewer = useCallback(async () => {
    try {
      await ensureCoreLoaded();

      const canvas = canvasRef.current;
      if (!canvas) return;

      const delegate = await createAppDelegate();
      delegateRef.current = delegate;

      attachCanvas(delegate, canvas);
      delegate.initialize();
      delegate.changeModel(modelUrl);
      delegate.run();

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
      if (delegateRef.current) {
        try {
          delegateRef.current.stop();
          delegateRef.current.release();
        } catch { /* Silently ignore cleanup errors */ }
        delegateRef.current = null;
      }
    };
  }, [initViewer]);

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
