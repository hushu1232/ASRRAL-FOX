'use client';

import { ApiOutlined } from '@ant-design/icons';
import { Alert, Descriptions, Space, Tag, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import EvidenceGrid from '@/components/ui/EvidenceGrid';
import MetricTile from '@/components/ui/MetricTile';
import OperationPanel from '@/components/ui/OperationPanel';
import StatusChip, { type StatusChipTone } from '@/components/ui/StatusChip';
import {
  getPackageStateLabelKey,
  PACKAGE_STATE_TONES,
} from '@/components/pet/sync/syncStatusPresentation';
import type {
  DesktopConnectionState,
  DesktopSyncError,
  DesktopSyncStatus,
} from '@/lib/webbridge/sync-status';

const { Text } = Typography;

const CONNECTION_TONES: Record<DesktopConnectionState, StatusChipTone> = {
  unknown: 'neutral',
  checking: 'processing',
  online: 'success',
  offline: 'warning',
};

export interface PetSyncDiagnosticsPanelProps {
  status: DesktopSyncStatus | null;
  loading: boolean;
}

export default function PetSyncDiagnosticsPanel({
  status,
  loading,
}: PetSyncDiagnosticsPanelProps) {
  const t = useTranslations('pet.syncDiagnostics');
  const tStatus = useTranslations('pet.syncStatus');

  return (
    <OperationPanel data-testid="pet-sync-diagnostics-panel" title={renderTitle(t)}>
      {!status && loading && <Text type="secondary">{t('loading')}</Text>}

      {!status && !loading && <Alert type="warning" showIcon title={t('unavailable')} />}

      {status && (
        <Space vertical size="large" style={{ width: '100%' }}>
          {renderIntegrationSnapshot(status, t, tStatus)}
          {renderBlockingReason(status, t)}
          {renderEvidenceTrail(status, t)}
          {renderSmokeMapping(t)}
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
      <StatusChip tone="success">{t('liveData')}</StatusChip>
    </Space>
  );
}

function renderIntegrationSnapshot(
  status: DesktopSyncStatus,
  t: (key: string) => string,
  tStatus: (key: string) => string,
) {
  return (
    <section>
      <SectionTitle>{t('integrationSnapshot')}</SectionTitle>
      <EvidenceGrid data-testid="pet-sync-diagnostics-evidence-grid" style={{ marginTop: 12 }}>
        <MetricTile label={t('webVersion')} value={status.webConfigVersion} />
        <MetricTile
          label={t('desktopKnownVersion')}
          value={formatVersion(status.desktopKnownVersion, t)}
        />
        <MetricTile
          label={t('desktopAppliedVersion')}
          value={formatVersion(status.desktopAppliedVersion, t)}
        />
        <MetricTile
          label={t('packageState')}
          value={
            <StatusChip tone={PACKAGE_STATE_TONES[status.packageState]}>
              {tStatus(getPackageStateLabelKey(status.packageState))}
            </StatusChip>
          }
        />
        <MetricTile
          label={t('desktopConnection')}
          value={
            <StatusChip tone={CONNECTION_TONES[status.desktopConnection]}>
              {tStatus(`connectionState.${status.desktopConnection}`)}
            </StatusChip>
          }
        />
        <MetricTile
          label={t('localConfirmation')}
          value={
            <StatusChip tone={status.requiresLocalConfirmation ? 'warning' : 'success'}>
              {status.requiresLocalConfirmation ? t('required') : t('notRequired')}
            </StatusChip>
          }
        />
      </EvidenceGrid>
    </section>
  );
}

function renderBlockingReason(status: DesktopSyncStatus, t: (key: string) => string) {
  return (
    <section>
      <Alert
        type={getBlockingAlertType(status)}
        showIcon
        title={t('blockingReason')}
        description={
          <Space vertical size={4}>
            <Text>{getVersionAlignment(status, t)}</Text>
            <Text>{t(`blocking.${status.summaryKind}`)}</Text>
          </Space>
        }
      />
    </section>
  );
}

function renderEvidenceTrail(status: DesktopSyncStatus, t: (key: string) => string) {
  return (
    <section>
      <SectionTitle>{t('evidenceTrail')}</SectionTitle>
      <Descriptions column={1} size="small" style={{ marginTop: 8 }}>
        <Descriptions.Item label={t('lastSyncAt')}>
          {formatDate(status.lastSyncAt, t)}
        </Descriptions.Item>
        <Descriptions.Item label={t('lastAppliedAt')}>
          {formatDate(status.lastAppliedAt, t)}
        </Descriptions.Item>
        <Descriptions.Item label={t('milestones')}>
          {status.milestones.length > 0 ? (
            <Space size={[6, 6]} wrap>
              {status.milestones.map((milestone) => (
                <Tag key={milestone} color="processing">
                  {milestone}
                </Tag>
              ))}
            </Space>
          ) : (
            <Text type="secondary">{t('noMilestones')}</Text>
          )}
        </Descriptions.Item>
        <Descriptions.Item label={t('errorDetails')}>
          {renderErrorDetails(status.lastError, status.errorMessage, t)}
        </Descriptions.Item>
      </Descriptions>
    </section>
  );
}

function renderSmokeMapping(t: (key: string) => string) {
  return (
    <section>
      <Space align="center" size="small" wrap>
        <SectionTitle>{t('smokeMapping')}</SectionTitle>
        <Tag color="default">{t('smoke.readOnly')}</Tag>
      </Space>
      <Descriptions column={1} size="small" style={{ marginTop: 8 }}>
        <Descriptions.Item label={t('smoke.expectedStagedLabel')}>
          <Text code>{t('smoke.expectedStaged')}</Text>
        </Descriptions.Item>
        <Descriptions.Item label={t('smoke.expectedAppliedLabel')}>
          <Text code>{t('smoke.expectedApplied')}</Text>
        </Descriptions.Item>
        <Descriptions.Item label={t('smoke.commandLabel')}>
          <Text code>{t('smoke.command')}</Text>
        </Descriptions.Item>
      </Descriptions>
    </section>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Typography.Title
      level={3}
      style={{
        color: 'var(--text-primary)',
        fontSize: 'var(--ds-type-cardTitle-size)',
        lineHeight: 1.35,
        margin: 0,
      }}
    >
      {children}
    </Typography.Title>
  );
}

function formatVersion(value: number | null, t: (key: string) => string): number | string {
  return value ?? t('notReported');
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

function getVersionAlignment(status: DesktopSyncStatus, t: (key: string) => string): string {
  const knownVersion = status.desktopKnownVersion;
  const appliedVersion = status.desktopAppliedVersion;

  if (knownVersion === null || appliedVersion === null) {
    return t('versionAlignment.missingEvidence');
  }

  if (status.webConfigVersion > knownVersion && status.webConfigVersion > appliedVersion) {
    return t('versionAlignment.notPulled');
  }

  if (knownVersion === status.webConfigVersion && appliedVersion < status.webConfigVersion) {
    return t('versionAlignment.knownButNotApplied');
  }

  if (appliedVersion === status.webConfigVersion && status.summaryKind === 'upToDate') {
    return t('versionAlignment.current');
  }

  return t('versionAlignment.missingEvidence');
}

function getBlockingAlertType(status: DesktopSyncStatus): 'success' | 'info' | 'warning' | 'error' {
  if (status.summaryKind === 'failed') {
    return 'error';
  }

  if (status.summaryKind === 'upToDate') {
    return 'success';
  }

  return 'warning';
}

function renderErrorDetails(
  error: DesktopSyncError | null,
  errorMessage: DesktopSyncStatus['errorMessage'],
  t: (key: string) => string,
) {
  if (!error) {
    return <Text type="secondary">{t('noLiveError')}</Text>;
  }

  const title = errorMessage?.title ?? error.message;

  return (
    <Space vertical size={4}>
      {title && <Text>{`${t('errorTitle')}: ${title}`}</Text>}
      {error.message && error.message !== title && <Text type="secondary">{error.message}</Text>}
      {errorMessage?.recovery && (
        <Text type="secondary">{`${t('recovery')}: ${errorMessage.recovery}`}</Text>
      )}
      <Text code>{error.code}</Text>
      {error.technicalDetail && (
        <Text type="secondary">{`${t('technicalDetail')}: ${error.technicalDetail}`}</Text>
      )}
      {error.occurredAt && <Text type="secondary">{formatDate(error.occurredAt, t)}</Text>}
    </Space>
  );
}
