'use client';

import { Card, Tag, Typography } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { Avatar, AvatarStatus } from '@/types/avatar';
import { AVATAR_STATUS_MAP, AVATAR_STYLES } from '@/lib/constants';
import PlaceholderImage from '@/components/common/PlaceholderImage';

interface AvatarCardProps {
  avatar: Avatar;
  onClick?: (id: string) => void;
}

const styleLabel = (style: string) =>
  AVATAR_STYLES.find((s) => s.value === style)?.label || style;

export default function AvatarCard({ avatar, onClick }: AvatarCardProps) {
  const tc = useTranslations('common');
  const statusInfo = AVATAR_STATUS_MAP[avatar.status] || {
    color: 'default',
    label: avatar.status,
  };

  return (
    <Card
      hoverable
      onClick={() => onClick?.(avatar.id)}
      className="bg-[#0d0d20] border-purple-500/10 hover:border-purple-500/30 transition-colors"
      cover={
        <div className="h-40 bg-[#1a1a2e] flex items-center justify-center">
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
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Typography.Text strong className="text-gray-200 text-sm truncate max-w-[120px]">
            {avatar.name}
          </Typography.Text>
          <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <UserOutlined />
          <span>{styleLabel(avatar.style)}</span>
          <span className="ml-auto">{avatar.base_model === 'male' ? tc('gender.male') : tc('gender.female')}</span>
        </div>
      </div>
    </Card>
  );
}
