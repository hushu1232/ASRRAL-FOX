'use client';

import { ApiOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Descriptions, Space, Spin, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import MetricTile from '@/components/ui/MetricTile';
import OperationPanel from '@/components/ui/OperationPanel';
import StatusChip, { type StatusChipTone } from '@/components/ui/StatusChip';
import type { AlifeLocalHealthState, AlifeLocalHealthView } from '@/lib/alife/local-health';

const { Text } = Typography;

const STATE_TONES: Record<AlifeLocalHealthState, StatusChipTone> = {
  notConfigured: 'neutral',
  reachable: 'success',
  unreachable: 'warning',
  authRequired: 'warning',
  invalidResponse: 'error',
  error: 'error',
};

export interface AlifeLocalHealthPanelProps {
  health: AlifeLocalHealthView | null;
  loading: boolean;
  onRefresh: () => void;
}

export default function AlifeLocalHealthPanel({
  health,
  loading,
  onRefresh,
}: AlifeLocalHealthPanelProps) {
  const t = useTranslations('pet.alifeLocalHealth');

  return (
    <OperationPanel
      data-testid="alife-local-health-panel"
      title={renderTitle(t)}
      extra={<RefreshButton loading={loading} onRefresh={onRefresh} t={t} />}
    >
      {!health && loading && (
        <Space>
          <Spin />
          <Text>{t('loading')}</Text>
        </Space>
      )}

      {!health && !loading && <Text type="secondary">{t('notReported')}</Text>}

      {health && (
        <Space vertical size="middle" style={{ width: '100%' }}>
          <Space size="small" wrap>
            <StatusChip tone={STATE_TONES[health.state]}>{t(`state.${health.state}`)}</StatusChip>
            <StatusChip tone="neutral">{t('source')}</StatusChip>
          </Space>

          <Text style={{ color: 'var(--text-primary)', lineHeight: 1.55 }}>
            {t(`description.${health.state}`)}
          </Text>

          <Alert type="info" showIcon title={t('advisory')} />

          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(var(--ds-panel-gridMinWidth), 1fr))',
            }}
          >
            <MetricTile label={t('agent')} value={formatText(health.runtime?.agent, t)} />
            <MetricTile label={t('version')} value={formatText(health.health?.version, t)} />
            <MetricTile label={t('qchat')} value={formatEnabled(health.runtime?.qchatEnabled, t)} />
            <MetricTile
              label={t('outbox')}
              value={formatEnabled(health.runtime?.outboxEnabled, t)}
            />
          </div>

          <Descriptions column={1} size="small">
            <Descriptions.Item label={t('vision')}>
              {renderRuntimeCapability(
                health.runtime?.visionEnabled,
                health.runtime?.visionStatus,
                health.runtime?.visionReason,
                t,
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('tts')}>
              {renderRuntimeCapability(
                health.runtime?.ttsEnabled,
                health.runtime?.ttsStatus,
                health.runtime?.ttsReason,
                t,
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('lastChecked')}>
              {formatDate(health.checkedAt, t)}
            </Descriptions.Item>
            {health.reason && (
              <Descriptions.Item label={t('reason')}>{health.reason}</Descriptions.Item>
            )}
          </Descriptions>
        </Space>
      )}
    </OperationPanel>
  );
}

function renderTitle(t: (key: string) => string) {
  return (
    <Space size="small" wrap>
      <ApiOutlined />
      <span>{t('title')}</span>
    </Space>
  );
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
      {t('refresh')}
    </Button>
  );
}

function renderRuntimeCapability(
  enabled: boolean | undefined,
  status: string | undefined,
  reason: string | undefined,
  t: (key: string) => string,
) {
  if (enabled === undefined && !status && !reason) {
    return <Text type="secondary">{t('notReported')}</Text>;
  }

  return (
    <Space vertical size={4}>
      <Space size="small" wrap>
        {enabled !== undefined && (
          <StatusChip tone={enabled ? 'success' : 'neutral'}>
            {enabled ? t('enabled') : t('disabled')}
          </StatusChip>
        )}
        {status && (
          <StatusChip tone={isReadyStatus(status) ? 'success' : 'warning'}>
            {formatRuntimeStatus(status, t)}
          </StatusChip>
        )}
      </Space>
      {reason && <Text type="secondary">{reason}</Text>}
    </Space>
  );
}

function formatText(value: string | null | undefined, t: (key: string) => string): string {
  return value && value.trim().length > 0 ? value : t('notReported');
}

function formatEnabled(value: boolean | undefined, t: (key: string) => string): string {
  if (value === undefined) {
    return t('notReported');
  }

  return value ? t('enabled') : t('disabled');
}

function formatRuntimeStatus(status: string, t: (key: string) => string): string {
  if (isReadyStatus(status)) {
    return t('ready');
  }

  if (isNotReadyStatus(status)) {
    return t('notReady');
  }

  return status;
}

function isReadyStatus(status: string): boolean {
  const normalized = normalizeStatus(status);
  return ['ready', 'healthy', 'ok', 'online', 'running', 'enabled'].includes(normalized);
}

function isNotReadyStatus(status: string): boolean {
  const normalized = normalizeStatus(status);
  return [
    'disabled',
    'error',
    'failed',
    'notready',
    'not_ready',
    'offline',
    'unavailable',
  ].includes(normalized);
}

function normalizeStatus(status: string): string {
  return status.trim().toLowerCase();
}

function formatDate(value: string, t: (key: string) => string): string {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return t('notReported');
  }

  return date.toLocaleString();
}
