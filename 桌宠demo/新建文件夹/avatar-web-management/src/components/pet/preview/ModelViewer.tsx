// TODO: BEM-migrate
'use client';

import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Spin } from 'antd';
import { useTranslations } from 'next-intl';
import type { EmotionTag } from '@/types/pet-preview';

const Live2DViewer = dynamic(
  () => import('@/components/live2d/Live2DViewer'),
  { ssr: false, loading: () => <ModelLoading /> }
);

interface ModelViewerProps {
  modelType: 'live2d' | 'vrm';
  modelPath: string;
  emotion: EmotionTag;
  action?: string;
  isSpeaking: boolean;
  audioElement?: HTMLAudioElement | null;
  className?: string;
}

export default function ModelViewer({
  modelType,
  modelPath,
  emotion,
  isSpeaking,
  audioElement,
  className = '',
}: ModelViewerProps) {
  const tm = useTranslations('pet.modelViewer.emotions');
  const tv = useTranslations('pet.modelViewer');

  const EMOTION_MAP: Record<EmotionTag, string> = {
    happy: tm('happy'),
    sad: tm('sad'),
    shy: tm('shy'),
    angry: tm('angry'),
    neutral: tm('neutral'),
    surprised: tm('surprised'),
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const lipSyncRef = useRef<{
    audioCtx: AudioContext;
    analyser: AnalyserNode;
    source: MediaElementAudioSourceNode;
    frameId: number;
  } | null>(null);

  const stopLipSync = useCallback(() => {
    if (lipSyncRef.current) {
      cancelAnimationFrame(lipSyncRef.current.frameId);
      lipSyncRef.current.audioCtx.close();
      lipSyncRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopLipSync();
  }, [stopLipSync]);

  useEffect(() => {
    if (isSpeaking && audioElement && modelType === 'live2d') {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.4;

        const source = audioCtx.createMediaElementSource(audioElement);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let frameId = 0;

        const updateLip = () => {
          analyser.getByteTimeDomainData(dataArray);

          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const v = (dataArray[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / dataArray.length);
          const openness = Math.min(1, rms * 3);

          if (window.__petLipOpenness !== undefined) {
            window.__petLipOpenness = openness;
          }

          frameId = requestAnimationFrame(updateLip);
        };

        lipSyncRef.current = { audioCtx, analyser, source, frameId };
        updateLip();
      } catch {
        console.warn('[ModelViewer] AudioContext not available for lip sync');
      }
    } else if (!isSpeaking) {
      stopLipSync();
      if (window.__petLipOpenness !== undefined) {
        window.__petLipOpenness = 0;
      }
    }
  }, [isSpeaking, audioElement, modelType, stopLipSync]);

  if (error) {
    return <ModelError message={error} />;
  }

  return (
    <div className={`relative overflow-hidden rounded-xl bg-[var(--ds-colors-surface)] border border-[var(--ds-colors-border)] ${className}`}>
      <div className="w-full h-full flex items-center justify-center min-h-[400px]" role="img" aria-label={tv('livePreview')}>
        {modelType === 'live2d' ? (
          <Live2DViewer
            modelUrl={modelPath}
            width={600}
            height={600}
            interactive={true}
            onError={(err) => {
              setError(err.message);
              setLoading(false);
            }}
          />
        ) : (
          <VRMViewer
            modelPath={modelPath}
            onLoad={() => setLoading(false)}
            onError={(msg) => { setError(msg); setLoading(false); }}
            labels={{ vrmMissing: tv('vrmMissing'), vrmLoadFailed: tv('vrmLoadFailed') }}
          />
        )}
      </div>

      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/30 backdrop-blur-sm text-white text-xs">
        {EMOTION_MAP[emotion]}
      </div>

      {isSpeaking && (
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/30 backdrop-blur-sm">
          <span className="flex gap-0.5">
            <span className="w-1 h-3 bg-green-400 rounded-full animate-[pulse_0.3s_ease-in-out_infinite]" />
            <span className="w-1 h-3 bg-green-400 rounded-full animate-[pulse_0.3s_ease-in-out_infinite_0.1s]" />
            <span className="w-1 h-3 bg-green-400 rounded-full animate-[pulse_0.3s_ease-in-out_infinite_0.2s]" />
          </span>
          <span className="text-white text-xs">{tv('speaking')}</span>
        </div>
      )}
    </div>
  );
}

function VRMViewer({
  modelPath,
  onLoad,
  onError,
  labels,
}: {
  modelPath: string;
  onLoad: () => void;
  onError: (msg: string) => void;
  labels: { vrmMissing: string; vrmLoadFailed: string };
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [vrmLoading, setVrmLoading] = useState(true);

  useEffect(() => {
    let disposed = false;
    let animFrameId = 0;
    let rendererDomElement: HTMLCanvasElement | null = null;

    // Collect event listener removers
    const cleanups: (() => void)[] = [];

    function onPointerDown(e: PointerEvent) {
      isDragging = true;
      prevX = e.clientX;
    }
    function onPointerMove(e: PointerEvent) {
      if (!isDragging) return;
      if (vrmInstance?.scene?.rotation?.y !== undefined) {
        vrmInstance.scene.rotation.y += (e.clientX - prevX) * 0.01;
      }
      prevX = e.clientX;
    }
    function onPointerUp() { isDragging = false; }

    let vrmInstance: any = null;
    let isDragging = false;
    let prevX = 0;

    async function initVRM() {
      try {
        // @ts-expect-error three.js is not installed; optional runtime import
        const threeP = import('three').catch(() => null);
        // @ts-expect-error GLTFLoader is not installed; optional runtime import
        const gltfP = import('three/examples/jsm/loaders/GLTFLoader.js').catch(() => null);
        const [THREE, gltfModule] = await Promise.all([threeP, gltfP]);
        const GLTFLoader: any = (gltfModule as Record<string, unknown> | null)?.GLTFLoader;

        if (!THREE || disposed) return;

        let VRMLoader: any;
        try {
          // @ts-expect-error — @pixiv/three-vrm is optional
          const vrm = await import('@pixiv/three-vrm');
          VRMLoader = vrm.VRMLoader || vrm.VRMUtils;
        } catch {
          if (!disposed) {
            onError(labels.vrmMissing);
            setVrmLoading(false);
            onLoad();
          }
          return;
        }

        const container = containerRef.current;
        if (!container || disposed) return;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 20);
        camera.position.set(0, 1.2, 2.5);

        const renderer = new THREE.WebGLRenderer({ alpha: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        rendererDomElement = renderer.domElement as HTMLCanvasElement;
        container.appendChild(rendererDomElement);

        scene.add(new THREE.DirectionalLight(0xffffff, 1.2));
        scene.add(new THREE.AmbientLight(0xffffff, 0.8));

        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync(modelPath);
        const vrmLoader = new VRMLoader();
        vrmInstance = await vrmLoader.load(gltf);

        if (disposed) return;

        scene.add(vrmInstance.scene);
        setVrmLoading(false);
        onLoad();

        function animate() {
          if (disposed) return;
          animFrameId = requestAnimationFrame(animate);
          vrmInstance?.update?.(0.016);
          renderer.render(scene, camera);
        }
        animate();

        // Register event listeners with cleanup tracking
        rendererDomElement.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);

        cleanups.push(() => {
          if (rendererDomElement) {
            rendererDomElement.removeEventListener('pointerdown', onPointerDown);
          }
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
        });
      } catch (err) {
        if (!disposed) {
          onError(err instanceof Error ? err.message : labels.vrmLoadFailed);
          setVrmLoading(false);
        }
      }
    }

    initVRM();

    return () => {
      disposed = true;
      // Cancel pending animation frame
      if (animFrameId) cancelAnimationFrame(animFrameId);
      // Remove all registered event listeners
      cleanups.forEach((fn) => fn());
      // Remove renderer DOM element from container
      if (rendererDomElement && rendererDomElement.parentElement) {
        rendererDomElement.parentElement.removeChild(rendererDomElement);
      }
    };
  }, [modelPath, onLoad, onError, labels]);

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center">
      {vrmLoading && <ModelLoading />}
      <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-black/30 text-white text-xs">
        3D VRM
      </div>
    </div>
  );
}

function ModelLoading() {
  const t = useTranslations('pet.modelViewer');
  return (
    <div className="flex flex-col items-center gap-3">
      <Spin size="large" />
      <span className="text-sm text-[var(--ds-colors-text-secondary)]">{t('loading')}</span>
    </div>
  );
}

function ModelError({ message }: { message: string }) {
  return (
    <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center gap-3 text-center p-6">
      <div className="text-4xl opacity-40">🐱</div>
      <p className="text-sm text-[var(--ds-colors-text-secondary)] max-w-[300px]">{message}</p>
    </div>
  );
}