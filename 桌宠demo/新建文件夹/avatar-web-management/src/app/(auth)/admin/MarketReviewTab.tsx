'use client';

import { useState } from 'react';
import { Card, Table, Tag, Button, Space, message, Select } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { apiPatch } from '@/lib/api-client';
import { useApiGet } from '@/lib/use-api';

interface MarketReviewItem {
  id: string;
  title: string;
  category: string;
  price: number;
  currency: string;
  status: string;
  download_count: number;
  seller_name: string;
  seller_email: string;
  created_at: string;
}

export default function MarketReviewTab() {
  const t = useTranslations('admin.market');
  const tc = useTranslations('admin.market.categories');

  const CATEGORY_LABELS: Record<string, string> = {
    model: tc('model'), personality: tc('personality'), voice: tc('voice'), animation: tc('animation'), theme: tc('theme'),
  };

  const STATUS_MAP: Record<string, { color: string; label: string }> = {
    pending: { color: 'orange', label: t('pending') },
    approved: { color: 'green', label: t('approved') },
    rejected: { color: 'red', label: t('rejected') },
  };

  function formatPrice(p: number, c: string) {
    if (p === 0) return t('free');
    return c === 'CNY' ? `¥${p}` : `$${p}`;
  }

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('pending');
  const { data, isLoading, mutate } = useApiGet<{ items: MarketReviewItem[]; total: number }>(
    '/api/admin/market/items',
    { page: String(page), pageSize: '20', status: statusFilter },
  );
  const items = data?.success ? (data.data?.items ?? []) : [];
  const total = data?.success ? (data.data?.total ?? 0) : 0;

  const handleReview = async (id: string, status: 'approved' | 'rejected') => {
    const res = await apiPatch(`/api/admin/market/items/${id}`, { status });
    if (res.success) {
      void mutate();
      message.success(status === 'approved' ? t('approveSuccess') : t('rejectSuccess'));
    } else {
      message.error(res.error || t('operationFailed'));
    }
  };

  return (
    <div>
      <div className="mb-4 flex gap-3">
        <Select
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(1); }}
          style={{ width: 140 }}
          options={[
            { value: 'pending', label: t('pending') },
            { value: 'approved', label: t('approved') },
            { value: 'rejected', label: t('rejected') },
          ]}
        />
      </div>
      <Card className="!border-purple-500/10">
        <Table
          dataSource={items} rowKey="id" loading={isLoading}
          columns={[
            { title: t('item'), dataIndex: 'title', key: 'title', render: (val: string) => <span className="text-white">{val}</span> },
            { title: t('category'), dataIndex: 'category', key: 'cat', render: (c: string) => CATEGORY_LABELS[c] || c },
            { title: t('price'), dataIndex: 'price', key: 'price', render: (p: number, r: MarketReviewItem) => formatPrice(p, r.currency) },
            { title: t('seller'), dataIndex: 'seller_name', key: 'seller' },
            {
              title: t('status'), dataIndex: 'status', key: 'status',
              render: (s: string) => {
                const info = STATUS_MAP[s] || { color: 'default', label: s };
                return <Tag color={info.color}>{info.label}</Tag>;
              },
            },
            { title: t('submittedAt'), dataIndex: 'created_at', key: 'time' },
            ...(statusFilter === 'pending' ? [{
              title: t('actions'), key: 'actions',
              render: (_: unknown, record: MarketReviewItem) => (
                <Space>
                  <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleReview(record.id, 'approved')}>{t('approve')}</Button>
                  <Button size="small" danger icon={<CloseOutlined />} onClick={() => handleReview(record.id, 'rejected')}>{t('reject')}</Button>
                </Space>
              ),
            }] : []),
          ]}
          pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: total => t('paginationTotal', { total }) }}
        />
      </Card>
    </div>
  );
}
