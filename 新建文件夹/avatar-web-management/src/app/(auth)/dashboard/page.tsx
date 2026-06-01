'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, Spin } from 'antd';
import { useTranslations } from 'next-intl';
import KpiCards from '@/components/dashboard/KpiCards';
import RecentAvatars from '@/components/dashboard/RecentAvatars';
import dynamic from 'next/dynamic';
import { apiGet } from '@/lib/api-client';
import { dashboardReveal } from '@/lib/motion';

const CreationTrendChart = dynamic(() => import('@/components/dashboard/CreationTrendChart'), { ssr: false });
const PartUsageChart = dynamic(() => import('@/components/dashboard/PartUsageChart'), { ssr: false });

interface DashboardData {
  totalAvatars: number;
  createdThisMonth: number;
  pendingReviews: number;
  totalStorage: number;
  marketItemsCount?: number;
  marketRevenue?: number;
  recentAvatars: Array<{ id: string; name: string; style: string; status: string; updated_at: string }>;
  trend: Array<{ date: string; created: number; published: number }>;
  partUsage: Array<{ name: string; count: number }>;
}

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<DashboardData>('/api/dashboard/stats').then(res => {
      if (res.success) setData(res.data);
    }).finally(() => setLoading(false));
  }, []);

  const dashRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!loading && dashRef.current) dashboardReveal(dashRef.current); }, [loading]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" style={{ color: 'var(--ds-colors-text-muted)' }}>
        {tCommon('networkError')}
      </div>
    );
  }

  return (
    <div ref={dashRef}>
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--ds-colors-text-primary)' }}>{t('title')}</h1>
      <KpiCards
        totalAvatars={data.totalAvatars}
        createdThisMonth={data.createdThisMonth}
        pendingReviews={data.pendingReviews}
        totalStorage={data.totalStorage}
        marketItemsCount={data.marketItemsCount}
        marketRevenue={data.marketRevenue}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card title={t('trends.title')} className="!border-purple-500/10">
          {data.trend.length > 0 ? (
            <CreationTrendChart data={data.trend} />
          ) : (
            <div className="h-[240px] flex items-center justify-center text-gray-500 text-sm">{tCommon('noData')}</div>
          )}
        </Card>
        <Card title={t('partUsage.title')} className="!border-purple-500/10">
          {data.partUsage.length > 0 ? (
            <PartUsageChart data={data.partUsage} />
          ) : (
            <div className="h-[240px] flex items-center justify-center text-gray-500 text-sm">{tCommon('noData')}</div>
          )}
        </Card>
      </div>
      <RecentAvatars data={data.recentAvatars} />
    </div>
  );
}
