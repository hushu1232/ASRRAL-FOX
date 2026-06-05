'use client';

import { useState, Suspense } from 'react';
import { Card, Form, Input, Button, App } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

function ResetForm() {
  const t = useTranslations('auth.resetPassword');
  const tForgot = useTranslations('auth.forgotPassword');
  const tCommon = useTranslations('common');
  const { message } = App.useApp();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: { newPassword: string; confirmPassword: string }) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error(t('passwordMismatch'));
      return;
    }
    if (!token) {
      message.error(t('missingToken'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: values.newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        message.success(t('success'));
        router.push('/login');
      } else {
        message.error(data.error || t('resetFailed'));
      }
    } catch {
      message.error(tCommon('networkError'));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <Card className="!border-purple-500/10 w-full max-w-sm" styles={{ body: { background: '#0d0d1a' } }}>
        <h2 className="text-white text-xl font-bold text-center mb-4">{t('invalidToken')}</h2>
        <p className="text-gray-500 text-sm text-center mb-4">{t('expiredToken')}</p>
        <Link href="/forgot-password" className="text-purple-400 hover:text-purple-300 text-sm block text-center">{t('requestAgain')}</Link>
      </Card>
    );
  }

  return (
    <Card className="!border-purple-500/10 w-full max-w-sm" styles={{ body: { background: '#0d0d1a' } }}>
      <h2 className="text-white text-xl font-bold text-center mb-1">{t('title')}</h2>
      <p className="text-gray-500 text-sm text-center mb-6">{t('subtitle')}</p>
      <Form layout="vertical" onFinish={handleSubmit}>
        <Form.Item name="newPassword" rules={[{ required: true, min: 8, message: t('minLength') }]}>
          <Input.Password prefix={<LockOutlined className="text-gray-500" />} placeholder={t('newPasswordPlaceholder')} size="large" />
        </Form.Item>
        <Form.Item name="confirmPassword" rules={[{ required: true, message: t('confirmPassword') }]}>
          <Input.Password prefix={<LockOutlined className="text-gray-500" />} placeholder={t('confirmPasswordPlaceholder')} size="large" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block size="large" loading={loading}>{t('submitButton')}</Button>
        <div className="text-center mt-4">
          <Link href="/login" className="text-gray-500 hover:text-gray-300 text-sm">{tForgot('backToLogin')}</Link>
        </div>
      </Form>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090F] p-4">
      <Suspense fallback={<Card className="!border-purple-500/10 w-full max-w-sm" loading />}>
        <ResetForm />
      </Suspense>
    </div>
  );
}
