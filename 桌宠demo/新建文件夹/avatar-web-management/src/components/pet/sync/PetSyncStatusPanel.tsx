'use client';

import { Alert, Button, Card, Descriptions, Space, Spin, Tag, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type {
  DesktopConnectionState,
  DesktopPrimaryAction,
  DesktopSummaryKind,
  DesktopSyncStatus,
} from '@/lib/webbridge/sync-status';

const { Text } = Typography;

interface PetSyncStatusPanelProps {
  status: DesktopSyncStatus | null;
  loading: boolean;
  onRefresh: () => void;
}

const SUMMARY_TAG_COLORS: Record<DesktopSummaryKind, string> = {
  unknown: 'default',
  desktopOffline: 'warning',
  pendingPull: 'processing',
  localConfirmationRequired: 'orange',
  upToDate: 'success',
  failed: 'error',
};

export default function PetSyncStatusPanel({
  status,
  loading,
  onRefresh,
}: PetSyncStatusPanelProps) {
  const t = useTranslations('pet.syncStatus');

  if (!status && loading) {
    return (
      <Card>
        <Space>
          <Spin />
          <Text>{t('loading')}</Text>
        </Space>
      </Card>
    );
  }

  if (!status) {
    return (
      <Alert
        type="warning"
        showIcon
        title={t('unavailable')}
        action={<RefreshButton loading={loading} onRefresh={onRefresh} t={t} />}
      />
    );
  }

  return (
    <Card title={t('title')} extra={renderAction(status.primaryAction, loading, onRefresh, t)}>
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <Tag color={SUMMARY_TAG_COLORS[status.summaryKind]}>
          {t(`summary.${status.summaryKind}`)}
        </Tag>

        <Descriptions column={1} size="small">
          <Descriptions.Item label={t('connection')}>
            {formatConnection(status.desktopConnection, t)}
          </Descriptions.Item>
          <Descriptions.Item label={t('webVersion')}>
            {status.webConfigVersion}
          </Descriptions.Item>
          <Descriptions.Item label={t('desktopAppliedVersion')}>
            {status.desktopAppliedVersion ?? t('notApplied')}
          </Descriptions.Item>
          <Descriptions.Item label={t('lastSyncAt')}>
            {formatDate(status.lastSyncAt, t)}
          </Descriptions.Item>
          <Descriptions.Item label={t('lastAppliedAt')}>
            {formatDate(status.lastAppliedAt, t)}
          </Descriptions.Item>
          <Descriptions.Item label={t('localConfirmation')}>
            {status.requiresLocalConfirmation ? t('required') : t('notRequired')}
          </Descriptions.Item>
        </Descriptions>

        {status.lastError && (
          <Alert
            type="error"
            showIcon
            title={status.lastError.message ?? status.lastError.code}
            description={
              <Space orientation="vertical" size={4}>
                <Text code>{status.lastError.code}</Text>
                {status.lastError.technicalDetail && (
                  <Text type="secondary">{status.lastError.technicalDetail}</Text>
                )}
              </Space>
            }
          />
        )}
      </Space>
    </Card>
  );
}

function renderAction(
  primaryAction: DesktopPrimaryAction,
  loading: boolean,
  onRefresh: () => void,
  t: (key: string) => string
) {
  if (primaryAction === 'none') {
    return null;
  }

  if (primaryAction === 'confirmInDesktop') {
    return <Button type="primary">{t('action.confirmInDesktop')}</Button>;
  }

  if (primaryAction === 'viewDetails') {
    return <Button>{t('action.viewDetails')}</Button>;
  }

  return <RefreshButton loading={loading} onRefresh={onRefresh} t={t} />;
}

function RefreshButton({
  loading,
  onRefresh,
  t,
}: {
  loading: boolean;
  onRefresh: () => void;
  t: (key: string) => string;
}) {
  return (
    <Button icon={<ReloadOutlined />} loading={loading} onClick={onRefresh}>
      {t('action.checkAgain')}
    </Button>
  );
}

function formatConnection(
  connection: DesktopConnectionState,
  t: (key: string) => string
): string {
  return t(`connectionState.${connection}`);
}

function formatDate(
  value: Date | number | string | null,
  t: (key: string) => string
): string {
  if (value === null) {
    return t('never');
  }

  const date = value instanceof Date ? value : new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return t('never');
  }

  return date.toLocaleString();
}
