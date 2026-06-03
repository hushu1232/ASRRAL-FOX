// TODO: BEM-migrate
'use client';

import { Empty } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslations } from 'next-intl';

interface Props {
  data: Array<{ name: string; count: number }>;
}

export default function PartUsageChart({ data }: Props) {
  const t = useTranslations('dashboard.partUsage');
  const tc = useTranslations('common');

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[240px]">
        <Empty description={tc('noData')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  return (
    <div role="img" aria-label={t('chartLabel')}>
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.1)" />
        <XAxis type="number" stroke="#5e5e7a" fontSize={12} allowDecimals={false} />
        <YAxis dataKey="name" type="category" stroke="#5e5e7a" fontSize={12} width={60} />
        <Tooltip
          contentStyle={{ background: '#12122A', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8 }}
          labelStyle={{ color: '#e8e8f0' }}
        />
        <Bar dataKey="count" name={t('count')} fill="#6d5df0" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
    </div>
  );
}