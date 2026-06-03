// TODO: BEM-migrate
'use client';

import { Card, Statistic } from 'antd';
import { PictureOutlined, FileAddOutlined, ClockCircleOutlined, CloudOutlined, ShopOutlined, DollarOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

interface Props {
  totalAvatars: number;
  createdThisMonth: number;
  pendingReviews: number;
  totalStorage: number;
  marketItemsCount?: number;
  marketRevenue?: number;
}

export default function KpiCards({ totalAvatars, createdThisMonth, pendingReviews, totalStorage, marketItemsCount, marketRevenue }: Props) {
  const t = useTranslations('dashboard.kpi');

  const kpis = [
    { title: t('totalAvatars'), value: totalAvatars, icon: <PictureOutlined />, color: '#6d5df0' },
    { title: t('thisMonthCreations'), value: createdThisMonth, icon: <FileAddOutlined />, color: '#3b82f6' },
    { title: t('approvalPending'), value: pendingReviews, icon: <ClockCircleOutlined />, color: '#f59e0b' },
    { title: t('storageUsed'), value: formatBytes(totalStorage), icon: <CloudOutlined />, color: '#4ade80' },
    ...(marketItemsCount !== undefined ? [
      { title: t('marketItems'), value: marketItemsCount, icon: <ShopOutlined />, color: '#8b5cf6' },
    ] : []),
    ...(marketRevenue !== undefined ? [
      { title: t('marketRevenue'), value: `¥${marketRevenue.toLocaleString()}`, icon: <DollarOutlined />, color: '#ec4899' },
    ] : []),
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
      {kpis.map((kpi) => (
        <Card key={kpi.title} style={{ borderColor: 'var(--border-subtle)' }} className="transition-colors">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-lg text-lg"
              style={{ background: `${kpi.color}20`, color: kpi.color }}
            >
              {kpi.icon}
            </div>
            <div className="flex-1 min-w-0">
              <Statistic
                title={<span className="text-gray-400 text-xs">{kpi.title}</span>}
                value={kpi.value}
                valueStyle={{ color: '#e8e8f0', fontSize: 22, fontWeight: 700 }}
              />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}