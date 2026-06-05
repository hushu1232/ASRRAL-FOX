'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, Table, Tag, Button, Space, message } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { apiGet, apiPut } from '@/lib/api-client';

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
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: '20', status: 'pending_review' });
    const res = await apiGet<{ items: ReviewItem[]; total: number }>(`/api/admin/reviews?${params}`);
    if (res.success) { setReviews(res.data.items); setTotal(res.data.total); }
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const handleReview = async (versionId: string, action: 'approved' | 'rejected') => {
    const res = await apiPut(`/api/admin/reviews/${versionId}`, { action });
    if (res.success) {
      setReviews(prev => prev.filter(r => r.version_id !== versionId));
      message.success(action === 'approved' ? t('approvedAction') : t('rejectedAction'));
    } else { message.error(res.error || t('operationFailed')); }
  };

  return (
    <Card className="!border-purple-500/10">
      <Table
        dataSource={reviews} rowKey="version_id" loading={loading}
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
