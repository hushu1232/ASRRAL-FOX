'use client';

import { useState } from 'react';
import { Card, Tabs, Button, Tag, Input, Select, App, Spin, Rate, Empty, Pagination } from 'antd';
import { SearchOutlined, DownloadOutlined, StarFilled } from '@ant-design/icons';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useApiPaginated } from '@/lib/use-api';
import type { PaginatedResponse } from '@/lib/use-api';

interface MarketItem {
  id: string;
  seller_id: string;
  seller_username: string;
  title: string;
  description: string;
  category: string;
  price: number;
  currency: string;
  preview_images: string | string[];
  thumbnail_url?: string;
  rating: number;
  download_count: number;
  applied_count: number;
  status: string;
  created_at: string;
}

interface PreviewImage {
  src: string;
  alt: string;
}

function parseImages(raw: string | string[]): PreviewImage[] {
  try {
    const arr = Array.isArray(raw) ? raw : JSON.parse(raw);
    if (Array.isArray(arr)) return arr.map((s: string) => ({ src: s, alt: '' }));
  } catch { /* use placeholder */ }
  return [];
}

export default function MarketplacePage() {
  const t = useTranslations('marketplace');
  const tc = useTranslations('marketplace.categories');
  const ts = useTranslations('marketplace.sort');
  const { message } = App.useApp();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [sort, setSort] = useState('latest');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const pageSize = 24;

  const CATEGORIES = [
    { key: 'all', label: tc('all') },
    { key: 'model', label: tc('model') },
    { key: 'personality', label: tc('personality') },
    { key: 'voice', label: tc('voice') },
    { key: 'animation', label: tc('animation') },
    { key: 'theme', label: tc('theme') },
  ];

  const SORT_OPTIONS = [
    { value: 'latest', label: ts('latest') },
    { value: 'popular', label: ts('popular') },
    { value: 'rating', label: ts('rating') },
    { value: 'price_asc', label: ts('priceAsc') },
    { value: 'price_desc', label: ts('priceDesc') },
  ];

  function formatPrice(price: number, currency: string): string {
    if (price === 0) return t('free');
    if (currency === 'CNY') return `¥${price}`;
    return `$${(price / 100).toFixed(2)}`;
  }

  const params: Record<string, string> = { page: String(page), pageSize: String(pageSize), sort };
  if (activeTab !== 'all') params.category = activeTab;
  if (search) params.search = search;

  const { data, isLoading } = useApiPaginated<MarketItem>('/api/market/items', params);
  const items: MarketItem[] = data?.success ? (data.data as unknown as { items: MarketItem[] })?.items || [] : [];
  const total = data?.success ? (data.data as unknown as { total: number })?.total ?? 0 : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
        <Button type="primary" onClick={() => router.push('/marketplace/new')} className="bg-gradient-to-r from-purple-600 to-blue-600 border-0">
          {t('listItem')}
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          placeholder={t('searchPlaceholder')}
          prefix={<SearchOutlined className="text-gray-500" />}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onPressEnter={() => { setSearch(searchValue); setPage(1); }}
          className="w-full sm:max-w-xs"
          allowClear
          onClear={() => { setSearchValue(''); setSearch(''); setPage(1); }}
        />
        <Button
          className="sm:hidden"
          icon={<SearchOutlined />}
          onClick={() => setShowFilters(!showFilters)}
        >
          {t('filters')}
        </Button>
        <div className={`${showFilters ? 'flex' : 'hidden'} sm:flex flex-wrap gap-3`}>
          <Select
            value={sort}
            onChange={setSort}
            options={SORT_OPTIONS}
            className="w-40"
          />
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(k) => { setActiveTab(k); setPage(1); }}
        items={CATEGORIES.map(cat => ({ key: cat.key, label: cat.label }))}
        className="mb-6"
      />

      {isLoading ? (
        <div className="flex justify-center py-20"><Spin size="large" /></div>
      ) : items.length === 0 ? (
        <Empty description={t('noItems')} className="py-20" />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map(item => {
              const images = parseImages(item.preview_images);
              const hasPreview = images.length > 0;
              return (
                <Card
                  key={item.id}
                  hoverable
                  className="!border-purple-500/10 hover:!border-purple-500/30 transition-all cursor-pointer"
                  onClick={() => router.push(`/marketplace/${item.id}`)}
                  cover={
                    <div className="h-44 bg-gradient-to-br from-purple-900/40 to-blue-900/40 flex items-center justify-center relative overflow-hidden">
                      {hasPreview ? (
                        <Image
                          src={images[0].src}
                          alt={item.title}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <Image
                          src="/images/placeholder-template.svg"
                          alt={item.title}
                          fill
                          className="object-contain p-8 opacity-50"
                          unoptimized
                        />
                      )}
                      <span className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full font-bold ${
                        item.price === 0
                          ? 'bg-green-500/90 text-black'
                          : 'bg-purple-500/90 text-white'
                      }`}>
                        {formatPrice(item.price, item.currency)}
                      </span>
                    </div>
                  }
                >
                  <div className="text-white font-medium text-sm mb-1 truncate">{item.title}</div>
                  <div className="flex items-center justify-between text-gray-500 text-xs mb-1">
                    <span
                      className="text-purple-400 hover:text-purple-300 hover:underline truncate max-w-[120px]"
                      onClick={(e) => { e.stopPropagation(); router.push(`/marketplace/seller/${item.seller_id}`); }}
                    >
                      {item.seller_username}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <DownloadOutlined className="text-xs" />
                      {item.download_count}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Rate disabled value={Math.round(item.rating)} count={5} className="!text-xs" style={{ fontSize: 12 }} />
                    <span className="text-gray-500 text-xs">({item.rating.toFixed(1)})</span>
                  </div>
                </Card>
              );
            })}
          </div>
          {total > pageSize && (
            <div className="flex justify-center mt-6">
              <Pagination
                current={page}
                total={total}
                pageSize={pageSize}
                onChange={setPage}
                showTotal={total => t('paginationTotal', { total })}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
