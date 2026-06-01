'use client';

import { useEffect, useCallback, useState } from 'react';
import { Spin, Button, Tooltip, message, Drawer } from 'antd';
import {
  SettingOutlined, ReloadOutlined, MessageOutlined,
} from '@ant-design/icons';
import ChatPanel from './ChatPanel';
import ModelViewer from './ModelViewer';
import TimeAwarenessOverlay from './TimeAwarenessOverlay';
import { useVoiceInput } from './VoiceInput';
import { usePetPreviewStore } from '@/stores/petPreviewStore';
import { useTimeAwareness } from '@/hooks/useTimeAwareness';
import { useTranslations } from 'next-intl';

export default function PetPreview() {
  const t = useTranslations('pet');
  const store = usePetPreviewStore();
  const [chatOpen, setChatOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    store.loadConfig();
  }, []);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const voice = useVoiceInput({
    active: store.voiceActive,
    onResult: (text, isFinal) => {
      store.setVoiceText(text);
      if (isFinal && text.trim()) {
        setTimeout(() => {
          store.sendMessage(text.trim());
          store.setVoiceText('');
        }, 500);
      }
    },
    onError: (err) => {
      message.warning(err);
    },
    onStateChange: (active) => {
      store.setVoiceActive(active);
    },
    messages: {
      notSupported: t('voiceInput.notSupported'),
      micDenied: t('voiceInput.micDenied'),
      startFailed: t('voiceInput.startFailed'),
    },
  });

  useEffect(() => {
    const supported = !!(
      window.SpeechRecognition || (window as any).webkitSpeechRecognition
    );
    store.setVoiceSupported(supported);
  }, []);

  useTimeAwareness();

  const handleSend = useCallback(
    (text: string) => {
      store.sendMessage(text);
    },
    [store]
  );

  const VOICE_LABELS: Record<string, string> = {
    idle: '',
    listening: t('voiceLabels.listening'),
    thinking: t('voiceLabels.thinking'),
    speaking: t('voiceLabels.speaking'),
  };

  if (store.configLoading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <Spin size="large" tip={t('preview.loadingConfig')} />
      </div>
    );
  }

  if (store.configError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] gap-4">
        <div className="text-4xl opacity-40">🐱</div>
        <p className="text-base text-[var(--ds-colors-text-secondary)]">
          {store.configError}
        </p>
        <Button icon={<ReloadOutlined />} onClick={() => store.loadConfig()}>
          {t('preview.reload')}
        </Button>
      </div>
    );
  }

  const config = store.config;
  if (!config) return null;

  const chatPanel = (
    <ChatPanel
      messages={store.messages}
      onSend={handleSend}
      disabled={store.isProcessing}
      voiceState={store.voiceState}
      onStartVoice={voice.start}
      onStopVoice={voice.stop}
      voiceSupported={store.voiceSupported}
      voiceActive={store.voiceActive}
      voiceText={store.voiceText}
      className="h-full"
    />
  );

  return (
    <div className="w-full h-[calc(100vh-64px)] flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--ds-colors-border)] bg-[var(--ds-colors-surface)]">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-[var(--ds-colors-text)] m-0">
            {config.petName} · {t('preview.webPreview')}
          </h1>

          {store.voiceState !== 'idle' && (
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                store.voiceState === 'listening'
                  ? 'bg-red-100 text-red-700'
                  : store.voiceState === 'thinking'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-green-100 text-green-700'
              }`}
            >
              {VOICE_LABELS[store.voiceState]}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Tooltip title={t('preview.clearChat')}>
            <Button
              icon={<ReloadOutlined />}
              size="small"
              onClick={store.clearMessages}
              disabled={store.messages.length === 0}
            />
          </Tooltip>
          <Tooltip title={t('preview.configInDashboard')}>
            <Button icon={<SettingOutlined />} size="small" />
          </Tooltip>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 min-w-0 p-4 relative">
          <TimeAwarenessOverlay />
          <ModelViewer
            modelType={config.animationModel}
            modelPath={config.modelPath}
            emotion={store.currentEmotion}
            action={store.currentAction}
            isSpeaking={store.voiceState === 'speaking'}
            audioElement={store.audioElement}
            className="w-full h-full"
          />
        </div>

        {/* Desktop side panel */}
        <div className="hidden md:block w-[400px] min-w-[320px] max-w-[480px] p-4 pl-0">
          {chatPanel}
        </div>

        {/* Mobile floating chat button */}
        {isMobile && (
          <div className="fixed bottom-4 right-4 z-50">
            <Button
              type="primary"
              shape="circle"
              size="large"
              icon={<MessageOutlined />}
              onClick={() => setChatOpen(true)}
              className="shadow-lg"
            />
          </div>
        )}
      </div>

      {/* Mobile chat drawer */}
      {isMobile && (
        <Drawer
          title={t('preview.chat')}
          placement="bottom"
          height="70vh"
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          styles={{ body: { padding: 0, height: '100%' } }}
        >
          {chatPanel}
        </Drawer>
      )}
    </div>
  );
}
