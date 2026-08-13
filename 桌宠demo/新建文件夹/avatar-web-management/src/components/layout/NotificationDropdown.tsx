// TODO: BEM-migrate
'use client';

import { useState } from 'react';
import { Dropdown, Badge, Button, Spin, Empty, App } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { apiPut } from '@/lib/api-client';
import { useApiGet } from '@/lib/use-api';
import type { ApiResponse } from '@/lib/api-client';

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
  system: 'var(--accent)',
  review: 'var(--warning)',
  comment: 'var(--info)',
  share: 'var(--success)',
  storage: 'var(--danger)',
  market_purchase: 'var(--success)',
  pet_applied: '#eb2f96',  // no exact semantic var — keep hex for unique color
  market_sale: 'var(--warning)',
  asset_takedown: 'var(--danger)',
};

export default function NotificationDropdown() {
  const t = useTranslations('notifications');
  const tHeader = useTranslations('layout.header');
  const { message } = App.useApp();

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
  const [open, setOpen] = useState(false);
  const { data: unreadData, mutate: mutateUnread } = useApiGet<{ count: number }>(
    '/api/notifications/unread-count',
  );
  const { data: listData, isLoading: loading, mutate: mutateList } = useApiGet<{ items: NotificationItem[] }>(
    open ? '/api/notifications' : null,
    { pageSize: '10' },
  );
  const unread = unreadData?.success ? (unreadData.data?.count ?? 0) : 0;
  const notifs = listData?.success ? (listData.data?.items ?? []) : [];

  const handleOpen = (v: boolean) => {
    setOpen(v);
  };

  const handleReadOne = async (id: string) => {
    const res = await apiPut(`/api/notifications/${id}/read`);
    if (!res.success) return;

    await mutateList((current?: ApiResponse<{ items: NotificationItem[] }>) => current?.success
      ? { ...current, data: { items: current.data.items.map(n => n.id === id ? { ...n, is_read: 1 } : n) } }
      : current,
    { revalidate: true });
    void mutateUnread();
  };

  const handleReadAll = async () => {
    const res = await apiPut('/api/notifications/read-all');
    if (res.success) {
      await mutateList((current?: ApiResponse<{ items: NotificationItem[] }>) => current?.success
        ? { ...current, data: { items: current.data.items.map(n => ({ ...n, is_read: 1 })) } }
        : current,
      { revalidate: true });
      await mutateUnread({ success: true, data: { count: 0 } }, { revalidate: true });
      message.success(t('allRead'));
    }
  };

  const dropdownContent = (
    <div
      className="w-80 rounded-lg overflow-hidden"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}
    >
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{t('title')}</span>
        {unread > 0 && (
          <Button type="link" size="small" icon={<CheckOutlined />} onClick={handleReadAll}>{t('markAllRead')}</Button>
        )}
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Spin size="small" /></div>
      ) : notifs.length === 0 ? (
        <Empty description={t('noNotifications')} image={Empty.PRESENTED_IMAGE_SIMPLE} className="py-4" />
      ) : (
        <div className="max-h-80 overflow-y-auto">
          {notifs.map(item => (
            <div
              key={item.id}
              className="px-4 py-3 cursor-pointer transition-colors"
              style={{
                background: item.is_read ? 'transparent' : 'var(--bg-card-hover)',
                borderBottom: '1px solid var(--border-subtle)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = item.is_read ? 'transparent' : 'var(--bg-card-hover)'; }}
              onClick={() => handleReadOne(item.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleReadOne(item.id); } }}
              role="button"
              tabIndex={0}
              aria-label={`${typeLabels[item.type] || item.type}: ${item.title}`}
            >
              <div className="flex items-start gap-3">
                <span className="w-2 h-2 mt-1.5 rounded-full shrink-0" style={{ backgroundColor: item.is_read ? 'transparent' : typeColors[item.type] || '#d97706' }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: typeColors[item.type], background: typeColors[item.type] + '1a' }}>
                      {typeLabels[item.type] || item.type}
                    </span>
                  </div>
                  <p className="text-sm mt-1" style={{ color: item.is_read ? 'var(--text-muted)' : 'var(--text-primary)' }}>{item.title}</p>
                  {item.body && <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{item.body}</p>}
                  <span className="text-xs mt-1 block" style={{ color: 'var(--text-muted)' }}>{item.created_at}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Dropdown
      open={open}
      onOpenChange={handleOpen}
      popupRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomRight"
    >
      <Badge count={unread} size="small" offset={[-2, 2]}>
        <BellOutlined className="text-lg cursor-pointer transition-colors" style={{ color: 'var(--text-secondary)' }} aria-label={tHeader('notifications')} role="button" tabIndex={0} />
      </Badge>
    </Dropdown>
  );
}
