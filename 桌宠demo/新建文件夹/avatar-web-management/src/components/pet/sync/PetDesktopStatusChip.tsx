'use client';

import { CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { Tag, Tooltip } from 'antd';
import { useTranslations } from 'next-intl';
import { getPreviewChipLabelKey } from '@/components/pet/sync/syncStatusPresentation';
import type { DesktopSyncStatus } from '@/lib/webbridge/sync-status';

interface PetDesktopStatusChipProps {
  status: DesktopSyncStatus | null;
}

export default function PetDesktopStatusChip({ status }: PetDesktopStatusChipProps) {
  const t = useTranslations('pet');

  if (!status) {
    return (
      <Tooltip title={t('preview.desktopStatusTip')}>
        <Tag>{t('syncStatus.previewChip.unknown')}</Tag>
      </Tooltip>
    );
  }

  const label = t(`syncStatus.${getPreviewChipLabelKey(status.summaryKind)}`);

  if (status.isUpToDate) {
    return (
      <Tooltip title={t('preview.desktopStatusTip')}>
        <Tag color="green" icon={<CheckCircleOutlined />}>
          {label}
        </Tag>
      </Tooltip>
    );
  }

  if (status.summaryKind === 'failed') {
    return (
      <Tooltip title={t('preview.desktopStatusTip')}>
        <Tag color="red" icon={<ExclamationCircleOutlined />}>
          {label}
        </Tag>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={t('preview.desktopStatusTip')}>
      <Tag
        color={status.summaryKind === 'desktopOffline' ? 'orange' : 'blue'}
        icon={<ClockCircleOutlined />}
      >
        {label}
      </Tag>
    </Tooltip>
  );
}
