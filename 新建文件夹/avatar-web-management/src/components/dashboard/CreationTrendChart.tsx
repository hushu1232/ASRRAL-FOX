// TODO: BEM-migrate
'use client';

import { Empty } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslations } from 'next-intl';

interface Props {
  data: Array<{ date: string; created: number; published: number }>;
}

export default function CreationTrendChart({ data }: Props) {
  const t = useTranslations('dashboard.trends');
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
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.1)" />
        <XAxis dataKey="date" stroke="#5e5e7a" fontSize={12} />
        <YAxis stroke="#5e5e7a" fontSize={12} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: '#12122A', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8 }}
          labelStyle={{ color: '#e8e8f0' }}
        />
        <Line type="monotone" dataKey="created" name={t('created')} stroke="#6d5df0" strokeWidth={2} dot={{ fill: '#6d5df0' }} />
        <Line type="monotone" dataKey="published" name={t('published')} stroke="#4ade80" strokeWidth={2} dot={{ fill: '#4ade80' }} />
      </LineChart>
    </ResponsiveContainer>
    </div>
  );
}