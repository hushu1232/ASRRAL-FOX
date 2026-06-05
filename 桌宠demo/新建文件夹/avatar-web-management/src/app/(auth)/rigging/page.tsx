'use client';

import { useState, useCallback } from 'react';
import { Typography, Result, Button } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import RiggingUpload from '@/components/rigging/RiggingUpload';
import PipelineProgress from '@/components/rigging/PipelineProgress';
import ModelPreview from '@/components/rigging/ModelPreview';

const { Title } = Typography;

type Step = 'upload' | 'progress' | 'result';

interface PipelineConfig {
  imageId: string;
  template: string;
  meshDensity: string;
  previewUrl: string;
}

interface ModelResult {
  modelId: string;
  previewUrl: string;
  moc3Url: string;
  totalTimeMs: number;
}

export default function RiggingPage() {
  const t = useTranslations('rigging');
  const [step, setStep] = useState<Step>('upload');
  const [config, setConfig] = useState<PipelineConfig | null>(null);
  const [result, setResult] = useState<ModelResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serviceAvailable, setServiceAvailable] = useState<boolean | null>(null);

  // Check rigging service health on mount
  useState(() => {
    fetch('/api/rigging/health')
      .then((r) => r.json())
      .then((d) => setServiceAvailable(d.data?.rigging === 'ok'))
      .catch(() => setServiceAvailable(false));
  });

  const handlePipelineStart = useCallback((config: PipelineConfig) => {
    setConfig(config);
    setStep('progress');
    setError(null);

    // Trigger pipeline
    fetch('/api/rigging/pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageId: config.imageId,
        template: config.template,
        meshDensity: config.meshDensity,
        async: true,
      }),
    }).then((res) => res.json()).then((json) => {
      if (!json.success) {
        setError(json.error || 'Pipeline failed to start');
        setStep('upload');
      }
    }).catch(() => {
      // WS will handle progress, this is just fire-and-forget
    });
  }, []);

  const handleComplete = useCallback((res: ModelResult | undefined) => {
    if (res) {
      setResult(res);
      setStep('result');
    }
  }, []);

  const handleError = useCallback((err: string) => {
    setError(err);
  }, []);

  const handleReset = useCallback(() => {
    setStep('upload');
    setConfig(null);
    setResult(null);
    setError(null);
  }, []);

  // Service status check
  if (serviceAvailable === false) {
    return (
      <Result
        icon={<ThunderboltOutlined />}
        title={t('serviceUnavailableTitle')}
        subTitle={t('serviceUnavailableDesc')}
        extra={
          <Button type="primary" onClick={() => window.location.reload()}>
            {t('retryConnection')}
          </Button>
        }
      />
    );
  }

  if (serviceAvailable === null) {
    return null; // still checking
  }

  return (
    <div style={{ padding: '24px 0' }}>
      <Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>
        {t('title')}
      </Title>

      {step === 'upload' && (
        <RiggingUpload
          onPipelineStart={handlePipelineStart}
          disabled={false}
        />
      )}

      {step === 'progress' && config && (
        <PipelineProgress
          imageId={config.imageId}
          previewUrl={config.previewUrl}
          onComplete={handleComplete}
          onError={handleError}
        />
      )}

      {step === 'result' && result && config && (
        <ModelPreview
          result={result}
          template={config.template}
          meshDensity={config.meshDensity}
          onReset={handleReset}
        />
      )}

      {error && step !== 'progress' && (
        <Result
          status="error"
          title={t('generationFailed')}
          subTitle={error}
          extra={
            <Button type="primary" onClick={handleReset}>
              {t('retry')}
            </Button>
          }
        />
      )}
    </div>
  );
}
