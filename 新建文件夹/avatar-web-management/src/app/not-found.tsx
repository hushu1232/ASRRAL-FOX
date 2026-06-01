'use client';

import Link from 'next/link';
import { Button } from 'antd';
import { HomeOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';

export default function NotFound() {
  const t = useTranslations('error');

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090F]">
      <div className="text-center max-w-md px-6">
        <div className="text-8xl font-bold text-purple-400/10 mb-6">404</div>
        <h2 className="text-xl font-bold text-white mb-2">{t('pageNotFound')}</h2>
        <p className="text-gray-400 text-sm mb-6">
          {t('pageNotFoundDesc')}
        </p>
        <Link href="/dashboard">
          <Button type="primary" icon={<HomeOutlined />} size="large">
            {t('backToDashboard')}
          </Button>
        </Link>
      </div>
    </div>
  );
}
