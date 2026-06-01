'use client';

import { Card, Tag, Rate, Empty, Spin, Pagination, Statistic } from 'antd';
import { ShopOutlined, StarFilled, DownloadOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useApiPaginated } from '@/lib/use-api';
import { useApiGet } from '@/lib/use-api';

interface SellerMarketItem {
  id: string;
  title: string;
  category: string;
  price: number;
  currency: string;
  preview_images: string | string[];
  thumbnail_url?: string;
  rating: number;
  download_count: number;
  created_at: string;
}

interface SellerStats {
  totalItems: number;
  approvedItems: number;
  totalDownloads: number;
  totalOrders: number;
  totalRevenue: number;
  monthlyRevenue: number;
}

function parseImages(raw: string | string[]): string[] {
  if (Array.isArray(raw)) return raw;
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr;
  } catch { /* */ }
  return [];
}

export default function SellerShopPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations('seller.shop');
  const tc = useTranslations('seller.center.categories');

  const CATEGORY_LABELS: Record<string, string> = {
    model: tc('model'), personality: tc('personality'), voice: tc('voice'), animation: tc('animation'), theme: tc('theme'),
  };

  function formatPrice(price: number, currency: string): string {
    if (price === 0) return t('free') || '';
    if (currency === 'CNY') return `¥${price}`;
    return `$${(price / 100).toFixed(2)}`;
  }

  const { data: statsData } = useApiGet<SellerStats>(`/api/market/seller/dashboard?userId=${id}`);
  const stats: SellerStats | null = statsData?.success ? (statsData.data as unknown as SellerStats) : null;

  const { data: itemsData, isLoading } = useApiPaginated<SellerMarketItem>(
    '/api/market/items',
    { sellerId: id, pageSize: '12' },
  );
  const items: SellerMarketItem[] = itemsData?.success
    ? (itemsData.data as unknown as { items: SellerMarketItem[] })?.items || []
    : [];

  const sellerUsername = items.length > 0 ? (itemsData?.success ? (itemsData.data as unknown as { items: Array<{ seller_username?: string }> })?.items?.[0]?.seller_username : null) : null;

  return (
    <div>
      <button onClick={() => router.back()} className="mb-4 text-gray-400 hover:text-white text-sm">
        ← {t('back')}
      </button>

      {/* Seller header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-2xl">
          <ShopOutlined className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{t('title', { name: sellerUsername || t('defaultName') })}</h1>
          <div className="flex items-center gap-3 mt-1 text-gray-400 text-sm">
            {stats && (
              <>
                <span>{t('itemCount', { count: stats.approvedItems })}</span>
                <span>·</span>
                <span>{t('downloadCount', { count: stats.totalDownloads })}</span>
                <span>·</span>
                <span>{t('orderCount', { count: stats.totalOrders })}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card size="small" className="!border-purple-500/10">
            <Statistic title={t('totalRevenue')} value={`¥${(stats.totalRevenue / 100).toFixed(0)}`} valueStyle={{ color: '#e8e8f0', fontSize: 18 }} />
          </Card>
          <Card size="small" className="!border-purple-500/10">
            <Statistic title={t('monthlyRevenue')} value={`¥${(stats.monthlyRevenue / 100).toFixed(0)}`} valueStyle={{ color: '#e8e8f0', fontSize: 18 }} />
          </Card>
          <Card size="small" className="!border-purple-500/10">
            <Statistic title={t('totalDownloads')} value={stats.totalDownloads} prefix={<DownloadOutlined />} valueStyle={{ color: '#e8e8f0', fontSize: 18 }} />
          </Card>
          <Card size="small" className="!border-purple-500/10">
            <Statistic title={t('totalOrders')} value={stats.totalOrders} prefix={<ShoppingCartOutlined />} valueStyle={{ color: '#e8e8f0', fontSize: 18 }} />
          </Card>
        </div>
      )}

      <h2 className="text-lg font-bold text-white mb-4">{t('allItems')}</h2>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spin size="large" /></div>
      ) : items.length === 0 ? (
        <Empty description={t('noItems')} className="py-16" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map(item => {
            const images = parseImages(item.preview_images);
            return (
              <Card
                key={item.id}
                hoverable
                className="!border-purple-500/10 hover:!border-purple-500/30 transition-all cursor-pointer"
                onClick={() => router.push(`/marketplace/${item.id}`)}
                cover={
                  <div className="h-44 bg-gradient-to-br from-purple-900/40 to-blue-900/40 flex items-center justify-center relative overflow-hidden">
                    {images.length > 0 ? (
                      <Image src={images[0]} alt={item.title} fill className="object-cover" unoptimized />
                    ) : (
                      <Image src="/images/placeholder-template.svg" alt={item.title} fill className="object-contain p-8 opacity-50" unoptimized />
                    )}
                    <span className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full font-bold ${
                      item.price === 0 ? 'bg-green-500/90 text-black' : 'bg-purple-500/90 text-white'
                    }`}>
                      {formatPrice(item.price, item.currency)}
                    </span>
                  </div>
                }
              >
                <div className="text-white font-medium text-sm mb-1 truncate">{item.title}</div>
                <div className="flex items-center justify-between">
                  <Tag color="purple" className="text-[10px]">{CATEGORY_LABELS[item.category] || item.category}</Tag>
                  <div className="flex items-center gap-1 text-gray-500 text-xs">
                    <Rate disabled value={Math.round(item.rating)} count={5} className="!text-[10px]" style={{ fontSize: 10 }} />
                    <DownloadOutlined className="text-[10px]" />{item.download_count}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
