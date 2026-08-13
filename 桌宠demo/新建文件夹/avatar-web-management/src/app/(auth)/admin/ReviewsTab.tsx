'use client';

import { useState } from 'react';
import { App, Card, Table, Tag, Button, Space } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { apiPut } from '@/lib/api-client';
import { useApiGet } from '@/lib/use-api';

interface ReviewItem {
  id: string;
  avatar_name: string;
  creator: string;
  review_status: string;
  version_id: string;
  submitted_at: string;
}

export default function ReviewsTab() {
  const t = useTranslations('admin.reviews');
  const { message } = App.useApp();
  const [page, setPage] = useState(1);
  const { data, isLoading, mutate } = useApiGet<{ items: ReviewItem[]; total: number }>(
    '/api/admin/reviews',
    { page: String(page), pageSize: '20', status: 'pending_review' },
  );
  const reviews = data?.success ? (data.data?.items ?? []) : [];
  const total = data?.success ? (data.data?.total ?? 0) : 0;

  const handleReview = async (versionId: string, action: 'approved' | 'rejected') => {
    const res = await apiPut(`/api/admin/reviews/${versionId}`, { action });
    if (res.success) {
      void mutate();
      message.success(action === 'approved' ? t('approvedAction') : t('rejectedAction'));
    } else { message.error(res.error || t('operationFailed')); }
  };

  return (
    <Card className="!border-purple-500/10">
      <Table
        dataSource={reviews} rowKey="version_id" loading={isLoading}
        columns={[
          { title: t('avatarName'), dataIndex: 'avatar_name', key: 'name' },
          { title: t('creator'), dataIndex: 'creator', key: 'cr' },
          { title: t('status'), dataIndex: 'review_status', key: 'st',
            render: () => <Tag color="orange">{t('pending')}</Tag>,
          },
          { title: t('submittedAt'), dataIndex: 'submitted_at', key: 'su' },
          { title: t('actions'), key: 'actions',
            render: (_: unknown, record: ReviewItem) => (
              <Space>
                <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleReview(record.version_id, 'approved')}>{t('approve')}</Button>
                <Button size="small" danger icon={<CloseOutlined />} onClick={() => handleReview(record.version_id, 'rejected')}>{t('reject')}</Button>
              </Space>
            ),
          },
        ]}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: total => t('paginationTotal', { total }) }}
      />
    </Card>
  );
}
