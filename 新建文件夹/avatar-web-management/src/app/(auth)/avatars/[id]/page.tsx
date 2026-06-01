'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, Descriptions, Tag, Table, Button, Space, Tabs, Spin, message } from 'antd';
import { EditOutlined, ArrowLeftOutlined, RobotOutlined, ShopOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { AVATAR_STYLES, AVATAR_STATUS_MAP } from '@/lib/constants';
import { apiPost } from '@/lib/api-client';
import { useApiGet } from '@/lib/use-api';

interface AvatarDetail {
  id: string;
  name: string;
  style: string;
  status: string;
  base_model: string;
  created_at: string;
  updated_at: string;
  creator_id: string;
  versions?: VersionItem[];
}

interface VersionItem {
  id: string;
  version_number: number;
  status: string;
  created_at: string;
  review_comment: string | null;
}

export default function AvatarDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('avatars');
  const td = useTranslations('avatars.detail');
  const tc = useTranslations('common');
  const id = params?.id as string;
  const { data, isLoading, mutate } = useApiGet<AvatarDetail>(id ? `/api/avatars/${id}` : null);
  const avatar = data?.success ? data.data : null;

  if (isLoading) {
    return <div className="flex justify-center py-20"><Spin size="large" /></div>;
  }

  if (!avatar) {
    return (
      <div className="text-center py-20">
        <p className="text-lg text-gray-400 mb-4">{t('notFound')}</p>
        <Button onClick={() => router.push('/avatars')}>{t('backToList')}</Button>
      </div>
    );
  }

  const versions = avatar.versions || [];

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => router.push('/avatars')} />
        <h1 className="text-2xl font-bold text-white">{avatar.name}</h1>
        <Tag color={AVATAR_STATUS_MAP[avatar.status]?.color}>
          {AVATAR_STATUS_MAP[avatar.status]?.label || avatar.status}
        </Tag>
        <Button type="primary" icon={<EditOutlined />} onClick={() => router.push(`/avatars/${params.id}/edit`)}>
          {td('edit')}
        </Button>
        <Button
          icon={<RobotOutlined />}
          onClick={async () => {
            try {
              const res = await apiPost(`/api/pet/set-avatar`, { avatarId: id });
              if (res.success) {
                message.success(t('setAsPetSuccess'));
              } else {
                message.error(res.error || t('setAsPetFailed'));
              }
            } catch {
              message.error(tc('networkError'));
            }
          }}
        >
          {t('setAsPet')}
        </Button>
        <Button
          icon={<ShopOutlined />}
          onClick={() => router.push(`/marketplace/new?from=avatar&avatarId=${id}&title=${encodeURIComponent(avatar.name)}`)}
          className="border-purple-500/30 text-purple-400 hover:text-purple-300"
        >
          {t('sellOnMarket')}
        </Button>
      </div>

      <Tabs
        defaultActiveKey="info"
        items={[
          {
            key: 'info',
            label: td('basicInfo'),
            children: (
              <Card className="!border-purple-500/10">
                <Descriptions column={2} bordered size="small">
                  <Descriptions.Item label={tc('name')}>{avatar.name}</Descriptions.Item>
                  <Descriptions.Item label={t('create.style')}>
                    {AVATAR_STYLES.find(s => s.value === avatar.style)?.label || avatar.style}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('create.baseModel')}>{avatar.base_model}</Descriptions.Item>
                  <Descriptions.Item label={td('status')}>
                    <Tag color={AVATAR_STATUS_MAP[avatar.status]?.color}>
                      {AVATAR_STATUS_MAP[avatar.status]?.label || avatar.status}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label={td('createdAt')}>{avatar.created_at}</Descriptions.Item>
                  <Descriptions.Item label={tc('date')}>{avatar.updated_at}</Descriptions.Item>
                </Descriptions>
              </Card>
            ),
          },
          {
            key: 'versions',
            label: td('versions', { count: versions.length }),
            children: (
              <Card className="!border-purple-500/10">
                {versions.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">
                    <p>{td('noVersions')}</p>
                  </div>
                ) : (
                  <Table
                    dataSource={versions}
                    rowKey="id"
                    pagination={false}
                    columns={[
                      { title: td('versionNumber'), dataIndex: 'version_number', key: 'vn', render: (v: number) => `V${v}` },
                      {
                        title: td('status'), dataIndex: 'status', key: 'status',
                        render: (s: string) => <Tag color={AVATAR_STATUS_MAP[s]?.color}>{AVATAR_STATUS_MAP[s]?.label || s}</Tag>,
                      },
                      { title: td('comment'), dataIndex: 'review_comment', key: 'comment', render: (c: string | null) => c || '-' },
                      { title: td('createdAt'), dataIndex: 'created_at', key: 'time' },
                      {
                        title: td('actions'), key: 'actions',
                        render: (_: unknown, record: VersionItem) => (
                          <Space>
                            <Button
                              size="small"
                              type="link"
                              onClick={() => router.push(`/avatars/${params.id}/edit?version=${record.id}`)}
                            >
                              {td('preview')}
                            </Button>
                            <Button
                              size="small"
                              type="link"
                              onClick={async () => {
                                try {
                                  const res = await apiPost(`/api/avatars/${params.id}/versions/${record.id}/restore`);
                                  if (res.success) {
                                    message.success(td('rollbackSuccess', { version: record.version_number }));
                                    mutate();
                                  } else {
                                    message.error(res.error || td('rollbackFailed'));
                                  }
                                } catch {
                                  message.error(td('rollbackRequestFailed'));
                                }
                              }}
                            >
                              {td('rollback')}
                            </Button>
                          </Space>
                        ),
                      },
                    ]}
                  />
                )}
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
