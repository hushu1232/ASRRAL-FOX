'use client';

import { Card } from 'antd';
import { PictureOutlined, FileAddOutlined, ClockCircleOutlined, CloudOutlined, ShopOutlined, DollarOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

interface KpiDefinition {
  key: string;
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  /** Trend data for sparkline (array of { value: number }) */
  sparklineData?: Array<{ value: number }>;
  /** Month-over-month change as a decimal (e.g., 0.125 = +12.5%). undefined = no comparison available */
  momChange?: number;
}

interface Props {
  totalAvatars: number;
  createdThisMonth: number;
  pendingReviews: number;
  totalStorage: number;
  marketItemsCount?: number;
  marketRevenue?: number;
  /** Optional 30-day trend data for sparklines, indexed by metric key */
  trendData?: Record<string, Array<{ date: string; value: number }>>;
  /** Previous month counts for环比 calculation */
  prevMonth?: { totalAvatars: number; created: number; reviews: number; storage: number };
}

export default function KpiCards({
  totalAvatars,
  createdThisMonth,
  pendingReviews,
  totalStorage,
  marketItemsCount,
  marketRevenue,
  trendData,
  prevMonth,
}: Props) {
  const t = useTranslations('dashboard.kpi');

  const kpis: KpiDefinition[] = [
    {
      key: 'avatars', title: t('totalAvatars'), value: totalAvatars,
      icon: <PictureOutlined />, color: '#6d5df0',
      sparklineData: trendData?.avatars,
      momChange: prevMonth ? ((totalAvatars - prevMonth.totalAvatars) / Math.max(prevMonth.totalAvatars, 1)) : undefined,
    },
    {
      key: 'created', title: t('thisMonthCreations'), value: createdThisMonth,
      icon: <FileAddOutlined />, color: '#3b82f6',
      sparklineData: trendData?.created,
      momChange: prevMonth ? ((createdThisMonth - prevMonth.created) / Math.max(prevMonth.created, 1)) : undefined,
    },
    {
      key: 'reviews', title: t('approvalPending'), value: pendingReviews,
      icon: <ClockCircleOutlined />, color: '#f59e0b',
      sparklineData: trendData?.reviews,
      momChange: prevMonth ? ((pendingReviews - prevMonth.reviews) / Math.max(prevMonth.reviews, 1)) : undefined,
    },
    {
      key: 'storage', title: t('storageUsed'), value: formatBytes(totalStorage),
      icon: <CloudOutlined />, color: '#4ade80',
      sparklineData: trendData?.storage,
      momChange: prevMonth ? ((totalStorage - prevMonth.storage) / Math.max(prevMonth.storage, 1)) : undefined,
    },
    ...(marketItemsCount !== undefined ? [{
      key: 'marketItems', title: t('marketItems'), value: marketItemsCount,
      icon: <ShopOutlined />, color: '#8b5cf6',
    }] : []),
    ...(marketRevenue !== undefined ? [{
      key: 'revenue', title: t('marketRevenue'), value: `¥${marketRevenue.toLocaleString()}`,
      icon: <DollarOutlined />, color: '#ec4899',
    }] : []),
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
      {kpis.map((kpi) => (
        <Card
          key={kpi.key}
          className="transition-all hover:shadow-md"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
        >
          <div className="flex items-start justify-between mb-2">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-lg text-lg shrink-0"
              style={{ background: `${kpi.color}18`, color: kpi.color }}
            >
              {kpi.icon}
            </div>
            {/* Sparkline */}
            {kpi.sparklineData && kpi.sparklineData.length > 1 && (
              <div className="w-16 h-8">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={kpi.sparklineData}>
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={kpi.color}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Main value */}
          <div
            className="text-2xl font-bold mb-1 truncate"
            style={{ color: 'var(--text-primary)' }}
          >
            {kpi.value}
          </div>

          {/* Title +环比 change */}
          <div className="flex items-center gap-2">
            <span
              className="text-xs truncate"
              style={{ color: 'var(--text-muted)' }}
            >
              {kpi.title}
            </span>
            {kpi.momChange !== undefined && kpi.momChange !== 0 && (
              <span
                className="text-xs font-medium"
                style={{
                  color: kpi.momChange > 0 ? 'var(--success)' : 'var(--danger)',
                }}
              >
                {kpi.momChange > 0 ? '↑' : '↓'} {Math.abs(kpi.momChange * 100).toFixed(1)}%
              </span>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
