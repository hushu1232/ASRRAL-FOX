'use client';

import { CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { Tag, Tooltip } from 'antd';
import { useTranslations } from 'next-intl';
import type { DesktopSyncStatus } from '@/lib/webbridge/sync-status';

interface PetDesktopStatusChipProps {
  status: DesktopSyncStatus | null;
}

export default function PetDesktopStatusChip({ status }: PetDesktopStatusChipProps) {
  const t = useTranslations('pet');

  if (!status) {
    return (
      <Tooltip title={t('preview.desktopStatusTip')}>
        <Tag>{t('syncStatus.summary.unknown')}</Tag>
      </Tooltip>
    );
  }

  if (status.isUpToDate) {
    return (
      <Tooltip title={t('preview.desktopStatusTip')}>
        <Tag color="green" icon={<CheckCircleOutlined />}>
          {t('syncStatus.summary.upToDate')}
        </Tag>
      </Tooltip>
    );
  }

  if (status.summaryKind === 'failed') {
    return (
      <Tooltip title={t('preview.desktopStatusTip')}>
        <Tag color="red" icon={<ExclamationCircleOutlined />}>
          {t('syncStatus.summary.failed')}
        </Tag>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={t('preview.desktopStatusTip')}>
      <Tag color="blue" icon={<ClockCircleOutlined />}>
        {t(`syncStatus.summary.${status.summaryKind}`)}
      </Tag>
    </Tooltip>
  );
}
