// TODO: BEM-migrate
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Steps, Typography, Alert, Spin } from 'antd';
import { LoadingOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';

const { Text, Title } = Typography;

interface ProgressData {
  stage: string;
  percent: number;
  message: string;
  error?: string;
  result?: {
    modelId: string;
    previewUrl: string;
    moc3Url: string;
    totalTimeMs: number;
  };
}

interface PipelineProgressProps {
  imageId: string;
  previewUrl?: string;
  onComplete?: (result: ProgressData['result']) => void;
  onError?: (error: string) => void;
}

export default function PipelineProgress({ imageId, previewUrl, onComplete, onError }: PipelineProgressProps) {
  const tr = useTranslations('rigging');
  const ts = useTranslations('rigging.stages');
  const tp = useTranslations('rigging.progress');

  const STAGES = [
    { key: 'uploading', title: ts('uploading') },
    { key: 'separating', title: ts('separating') },
    { key: 'rigging', title: ts('rigging') },
    { key: 'exporting', title: ts('exporting') },
    { key: 'pulling_assets', title: ts('pulling_assets') },
    { key: 'deploying', title: ts('deploying') },
  ];

  const STAGE_ORDER = STAGES.map((s) => s.key);

  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);

  const currentStageIndex = (stage: string) => {
    const idx = STAGE_ORDER.indexOf(stage);
    return idx >= 0 ? idx : 0;
  };

  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.hostname}:3001`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      ws.send(JSON.stringify({
        type: 'subscribe_pipeline',
        imageId,
        payload: { imageId },
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.imageId !== imageId) return;

        if (msg.type === 'pipeline_progress') {
          setProgress(msg.payload as ProgressData);
        } else if (msg.type === 'pipeline_complete') {
          setProgress(msg.payload as ProgressData);
          completedRef.current = true;
          onComplete?.(msg.payload.result);
        } else if (msg.type === 'pipeline_error') {
          setProgress(msg.payload as ProgressData);
          onError?.(msg.payload.error || 'Unknown error');
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => ws.close();
  }, [imageId, onComplete, onError]);

  useEffect(() => {
    connectWs();

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/rigging/status/${imageId}`);
        const json = await res.json();
        if (json.success && json.data) {
          const data = json.data as ProgressData;
          setProgress(data);
          if (data.result && !completedRef.current) {
            completedRef.current = true;
            onComplete?.(data.result);
          }
          if (data.error) {
            onError?.(data.error);
          }
        }
      } catch { /* polling fail is ok */ }
    }, 2000);

    return () => {
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'unsubscribe_pipeline',
          imageId,
          payload: { imageId },
        }));
        wsRef.current.close();
      }
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [imageId, connectWs, onComplete, onError]);

  const hasError = progress?.error;
  const isComplete = !!progress?.result && !hasError;

  return (
    <div className="max-w-2xl mx-auto">
      <Title level={4}>{tp('title')}</Title>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {previewUrl && (
          <div className="w-40 h-[213px] overflow-hidden rounded-lg bg-gray-100">
            <img src={previewUrl} alt="Original" className="w-full h-full object-cover" />
          </div>
        )}
        <div style={{ flex: 1 }}>
          <Steps
            orientation="vertical"
            current={progress ? currentStageIndex(progress.stage) : 0}
            status={hasError ? 'error' : isComplete ? 'finish' : 'process'}
            items={STAGES.map((s) => ({
              title: s.title,
              icon: hasError && currentStageIndex(progress?.stage || '') === STAGES.indexOf(s)
                ? <CloseCircleOutlined />
                : isComplete ? <CheckCircleOutlined /> : undefined,
            }))}
            size="small"
          />
        </div>
      </div>

      {progress && !hasError && !isComplete && (
        <div className="text-center" aria-live="assertive" aria-atomic="true">
          <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
          <div className="mt-2">
            <Text type="secondary">{progress.message}</Text>
          </div>
          <div className="mt-1">
            <Text type="secondary" style={{ fontSize: 12 }}>
              {tp('estimatedRemaining', { seconds: Math.round((100 - progress.percent) * 1.2) })}
            </Text>
          </div>
        </div>
      )}

      {hasError && (
        <Alert
          type="error"
          message={tr('generationFailed')}
          description={progress?.error || tp('unknownError')}
          showIcon
        />
      )}

      {isComplete && (
        <Alert
          type="success"
          message={tp('complete')}
          description={tp('totalTime', { seconds: Math.round((progress!.result!.totalTimeMs) / 1000) })}
          showIcon
        />
      )}

      {!wsConnected && !isComplete && !hasError && (
        <Text type="secondary" className="block text-center mt-2" style={{ fontSize: 12 }}>
          {tp('wsDisconnected')}
        </Text>
      )}
    </div>
  );
}
