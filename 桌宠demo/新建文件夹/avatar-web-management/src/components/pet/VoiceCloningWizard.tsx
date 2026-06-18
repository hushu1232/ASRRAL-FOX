// TODO: BEM-migrate
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Steps, Button, Upload, Card, Progress, List, Spin, message,
  Typography, Space, Alert, Result, Descriptions, Tooltip, Empty,
} from 'antd';
import {
  UploadOutlined, SoundOutlined, RobotOutlined, CheckCircleOutlined,
  PlayCircleOutlined, PauseCircleOutlined, DeleteOutlined,
  ReloadOutlined, InboxOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { apiPost, apiGet, apiDelete, apiPostFormData } from '@/lib/api-client';
import { useAuthStore } from '@/stores/authStore';

const { Dragger } = Upload;
const { Title, Text, Paragraph } = Typography;

interface VoiceEntry {
  voice_id: string;
  has_reference_audio: boolean;
  prompt_text: string;
  gpt_model_size_mb: number;
  sovits_model_size_mb: number;
}

interface TrainStatus {
  task_id: string;
  status: string;
  progress: number;
  message: string;
  voice_id?: string;
  started_at: number;
  completed_at?: number;
  error?: string;
}

export default function VoiceCloningWizard() {
  const t = useTranslations('pet.voiceCloning');

  const STEPS = [
    { title: t('step.step1.title'), description: t('step.step1.description') },
    { title: t('step.step2.title'), description: t('step.step2.description') },
    { title: t('step.step3.title'), description: t('step.step3.description') },
  ];

  const STAGE_LABELS: Record<string, string> = {
    uploading: t('stages.uploading'),
    preprocessing: t('stages.preprocessing'),
    training: t('stages.training'),
    packaging: t('stages.packaging'),
    completed: t('stages.completed'),
    failed: t('stages.failed'),
  };

  const [currentStep, setCurrentStep] = useState(0);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [voiceName, setVoiceName] = useState('');
  const [promptText, setPromptText] = useState('');

  const [taskId, setTaskId] = useState<string | null>(null);
  const [trainStatus, setTrainStatus] = useState<TrainStatus | null>(null);
  const [training, setTraining] = useState(false);

  const [voices, setVoices] = useState<VoiceEntry[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);

  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadVoices();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  const loadVoices = async () => {
    setLoadingVoices(true);
    try {
      const res = await apiGet<{ voices: VoiceEntry[]; total: number }>('/api/tts/voices');
      setVoices(res.data?.voices || []);
    } catch { /* ignore */ }
    finally { setLoadingVoices(false); }
  };

  // ─── Step 1: Upload ────────────────────────────────────

  const handleUpload = useCallback((file: File) => {
    const validTypes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/flac', 'audio/x-wav'];
    if (!validTypes.includes(file.type)) {
      message.error(t('step1.unsupportedFormat'));
      return false;
    }
    if (file.size > 100 * 1024 * 1024) {
      message.error(t('step1.fileTooLarge'));
      return false;
    }
    setAudioFile(file);
    if (!voiceName) setVoiceName(file.name.replace(/\.[^.]+$/, ''));
    return false;
  }, [voiceName, t]);

  const goToStep2 = () => {
    if (!audioFile) { message.warning(t('step1.uploadFirst')); return; }
    if (!voiceName.trim()) { message.warning(t('step1.voiceNameRequired')); return; }
    setCurrentStep(1);
  };

  // ─── Step 2: Train ─────────────────────────────────────

  const startTraining = async () => {
    if (!audioFile) return;
    setTraining(true);

    const formData = new FormData();
    formData.append('audio', audioFile);
    formData.append('voice_name', voiceName.trim());
    formData.append('prompt_text', promptText.trim());

    try {
      const result = await apiPostFormData<{ task_id: string; status: string; message: string }>('/api/tts/train', formData);
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Training start failed');
      }
      setTaskId(result.data.task_id);
      startPolling(result.data.task_id);
    } catch (err: unknown) {
      message.error(`${t('step2.trainFailed')}: ${err instanceof Error ? err.message : String(err)}`);
      setTraining(false);
    }
  };

  const startPolling = (tid: string) => {
    pollingRef.current = setInterval(async () => {
      try {
        const res = await apiGet<TrainStatus>(`/api/tts/train/${tid}/status`);
        const status = res.data;
        if (!status) return;
        setTrainStatus(status);

        if (status.status === 'completed') {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          setTraining(false);
          setSelectedVoiceId(status.voice_id || null);
          message.success(t('stages.completed'));
          loadVoices();
        } else if (status.status === 'failed') {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          setTraining(false);
          message.error(status.error || t('step2.unknownError'));
        }
      } catch { /* polling error — retry next interval */ }
    }, 2000);
  };

  const goToStep3 = () => {
    setCurrentStep(2);
  };

  // ─── Step 3: Preview ───────────────────────────────────

  const handlePreview = async (voiceId: string) => {
    if (previewAudio) {
      previewAudio.pause();
      URL.revokeObjectURL(previewAudio.src);
    }

    try {
      const token = useAuthStore.getState().accessToken;
      const res = await fetch('/api/tts/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: t('step3.sampleText'),
          voice_id: voiceId,
        }),
      });

      if (!res.ok) throw new Error(`Synthesis failed: ${res.status}`);

      const contentType = res.headers.get('Content-Type') || '';
      if (contentType.includes('audio/')) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => setPlaying(false);
        setPreviewAudio(audio);
        setPlaying(true);
        await audio.play();
      } else {
        message.warning(t('step3.serviceUnavailable'));
      }
    } catch {
      message.error(t('step3.previewFailed'));
    }
  };

  const stopPreview = () => {
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
    }
    setPlaying(false);
  };

  const handleSelectVoice = async () => {
    if (!selectedVoiceId) { message.warning(t('step3.selectFirst')); return; }
    try {
      await apiPost('/api/pet/config', {
        tts_engine: 'gpt-sovits',
        custom_voice_id: selectedVoiceId,
      });
      message.success(t('step3.setSuccess'));
    } catch (err: unknown) {
      message.error(`${t('step3.saveFailed')}: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleDeleteVoice = async (voiceId: string) => {
    try {
      await apiDelete(`/api/tts/voices?voiceId=${voiceId}`);
      message.success(t('step3.deleteSuccess'));
      if (selectedVoiceId === voiceId) setSelectedVoiceId(null);
      loadVoices();
    } catch (err: unknown) {
      message.error(`${t('step3.deleteFailed')}: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // ─── Render ─────────────────────────────────────────────

  const renderStep1 = () => (
    <Card className="max-w-2xl mx-auto">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message={t('step1.recordingTips')}
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>{t('step1.tipNoBgMusic')}</li>
              <li>{t('step1.tipNormalSpeed')}</li>
              <li>{t('step1.tipMinLength')}</li>
              <li>{t('step1.tipWavBest')}</li>
            </ul>
          }
        />

        <Dragger
          accept="audio/wav,audio/mpeg,audio/mp3,audio/ogg,audio/flac"
          maxCount={1}
          beforeUpload={handleUpload}
          onRemove={() => setAudioFile(null)}
          className="!p-6"
        >
          {audioFile ? (
            <Space direction="vertical">
              <SoundOutlined style={{ fontSize: 40, color: '#1677ff' }} />
              <Text strong>{audioFile.name}</Text>
              <Text type="secondary">{(audioFile.size / (1024 * 1024)).toFixed(1)} MB</Text>
            </Space>
          ) : (
            <Space direction="vertical">
              <InboxOutlined style={{ fontSize: 48, color: '#1677ff' }} />
              <Text strong>{t('step1.dragText')}</Text>
              <Text type="secondary">{t('step1.dragHint')}</Text>
            </Space>
          )}
        </Dragger>

        <div>
          <label htmlFor="voice-name-input"><Text strong>{t('step1.voiceName')}</Text></label>
          <input
            id="voice-name-input"
            type="text"
            value={voiceName}
            onChange={e => setVoiceName(e.target.value)}
            placeholder={t('step1.voiceNamePlaceholder')}
            maxLength={50}
            className="block w-full mt-2 px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>

        <div>
          <label htmlFor="prompt-text-textarea"><Text strong>{t('step1.promptText')}</Text></label>
          <textarea
            id="prompt-text-textarea"
            value={promptText}
            onChange={e => setPromptText(e.target.value)}
            placeholder={t('step1.promptTextPlaceholder')}
            rows={3}
            maxLength={2000}
            className="block w-full mt-2 px-3 py-2 border border-gray-300 rounded-md text-sm resize-y"
          />
          <Text type="secondary" style={{ fontSize: 12 }}>{t('step1.promptTextHint')}</Text>
        </div>

        <div style={{ textAlign: 'right' }}>
          <Button type="primary" size="large" onClick={goToStep2} disabled={!audioFile}>
            {t('step1.next')}
          </Button>
        </div>
      </Space>
    </Card>
  );

  const renderStep2 = () => (
    <Card className="max-w-2xl mx-auto">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label={t('step2.audioFile')}>{audioFile?.name}</Descriptions.Item>
          <Descriptions.Item label={t('step2.voiceName')}>{voiceName}</Descriptions.Item>
          <Descriptions.Item label={t('step2.promptText')}>
            {promptText || t('step2.notProvided')}
          </Descriptions.Item>
        </Descriptions>

        {!taskId && !training && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <RobotOutlined style={{ fontSize: 48, color: '#1677ff', marginBottom: 16 }} />
            <Paragraph>
              {t('step2.descLine1')}<br />
              {t('step2.descLine2')}
            </Paragraph>
            <Space>
              <Button onClick={() => setCurrentStep(0)}>{t('step2.back')}</Button>
              <Button type="primary" size="large" icon={<SoundOutlined />} onClick={startTraining}>
                {t('step2.start')}
              </Button>
            </Space>
          </div>
        )}

        {(training || taskId) && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            {training ? (
              <>
                <Spin size="large" style={{ marginBottom: 16 }} />
                <Title level={4}>
                  {trainStatus ? (STAGE_LABELS[trainStatus.status] || trainStatus.status) : t('step2.starting')}
                </Title>
                <Progress
                  percent={Math.round(trainStatus?.progress || 0)}
                  status={trainStatus?.status === 'failed' ? 'exception' : 'active'}
                />
                <Text type="secondary">{trainStatus?.message || t('step2.preparing')}</Text>
              </>
            ) : (
              <Result
                status="success"
                title={t('step2.completeTitle')}
                subTitle={t('step2.completeDesc', { name: voiceName })}
                extra={
                  <Button type="primary" onClick={goToStep3}>
                    {t('step2.listen')}
                  </Button>
                }
              />
            )}

            {trainStatus?.status === 'failed' && (
              <Result
                status="error"
                title={t('step2.failedTitle')}
                subTitle={trainStatus.error || t('step2.unknownError')}
                extra={
                  <Space>
                    <Button onClick={() => { setTaskId(null); setTrainStatus(null); }}>
                      {t('step2.restart')}
                    </Button>
                    <Button type="primary" icon={<ReloadOutlined />} onClick={startTraining}>
                      {t('step2.retry')}
                    </Button>
                  </Space>
                }
              />
            )}
          </div>
        )}
      </Space>
    </Card>
  );

  const renderStep3 = () => (
    <Card className="max-w-2xl mx-auto">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Alert
          type="success"
          showIcon
          message={t('step3.alertTitle')}
          description={t('step3.alertDesc')}
        />

        {loadingVoices ? (
          <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
        ) : voices.length === 0 ? (
          <Empty description={t('step3.noVoices')} />
        ) : (
          <List
            dataSource={voices}
            renderItem={(voice) => (
              <List.Item
                actions={[
                  playing && selectedVoiceId === voice.voice_id ? (
                    <Tooltip key="stop" title={t('step3.stop')}>
                      <Button icon={<PauseCircleOutlined />} onClick={stopPreview} danger />
                    </Tooltip>
                  ) : (
                    <Tooltip key="preview" title={t('step3.preview')}>
                      <Button
                        icon={<PlayCircleOutlined />}
                        onClick={() => { setSelectedVoiceId(voice.voice_id); handlePreview(voice.voice_id); }}
                        type="primary"
                      />
                    </Tooltip>
                  ),
                  <Tooltip key="delete" title={t('step3.delete')}>
                    <Button
                      icon={<DeleteOutlined />}
                      onClick={() => handleDeleteVoice(voice.voice_id)}
                      danger
                    />
                  </Tooltip>,
                ]}
                onClick={() => setSelectedVoiceId(voice.voice_id)}
                style={{
                  cursor: 'pointer',
                  background: selectedVoiceId === voice.voice_id ? '#e6f4ff' : undefined,
                  padding: '8px 12px',
                  borderRadius: 8,
                }}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong>{voice.voice_id.slice(0, 8)}...</Text>
                      {selectedVoiceId === voice.voice_id && (
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      )}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={0}>
                      <Text type="secondary">
                        {t('step3.promptText', { text: voice.prompt_text?.slice(0, 50) || t('step3.noPromptText') })}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        GPT: {voice.gpt_model_size_mb}MB | SoVITS: {voice.sovits_model_size_mb}MB
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}

        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={() => setCurrentStep(1)}>{t('step3.backToTraining')}</Button>
            <Button
              type="primary"
              size="large"
              icon={<CheckCircleOutlined />}
              disabled={!selectedVoiceId}
              onClick={handleSelectVoice}
            >
              {t('step3.setAsPet')}
            </Button>
          </Space>
        </div>
      </Space>
    </Card>
  );

  // ─── Main ────────────────────────────────────────────────

  return (
    <div className="py-6">
      <Title level={3}>
        <SoundOutlined /> {t('title')}
      </Title>
      <Paragraph type="secondary">
        {t('description')}
      </Paragraph>

      <Steps
        current={currentStep}
        onChange={(step) => {
          if (step < currentStep || (!training && taskId && trainStatus?.status === 'completed')) {
            setCurrentStep(step);
          }
        }}
        items={STEPS}
        className="max-w-2xl mx-auto my-6"
      />

      {currentStep === 0 && renderStep1()}
      {currentStep === 1 && renderStep2()}
      {currentStep === 2 && renderStep3()}
    </div>
  );
}
