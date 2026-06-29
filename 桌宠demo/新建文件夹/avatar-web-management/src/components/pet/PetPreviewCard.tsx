'use client';

import { Descriptions, Tag } from 'antd';
import { LinkOutlined, PictureOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import OperationPanel from '@/components/ui/OperationPanel';

export interface PetPreviewCardConfig {
  id: string;
  pet_name: string;
  animation_model: string;
  avatar_id?: string;
  idle_timeout: number;
  wander_interval: number;
}

export interface PetPreviewCardProps {
  config: PetPreviewCardConfig | null;
}

export default function PetPreviewCard({ config }: PetPreviewCardProps) {
  const t = useTranslations('pet');

  return (
    <OperationPanel
      className="flex-shrink-0"
      title={t('preview.webPreview')}
      style={{
        width: 360,
        maxWidth: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: '100%', textAlign: 'center', padding: 28 }}>
        <PictureOutlined style={{ fontSize: 64, color: 'var(--text-muted)', marginBottom: 16 }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          {t('preview.label', { name: config?.pet_name || t('preview.defaultName') })}
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{t('preview.tip')}</p>
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
            styles={{
              label: { color: 'var(--text-secondary)' },
              content: { color: 'var(--text-primary)' },
            }}
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
      </div>
    </OperationPanel>
  );
}
