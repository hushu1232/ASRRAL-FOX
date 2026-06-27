'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  Tabs,
  Form,
  Input,
  Select,
  Slider,
  Button,
  message,
  Modal,
  Table,
  Tag,
  Spin,
  Descriptions,
  Alert,
  Tooltip,
  Steps,
} from 'antd';
import {
  RobotOutlined,
  KeyOutlined,
  CloudServerOutlined,
  PictureOutlined,
  PlayCircleOutlined,
  ExportOutlined,
  ApiOutlined,
  SaveOutlined,
  LinkOutlined,
  DisconnectOutlined,
  ShopOutlined,
  InfoCircleOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { apiGet, apiPut, apiPost } from '@/lib/api-client';
import PetSyncStatusPanel from '@/components/pet/sync/PetSyncStatusPanel';
import type { DesktopSyncStatus } from '@/lib/webbridge/sync-status';

const { TextArea } = Input;

interface PetConfig {
  id: string;
  pet_name: string;
  personality: string;
  backstory: string;
  animation_model: string;
  avatar_id?: string;
  ffmpeg_path?: string;
  idle_timeout: number;
  wander_interval: number;
  created_at?: string;
  updated_at?: string;
}

interface AssetEntry {
  id: string;
  filename: string;
  assetType: string;
  format: string;
  thumbnailUrl?: string;
  status: string;
}

export default function PetConfigPage() {
  const t = useTranslations('pet');
  const [config, setConfig] = useState<PetConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [assets, setAssets] = useState<AssetEntry[]>([]);
  const [assetLoading, setAssetLoading] = useState(false);
  const [assetFilter, setAssetFilter] = useState<string>('');
  const [showWizard, setShowWizard] = useState(false);
  const [wizardDismissed, setWizardDismissed] = useState(false);
  const [syncStatus, setSyncStatus] = useState<DesktopSyncStatus | null>(null);
  const [syncStatusLoading, setSyncStatusLoading] = useState(false);
  const [form] = Form.useForm();

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await apiGet<PetConfig>('/api/pet/config');
      if (res.success && res.data) {
        setConfig(res.data as PetConfig);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchSyncStatus = async () => {
    setSyncStatusLoading(true);
    try {
      const res = await apiGet<DesktopSyncStatus>('/api/pet/sync/status');
      if (res.success && res.data) {
        setSyncStatus(res.data);
      }
    } finally {
      setSyncStatusLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchSyncStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!config) {
      return;
    }

    const d = config as unknown as Record<string, unknown>;
    form.setFieldsValue({
      petName: d.pet_name,
      personality: d.personality,
      backstory: d.backstory,
      animationModel: d.animation_model,
      ffmpegPath: d.ffmpeg_path,
      idleTimeout: d.idle_timeout,
      wanderInterval: d.wander_interval,
    });
  }, [config, form]);

  // Show setup wizard for first-time users
  useEffect(() => {
    if (config && !wizardDismissed) {
      setShowWizard(true);
    }
  }, [config, wizardDismissed]);

  const handleSave = async () => {
    const values = form.getFieldsValue();
    const data: Record<string, unknown> = {};
    const fields = [
      'petName',
      'personality',
      'backstory',
      'animationModel',
      'ffmpegPath',
      'idleTimeout',
      'wanderInterval',
    ];
    for (const f of fields) {
      if (values[f] !== undefined) data[f] = values[f];
    }

    setSaving(true);
    const res = await apiPut<PetConfig>('/api/pet/config', data);
    if (res.success) {
      message.success(t('saveSuccess'));
      await fetchConfig();
      await fetchSyncStatus();
    } else {
      message.error(res.error || t('saveFailed'));
    }
    setSaving(false);
  };

  const handleExport = async () => {
    const res = await apiGet<Record<string, unknown>>('/api/pet/export');
    if (res.success && res.data) {
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pet-config-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      message.success(t('exportSuccess'));
    } else {
      message.error(t('exportFailed'));
    }
  };

  const openAssetPicker = async (type: string) => {
    setAssetFilter(type);
    setAssetModalOpen(true);
    setAssetLoading(true);
    const res = await apiGet<AssetEntry[]>(`/api/pet/assets?type=${type}`);
    if (res.success) setAssets((res.data || []) as AssetEntry[]);
    setAssetLoading(false);
  };

  const assetTypeLabels: Record<string, string> = {
    model: t('assetPicker.typeModel'),
    texture: t('assetPicker.typeTexture'),
    animation: t('assetPicker.typeAnimation'),
  };

  const wizardCurrent =
    syncStatus?.summaryKind === 'upToDate'
      ? 5
      : syncStatus?.summaryKind === 'localConfirmationRequired'
        ? 4
        : syncStatus?.summaryKind === 'pendingPull'
          ? 3
          : syncStatus?.desktopConnection === 'online'
            ? 2
            : 0;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">
          <RobotOutlined className="mr-3" />
          {t('title')}
        </h1>
        <div className="flex gap-3">
          <Button icon={<ExportOutlined />} onClick={handleExport}>
            {t('exportConfig')}
          </Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            {t('saveConfig')}
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <PetSyncStatusPanel
          status={syncStatus}
          loading={syncStatusLoading}
          onRefresh={fetchSyncStatus}
        />
      </div>

      {showWizard && (
        <Alert
          type="info"
          className="mb-4"
          style={{
            background: 'linear-gradient(135deg, #1a1030 0%, #12122A 100%)',
            borderColor: 'rgba(139,92,246,0.3)',
          }}
          title={
            <div className="flex items-center justify-between">
              <span className="text-white font-medium">{t('wizard.title')}</span>
              <Button
                size="small"
                type="text"
                style={{ color: '#9494a8' }}
                onClick={() => {
                  setShowWizard(false);
                  setWizardDismissed(true);
                }}
              >
                {t('wizard.skip')}
              </Button>
            </div>
          }
          description={
            <Steps
              size="small"
              orientation="horizontal"
              current={wizardCurrent}
              className="mt-3"
              items={[
                {
                  title: t('wizard.step1Title'),
                  content: (
                    <span className="text-gray-400 text-xs">
                      {t.rich('wizard.step1Desc', {
                        link: (chunks) => (
                          <a href="/downloads" className="text-purple-400 hover:text-purple-300">
                            {chunks}
                          </a>
                        ),
                      })}
                    </span>
                  ),
                  icon: <DownloadOutlined />,
                },
                {
                  title: t('wizard.step2Title'),
                  content: <span className="text-gray-400 text-xs">{t('wizard.step2Desc')}</span>,
                  icon: <KeyOutlined />,
                },
                {
                  title: t('wizard.step3Title'),
                  content: <span className="text-gray-400 text-xs">{t('wizard.step3Desc')}</span>,
                  icon: <RobotOutlined />,
                },
                {
                  title: t('wizard.step4Title'),
                  content: <span className="text-gray-400 text-xs">{t('wizard.step4Desc')}</span>,
                  icon: <PlayCircleOutlined />,
                },
                {
                  title: t('wizard.step5Title'),
                  content: <span className="text-gray-400 text-xs">{t('wizard.step5Desc')}</span>,
                  icon: <ApiOutlined />,
                },
                {
                  title: t('wizard.step6Title'),
                  content: <span className="text-gray-400 text-xs">{t('wizard.step6Desc')}</span>,
                  icon: <CheckCircleOutlined />,
                },
              ]}
            />
          }
          closable
          onClose={() => {
            setShowWizard(false);
            setWizardDismissed(true);
          }}
        />
      )}

      <div className="flex gap-6" style={{ minHeight: '70vh' }}>
        {/* Left: Preview */}
        <Card
          className="flex-shrink-0"
          style={{
            width: 360,
            background: '#12122A',
            borderColor: 'rgba(139,92,246,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          styles={{ body: { width: '100%', textAlign: 'center', padding: 48 } }}
        >
          <PictureOutlined style={{ fontSize: 64, color: '#5e5e7a', marginBottom: 16 }} />
          <p style={{ color: '#9494a8', fontSize: 14 }}>
            {t('preview.label', { name: config?.pet_name || t('preview.defaultName') })}
          </p>
          <p style={{ color: '#5e5e7a', fontSize: 12 }}>{t('preview.tip')}</p>
          {config?.avatar_id && (
            <Tag icon={<LinkOutlined />} color="purple" style={{ marginTop: 8 }}>
              {t('preview.bound')}
            </Tag>
          )}
          {config && (
            <Descriptions
              size="small"
              colon={false}
              column={1}
              style={{ marginTop: 16, textAlign: 'left' }}
              styles={{ label: { color: '#9494a8' }, content: { color: '#e8e8f0' } }}
            >
              <Descriptions.Item label={t('preview.system')}>
                {config.animation_model.toUpperCase()}
              </Descriptions.Item>
              <Descriptions.Item label={t('preview.idleTimeout')}>
                {config.idle_timeout}s
              </Descriptions.Item>
              <Descriptions.Item label={t('preview.wanderInterval')}>
                {config.wander_interval}s
              </Descriptions.Item>
            </Descriptions>
          )}
        </Card>

        {/* Right: Config Tabs */}
        <Card
          className="flex-1"
          style={{ background: '#12122A', borderColor: 'rgba(139,92,246,0.15)' }}
        >
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
                        <div className="flex gap-2">
                          <Button
                            icon={<ShopOutlined />}
                            type="primary"
                            onClick={() => window.open('/marketplace', '_blank')}
                            className="bg-gradient-to-r from-purple-600 to-blue-600 border-0"
                          >
                            {t('model.browseMarket')}
                          </Button>
                          <span className="text-gray-500 text-xs self-center">
                            {t('model.browseMarketTip')}
                          </span>
                        </div>
                      </Form.Item>
                      <Form.Item label={t('model.bindAvatar')}>
                        <div className="flex gap-2">
                          <Button
                            icon={<PictureOutlined />}
                            onClick={() => openAssetPicker('model')}
                          >
                            {t('model.pickModel')}
                          </Button>
                          <Button onClick={() => openAssetPicker('texture')}>
                            {t('model.pickTexture')}
                          </Button>
                          <Button onClick={() => openAssetPicker('animation')}>
                            {t('model.pickAnimation')}
                          </Button>
                        </div>
                        {config?.avatar_id && (
                          <div className="mt-2">
                            <Tag
                              icon={<LinkOutlined />}
                              color="purple"
                              closable
                              onClose={async () => {
                                await apiPut('/api/pet/config', { avatarId: null });
                                fetchConfig();
                              }}
                            >
                              {t('model.avatarId', { id: config.avatar_id })}
                            </Tag>
                          </div>
                        )}
                      </Form.Item>
                      <Form.Item name="ffmpegPath" label={t('model.ffmpegPath')}>
                        <Input placeholder="C:\ffmpeg\bin\ffmpeg.exe" />
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
        </Card>
      </div>

      {/* Asset Picker Modal */}
      <Modal
        title={t('assetPicker.title', { type: assetTypeLabels[assetFilter] || assetFilter })}
        open={assetModalOpen}
        onCancel={() => setAssetModalOpen(false)}
        footer={null}
        width={700}
      >
        {assetLoading ? (
          <div className="py-12 text-center">
            <Spin />
          </div>
        ) : assets.length === 0 ? (
          <div className="py-12 text-center" style={{ color: '#9494a8' }}>
            {t('assetPicker.noAssets')}
          </div>
        ) : (
          <Table
            dataSource={assets}
            rowKey="id"
            columns={[
              { title: t('assetPicker.filename'), dataIndex: 'filename', key: 'filename' },
              {
                title: t('assetPicker.type'),
                dataIndex: 'assetType',
                key: 'assetType',
                render: (v: string) => <Tag>{v}</Tag>,
              },
              { title: t('assetPicker.format'), dataIndex: 'format', key: 'format' },
              {
                title: t('assetPicker.actions'),
                key: 'action',
                render: (_: unknown, record: AssetEntry) => (
                  <Button
                    size="small"
                    type="primary"
                    onClick={async () => {
                      await apiPost('/api/pet/assets', {
                        assetId: record.id,
                        assetType: record.assetType,
                        slotName: `${assetFilter}_${Date.now()}`,
                      });
                      message.success(t('assetPicker.attachSuccess'));
                      setAssetModalOpen(false);
                      fetchConfig();
                    }}
                  >
                    {t('assetPicker.attach')}
                  </Button>
                ),
              },
            ]}
            pagination={false}
            size="small"
          />
        )}
      </Modal>
    </div>
  );
}
