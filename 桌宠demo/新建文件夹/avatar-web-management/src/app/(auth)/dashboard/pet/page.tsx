'use client';

import { useEffect, useState } from 'react';
import { Form, Button, message, Modal, Table, Tag, Spin } from 'antd';
import { ExportOutlined, SaveOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { apiGet, apiPut, apiPost } from '@/lib/api-client';
import PageHeader from '@/components/layout/PageHeader';
import PetRuntimeSummary from '@/components/pet/PetRuntimeSummary';
import PetSetupReadiness from '@/components/pet/PetSetupReadiness';
import PetPreviewCard from '@/components/pet/PetPreviewCard';
import PetConfigEditor, { type PetAssetPickerType } from '@/components/pet/PetConfigEditor';
import PetDiagnosticsSection from '@/components/pet/sync/PetDiagnosticsSection';
import PetSyncStatusPanel from '@/components/pet/sync/PetSyncStatusPanel';
import WebBridgeMockStatusPanel from '@/components/pet/sync/WebBridgeMockStatusPanel';
import type { DesktopSyncStatus } from '@/lib/webbridge/sync-status';

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
    fetchConfig().then(() => fetchSyncStatus());
  }, []);

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

  const openAssetPicker = async (type: PetAssetPickerType) => {
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
      <PageHeader
        title={t('title')}
        subtitle={t('consoleSubtitle')}
        actions={
          <>
            <Button icon={<ExportOutlined />} onClick={handleExport}>
              {t('exportConfig')}
            </Button>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
              {t('saveConfig')}
            </Button>
          </>
        }
      />

      <div className="space-y-4">
        <PetRuntimeSummary
          status={syncStatus}
          loading={syncStatusLoading}
          onRefresh={fetchSyncStatus}
        />

        <PetSyncStatusPanel
          status={syncStatus}
          loading={syncStatusLoading}
          onRefresh={fetchSyncStatus}
        />

        <PetDiagnosticsSection>
          <WebBridgeMockStatusPanel />
        </PetDiagnosticsSection>

        {showWizard && (
          <PetSetupReadiness
            current={wizardCurrent}
            onDismiss={() => {
              setShowWizard(false);
              setWizardDismissed(true);
            }}
          />
        )}

        <div
          className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-4"
          style={{ minHeight: '60vh' }}
        >
          <PetPreviewCard config={config} />
          <PetConfigEditor
            form={form}
            config={config}
            onOpenAssetPicker={openAssetPicker}
            onUnbindAvatar={async () => {
              await apiPut('/api/pet/config', { avatarId: null });
              await fetchConfig();
            }}
          />
        </div>
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
          <div className="py-12 text-center" style={{ color: 'var(--text-muted)' }}>
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
