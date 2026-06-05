'use client';

import { useState } from 'react';
import { Card, Input, Select, Button, Space, Tag, Pagination, App, Spin } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, CopyOutlined, DeleteOutlined, RobotOutlined, ShopOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { AVATAR_STYLES, AVATAR_STATUS_MAP } from '@/lib/constants';
import { apiPost, apiDelete } from '@/lib/api-client';
import { useApiPaginated } from '@/lib/use-api';
import type { PaginatedResponse } from '@/lib/use-api';

interface AvatarListItem {
  id: string;
  name: string;
  style: string;
  status: string;
  updated_at: string;
  creator_id: string;
}

export default function AvatarManagerPage() {
  const t = useTranslations('avatars');
  const tc = useTranslations('common');
  const { message } = App.useApp();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [styleFilter, setStyleFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const STATUS_OPTIONS = [
    { value: 'draft', label: t('status.draft') },
    { value: 'published', label: t('status.published') },
    { value: 'pending_review', label: t('status.pending_review') },
    { value: 'archived', label: t('status.archived') },
  ];

  const params: Record<string, string> = {
    page: String(page),
    pageSize: String(pageSize),
  };
  if (search) params.search = search;
  if (statusFilter) params.status = statusFilter;

  const { data, isLoading, mutate } = useApiPaginated<AvatarListItem>('/api/avatars', params);

  const rawItems = data?.success ? data.data?.items || [] : [];
  const rawTotal = data?.success ? (data.data?.total ?? 0) : 0;

  // Client-side style filter
  const filteredItems = styleFilter
    ? rawItems.filter((a) => a.style === styleFilter)
    : rawItems;
  const total = styleFilter ? filteredItems.length : rawTotal;

  const handleCreate = async () => {
    try {
      const res = await apiPost<{ id: string }>('/api/avatars', {
        name: t('createNew'),
        style: 'anime',
        base_model: 'female',
      });
      if (res.success) {
        message.success(t('create.success'));
        router.push(`/avatars/${res.data.id}/edit`);
      } else {
        message.error(res.error || tc('operationFailed'));
      }
    } catch {
      router.push('/avatars/new/edit');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await apiDelete<null>(`/api/avatars/${id}`);
      if (res.success) {
        message.success(t('deleteSuccess'));
        mutate();
      } else {
        message.error(res.error || tc('operationFailed'));
      }
    } catch {
      message.error(tc('networkError'));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} size="large">
          {t('createNew')}
        </Button>
      </div>

      <Card className="!border-purple-500/10 mb-4">
        <Space wrap size="middle">
          <Input
            prefix={<SearchOutlined />}
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ width: 220 }}
          />
          <Select
            placeholder={t('filterByStatus')}
            value={statusFilter || undefined}
            onChange={(v) => { setStatusFilter(v || ''); setPage(1); }}
            allowClear
            style={{ width: 140 }}
            options={STATUS_OPTIONS}
          />
          <Select
            placeholder={t('filterByStyle')}
            value={styleFilter || undefined}
            onChange={(v) => { setStyleFilter(v || ''); setPage(1); }}
            allowClear
            style={{ width: 140 }}
            options={[...AVATAR_STYLES]}
          />
        </Space>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spin size="large" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg mb-2">{t('noAvatars')}</p>
          <p className="text-sm">{t('createFirstHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((avatar) => (
            <Card
              key={avatar.id}
              hoverable
              className="!border-purple-500/10 hover:!border-purple-500/30 transition-all"
              cover={
                <div
                  className="h-40 relative flex items-center justify-center cursor-pointer overflow-hidden bg-gradient-to-br from-purple-900/30 to-blue-900/30"
                  onClick={() => router.push(`/avatars/${avatar.id}/edit`)}
                >
                  <Image
                    src="/images/placeholder-model.svg"
                    alt={avatar.name}
                    fill
                    className="object-contain p-6 opacity-50"
                    unoptimized
                  />
                </div>
              }
              actions={[
                <EditOutlined key="edit" onClick={() => router.push(`/avatars/${avatar.id}/edit`)} aria-label={tc('edit')} />,
                <CopyOutlined key="copy" onClick={() => message.info(tc('copied'))} aria-label={tc('copy')} />,
                <DeleteOutlined key="delete" onClick={() => handleDelete(avatar.id)} aria-label={tc('delete')} />,
                <ShopOutlined key="sell" onClick={() => router.push(`/marketplace/new?from=avatar&avatarId=${avatar.id}&title=${encodeURIComponent(avatar.name)}`)} aria-label={t('sellOnMarket')} />,
                <RobotOutlined key="pet" onClick={async () => {
                  try {
                    const res = await apiPost(`/api/pet/set-avatar`, { avatarId: avatar.id });
                    if (res.success) message.success(t('setAsPetSuccess'));
                    else message.error(res.error || t('setAsPetFailed'));
                  } catch { message.error(tc('networkError')); }
                }} aria-label={t('setAsPet')} />,
              ]}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-white font-medium text-sm truncate">{avatar.name}</span>
                <Tag color={AVATAR_STATUS_MAP[avatar.status]?.color}>
                  {AVATAR_STATUS_MAP[avatar.status]?.label || avatar.status}
                </Tag>
              </div>
              <div className="text-gray-500 text-xs">
                {AVATAR_STYLES.find((s) => s.value === avatar.style)?.label || avatar.style} · {avatar.updated_at}
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-center mt-6">
        <Pagination
          current={page}
          total={total}
          pageSize={pageSize}
          onChange={(p) => setPage(p)}
          showTotal={(total) => t('paginationTotal', { count: total })}
        />
      </div>
    </div>
  );
}
