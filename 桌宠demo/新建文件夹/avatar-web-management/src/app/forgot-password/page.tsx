'use client';

import { useState } from 'react';
import { Card, Form, Input, Button, App } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth.forgotPassword');
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (values: { email: string }) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email }),
      });
      const data = await res.json();
      if (data.success) {
        setSent(true);
      } else {
        message.error(data.error || t('requestFailed'));
      }
    } catch {
      message.error(t('requestFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090F] p-4">
      <Card className="!border-purple-500/10 w-full max-w-sm" styles={{ body: { background: '#0d0d1a' } }}>
        <h2 className="text-white text-xl font-bold text-center mb-1">{t('title')}</h2>
        <p className="text-gray-500 text-sm text-center mb-6">{t('subtitle')}</p>

        {sent ? (
          <div className="text-center">
            <div className="text-green-400 text-5xl mb-4">✓</div>
            <p className="text-white mb-2">{t('sendSuccess')}</p>
            <p className="text-gray-500 text-sm mb-4">{t('checkEmail')}</p>
            <Link href="/login" className="text-purple-400 hover:text-purple-300 text-sm">{t('backToLogin')}</Link>
          </div>
        ) : (
          <Form layout="vertical" onFinish={handleSubmit}>
            <Form.Item name="email" rules={[{ required: true, type: 'email', message: t('emailInvalid') }]}>
              <Input prefix={<MailOutlined className="text-gray-500" />} placeholder={t('emailPlaceholder')} size="large" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>{t('sendButton')}</Button>
            <div className="text-center mt-4">
              <Link href="/login" className="text-gray-500 hover:text-gray-300 text-sm">{t('backToLogin')}</Link>
            </div>
          </Form>
        )}
      </Card>
    </div>
  );
}
