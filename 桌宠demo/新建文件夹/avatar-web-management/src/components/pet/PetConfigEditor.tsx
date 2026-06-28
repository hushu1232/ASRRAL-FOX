'use client';

import type { MouseEvent } from 'react';
import { Button, Form, Input, Select, Slider, Tabs, Tag } from 'antd';
import type { FormInstance } from 'antd';
import {
  CloudServerOutlined,
  LinkOutlined,
  PictureOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import OperationPanel from '@/components/ui/OperationPanel';

const { TextArea } = Input;

export interface PetConfigEditorConfig {
  id: string;
  pet_name: string;
  animation_model: string;
  avatar_id?: string;
  idle_timeout: number;
  wander_interval: number;
}

export interface PetConfigEditorProps {
  form: FormInstance;
  config: PetConfigEditorConfig | null;
  onOpenAssetPicker: (type: string) => void;
  onUnbindAvatar: () => void | Promise<void>;
}

export default function PetConfigEditor({
  form,
  config,
  onOpenAssetPicker,
  onUnbindAvatar,
}: PetConfigEditorProps) {
  const t = useTranslations('pet');

  const handleUnbindAvatar = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    void onUnbindAvatar();
  };

  return (
    <OperationPanel className="flex-1" title={t('config.editor')}>
      <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
        <Tabs
          items={[
            {
              key: 'basic',
              label: t('tabs.basic'),
              children: (
                <div className="pt-4">
                  <Form.Item name="petName" label={t('basic.name')}>
                    <Input placeholder={t('basic.namePlaceholder')} />
                  </Form.Item>
                  <Form.Item name="personality" label={t('basic.personality')}>
                    <TextArea rows={3} placeholder={t('basic.personalityPlaceholder')} />
                  </Form.Item>
                  <Form.Item name="backstory" label={t('basic.backstory')}>
                    <TextArea rows={4} placeholder={t('basic.backstoryPlaceholder')} />
                  </Form.Item>
                </div>
              ),
            },
            {
              key: 'model',
              label: (
                <span>
                  <CloudServerOutlined className="mr-1" />
                  {t('tabs.model')}
                </span>
              ),
              children: (
                <div className="pt-4">
                  <Form.Item name="animationModel" label={t('model.systemLabel')}>
                    <Select
                      options={[
                        { value: 'live2d', label: t('model.live2D') },
                        { value: 'dragonbones', label: t('model.dragonBones') },
                        { value: 'vrm', label: t('model.vrm') },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item label={t('model.fromMarket')}>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        icon={<ShopOutlined />}
                        type="primary"
                        onClick={() => window.open('/marketplace', '_blank')}
                      >
                        {t('model.browseMarket')}
                      </Button>
                      <span className="text-gray-500 text-xs self-center">
                        {t('model.browseMarketTip')}
                      </span>
                    </div>
                  </Form.Item>
                  <Form.Item label={t('model.bindAvatar')}>
                    <div className="flex flex-wrap gap-2">
                      <Button icon={<PictureOutlined />} onClick={() => onOpenAssetPicker('model')}>
                        {t('model.pickModel')}
                      </Button>
                      <Button onClick={() => onOpenAssetPicker('texture')}>
                        {t('model.pickTexture')}
                      </Button>
                      <Button onClick={() => onOpenAssetPicker('animation')}>
                        {t('model.pickAnimation')}
                      </Button>
                    </div>
                    {config?.avatar_id && (
                      <div className="mt-2">
                        <Tag
                          icon={<LinkOutlined />}
                          color="purple"
                          closable
                          onClose={handleUnbindAvatar}
                        >
                          {t('model.avatarId', { id: config.avatar_id })}
                        </Tag>
                      </div>
                    )}
                  </Form.Item>
                  <Form.Item name="ffmpegPath" label={t('model.ffmpegPath')}>
                    <Input placeholder="C:\\ffmpeg\\bin\\ffmpeg.exe" />
                  </Form.Item>
                  <Form.Item name="idleTimeout" label={t('model.idleTimeout')}>
                    <Slider
                      min={60}
                      max={1800}
                      step={30}
                      marks={{ 60: '1m', 300: '5m', 900: '15m', 1800: '30m' }}
                    />
                  </Form.Item>
                  <Form.Item name="wanderInterval" label={t('model.wanderInterval')}>
                    <Slider
                      min={5}
                      max={120}
                      step={5}
                      marks={{ 5: '5s', 30: '30s', 60: '1m', 120: '2m' }}
                    />
                  </Form.Item>
                </div>
              ),
            },
          ]}
        />
      </Form>
    </OperationPanel>
  );
}
