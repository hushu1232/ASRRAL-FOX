// TODO: BEM-migrate
'use client';

import { Card, Table, Tag, Space, Button } from 'antd';
import { EditOutlined, EyeOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

const statusColors: Record<string, string> = {
  draft: 'default',
  published: 'green',
  pending_review: 'orange',
  archived: 'red',
};

interface AvatarItem {
  id: string;
  name: string;
  style: string;
  status: string;
  updated_at: string;
}

interface Props {
  data: AvatarItem[];
}

export default function RecentAvatars({ data }: Props) {
  const t = useTranslations('dashboard.recentAvatars');
  const tStatus = useTranslations('avatars.status');
  const tStyle = useTranslations('avatars.style');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const columns = [
    { title: tCommon('name'), dataIndex: 'name', key: 'name', render: (name: string) => <span className="text-white font-medium">{name}</span> },
    { title: tCommon('type'), dataIndex: 'style', key: 'style', render: (s: string) => tStyle(s as keyof typeof tStyle) },
    {
      title: tCommon('status'), dataIndex: 'status', key: 'status',
      render: (status: string) => <Tag color={statusColors[status]}>{tStatus(status as keyof typeof tStatus)}</Tag>,
    },
    { title: tCommon('date'), dataIndex: 'updated_at', key: 'updated_at', render: (d: string) => <span className="text-gray-400 text-xs">{d}</span> },
    {
      title: tCommon('actions'), key: 'actions',
      render: (_: unknown, record: { id: string }) => (
        <Space>
          <Button size="small" type="text" icon={<EyeOutlined />} onClick={() => router.push(`/avatars/${record.id}`)} />
          <Button size="small" type="text" icon={<EditOutlined />} onClick={() => router.push(`/avatars/${record.id}/edit`)} />
        </Space>
      ),
    },
  ];

  return (
    <Card title={t('title')} className="!border-purple-500/10">
      {data.length === 0 ? (
        <div className="py-12 text-center text-gray-500 text-sm">{t('noAvatars')}</div>
      ) : (
        <Table dataSource={data} columns={columns} rowKey="id" pagination={false} size="middle" />
      )}
    </Card>
  );
}