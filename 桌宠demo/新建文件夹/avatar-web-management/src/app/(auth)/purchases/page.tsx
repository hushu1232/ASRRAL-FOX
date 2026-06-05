'use client';

import { useState } from 'react';
import { Card, Tag, Spin, Pagination, Empty } from 'antd';
import { ShoppingCartOutlined, DownloadOutlined, RobotOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useApiPaginated } from '@/lib/use-api';
import { apiPost, apiGet } from '@/lib/api-client';
import { App } from 'antd';

interface PurchaseItem {
  orderId: string;
  amount: number;
  status: string;
  createdAt: string;
  item: {
    id: string;
    title: string;
    category: string;
    price: number;
    currency: string;
    thumbnailUrl: string | null;
    status: string;
  };
}

const orderStatusColors: Record<string, string> = {
  completed: 'green', pending: 'orange', refunded: 'red',
};

const PAGE_SIZE = 12;

export default function PurchasesPage() {
  const router = useRouter();
  const t = useTranslations('purchases');
  const tc = useTranslations('purchases.categories');
  const { message } = App.useApp();
  const [page, setPage] = useState(1);

  const categoryLabels: Record<string, string> = {
    model: tc('model'), personality: tc('personality'), voice: tc('voice'), animation: tc('animation'), theme: tc('theme'),
  };

  const statusLabels: Record<string, string> = {
    completed: t('statusCompleted'),
    pending: t('statusPending'),
    refunded: t('statusRefunded'),
  };

  const { data, isLoading } = useApiPaginated<PurchaseItem>('/api/market/purchases', {
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });

  const items = data?.success ? data.data?.items || [] : [];
  const total = data?.success ? (data.data?.total ?? 0) : 0;

  const handleApplyToPet = async (itemId: string) => {
    try {
      const res = await apiPost('/api/pet/set-avatar', { avatarId: itemId });
      if (res.success) message.success(t('applySuccess'));
      else message.error(res.error || t('applyFailed'));
    } catch { message.error(t('requestFailed')); }
  };

  const handleDownload = async (itemId: string) => {
    try {
      const res = await apiGet<{ files: Array<{ key: string; url: string }> }>(`/api/market/downloads/${itemId}`);
      if (res.success && res.data?.files) {
        for (const file of res.data.files) {
          window.open(file.url, '_blank');
        }
        message.success(t('downloadStarted', { count: res.data.files.length }));
      } else {
        message.error(res.error || t('downloadFailed'));
      }
    } catch { message.error(t('networkError')); }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">{t('title')}</h1>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spin size="large" /></div>
      ) : items.length === 0 ? (
        <Card className="!border-purple-500/10">
          <Empty
            image={<ShoppingCartOutlined className="text-6xl text-gray-600" />}
            description={<span className="text-gray-500">{t('noPurchases')}</span>}
          >
            <span
              className="text-purple-400 cursor-pointer hover:text-purple-300"
              onClick={() => router.push('/marketplace')}
            >
              {t('goShopping')}
            </span>
          </Empty>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(purchase => (
            <Card
              key={purchase.orderId}
              hoverable
              className="!border-purple-500/10 hover:!border-purple-500/30 transition-all"
              onClick={() => router.push(`/marketplace/${purchase.item.id}`)}
            >
              <div className="flex items-start gap-3">
                <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-purple-900/40 to-blue-900/40 flex items-center justify-center shrink-0">
                  <DownloadOutlined className="text-2xl text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">{purchase.item.title}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Tag color="purple">{categoryLabels[purchase.item.category] || purchase.item.category}</Tag>
                    {purchase.item.price > 0 ? (
                      <span className="text-purple-400 text-xs">
                        {purchase.item.currency === 'CNY' ? '¥' : '$'}{(purchase.item.price / 100).toFixed(0)}
                      </span>
                    ) : (
                      <span className="text-green-400 text-xs">{t('free')}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Tag color={orderStatusColors[purchase.status]}>
                      {statusLabels[purchase.status] || purchase.status}
                    </Tag>
                    <span className="text-gray-500 text-xs">
                      {new Date(purchase.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-3" onClick={e => e.stopPropagation()}>
                {purchase.item.category === 'model' && (
                  <button
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors border border-purple-500/20"
                    onClick={() => handleApplyToPet(purchase.item.id)}
                  >
                    <RobotOutlined /> {t('apply')}
                  </button>
                )}
                <button
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors border border-blue-500/20"
                  onClick={() => handleDownload(purchase.item.id)}
                >
                  <DownloadOutlined /> {t('download')}
                </button>
              </div>
            </Card>
          ))}
        </div>
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
