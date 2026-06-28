'use client';

import { useState } from 'react';
import { Card, Tag, Spin, Pagination, Empty, Button, App } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import PageHeader from '@/components/layout/PageHeader';
import { useApiPaginated } from '@/lib/use-api';
import { apiPut } from '@/lib/api-client';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  resource_type: string | null;
  resource_id: string | null;
  is_read: number;
  created_at: string;
}

const typeColors: Record<string, string> = {
  system: '#6d5df0',
  review: '#faad14',
  comment: '#1890ff',
  share: '#52c41a',
  storage: '#ff4d4f',
  market_purchase: '#52c41a',
  pet_applied: '#eb2f96',
  market_sale: '#faad14',
  asset_takedown: '#ff4d4f',
};

const resourceRoutes: Record<string, (id: string) => string> = {
  market_item: (id) => `/marketplace/${id}`,
  asset: (id) => `/assets?id=${id}`,
  avatar: (id) => `/avatars/${id}`,
  order: (id) => `/purchases`,
  pet: (id) => `/dashboard/pet`,
};

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const router = useRouter();
  const t = useTranslations('notifications');
  const { message } = App.useApp();
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<NotificationItem[]>([]);

  const typeLabels: Record<string, string> = {
    system: t('types.system'),
    review: t('types.review'),
    comment: t('types.comment'),
    share: t('types.share'),
    storage: t('types.storage'),
    market_purchase: t('types.marketPurchase'),
    pet_applied: t('types.petApplied'),
    market_sale: t('types.marketSale'),
    asset_takedown: t('types.assetTakedown'),
  };

  const { data, isLoading, mutate } = useApiPaginated<NotificationItem>('/api/notifications', {
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });

  const currentItems = data?.success ? data.data?.items || [] : [];
  const total = data?.success ? (data.data?.total ?? 0) : 0;

  // Sync items to local state for optimistic read marking
  if (currentItems !== items && currentItems.length > 0) {
    setItems(currentItems);
  }

  const handleReadOne = async (id: string) => {
    const res = await apiPut(`/api/notifications/${id}/read`);
    if (res.success) {
      setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      mutate();
    }
  };

  const handleReadAll = async () => {
    const res = await apiPut('/api/notifications/read-all');
    if (res.success) {
      setItems(prev => prev.map(n => ({ ...n, is_read: 1 })));
      mutate();
      message.success(t('allRead'));
    }
  };

  const handleClick = (item: NotificationItem) => {
    if (!item.is_read) handleReadOne(item.id);
    if (item.resource_type && item.resource_id && resourceRoutes[item.resource_type]) {
      router.push(resourceRoutes[item.resource_type](item.resource_id));
    }
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60_000) return t('justNow');
    if (diff < 3_600_000) return t('minutesAgo', { n: Math.floor(diff / 60_000) });
    if (diff < 86_400_000) return t('hoursAgo', { n: Math.floor(diff / 3_600_000) });
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      <PageHeader
        title={t('notificationCenter')}
        actions={
          <Button
            icon={<CheckOutlined />}
            onClick={handleReadAll}
            className="!border-purple-500/20 !text-purple-400 hover:!border-purple-500/40 hover:!text-purple-300"
          >
            {t('markAllRead')}
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-20"><Spin size="large" /></div>
      ) : items.length === 0 ? (
        <Card className="!border-purple-500/10">
          <Empty
            image={<BellOutlined className="text-6xl text-gray-600" />}
            description={<span className="text-gray-500">{t('noNotifications')}</span>}
          />
        </Card>
      ) : (
        <Card className="!border-purple-500/10 !p-0 overflow-hidden">
          {items.map((item, i) => (
            <div
              key={item.id}
              className={`px-5 py-4 flex items-start gap-4 cursor-pointer transition-colors hover:bg-purple-500/5 ${
                !item.is_read ? 'bg-purple-500/[0.03]' : ''
              } ${i < items.length - 1 ? 'border-b border-purple-500/5' : ''}`}
              onClick={() => handleClick(item)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleClick(item); } }}
              role="button"
              tabIndex={0}
            >
              <span
                className="w-2.5 h-2.5 mt-2 rounded-full shrink-0"
                style={{ backgroundColor: item.is_read ? 'transparent' : typeColors[item.type] || '#6d5df0' }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{ color: typeColors[item.type], background: typeColors[item.type] + '1a' }}
                  >
                    {typeLabels[item.type] || item.type}
                  </span>
                  {item.resource_type && (
                    <Tag color="default" className="!text-gray-500 !text-[10px] !leading-none !py-0">
                      {item.resource_type}
                    </Tag>
                  )}
                </div>
                <p className={`text-sm ${item.is_read ? 'text-gray-400' : 'text-white font-medium'}`}>
                  {item.title}
                </p>
                {item.body && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.body}</p>
                )}
              </div>
              <span className="text-xs text-gray-600 shrink-0 mt-1">{formatDate(item.created_at)}</span>
            </div>
          ))}
        </Card>
      )}

      {total > PAGE_SIZE && (
        <div className="flex justify-center mt-6">
          <Pagination
            current={page}
            total={total}
            pageSize={PAGE_SIZE}
            onChange={setPage}
            showTotal={total => t('paginationTotal', { total })}
          />
        </div>
      )}
    </div>
  );
}
