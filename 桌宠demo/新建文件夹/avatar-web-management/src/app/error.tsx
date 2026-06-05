'use client';

import { Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('error');

  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#09090F',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <h2 style={{ color: '#fff', fontSize: 18, marginBottom: 8 }}>{t('pageLoadFailed')}</h2>
        <p style={{ color: '#9ca3af', fontSize: 14, marginBottom: 20 }}>
          {error.message || t('unknownError')}
        </p>
        <Button type="primary" icon={<ReloadOutlined />} onClick={reset}>
          {t('refreshPage')}
        </Button>
      </div>
    </div>
  );
}
