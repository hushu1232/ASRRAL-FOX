'use client';

import { Card, Tag, Typography } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { Avatar } from '@/types/avatar';
import { AVATAR_STATUS_MAP, AVATAR_STYLES } from '@/lib/constants';
import PlaceholderImage from '@/components/common/PlaceholderImage';
import './style.scss';

interface AvatarCardProps {
  avatar: Avatar;
  onClick?: (id: string) => void;
}

const styleLabel = (style: string) =>
  AVATAR_STYLES.find((s) => s.value === style)?.label || style;

export default function AvatarCard({ avatar, onClick }: AvatarCardProps) {
  const tc = useTranslations('common');
  const statusInfo = AVATAR_STATUS_MAP[avatar.status] || { color: 'default' as const, label: avatar.status };

  return (
    <Card
      hoverable
      onClick={() => onClick?.(avatar.id)}
      className="avatar-card"
      cover={
        <div className="avatar-card__image-wrapper">
          <PlaceholderImage
            src={avatar.thumbnail_url}
            alt={avatar.name}
            type="avatar"
            width={160}
            height={160}
          />
        </div>
      }
    >
      <div className="avatar-card__body">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography.Text className="avatar-card__name">{avatar.name}</Typography.Text>
          <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
        </div>
        <div className="avatar-card__creator">
          <UserOutlined /> {styleLabel(avatar.style)}
        </div>
      </div>
    </Card>
  );
}
