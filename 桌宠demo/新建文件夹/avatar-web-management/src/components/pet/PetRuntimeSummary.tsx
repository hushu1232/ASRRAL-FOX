'use client';

import { ReloadOutlined } from '@ant-design/icons';
import { Button, Space, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import MetricTile from '@/components/ui/MetricTile';
import OperationPanel from '@/components/ui/OperationPanel';
import StatusChip from '@/components/ui/StatusChip';
import {
  getRuntimeDetailKey,
  SUMMARY_TONES,
} from '@/components/pet/sync/syncStatusPresentation';
import type { DesktopPrimaryAction, DesktopSyncStatus } from '@/lib/webbridge/sync-status';

const { Text } = Typography;

export interface PetRuntimeSummaryProps {
  status: DesktopSyncStatus | null;
  loading: boolean;
  onRefresh: () => void;
}

export default function PetRuntimeSummary({ status, loading, onRefresh }: PetRuntimeSummaryProps) {
  const tPet = useTranslations('pet');
  const tSync = useTranslations('pet.syncStatus');

  if (!status) {
    return (
      <OperationPanel
        title={tPet('runtimeSummary.title')}
        extra={
          <RefreshAction
            loading={loading}
            onRefresh={onRefresh}
            label={tSync('action.checkAgain')}
          />
        }
      >
        <Text type="secondary">{tPet('runtimeSummary.unavailable')}</Text>
      </OperationPanel>
    );
  }

  return (
    <OperationPanel
      title={tPet('runtimeSummary.title')}
      extra={renderPrimaryAction(status.primaryAction, loading, onRefresh, tSync)}
    >
      <Space vertical size="middle" style={{ width: '100%' }}>
        <div>
          <Text type="secondary">{tPet('runtimeSummary.currentState')}</Text>
          <div style={{ marginTop: 6 }}>
            <StatusChip tone={SUMMARY_TONES[status.summaryKind]}>
              {tSync(`summary.${status.summaryKind}`)}
            </StatusChip>
          </div>
          <div style={{ marginTop: 8, color: 'var(--text-primary)', lineHeight: 1.55 }}>
            {tSync(getRuntimeDetailKey(status.summaryKind))}
          </div>
        </div>
        <div>
          <Text type="secondary">{tPet('runtimeSummary.nextAction.label')}</Text>
          <div style={{ marginTop: 4, color: 'var(--text-primary)', fontWeight: 650 }}>
            {tPet(`runtimeSummary.nextAction.${status.primaryAction}`)}
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(var(--ds-panel-gridMinWidth), 1fr))',
          }}
        >
          <MetricTile label={tSync('webVersion')} value={status.webConfigVersion} />
          <MetricTile
            label={tSync('desktopKnownVersion')}
            value={status.desktopKnownVersion ?? tSync('never')}
          />
          <MetricTile
            label={tSync('desktopAppliedVersion')}
            value={status.desktopAppliedVersion ?? tSync('notApplied')}
          />
          <MetricTile
            label={tSync('localConfirmation')}
            value={status.requiresLocalConfirmation ? tSync('required') : tSync('notRequired')}
          />
        </div>
      </Space>
    </OperationPanel>
  );
}

function renderPrimaryAction(
  action: DesktopPrimaryAction,
  loading: boolean,
  onRefresh: () => void,
  t: (key: string) => string,
) {
  if (action === 'checkAgain') {
    return <RefreshAction loading={loading} onRefresh={onRefresh} label={t('action.checkAgain')} />;
  }

  return null;
}

function RefreshAction({
  loading,
  onRefresh,
  label,
}: {
  loading: boolean;
  onRefresh: () => void;
  label: string;
}) {
  return (
    <Button icon={<ReloadOutlined />} loading={loading} onClick={onRefresh}>
      {label}
    </Button>
  );
}
