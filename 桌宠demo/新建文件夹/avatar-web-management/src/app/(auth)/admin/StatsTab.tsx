'use client';

import { useEffect, useState } from 'react';
import { Card, Statistic, Spin } from 'antd';
import {
  UserOutlined, PictureOutlined, CloudOutlined, ClockCircleOutlined,
  ShopOutlined, DollarOutlined, ShoppingCartOutlined, FileAddOutlined,
  AuditOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { apiGet } from '@/lib/api-client';

interface AdminStats {
  totalUsers: number;
  totalAvatars: number;
  totalAssets: number;
  pendingReviews: number;
  totalStorage: number;
  createdThisMonth: number;
  marketItemsTotal?: number;
  marketItemsPending?: number;
  ordersTotal?: number;
  ordersCompleted?: number;
  revenueTotal?: number;
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatMoney(cents: number) {
  return `¥${(cents / 100).toLocaleString()}`;
}

export default function StatsTab() {
  const t = useTranslations('admin.stats');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiGet<AdminStats>('/api/admin/stats').then(res => {
      if (res.success) setStats(res.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Spin /></div>;
  if (!stats) return <div className="text-center text-gray-500 py-12">{t('loadFailed')}</div>;

  const platformCards = [
    { title: t('totalUsers'), value: stats.totalUsers, icon: <UserOutlined />, color: '#6d5df0' },
    { title: t('totalAvatars'), value: stats.totalAvatars, icon: <PictureOutlined />, color: '#3b82f6' },
    { title: t('totalAssets'), value: stats.totalAssets, icon: <FileAddOutlined />, color: '#8b5cf6' },
    { title: t('createdThisMonth'), value: stats.createdThisMonth, icon: <ClockCircleOutlined />, color: '#f59e0b' },
    { title: t('pendingReviews'), value: stats.pendingReviews, icon: <AuditOutlined />, color: '#ef4444' },
    { title: t('storageUsed'), value: formatBytes(stats.totalStorage), icon: <CloudOutlined />, color: '#4ade80' },
  ];

  const marketCards = [
    { title: t('marketItemsTotal'), value: stats.marketItemsTotal ?? '-', icon: <ShopOutlined />, color: '#ec4899' },
    { title: t('marketItemsPending'), value: stats.marketItemsPending ?? '-', icon: <AuditOutlined />, color: '#f97316' },
    { title: t('ordersTotal'), value: stats.ordersTotal ?? '-', icon: <ShoppingCartOutlined />, color: '#06b6d4' },
    { title: t('ordersCompleted'), value: stats.ordersCompleted ?? '-', icon: <CheckCircleOutlined />, color: '#22c55e' },
    { title: t('revenueTotal'), value: stats.revenueTotal !== undefined ? formatMoney(stats.revenueTotal) : '-', icon: <DollarOutlined />, color: '#eab308' },
  ];

  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-4">{t('platformOverview')}</h2>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {platformCards.map(c => (
          <Card key={c.title} className="!border-purple-500/10">
            <Statistic
              title={<span className="text-gray-400 text-xs">{c.title}</span>}
              value={c.value}
              prefix={<span style={{ color: c.color }}>{c.icon}</span>}
              valueStyle={{ color: '#e8e8f0', fontSize: 24, fontWeight: 700 }}
            />
          </Card>
        ))}
      </div>

      <h2 className="text-lg font-bold text-white mb-4">{t('marketData')}</h2>
      <div className="grid grid-cols-3 gap-4">
        {marketCards.map(c => (
          <Card key={c.title} className="!border-purple-500/10">
            <Statistic
              title={<span className="text-gray-400 text-xs">{c.title}</span>}
              value={c.value}
              prefix={<span style={{ color: c.color }}>{c.icon}</span>}
              valueStyle={{ color: '#e8e8f0', fontSize: 24, fontWeight: 700 }}
            />
          </Card>
        ))}
      </div>
    </div>
  );
}
