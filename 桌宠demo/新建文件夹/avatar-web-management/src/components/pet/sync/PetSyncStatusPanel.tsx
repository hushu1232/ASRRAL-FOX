'use client';

import { Alert, Button, Descriptions, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import { DesktopOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import OperationPanel from '@/components/ui/OperationPanel';
import StatusChip from '@/components/ui/StatusChip';
import type { StatusChipTone } from '@/components/ui/StatusChip';
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

const SUMMARY_TONES: Record<DesktopSummaryKind, StatusChipTone> = {
  unknown: 'neutral',
  desktopOffline: 'warning',
  pendingPull: 'processing',
  localConfirmationRequired: 'warning',
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
      <OperationPanel title={null}>
        <Space>
          <Spin />
          <Text>{t('loading')}</Text>
        </Space>
      </OperationPanel>
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
    <OperationPanel
      title={t('title')}
      extra={renderAction(status.primaryAction, loading, onRefresh, t)}
    >
      <Space vertical size="middle" style={{ width: '100%' }}>
        <Space size="small" wrap>
          <StatusChip tone={SUMMARY_TONES[status.summaryKind]}>
            {t(`summary.${status.summaryKind}`)}
          </StatusChip>
          <StatusChip tone="success">{t('source.live')}</StatusChip>
        </Space>

        <Descriptions column={1} size="small">
          <Descriptions.Item label={t('connection')}>
            {formatConnection(status.desktopConnection, t)}
          </Descriptions.Item>
          <Descriptions.Item label={t('webVersion')}>{status.webConfigVersion}</Descriptions.Item>
          <Descriptions.Item label={t('packageState')}>
            <Text code>{status.packageState}</Text>
          </Descriptions.Item>
          <Descriptions.Item label={t('desktopKnownVersion')}>
            {status.desktopKnownVersion ?? t('notApplied')}
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
          <Descriptions.Item label={t('milestones')}>
            <Space size={[6, 6]} wrap>
              {status.milestones.length > 0 ? (
                status.milestones.map((milestone) => <Tag key={milestone}>{milestone}</Tag>)
              ) : (
                <Text type="secondary">{t('none')}</Text>
              )}
            </Space>
          </Descriptions.Item>
        </Descriptions>

        {status.lastError && (
          <Alert
            type="error"
            showIcon
            title={status.errorMessage?.title ?? status.lastError.message ?? status.lastError.code}
            description={
              <Space vertical size={4}>
                {status.errorMessage?.recovery && <Text>{status.errorMessage.recovery}</Text>}
                <Text code>{status.lastError.code}</Text>
                {status.lastError.technicalDetail && (
                  <Text type="secondary">{status.lastError.technicalDetail}</Text>
                )}
              </Space>
            }
          />
        )}
      </Space>
    </OperationPanel>
  );
}

function renderAction(
  primaryAction: DesktopPrimaryAction,
  loading: boolean,
  onRefresh: () => void,
  t: (key: string) => string,
) {
  if (primaryAction === 'none') {
    return null;
  }

  if (primaryAction === 'confirmInDesktop') {
    return (
      <Tooltip title={t('actionHint.confirmInDesktop')}>
        <Button type="primary" icon={<DesktopOutlined />} disabled>
          {t('action.confirmInDesktop')}
        </Button>
      </Tooltip>
    );
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

function formatConnection(connection: DesktopConnectionState, t: (key: string) => string): string {
  return t(`connectionState.${connection}`);
}

function formatDate(value: Date | number | string | null, t: (key: string) => string): string {
  if (value === null) {
    return t('never');
  }

  const date = value instanceof Date ? value : new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return t('never');
  }

  return date.toLocaleString();
}
